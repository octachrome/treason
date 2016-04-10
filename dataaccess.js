'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();
var treasonDb = pr.wrapAll(connection.database('treason_db'));

var debugMode = false;

var stats;
var playerRanksToReturn = 10;

//View recreation
var gameVersionsDocumentId = 'game_versions';
var updateViews = false;
//NOTE: If you update any view, also increment this version
var currentViewVersion = 1;

var ready = treasonDb.exists().then(function (exists) {
    if (!exists) {
        debug('Creating database');
        return treasonDb.create();
    }
}).then(function () {
    debug('Database is up. Checking if views should be recreated');
    return treasonDb.get(gameVersionsDocumentId)
        .then(function (result) {
            if (result.currentViewVersion != currentViewVersion) {
                updateViews = true;
            } else {
                debug('View version is up to date');
            }
        })
        .catch(function () {
            return treasonDb.save(gameVersionsDocumentId, {
                currentViewVersion: currentViewVersion
            }).then(function () {
                debug('Current view version document not found in database, created it');
                updateViews = true;
            }).catch(function (error) {
                debug('Failed to create initial current view version document');
                debug(error);
            });
        });
}).then(function () {
    if (debugMode || updateViews) {
        debug('Recreating views because ' + (updateViews ? 'view version was updated' : 'of debug mode'));
        return treasonDb.save('_design/games', {
            by_winner: {
                map: function (doc) {
                    if (doc.type === 'game' && doc.playerRank && doc.playerRank[0] && doc.playerRank[0] !== 'ai') {
                        emit(doc.playerRank[0], doc.humanPlayers);
                    }
                },
                reduce: function (keys, values, rereduce) {
                    var stats = {
                        wins: 0,
                        winsAI: 0
                    };

                    if (rereduce) {
                        for (var i = 0; i < values.length; i++) {
                            stats.wins += values[i].wins;
                            stats.winsAI += values[i].winsAI;
                        }
                        return stats;
                    }

                    stats.wins = values.length;
                    values.forEach(function(value) {
                        if (value < 2) {
                            stats.winsAI++;
                        }
                    });
                    return stats;
                }
            },
            by_player: {
                map: function (doc) {
                    if (doc.type === 'game' && doc.playerRank) {
                        doc.playerRank.forEach(function (playerId) {
                            if (playerId && playerId !== 'ai') {
                                emit(playerId);
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
                        emit(null, document.name);
                    }
                }
            }
        }).then(function() {
            return treasonDb.merge(gameVersionsDocumentId, {
                currentViewVersion: currentViewVersion
            }).then(function () {
                debug('Updated current view version to ' + currentViewVersion);
            }).catch(function (error) {
                debug('Failed to update current view version.');
                debug(error);
                throw error;
            });
        }).then(function() {
            //Exercise a view. This will rebuild all the views and can take some time
            debug('Initialising views');
            var start = new Date().getTime();
            return treasonDb.view('games/all_players').then(function() {
                var end = new Date().getTime();
                debug('Spent ' + (end - start) / 1000 + ' seconds initialising views');
            });
        });
    }
}).then(function() {
    debug('Finished initialising views');
    return calculateAllStats();
}).then(function() {
    debug('Database is ready');
}).catch(function(error) {
    debug('Failed to initialise database(s)');
    debug(error);
    process.exit(1);
});

var register = function (id, name) {
    return ready.then(function() {
        debug('Player ' + name + ', trying to register with id ' + id);

        if (!id || id === 'ai') {
            id = -1;
        }
        if (!name) {
            debug('Player given a dummy name');
            name = "JohnDoe";
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
            .catch(function () {
                //failed to find the player, recreate with new id
                debug('Id ' + id + ' not recognised, recreating');
                id = crypto.randomBytes(16).toString('hex');

                debug('Saving new id ' + id + ' for player ' + name);
                return treasonDb.save(id, {
                    type: 'player',
                    name: name
                }).then(function (result) {
                    debug('Allocated new id ' + id + ' to player: ' + name);
                }).catch(function (error) {
                    debug('Failed to save player');
                    debug(error);
                    return treasonDb.get(id).then(function() {
                        debug('Collision detected, retrying with new id');
                        return register(null, name);
                    }).catch(function(error) {
                        debug(error);
                        throw error;
                    });
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
 * @type {{players: number, humanPlayers: number, onlyHumans: boolean, playerRank: Array, playerDisconnect: Array, gameStarted: number, gameFinished: number}}
 */
var constructGameStats = function() {
    return {
        players: 0,
        humanPlayers: 0,
        onlyHumans: true,
        type: 'game',
        playerRank: [],
        playerDisconnect: [],
        gameStarted: new Date().getTime(),
        gameFinished: 0
    };
};

var recordGameData = function (gameData, skipStatRecalculation) {
    return ready.then(function () {
        gameData.gameFinished = new Date().getTime();
        return treasonDb.save(gameData).then(function (result) {
            debug('Saved game data for game: ' + result._id);
            if (!skipStatRecalculation) {
                calculateAllStats();
            }
        }).catch(function (error) {
            debug('failed to save game data');
            debug(error);
        });
    });
};

var recordPlayerDisconnect = function (playerId) {
    return ready.then(function () {
        return treasonDb.get(playerId)
            .then(function (player) {
                if (player) {
                    debug('Updating disconnects for player: ' + playerId);
                    return treasonDb.merge(playerId, {
                        disconnects: 1 + (player.disconnects || 0)
                    }).then(function (player) {
                        debug('Updated disconnect count of player: ' + playerId);
                    }).catch(function (error) {
                        debug('Failed to update player.');
                        debug(error);
                    });
                }
            });
    });
};

var getAllPlayers = function () {
    return ready.then(function () {
        return treasonDb.view('games/all_players').then(function (result) {
            var players = [];
            result.forEach(function (row) {
                players.push({
                    playerName: row.value,
                    playerId: row.id
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
            return stats[id1].rank - stats[id2].rank;
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

                var rankedPlayerStats = Object.assign({}, stats[sortedPlayerId]);
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
                    var rankedTopPlayerStats = Object.assign({}, stats[sortedPlayerIds[j]]);
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

    return Promise.all([
        treasonDb.view('games/by_winner', {reduce: true, group: true}),
        treasonDb.view('games/by_player', {reduce: true, group: true}),
        treasonDb.view('games/all_players')
    ]).then(function (results) {
        var newStats = {};

        var games = results[1];
        games.forEach(function (playerId, gameCount) {
            newStats[playerId] = {
                games: gameCount,
                rank: 0,
                playerName: '',
                wins: 0,
                winsAI: 0,
                percent: 0
            };
        });

        var wins = results[0];
        wins.forEach(function (playerId, winStats) {
            newStats[playerId].wins = winStats.wins;
            newStats[playerId].winsAI = winStats.winsAI;
            newStats[playerId].percent = Math.floor(100 * winStats.wins / newStats[playerId].games);
        });

        var sortedPlayerIds = Object.keys(newStats).sort(function (id1, id2) {
            var first = newStats[id1];
            var second = newStats[id2];
            var result = (second.wins - second.winsAI) - (first.wins - first.winsAI);
            if (result == 0) {
                result = second.wins - first.wins;
                if (result == 0) {
                    return second.percent - first.percent;
                }
                return result;
            } else {
                return result;
            }
        });

        var rank = 1;
        for (var i = 0; i < sortedPlayerIds.length; i++) {
            newStats[sortedPlayerIds[i]].rank = rank++;
        }

        var players = results[2];
        for (var j = 0; j < players.length; j++) {
            var player = players[j];
            if (newStats[player.id]) {
                newStats[player.id].playerName = player.value;
            }
        }
        stats = newStats;
        debug('Finished calculating all stats')
    }).catch(function (error) {
        debug('Failed to calculate all stats');
        debug(error);
    });
}

module.exports = {
    register: register,
    constructGameStats: constructGameStats,
    recordGameData: recordGameData,
    recordPlayerDisconnect: recordPlayerDisconnect,
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

//Just for testing
function createTestData(players, games) {
    var playerIds = [];
    ready.then(function () {
        var registerPromises = [];
        for (var i = 0; i < players; i++) {
            registerPromises.push(register(i, randomName()));
        }

        Promise.all(registerPromises).then(function (result) {
            result.forEach(function(player) {
                playerIds.push(player);
            });
        }).then(function () {
            for (var g = 0; g < games; g++) {
                var playerRank = [];
                for (var p = 0, len = 2 + randomInteger(0, 2); p < len; p++) {
                    playerRank.push(playerIds[randomInteger(0, playerIds.length - 1)]);
                }

                var game = constructGameStats();

                game.playerRank = playerRank;
                game.players = playerRank.length;
                game.onlyHumans = true;
                game.humanPlayers = game.players;

                recordGameData(game, true);
            }
        });
    }).then(function () {
        debug('Finished creating test data');
    });
}

//createTestData(1000, 10000);

function randomName() {
    var name = 'P-';
    var chars = "abcdefghijklmnopqrstuvwxyz";
    for (var i = 0; i < 8; i++) {
        name += chars.charAt(randomInteger(0, chars.length - 1));
    }
    return name;
}

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
