var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();

var nomenclator = pr.wrapAll(connection.database('players'));
var gameStats = pr.wrapAll(connection.database('gamestats'));
var playerStats = pr.wrapAll(connection.database('playerstats'));

var ready = Promise.all([
    nomenclator.exists().then(function (exists) {
        if (!exists) {
            return nomenclator.create();
        }
    }),
    gameStats.exists().then(function (exists) {
        if (!exists) {
            return gameStats.create();
        }
    }),
    playerStats.exists().then(function (exists) {
        if (!exists) {
            return playerStats.create();
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
            nomenclator.get(id)
                .then(function (result) {
                    if (result.name != name) {
                        debug('Updating name of player ' + result.name + ' to ' + name);
                        nomenclator.merge(id, {
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
            nomenclator.save(id, {
                name: name
            }).then(function (result) {
                debug('Allocated new id ' + id + ' to player: ' + name);
            }).catch(function (error) {
                debug('Failed to save player');
                debug(error);
            });
        }

        return id;
    },
    recordGameStats: function (gameStats) {

    },
    recordPlayerStats: function (playerStats) {

    }
};

function debug(message) {
    console.log(message);
}