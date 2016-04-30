var path = require('path');
var fs = require('fs');
var lodash = require('lodash');
var cradle = require('cradle');
var pr = require('promise-ring');

var argv = require('optimist')
    .default('server', 'localhost')
    .default('db', 'treason_db')
    .argv;

if (argv.analyze) {
    var stats = require(path.resolve(argv.analyze));

    stats.sort(function (first, second) {
        return second.percentHuman - first.percentHuman;
    });

    // Print top ten players with >=20 wins, sorted by % games won against humans.
    var count = 0, i = 0;
    while (count < 10 && i < stats.length) {
        var s = stats[i];
        if (s.winsHuman >= 20) {
            console.log(stats[i]);
            count++;
        }
        i++;
    }
    process.exit();
}

var views = {
    views: {
        games_by_player_count: {
            map: function (doc) {
                if (doc.type === 'game') {
                    emit(doc.humanPlayers, 1);
                }
            },
            reduce: function (keys, values, rereduce) {
                return sum(values);
            }
        },
        odd_games: {
            map: function (doc) {
                if (doc.type === 'game' && (/*doc.humanPlayers === 0 ||*/ doc.humanPlayers > 6)) {
                    emit(doc.id, doc.id);
                }
            }
        },
        by_winner_all: {
            map: function (doc) {
                if (doc.type === 'game' && doc.playerRank && doc.playerRank.length > 1) {
                    var lastHuman;
                    var humanPlayers = 0;
                    var aiPlayers = 0;
                    var aiWon;
                    for (var i = 0; i < doc.playerRank.length; i++) {
                        var p = doc.playerRank[i];
                        if (!p || p === 'ai') {
                            aiPlayers++;
                            if (i === 0) {
                                aiWon = true;
                            }
                        }
                        else {
                            if (p !== lastHuman) {
                                humanPlayers++;
                                p = lastHuman;
                            }
                        }
                    }

                    var gameType;
                    if (aiPlayers === 0) {
                        if (humanPlayers > 1) {
                            gameType = 'human_vs_human';
                        }
                        else {
                            gameType = 'weird_one_or_no_humans';
                        }
                    }
                    else if (humanPlayers === 1) {
                        if (aiWon) {
                            gameType = 'human_practice_ai_won';
                        }
                        else {
                            gameType = 'human_practice_human_won';
                        }
                    }
                    else if (humanPlayers > 1) {
                        if (aiWon) {
                            gameType = 'mixed_ai_won';
                        }
                        else {
                            gameType = 'mixed_human_won';
                        }
                    }
                    else {
                        gameType = 'weird_ai_no_humans';
                    }
                    emit(gameType, 1);
                }
            },
            reduce: function (keys, values, rereduce) {
                return sum(values);
            }
        },
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
                            emit(playerId, doc.humanPlayers);
                        }
                    });
                }
            },
            reduce: function (keys, values, rereduce) {
                var stats = {
                    games: 0,
                    gamesAI: 0
                };

                if (rereduce) {
                    for (var i = 0; i < values.length; i++) {
                        stats.games += values[i].games;
                        stats.gamesAI += values[i].gamesAI;
                    }
                    return stats;
                }

                stats.games = values.length;
                values.forEach(function(value) {
                    if (value < 2) {
                        stats.gamesAI++;
                    }
                });
                return stats;
            }
        },
        all_players: {
            map: function (document) {
                if (document.type === 'player') {
                    emit(null, document);
                }
            }
        }
    }
};

var opts = {};
if (argv.user && argv.pwd) {
    opts.auth = { username: argv.user, password: argv.pwd };
}

var connection = new cradle.Connection(argv.server, opts);
var treasonDb = pr.wrapAll(connection.database(argv.db));

if (argv.create) {
    treasonDb
        .save('_design/dev', views)
        .catch(handleErrors);
}
else {
    calculateStats()
        .then(function (stats) {
            var json = JSON.stringify(stats);
            fs.writeFileSync('stats.json', json);
            console.log('Wrote stats.json');
        })
        .catch(handleErrors);
}

function calculateStats() {
    return Promise.all([
        treasonDb.view('dev/by_winner', {reduce: true, group: true}),
        treasonDb.view('dev/by_player', {reduce: true, group: true}),
        treasonDb.view('dev/all_players')
    ]).then(function (results) {
        var stats = {};

        var games = results[1];
        games.forEach(function (playerId, data) {
            stats[playerId] = {
                games: data.games,
                gamesAI: data.gamesAI,
                gamesHuman: data.games - data.gamesAI,
                rank: 0,
                playerName: '',
                wins: 0,
                winsAI: 0,
                winsHuman: 0,
                percent: 0,
                percentHuman: 0
            };
        });

        var wins = results[0];
        wins.forEach(function (playerId, data) {
            stats[playerId].wins = data.wins;
            stats[playerId].winsAI = data.winsAI;
            stats[playerId].winsHuman = data.wins - data.winsAI;

            stats[playerId].percent = stats[playerId].wins / stats[playerId].games;
            stats[playerId].percentHuman = stats[playerId].winsHuman / stats[playerId].gamesHuman;
            stats[playerId].percentAI = stats[playerId].winsAI / stats[playerId].gamesAI;
        });

        var players = results[2];
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            if (stats[player.id]) {
                stats[player.id].playerName = player.value.name;
                stats[player.id].userAgent = player.value.userAgent;
            }
        }

        return lodash.values(stats);
    });
}

function handleErrors(err) {
    console.log(err);
    process.exit(1);
}
