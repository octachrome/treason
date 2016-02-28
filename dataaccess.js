'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();
var treasonDb = pr.wrapAll(connection.database('treason_db'));

var debugMode = false;

var globalPlayerRankings = [];
var playerRanksToReturn = 10;

var ready = treasonDb.exists().then(function (exists) {
    if (!exists) {
        return treasonDb.create();
    }
}).then(function() {
    debug('All databases initialised');
}).then(function() {
    debug('Initialising views');
    if (debugMode) {
        debug('Recreating views because of debug mode');
        return treasonDb.save('_design/games', {
            all_games: {
                map: function (document) {
                    if (document.players && document.playerRank) {
                        emit(null, document);
                    }
                }
            },
            player_wins: {
                map: function (document) {
                    if (document.players && document.playerRank) {
                        emit(document.playerRank[0], document);
                    }
                }
            },
            all_players: {
                map: function (document) {
                    //This sucks, fix it, so easy to get collisions
                    if (document.name) {
                        emit(null, document);
                    }
                }
            }
        });
    }
}).then(function() {
    debug('Finished initialising views, databases ready');
}).catch(function(error) {
    debug('Failed to initialise database(s)');
    debug(error);
});

updatePlayerRankings();

var register = function (id, name) {
    return ready.then(function() {
        debug('Player ' + name + ', trying to register with id ' + id);

        if (!id) {
            id = -1;
        }

        return treasonDb.get(id)
            .then(function (result) {
                if (result.name != name) {
                    debug('Updating name of player ' + result.name + ' to ' + name);
                    return treasonDb.merge(id, {
                        name: name
                    }).then(function (result) {
                        debug('Updated name of playerId ' + id + ' to ' + name);
                    }).catch(function (error) {
                        debug('Failed to update player.');
                        debug(error);
                    });
                }
            })
            .then(function () {
                debug('Existing player ' + name + ' logged in with id ' + id);
            })
            .catch(function (error) {
                //failed to find the player, recreate with new id
                debug('Id ' + id + ' not recognised, recreating');
                id = crypto.randomBytes(32).toString('hex');

                debug('Saving new id ' + id + ' for player ' + name);
                return treasonDb.save(id, {
                    name: name
                }).then(function (result) {
                    debug('Allocated new id ' + id + ' to player: ' + name);
                }).catch(function (error) {
                    debug('Failed to save player');
                    debug(error);
                });
            })
            .then(function() {
                return id;
            });
    });
};

/**
 * Captures statistics about each game.
 * PlayerRank is ordered by the first outgoing player being last in the array, with the winner first and no disconnects.
 * @type {{players: number, onlyHumans: boolean, playerRank: Array, bluffs: number, challenges: number, moves: number}}
 */
var constructGameStats = function() {
    return {
        players: 0,
        onlyHumans: true,
        playerRank: [],
        bluffs: 0,
        challenges: 0,
        moves: 0
    };
};

var recordGameData = function (gameData) {
    return ready.then(function () {
        return treasonDb.save(gameData).then(function (result) {
            debug('saved game data');
            updatePlayerRankings();
        }).catch(function (error) {
            debug('failed to save game data');
            debug(error);
        });
    });
};

var getPlayerWins = function (playerId) {
    return ready.then(function () {
        return treasonDb.view('games/player_wins', {key: playerId} ).then(function (result) {
            var wins = 0;
            var winsAI = 0;
            result.forEach(function (row) {
                wins++;
                if (!row.onlyHumans) {
                    winsAI++;
                }
            });
            return {
                wins: wins,
                winsAI: winsAI
            };
        }).catch(function (error) {
            debug('failed to look up player wins');
            debug(error);
        });
    });
};

var getAllPlayers = function () {
    return ready.then(function () {
        return treasonDb.view('games/all_players').then(function (result) {
            var players = [];
            result.forEach(function (row) {
                players.push({
                    playerName: row.name,
                    playerId: row._id
                })
            });
            return players;
        }).catch(function (error) {
            debug('failed to look up all players');
            debug(error);
        });
    });
};

var buildPlayerWin = function (player) {
    return ready.then(function () {
        return getPlayerWins(player.playerId).then(function (wins) {
            return {
                playerName: player.playerName,
                playerId: player.playerId,
                wins: wins.wins,
                winsAI: wins.winsAI,
                winsHuman: wins.wins - wins.winsAI
            };
        });
    });
};

var getPlayerRankings = function (playerId) {
    return ready.then(function () {
        var playerStats;
        if (playerId) {
            var myRankings = [];
            var playerAdded = false;
            var playersBelowPlayerRank = 0;
            for (var i = 0; i < globalPlayerRankings.length; i++) {
                var player = globalPlayerRankings[i];
                if (playerAdded) {
                    playersBelowPlayerRank++;
                    if (playersBelowPlayerRank >= playerRanksToReturn / 2 && myRankings.length > playerRanksToReturn - 1) {
                        break;
                    }
                }
                myRankings.push(player);
                if (player.playerId === playerId) {
                    playerAdded = true;
                }
            }

            playerStats = myRankings.splice(myRankings.length - playerRanksToReturn, playerRanksToReturn);

            playerStats.forEach(function (player) {
                if (playerId == player.playerId) {
                    player.isPlayer = true;
                }
                delete player.playerId;
            });

            return playerStats;
        } else {
            playerStats = globalPlayerRankings.slice(0);
            return playerStats.splice(0, playerRanksToReturn);
        }
    });
};

function updatePlayerRankings() {
    return ready.then(function () {
        return getAllPlayers().then(function (players) {
            return Promise.all(players.map(buildPlayerWin)).then(function (playerStats) {
                playerStats.sort(function(first, second) {
                    var result = second.winsHuman - first.winsHuman;
                    if (result == 0) {
                        return second.wins - first.wins;
                    } else {
                        return result;
                    }
                });
                var rank = 1;
                playerStats.forEach(function (player) {
                    player.rank = rank++;
                });

                debug('Refreshing player rankings, fetched ranks for ' + playerStats.length + ' players');

                globalPlayerRankings = playerStats;

                return playerStats;
            });
        });
    });
}

module.exports = {
    register: register,
    constructGameStats: constructGameStats,
    recordGameData: recordGameData,
    getPlayerWins: getPlayerWins,
    getAllPlayers: getAllPlayers,
    getPlayerRankings: getPlayerRankings,
    setDebug: setDebug
};

function setDebug(debug) {
    debugMode = debug;
}

function debug(message) {
    if (debugMode) {
        console.log(message);
    }
}