'use strict';

var express = require('express');
var app = express();
app.use(express.static('web'));

var server = app.listen(8080);

var io = require('socket.io')(server);
var createGame = require('./game');

var pending = [];

io.on('connection', function (socket) {
    var game;
    if (pending.length) {
        game = pending.pop();
    } else {
        game = createGame();
        pending.push(game);
    }
    game.playerJoined(socket);
    socket.on('command', function (data) {
        try {
            game.command(socket, data);
        } catch(e) {
            console.error(e);
            console.error(e.stack);
        }
    });
    socket.on('disconnect', function () {
        game.playerLeft(socket);
    });
});
