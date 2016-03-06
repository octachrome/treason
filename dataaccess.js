'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();
var treasonDb = pr.wrapAll(connection.database('treason_db'));

var debugMode = false;

var stats;
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
            by_winner: {
                map: function (doc) {
                    if (doc.type === 'game' && doc.playerRank) {
                        emit(doc.playerRank[0]);
                    }
                },
                reduce: function (keys, values, rereduce) {
                    if (rereduce) {
                        return sum(values);
                    }
                    else {
                        return values.length;
                    }
                }
            },
            by_winner_ai: {
                map: function (doc) {
                    if (doc.type === 'game' && doc.playerRank && !doc.onlyHumans) {
                        emit(doc.playerRank[0]);
                    }
                },
                reduce: function (keys, values, rereduce) {
                    if (rereduce) {
                        return sum(values);
                    }
                    else {
                        return values.length;
                    }
                }
            },
            by_player: {
                map: function (doc) {
                    if (doc.type === 'game' && doc.playerRank) {
                        doc.playerRank.forEach(function (player) {
                            if (player) {
                                //Ignore AI players
                                emit(player);
                            }
                        });
                    }
                },
                reduce: function (keys, values, rereduce) {
                    if (rereduce) {
                        return sum(values);
                    }
                    else {
                        return values.length;
                    }
                }
            },
            all_players: {
                map: function (document) {
                    if (document.type === 'player') {
                        emit(null, document);
                    }
                }
            },
            all_games: {
                map: function (document) {
                    if (document.type === 'game') {
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

calculateAllStats();

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
                    type: 'player',
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
        type: 'game',
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
            calculateAllStats();
        }).catch(function (error) {
            debug('failed to save game data');
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

var getPlayerRankings = function (playerId, showPersonalRank) {
    return ready.then(function () {
        var sortedPlayerIds = Object.keys(stats).sort(function (id1, id2) {
            return id2.rank - id1.rank;
        });
        var playerStats = [];

        if (showPersonalRank && playerId) {
            debug('Getting player rankings for player ' + playerId);
            var myRankings = [];
            var playerAdded = false;
            var playersBelowPlayerRank = 0;
            for (var i = 0; i < sortedPlayerIds.length; i++) {
                var sortedPlayerId = sortedPlayerIds[i];
                if (playerAdded) {
                    playersBelowPlayerRank++;
                    if (playersBelowPlayerRank >= playerRanksToReturn / 2 && myRankings.length > playerRanksToReturn - 1) {
                        break;
                    }
                }

                var rankedPlayerStats = assign(stats[sortedPlayerId]);
                rankedPlayerStats.playerId = sortedPlayerId;
                myRankings.push(rankedPlayerStats);
                if (sortedPlayerId === playerId) {
                    playerAdded = true;
                }
            }

            playerStats = myRankings.splice(myRankings.length - playerRanksToReturn, playerRanksToReturn);
        } else {
            debug('Getting global player rankings');
            for (var j = 0; j < playerRanksToReturn; j++) {
                if (stats[sortedPlayerIds[j]]) {
                    var rankedTopPlayerStats = assign(stats[sortedPlayerIds[j]]);
                    rankedTopPlayerStats.playerId = sortedPlayerIds[j];
                    playerStats.push(rankedTopPlayerStats);
                } else {
                    //There are less than 10-20 players registered in the ranks in this case
                    break;
                }
            }
        }

        playerStats.forEach(function (player) {
            if (playerId && playerId == player.playerId) {
                player.isPlayer = true;
            }
            delete player.playerId;
        });

        return playerStats;
    });
};

function calculateAllStats() {
    debug('Calculating stats for every player');
    stats = {};
    return Promise.all([
        treasonDb.view('games/by_winner', {reduce: true, group: true}),
        treasonDb.view('games/by_winner_ai', {reduce: true, group: true}),
        treasonDb.view('games/by_player', {reduce: true, group: true}),
        treasonDb.view('games/all_players')
    ]).then(function (results) {
        var games = results[2];
        games.forEach(function (playerId, gameCount) {
            stats[playerId] = {
                games: gameCount,
                rank: 0,
                playerName: '',
                wins: 0,
                winsAI: 0,
                percent: 0
            };
        });
        var totalWins = results[0];
        totalWins.forEach(function (playerId, winCount) {
            stats[playerId].wins = winCount;
            stats[playerId].percent = Math.floor(100 * winCount / stats[playerId].games);
        });
        var winsAI = results[1];
        winsAI.forEach(function (playerId, winCount) {
            stats[playerId].winsAI = winCount;
        });

        var sortedPlayerIds = Object.keys(stats).sort(function (id1, id2) {
            var first = stats[id1];
            var second = stats[id2];
            var result = (second.wins - second.winsAI) - (first.wins - first.winsAI);
            if (result == 0) {
                return second.wins - first.wins;
            } else {
                return result;
            }
        });

        var rank = 1;
        for (var i = 0; i < sortedPlayerIds.length; i++) {
            stats[sortedPlayerIds[i]].rank = rank++;
        }

        var players = results[3];
        for (var j = 0; j < players.length; j++) {
            var player = players[j];
            stats[player.id].playerName = player.value.name;
        }
    });
}

module.exports = {
    register: register,
    constructGameStats: constructGameStats,
    recordGameData: recordGameData,
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

function assign(source) {
    //Object.assign would have been great here.
    var destination = {};
    for(var i in source) {
        if(source.hasOwnProperty(i)) {
            destination[i] = source[i];
        }
    }
    return destination;
}