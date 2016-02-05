'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();

//Multiple databases is generally wrong. Reduce
var nomenclatorDb = pr.wrapAll(connection.database('treason_players'));
var gameStatsDb = pr.wrapAll(connection.database('treason_gamestats'));
var playerStatsDb = pr.wrapAll(connection.database('treason_playerstats'));

var ready = Promise.all([
    nomenclatorDb.exists().then(function (exists) {
        if (!exists) {
            return nomenclatorDb.create();
        }
    }),
    gameStatsDb.exists().then(function (exists) {
        if (!exists) {
            return gameStatsDb.create();
        }
    }),
    playerStatsDb.exists().then(function (exists) {
        if (!exists) {
            return playerStatsDb.create();
        }
    })
]).then(function() {
    debug('All databases initialized');
}).then(function() {
    debug('Initializing views');
    //Set up your views here
    gameStatsDb.save('_design/games', {
        totalGames: {
            map: function (document) {
                if (document.players > 0) {
                    emit(document.players, document);
                }
            }
        }
    });

    gameStatsDb.save('_design/player', {
        views: {
            total_wins: {
                /*map: 'function (doc) { if (doc.playerRank.indexOf(playerId) === doc.playerRank.length ) { emit(playerId, 1) } }',*/
                map: 'function (doc) { if (true) { emit(playerId, 1) } }',
                reduce: 'function(keys, values) { return sum(values) }'
            }
        }
    });
    debug('Finished initializing views, databases ready');
}).catch(function(error) {
    debug('Failed to initialize database(s)');
    debug(error);
});

/**
 * Captures statistics about each game.
 * PlayerRank is ordered by the first outgoing player being first in the array, with the winner last and no disconnects.
 * @type {{players: number, onlyHumans: boolean, playerRank: Array, bluffs: number, challenges: number, moves: number}}
 */
var GameStats = {
    players: 0,
    onlyHumans: true,
    playerRank: [],
    bluffs: 0,
    challenges: 0,
    moves: 0
};

module.exports = {
    register: function (id, name) {
        return ready.then(function() {
            debug('Player ' + name + ', trying to register with id ' + id);

            return nomenclatorDb.get(id)
                .then(function (result) {
                    if (result.name != name) {
                        debug('Updating name of player ' + result.name + ' to ' + name);
                        nomenclatorDb.merge(id, {
                            name: name
                        }).then(function (result) {
                            debug('Updated name of playerId ' + id + ' to ' + name);
                        }).catch(function (error) {
                            debug('Failed to update player.');
                            debug(error);
                        });
                    }
                    debug('Existing player ' + name + ' logged in with id ' + id);
                })
                .catch(function (error) {
                    //failed to find the player, recreate with new id
                    debug('Id ' + id + ' not recognised, recreating');
                    id = crypto.randomBytes(32).toString('hex');

                    debug('Saving new id ' + id + ' for player ' + name);
                    return nomenclatorDb.save(id, {
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
    },
    constructGameStats: function() {
        return Object.create(GameStats);
    },
    recordGameData: function (gameData) {
        return ready.then(function () {
            return gameStatsDb.save(gameData).then(function (result) {
                debug('saved game data');
            }).catch(function (error) {
                debug('failed to save game data');
                debug(error);
            });
        });
    },
    recordPlayerData: function (playerData) {
        return ready.then(function () {
            return playerStatsDb.save(playerData).then(function (result) {
                debug('saved player data');
            }).catch(function (error) {
                debug('failed to save player data');
                debug(error);
            });
        });
    },
    getPlayerWins: function (playerId) {
        return ready.then(function () {
            return gameStatsDb.view('player/wins').then(function (result) {
                result.forEach(function (row) {
                    debug('wins ' + row.wins)
                })
            }).catch(function (error) {
                debug('failed to look up player wins');
                debug(error);
            });
        })
    }
};

function debug(message) {
    console.log(message);
}