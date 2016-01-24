'use strict';

var fs = require('fs');
var rand = require('random-seed')();

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

var publicGames = [];
var privateGames = {};

io.on('connection', function (socket) {
    socket.on('join', function (data) {
        reapPrivateGames();

        var playerName = data.playerName;
        var gameName = data.gameName;

        if (!playerName || playerName.length > 30 || !playerName.match(/^[a-zA-Z0-9_ !@#$*]+$/)) {
            return;
        }
        if (gameName) {
            joinPrivateGame(playerName, gameName);
        } else {
            joinOrCreatePublicGame(playerName);
        }
    });

    function reapPrivateGames() {
        for (var gameName in privateGames) {
            var privateGameUpForReaping = privateGames[gameName];
            if (privateGameUpForReaping.gameOver()) {
                console.log('Reaping finished private game ' + gameName);
                delete privateGames[gameName];
            }
        }
    }

    function joinPrivateGame(playerName, gameName) {
        var game = privateGames[gameName];
        if (!game) {
            socket.emit('gamenotfound', {
                gameName: gameName
            });
            return;
        } else {
            if (!game.canJoin()) {
                socket.emit('gameinprogress', {
                    gameName: gameName
                });
                return;
            }
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
                    moveDelay: 1000 // For AI players
                });
            }
        }
        createNetPlayer(game, socket, playerName);
        if (game.canJoin()) {
            // The game is not yet full; still open for more players.
            publicGames.push(game);
        }
    }

    socket.on('create', function(data) {
        var gameName = randomGameName(data.gameName);
        var game = createGame({
            debug: argv.debug,
            logger: winston,
            moveDelay: 1000,
            gameName: gameName,
            created: new Date()
        });
        privateGames[gameName] = game;

        socket.emit('created', {
            gameName: gameName
        });
    });

    socket.on('ready', function(data) {
        var playerName = data.playerName;
        var gameName = data.gameName;
        var playerIndex = data.playerIdx;
        var game = privateGames[gameName];
        game.playerReady(playerName, playerIndex);

        if (game.allPlayersReady()) {
            game = createGame({
                debug: argv.debug,
                logger: winston,
                moveDelay: 1000,
                gameName: gameName,
                created: new Date()
            });
            privateGames[gameName] = game;
        }
    });

    socket.on('disconnect', function () {
        socket.removeAllListeners();
        socket = null;
    })
});

var adjectives;

fs.readFile('adjectives.txt', function(err, data) {
    if (err) {
        throw err;
    }
    adjectives = data.toString().split(/\r?\n/);
});

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
