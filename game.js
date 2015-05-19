'use strict';

var stateNames = {
    WAITING_FOR_PLAYERS: 'waiting-for-players',
    START_OF_TURN: 'start-of-turn'
};

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
        state: {
            name: stateNames.WAITING_FOR_PLAYERS,
            playerIdx: null
        }
    };

    var sockets = [];

    function playerJoined(socket) {
        var playerId = nextPlayerId++;

        if (state.players.length >= numPlayers) {
            socket.emit('error', 'Cannot join game ' + gameId + ': it is full.');
            return;
        }

        state.players.push({
            playerId: playerId,
            name: 'Player ' + playerId,
            cash: 2,
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
            state.state = {
                name: stateNames.START_OF_TURN,
                playerIdx: 0
            }
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
     * Mask hidden influences, add player-specific data.
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
        }
        masked.playerIdx = playerIdx;
        masked.playerId = masked.players[playerIdx].playerId;
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
