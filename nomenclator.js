var crypto = require('crypto');
var cradle = require('cradle');

var dbname = 'players';

var db = new(cradle.Connection)().database(dbname);

db.exists(function (err, exists) {
    if (err) {
        debug('error', err);
    } else if (exists) {
        debug('Loaded database ' + dbname);
    } else {
        debug('Database ' +dbname + ' did not exist, creating it.');
        db.create(function(err) {
            debug('Failed to create database ' + dbname + ', ' + err)
        });
    }
});

module.exports = function () {
    var nomenclator = {};

    nomenclator.register = register;

    function register(id, name) {
        var allocatedId;
        debug('Player ' + name + ', registered with id ' + id);

        //claims to have an id
        if (id) {
            //find the player
            db.get(id, function(err, doc) {
                if (err) {
                    //failed to find the player, recreate with new id
                    debug('Id ' +  id + ' not recognised, recreating' );
                    id = crypto.randomBytes(32).toString('hex');
                } else {
                    //update the name if needed
                    if (doc.name != name) {
                        debug('Updating name of player ' + doc.name + ' to ' + name);
                        db.merge(id, {
                            name: name
                        }, function (err, res) {
                            if (err) {
                                debug('Failed to update player, error: ' +err);
                            } else {
                                debug('Updated name of playerId ' + id);
                            }
                        });
                    }
                }
            });
        } else {
            //give new id
            id = crypto.randomBytes(32).toString('hex');
            db.save(id, {
                name: name
            }, function (err, res) {
                if (err) {
                    debug('Failed to save player, ' +err);
                } else {
                    debug('Allocated new id ' + id + ' to player: ' + name);
                }
            });
        }

        return id;
    }

    return nomenclator;
};

function debug(message) {
    console.log(message);
}