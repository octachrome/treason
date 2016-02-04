'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();

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
}).catch(function(error) {
    debug('Failed to initialize database(s)');
    debug(error);
});

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
    recordPlayerData: function (playerId, playerData) {
        return ready.then(function () {
            return playerStatsDb.save(playerId, playerData).then(function (result) {
                debug('saved player data');
            }).catch(function (error) {
                debug('failed to save player data');
                debug(error);
            });
        });
    }
};

function debug(message) {
    console.log(message);
}