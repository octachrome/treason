'use strict';

var Promise = require('es6-promise').Promise;

var express = require('express');
var app = express();
app.use(express.static('web'));

var server = app.listen(8080);

var io = require('socket.io')(server);
var createGame = require('./game');

var pending = [];
var active = [];

io.on('connection', function (socket) {
    if (pending.length) {
        var game = pending.pop();
        active.push(game);
        game.playerJoined(socket);
    } else {
        var game = createGame();
        pending.push(game);
        game.playerJoined(socket);
    }
});
