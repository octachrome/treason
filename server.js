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

var gameId = 1;
var games = {};
var players = {};
var sockets = {};
// Players who have not joined a game in the last 30 minutes are not counted as active users.
var TIMEOUT = 30 * 60 * 1000;

io.on('connection', function (socket) {
    var timestamp = new Date().getTime();
    sockets[socket.id] = timestamp;
    var activeUsers = 0;
    for (var id in sockets) {
        if (timestamp - sockets[id] > TIMEOUT) {
            delete sockets[id];
            delete players[id];
        } else {
            activeUsers++;
        }
    }

    //Emit the global rankings upon connect
    dataAccess.getPlayerRankings().then(function (result) {
        socket.emit('rankings', result);
    });

    socket.on('registerplayer', function (data) {
        if (isInvalidPlayerName(data.playerName)) {
            //Do not even attempt to register invalid player names
            return;
        }

        dataAccess.register(data.playerId, data.playerName).then(function (playerId) {
            socket.playerId = playerId;

            players[playerId] = {
                playerName: data.playerName
            };

            socket.emit('handshake', {
                activeUsers: activeUsers,
                playerId: playerId,
                games: filterGames(),
                players: filterPlayers()
            });

            broadcastPlayers();

            //Now that we know who you are, we can highlight you in the rankings
            dataAccess.getPlayerRankings(socket.playerId).then(function (result) {
                socket.emit('rankings', result);
            });
        });
    });

    socket.on('join', function (data) {
        var timestamp = new Date().getTime();
        sockets[socket.id] = timestamp;

        var playerName = data.playerName;
        var gameName = data.gameName;
        var password = data.password;

        if (isInvalidPlayerName(playerName)) {
            return;
        }

        if (gameName) {
            joinGame(socket, gameName, playerName, password);
        } else {
            quickJoin(socket, playerName);
        }
    });

    socket.on('create', function(data) {
        if (isInvalidPlayerName(data.playerName)) {
            return;
        }
        createNewGame(socket, data.password);
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

    socket.on('sendglobalchatmessage', function (data) {
        if (data.length > 300) {
            data = data.slice(0, 300) + '...';
        }

        var now = new Date();
        var timeStamp = '[' + now.getHours() + ':' + ('0' + now.getMinutes()).slice(-2) + '] ';
        var playerName = players[socket.playerId].playerName;

        var globalMessage =  timeStamp + playerName + ': ' + data;
        var localMessage = timeStamp + ' You: ' + data;

        socket.emit('globalchatmessage', localMessage);
        socket.broadcast.emit('globalchatmessage', globalMessage);
    });

    socket.on('disconnect', function () {
        broadcastGames(socket);

        delete sockets[socket.id];
        delete players[socket.id];
        socket.removeAllListeners();
        socket = null;
    });
});

function joinGame(socket, gameName, playerName, password) {
    var game = games[gameName];

    if (game) {
        if (!game.password() || game.password() === password) {
            playerJoinsGame(game, socket, playerName, gameName);
        } else {
            socket.emit('gamerequirespassword', {
                message: 'Failed to join game, incorrect password',
                gameName: gameName
            });
        }
    } else {
        socket.emit('gamenotfound', 'Failed to join game, game not found');
    }
}

function quickJoin(socket, playerName) {
    //Discover a game to join. This should prefer the older games in the list
    for (var gameName in games) {
        if (games.hasOwnProperty(gameName)) {
            var game = games[gameName];
            if (game && game.canJoin() && !game.password()) {
                playerJoinsGame(game, socket, playerName, gameName);
                return;
            }
        }
    }

    //Failed to find a game, make a new one instead
    createNewGame(socket);
}

function playerJoinsGame(game, socket, playerName, gameName) {
    createNetPlayer(game, socket, playerName);
    socket.emit('joined', {
        gameName: gameName,
        password: game.password()
    });

    broadcastGames();
}

function createNewGame(socket, password) {
    var gameName = '#' + gameId++;

    var game = createGame({
        debug: argv.debug,
        logger: winston,
        moveDelay: 1000,
        gameName: gameName,
        created: new Date(),
        password: password || '',
        callback: broadcastGames
    });

    games[gameName] = game;

    game.once('end', function () {
        delete games[gameName];
    });

    socket.emit('created', {
        gameName: gameName,
        password: password
    });

    broadcastGames();
}

function isInvalidPlayerName(playerName) {
    return !playerName || playerName.length > 30 || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/ || !playerName.trim());
}

function broadcastGames() {
    var gamesList = filterGames();
    io.sockets.emit('updategames', {
        games: gamesList
    });
}

function broadcastPlayers() {
    var playerList = filterPlayers();
    io.sockets.emit('updateplayers', {
        players: playerList
    });
}

function filterPlayers() {
    var playerList = [];

    for (var playerId in players) {
        if (players.hasOwnProperty(playerId)) {
            var player = players[playerId];
            playerList.push({
                playerName: player.playerName
            });
        }
    }

    return playerList;
}

function filterGames() {
    var gamesList = [];

    for (var gameName in games) {
        if (games.hasOwnProperty(gameName)) {
            var game = games[gameName];
            if (game) {
                var playerList = [];
                var playersInGame = game.playersInGame();

                for (var i = 0; i < playersInGame.length; i++) {
                    var player = playersInGame[i];

                    var clientPlayer = {
                        playerName: player.name,
                        ai: player.ai,
                        observer: player.isObserver
                    };

                    playerList.push(clientPlayer);
                }

                var clientGame = {
                    gameName: gameName,
                    status: game.currentState(),
                    type: game.gameType(),
                    passwordRequired: game.password() ? true : false,
                    players: playerList
                };

                gamesList.push(clientGame);
            }
        }
    }

    return gamesList;
}