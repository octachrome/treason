'use strict';

var express = require('express');
var app = express();
app.use(express.static('web'));

var server = app.listen(8080);

var io = require('socket.io')(server);
var createGame = require('./game');
var createNetPlayer = require('./net-player');
var createAiPlayer = require('./ai-player');

var debugging = process.argv.indexOf('--debug') >= 0;
var ai = process.argv.indexOf('--ai') >= 0;

var pending = [];

io.on('connection', function (socket) {
    var game;
    if (pending.length) {
        game = pending.pop();
    } else {
        game = createGame(debugging);
        if (ai) {
            createAiPlayer(game);
        }
    }
    createNetPlayer(game, socket);
    if (!game.isFull()) {
        pending.push(game);
    }
});
