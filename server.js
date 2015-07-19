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

var pending = [];//public games
var privateGames = {};

io.on('connection', function (socket) {
    socket.on('join', function (data) {
        var playerName = data.playerName;
        var privateGameName = data.privateGameName;//If it has a hash, it's someone joining, else it's someone creating
        var isCreatingPrivateGame = privateGameName && privateGameName.indexOf('#') === -1;
        if (privateGameName && !isCreatingPrivateGame) {
            privateGameName = privateGameName.substring(1);
        }

        if (!playerName || playerName.length > 30 || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/)) {
            return;
        }
        var game = null;
        while (!game) {
            if (privateGameName) {
                if (isCreatingPrivateGame) {
                    var gameName = playerName;
                    while (privateGames[gameName]) {
                        //gameName += Date.now() % 17 + '';
                        gameName += 'x';
                    }
                    privateGames[gameName] = {};
                    game = createGame({
                        debug: argv.debug,
                        logger: winston,
                        moveDelay: 1000,
                        gameName: gameName
                    });
                    privateGames[gameName] = game;
                } else {
                    //joining a private game
                    if (privateGames[privateGameName]) {
                        game = privateGames[privateGameName];
                    } else {
                        //todo this game has expired/was not found
                    }
                }

                //todo figure out what parameters to reap on. maybe instead when number of player is empty?
                /*for (var property in privateGames) {
                    if (privateGames.hasOwnProperty(property)) {
                        var privateGameToBeReapedMaybe = privateGames[property];
                        if (privateGameToBeReapedMaybe.gameOver && privateGameToBeReapedMaybe.gameOver()) {
                            console.log('Reaping finished private game ' + property);
                            app.get(privateGameToBeReapedMaybe.gamePath, function(req, res) {
                                res.send('This game has expired');
                            });
                            delete privateGames.property;
                        }
                    }
                }*/
            } else {
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
        }
        createNetPlayer(game, socket, playerName);
        if (game.canJoin() && !privateGameName) {
            pending.push(game);
        }
    });

    socket.on('disconnect', function () {
        socket.removeAllListeners();
        socket = null;
    })
});
