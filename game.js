'use strict';

var deepcopy = require('deepcopy');

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
            playerId: playerId,
            name: 'Player ' + playerId,
            influence: [
                {
                    role: 'Duke',
                    revealed: false
                },
                {
                    role: 'Captain',
                    revealed: false
                },
            ]
        });
        sockets.push(socket);

        if (isActive()) {
            state.turn.state = 'playing';
            state.turn.player = 0;
        }

        emitState();
    }

    function emitState() {
        for (var i = 0; i < state.players.length; i++) {
            var masked = maskState(i);
            sockets[i].emit('state', masked);
        }
    }

    /**
     * Mask hidden influences.
     */
    function maskState(playerIdx) {
        var masked = deepcopy(state);
        for (var i = 0; i < state.players.length; i++) {
            if (i != playerIdx) {
                var influence = masked.players[i].influence;
                for (var j = 0; j < influence.length; j++) {
                    if (!influence[j].revealed) {
                        influence[j].role = 'Unknown';
                    }
                }
            }
            masked.players[i].me = (i == playerIdx);
        }
        return masked;
    }

    function isActive() {
        return state.players.length == numPlayers;
    }

    return {
        playerJoined: playerJoined,
        isActive: isActive
    };
};
