'use strict';
var crypto = require('crypto');
var cradle = require('cradle');
var pr = require('promise-ring');
var rand = require('random-seed')();

var argv = require('optimist')
    .usage('$0 [--players <N>] [--games <N>]')
    .default('players', 100)
    .default('games', 1000)
    .default('queries', 10)
    .argv;

var connection = new cradle.Connection();
var db = pr.wrapAll(connection.database('treason_test'));

var playerIds;
var stats;

createDatabase()
    .then(createViews)
    .then(createPlayers)
    .then(createGames)
    .then(queryRandomPlayers)
    .then(countOverallGames)
    .then(calculateAllStats)
    .then(calculateTopTwenty)
    .catch(function (err) {
        console.log(err);
    });

function queryRandomPlayers() {
    console.log('Calculating individual stats');
    var results = [];
    for (var i = 0; i < argv.queries; i++) {
        var somePlayerId = playerIds[rand(playerIds.length)];
        results.push(Promise.all([
            db.view('games/by_winner', {reduce: true, key: somePlayerId}),
            db.view('games/by_player', {reduce: true, key: somePlayerId})
        ]).then(function (results) {
            var wins = results[0][0].value;
            var games = results[1][0].value;
            var percent = Math.floor(100 * wins / games);
            console.log('Player ' + somePlayerId + ' won ' + percent + '% (' + wins + '/' + games + ')');
        }));
    }
    return Promise.all(results);
}

function countOverallGames() {
    console.log('Counting total games won');
    return db.view('games/by_winner', {reduce: true}).then(function (results) {
        var wins = results[0].value;
        console.log('Overall games won ' + wins);
    });
}

function calculateAllStats() {
    console.log('Calculating stats for every player');
    stats = {};
    return Promise.all([
        db.view('games/by_winner', {reduce: true, group: true}),
        db.view('games/by_player', {reduce: true, group: true})
    ]).then(function (results) {
        var games = results[1];
        games.forEach(function (playerId, gameCount) {
            stats[playerId] = {
                games: gameCount,
                wins: 0,
                percent: 0
            };
        });
        var wins = results[0];
        wins.forEach(function (playerId, winCount) {
            stats[playerId].wins = winCount;
            stats[playerId].percent = Math.floor(100 * winCount / stats[playerId].games);
        });
    });
}

function calculateTopTwenty() {
    console.log('Calculating top 20 players');
    var sortedPlayerIds = Object.keys(stats).sort(function (id1, id2) {
        return stats[id2].percent - stats[id1].percent;
    });
    console.log('Top twenty:');
    for (var i = 0; i < 20; i++) {
        var id = sortedPlayerIds[i];
        console.log('Player ' + id + ' won ' + stats[id].percent + '% (' + stats[id].wins + '/' + stats[id].games + ')');
    }
}

function createDatabase() {
    return db.exists().then(function (exists) {
        if (exists) {
            console.log('Destroying database');
            return db.destroy();
        }
    }).then(function () {
        console.log('Creating database');
        return db.create();
    });
}

function createPlayers() {
    console.log('Creating player ids');
    playerIds = [];
    for (var i = 0; i < argv.players; i++) {
        playerIds.push(crypto.randomBytes(16).toString('hex'));
    }
}

function createGames() {
    console.log('Creating games');
    var gamePromises = [];
    for (var g = 0; g < argv.games; g++) {
        var playerRank = [];
        for (var p = 0, len = 2+rand(2); p < len; p++) {
            playerRank.push(playerIds[rand(playerIds.length)]);
        }
        gamePromises.push(db.save({
            type: 'game',
            playerRank: playerRank
        }));
    }
    return Promise.all(gamePromises);
}

function createViews() {
    console.log('Creating views');
    return db.save('_design/games', {
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
        by_player: {
            map: function (doc) {
                if (doc.type === 'game' && doc.playerRank) {
                    doc.playerRank.forEach(function (player) {
                        emit(player);
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
        }
    });
}
