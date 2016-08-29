/*
 * Copyright 2015-2016 Christopher Brown and Jackie Niebling.
 *
 * This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
 *
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/ or send a letter to:
 *     Creative Commons
 *     PO Box 1866
 *     Mountain View
 *     CA 94042
 *     USA
 */
'use strict';

var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');
var ms = require('ms');
var debug = require('debug')('dataaccess');

var rankingsDisabled = true;

var connection = new cradle.Connection();
var treasonDb;

var debugMode = false;

var stats;
var playerRanksToReturn = 10;

//View recreation
var gameVersionsDocumentId = 'game_versions';
var updateViews = false;
var recreateViews = false;
//NOTE: If you update any view, also increment this version
var currentViewVersion = 1;

// This ensures that unit tests do not try to record stats.
var ready = Promise.reject(new Error('not initialized'));

function init(dbname) {
    treasonDb = pr.wrapAll(connection.database(dbname));
    ready = treasonDb.exists().then(function (exists) {
        if (!exists) {
            debug('Creating database');
            return treasonDb.create();
        }
    }).then(function () {
        if (!rankingsDisabled) {
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
                        console.error('Failed to create initial current view version document');
                        console.error(error);
                    });
                });
        }
    }).then(function () {
        if (recreateViews || updateViews) {
            debug('Recreating views because ' + (updateViews ? 'view version was updated' : 'of --recreate-views'));
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
                    console.error('Failed to update current view version.');
                    console.error(error);
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
        if (!rankingsDisabled) {
            return calculateAllStats();
        }
    }).then(function() {
        debug('Database is ready');
    }).catch(function(error) {
        console.error('Failed to initialise database(s)');
        console.error(error);
        process.exit(1);
    });
    return ready;
}

function register(id, name, userAgent) {
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
                if (result.name != name || userAgent != result.userAgent) {
                    debug('Updating player ' + result.name + ' (new name ' + name + ')');
                    return treasonDb.merge(id, {
                        name: name,
                        userAgent: userAgent
                    }).then(function (result) {
                        debug('Updated playerId ' + id);
                    }).catch(function (error) {
                        console.error('Failed to update player.');
                        console.error(error);
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
                    name: name,
                    userAgent: userAgent
                }).then(function (result) {
                    debug('Allocated new id ' + id + ' to player: ' + name);
                }).catch(function (error) {
                    console.error('Failed to save player');
                    console.error(error);
                    return treasonDb.get(id).then(function() {
                        debug('Collision detected, retrying with new id');
                        return register(null, name);
                    }).catch(function(error) {
                        console.error(error);
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
 * @type {{players: number, humanPlayers: number, playerRank: Array, playerDisconnect: Array, gameStarted: number, gameFinished: number, gameType: string}}
 */
function constructGameStats() {
    return {
        players: 0,
        humanPlayers: 0,
        type: 'game',
        playerRank: [],
        playerDisconnect: [],
        gameStarted: new Date().getTime(),
        gameFinished: 0,
        gameType: 'original'
    };
};

function recordGameData(gameData, skipStatRecalculation) {
    return ready.then(function () {
        gameData.gameFinished = new Date().getTime();
        return treasonDb.save(gameData).then(function (result) {
            debug('Saved game data for game: ' + result._id);
            if (!skipStatRecalculation && !rankingsDisabled) {
                calculateAllStats();
            }
        }).catch(function (error) {
            console.error('failed to save game data');
            console.error(error);
        });
    });
};

function recordPlayerDisconnect(playerId) {
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
                        console.error('Failed to update player.');
                        console.error(error);
                    });
                }
            });
    });
};

function getAllPlayers() {
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
            console.error('failed to look up all players');
            console.error(error);
        });
    });
};

function getPlayerRankings(playerId, showPersonalRank) {
    if (rankingsDisabled) {
        return Promise.resolve([]);
    }
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
        console.error('Failed to calculate all stats');
        console.error(error);
    });
}

module.exports = {
    register: timeApi(register),
    constructGameStats: constructGameStats,
    recordGameData: timeApi(recordGameData),
    recordPlayerDisconnect: timeApi(recordPlayerDisconnect),
    getPlayerRankings: timeApi(getPlayerRankings),
    setRecreateViews: setRecreateViews,
    init: timeApi(init)
};

function setRecreateViews(value) {
    recreateViews = value;
}

function timeApi(fn) {
    return function () {
        var start = new Date().getTime();
        function done(err) {
            var end = new Date().getTime();
            debug(fn.name + ' took ' + ms(end - start) + ' ' + (err && err.stack || ''));
        }
        debug(fn.name + '...');
        return fn.apply(this, arguments).then(function (result) {
            done();
            return result;
        }, function (err) {
            done(err);
            throw err;
        });
    };
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
