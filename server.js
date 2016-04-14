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

var fs = require('fs');
var rand = require('random-seed')();
var dataAccess = require('./dataaccess');

var argv = require('optimist')
    .usage('$0 [--debug] [--port <port>] [--log <logfile>] [--db <database>]')
    .default('port', 8080)
    .default('log', 'treason.log')
    .default('db', 'treason_db')
    .argv;

dataAccess.init(argv.db);

var winston = require('winston');
winston.add(winston.transports.File, {
    filename: argv.log,
    maxsize: 5*1024*1024,
    zippedArchive: true,
    json: false
});
winston.remove(winston.transports.Console);
winston.info('server started');

var express = require('express');
var app = express();
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/web'));

var version = require('./version');
app.get('/version.js', version);

app.get('/', function (req, res) {
    res.render('pages/index.ejs');
});

var server = app.listen(argv.port);
dataAccess.setDebug(argv.debug);

var io = require('socket.io')(server);
var createGame = require('./game');
var createNetPlayer = require('./net-player');

var publicGames = [];
var privateGames = {};
var sockets = {};
var TIMEOUT = 30 * 60 * 1000;

io.on('connection', function (socket) {
    var timestamp = new Date().getTime();
    sockets[socket.id] = timestamp;
    var activeUsers = 0;
    for (var id in sockets) {
        if (timestamp - sockets[id] > TIMEOUT) {
            delete sockets[id];
        } else {
            activeUsers++;
        }
    }

    //Emit the global rankings upon connect
    dataAccess.getPlayerRankings().then(function (result) {
        socket.emit('rankings', result);
    });

    socket.on('registerplayer', function (data) {
        dataAccess.register(data.playerId, data.playerName).then(function (playerId) {
            socket.emit('handshake', {
                activeUsers: activeUsers,
                playerId: playerId
            });
            socket.playerId = playerId;

            //Now that we know who you are, we can highlight you in the rankings
            dataAccess.getPlayerRankings(socket.playerId).then(function (result) {
                socket.emit('rankings', result);
            });
        });
    });

    socket.on('join', function (data) {
        var playerName = data.playerName;
        var gameName = data.gameName;

        if (isInvalidPlayerName(playerName)) {
            return;
        }
        if (gameName) {
            joinPrivateGame(playerName, gameName);
        } else {
            joinOrCreatePublicGame(playerName);
        }
    });

    function joinPrivateGame(playerName, gameName) {
        var game = privateGames[gameName];
        if (!game) {
            game = createPrivateGame(gameName);
        }
        if (!game.canJoin()) {
            socket.emit('gameinprogress', {
                gameName: gameName
            });
            return;
        }
        createNetPlayer(game, socket, playerName);
    }

    function joinOrCreatePublicGame(playerName) {
        var game = null;
        while (!game) {
            if (publicGames.length) {
                game = publicGames.pop();
                if (!game.canJoin()) {
                    game = null;
                }
            } else {
                game = createGame({
                    debug: argv.debug,
                    logger: winston,
                    moveDelay: 3000, // For AI players
                    moveDelaySpread: 700
                });
            }
        }
        createNetPlayer(game, socket, playerName);
        if (game.canJoin()) {
            // The game is not yet full; still open for more players.
            publicGames.push(game);
        }
    }

    function createPrivateGame(gameName) {
        var game = createGame({
            debug: argv.debug,
            logger: winston,
            moveDelay: 1000,
            gameName: gameName,
            created: new Date()
        });
        privateGames[gameName] = game;
        game.once('end', function () {
            delete privateGames[gameName];
        });
        return game;
    }

    socket.on('create', function(data) {
        var gameName = randomGameName(data.gameName);
        if (isInvalidPlayerName(data.playerName)) {
            return;
        }
        var game = createPrivateGame(gameName);
        socket.emit('created', {
            gameName: gameName
        });
    });

    socket.on('showrankings', function () {
        dataAccess.getPlayerRankings(socket.playerId).then(function (result) {
            socket.emit('rankings', result);
        });
    });

    socket.on('showmyrank', function () {
        dataAccess.getPlayerRankings(socket.playerId, true).then(function (result) {
            socket.emit('rankings', result);
        });
    });

    socket.on('disconnect', function () {
        delete sockets[socket.id];
        socket.removeAllListeners();
        socket = null;
    });
});

var adjectives = fs.readFileSync(__dirname + '/adjectives.txt', 'utf8').split(/\r?\n/);

function isInvalidPlayerName(playerName) {
    return !playerName || playerName.length > 30 || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/ || !playerName.trim());
}

function randomGameName(playerName) {
    var i = 1;
    while (true) {
        var adjective = adjectives[rand(adjectives.length)];
        var gameName =  playerName + "'s " + adjective + " game";
        if (i > 100) {
            gameName += " (" + i + ")";
        }
        if (!privateGames[gameName]) {
            return gameName;
        }
        i++;
    }
}