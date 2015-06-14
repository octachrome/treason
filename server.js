'use strict';

var argv = require('optimist')
    .usage('$0 [--debug] [--port <port>]')
    .default('port', 8080)
    .argv;

var express = require('express');
var app = express();
app.use(express.static(__dirname + '/web'));

var version = require('./version');
app.get('/version.js', version);

var server = app.listen(argv.port);

var io = require('socket.io')(server);
var createGame = require('./game');
var createNetPlayer = require('./net-player');

var pending = [];

io.on('connection', function (socket) {
    socket.on('join', function (playerName) {
        if (!playerName || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/)) {
            return;
        }
        var game = null;
        while (!game) {
            if (pending.length) {
                game = pending.pop();
                if (!game.canJoin()) {
                    game = null;
                }
            } else {
                game = createGame({
                    debug: argv.debug
                });
            }
        }
        createNetPlayer(game, socket, playerName);
        if (game.canJoin()) {
            pending.push(game);
        }
    });

    socket.on('disconnect', function () {
        socket.removeAllListeners();
        socket = null;
    })
});
