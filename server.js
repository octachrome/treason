'use strict';

var argv = require('optimist')
    .usage('$0 [--debug] [--port <port>] [--log <logfile>]')
    .default('port', 8080)
    .default('log', 'treason.log')
    .argv;

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

var io = require('socket.io')(server);
var createGame = require('./game');
var createNetPlayer = require('./net-player');

var pending = [];

io.on('connection', function (socket) {
    socket.on('join', function (playerName) {
        if (!playerName || playerName.length > 30 || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/)) {
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
                    debug: argv.debug,
                    logger: winston,
                    moveDelay: 1000 // For AI players
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
