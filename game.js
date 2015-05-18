'use strict';

var nextGameId = 1;
var nextPlayerId = 1;

module.exports = function createGame() {
    var gameId = nextGameId++;
    var numPlayers = 2;

    var state = {
        gameId: gameId,
        players: [],
        numPlayers: numPlayers,
        turn: {
            state: 'waiting'
        }
    };

    var sockets = [];

    function playerJoined(socket) {
        var playerId = nextPlayerId++;

        if (state.players.length >= state.numPlayers) {
            socket.emit('error', 'Cannot join game ' + gameId + ': it is full.');
            return;
        }

        state.players.push({
            playerId: playerId
        });
        sockets.push(socket);

        if (state.players.length == numPlayers) {
            state.turn.state = 'playing';
            state.turn.player = 0;
        }

        emitState();
    }

    function emitState() {
        for (var i = 0; i < sockets.length; i++) {
            sockets[i].emit('state', state);
        }
    }

    return {
        playerJoined: playerJoined
    };
};
