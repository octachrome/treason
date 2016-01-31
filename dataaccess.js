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
]);

ready.catch(function (err) {
    console.err('Stats failed to initialize:');
    console.err(err);
});

module.exports = {
    register: function (id, name) {
        var createEntry = false;
        debug('Player ' + name + ', trying to register with id ' + id);

        //claims to have an id
        if (id) {
            //find the player
            nomenclatorDb.get(id)
                .then(function (result) {
                    if (result.name != name) {
                        debug('Updating name of player ' + result.name + ' to ' + name);
                        nomenclatorDb.merge(id, {
                            name: name
                        }).then(function (result) {
                            debug('Updated name of playerId ' + id);
                        }).catch(function (error) {
                            debug('Failed to update player.');
                            debug(error);
                        });
                    }
                }).catch(function (error) {
                //failed to find the player, recreate with new id
                debug('Id ' + id + ' not recognised, recreating');
                createEntry = true;
            });
        } else {
            createEntry = true;
        }

        if (createEntry) {
            //give new id
            id = crypto.randomBytes(32).toString('hex');
            nomenclatorDb.save(id, {
                name: name
            }).then(function (result) {
                debug('Allocated new id ' + id + ' to player: ' + name);
            }).catch(function (error) {
                debug('Failed to save player');
                debug(error);
            });
        } else {
            debug('Existing player '+ name +' logged in with id ' + id);
        }

        return id;
    },
    recordGameData: function (gameData) {
        gameStatsDb.save(gameData).then(function (result) {
            debug('saved game data');
        }).catch(function (error) {
            debug('failed to save game data');
            debug(error);
        })
    },
    recordPlayerData: function (playerData) {
        playerStatsDb.save(playerData).then(function (result) {
            debug('saved player data');
        }).catch(function (error) {
            debug('failed to save player data');
            debug(error);
        })
    }
};

function debug(message) {
    console.log(message);
}