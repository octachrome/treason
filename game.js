'use strict';

var shared = require('./web/shared.js');
var actions = shared.actions;

var stateNames = {
    WAITING_FOR_PLAYERS: 'waiting-for-players',
    START_OF_TURN: 'start-of-turn',
    BLOCK_CHALLENGE: 'block-challenge'
};

var deepcopy = require('deepcopy');

var nextGameId = 1;
var nextPlayerId = 1;

module.exports = function createGame() {
    var gameId = nextGameId++;
    var numPlayers = 2;

    var state = {
        stateId: 1,
        gameId: gameId,
        players: [],
        numPlayers: numPlayers,
        state: createState(stateNames.WAITING_FOR_PLAYERS)
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
            state.state = createState(stateNames.START_OF_TURN, 0);
        }

        emitState();
    }

    function playerLeft(socket) {
        var playerIdx = playerIdxBySocket(socket);
        if (playerIdx != null) {
            sockets[playerIdx] = null;

            // Reveal all the player's influence.
            var influence = state.players[playerIdx].influence;
            for (var j = 0; j < influence.length; j++) {
                influence[j].revealed = true;
            }
        }
        checkForGameEnd();
    }

    function playerIdxBySocket(socket) {
        for (var i = 0; i < state.players.length; i++) {
            if (sockets[i] == socket) {
                return i;
            }
        }
        return null;
    }

    function checkForGameEnd() {
        var winnerIdx = null;
        for (var i = 0; i < state.players.length; i++) {
            if (hasInfluence(state.players[i])) {
                if (winnerIdx == null) {
                    winnerIdx = i;
                } else {
                    winnerIdx = null;
                    break;
                }
            }
        }
        if (winnerIdx != null) {
            state.state = createState('game-won', winnerIdx);
            emitState();
        }
    }

    function hasInfluence(player) {
        for (var i = 0; i < player.influence.length; i++) {
            if (!player.influence[i].revealed) {
                return true;
            }
        }
        return false;
    }

    function emitState() {
        state.stateId++;
        debug(state);
        for (var i = 0; i < state.players.length; i++) {
            var masked = maskState(i);
            if (sockets[i] != null) {
                sockets[i].emit('state', masked);
            }
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

    function command(socket, command) {
        debug(command);
        var playerIdx = playerIdxBySocket(socket);
        if (playerIdx == null) {
            debug('unknown player');
            return;
        }
        var player = state.players[playerIdx];
        if (player == null) {
            debug('unknown player');
            return;
        }

        if (command.command == 'play-action') {
            if (state.state.name == stateNames.START_OF_TURN) {
                if (state.state.playerIdx != playerIdx) {
                    debug('not your turn');
                    return;
                }
                var action = actions[command.action];
                if (action == null) {
                    debug('unknown action');
                    return;
                }
                if (player.cash < action.cost) {
                    debug('not enough cash');
                    return;
                }
                if (action.targetted) {
                    if (command.target == null) {
                        debug('no target specified');
                        return;
                    }
                    if (command.target < 0 || command.target >= numPlayers) {
                        debug('invalid target specified');
                        return;
                    }
                    if (!hasInfluence(state.players[command.target])) {
                        debug('cannot target dead player');
                        return;
                    }
                }
                if (action.role == null && action.blockedBy == null) {
                    debug('playing action');
                    player.cash -= action.cost;
                    state.state = createState(stateNames.START_OF_TURN, nextPlayerIdx());
                } else {
                    debug('checking for blocks/challenges');
                    state.state = createState(stateNames.BLOCK_CHALLENGE, playerIdx, command.action, command.target);
                }
                emitState();
            }
        }
    }

    function nextPlayerIdx() {
        var playerIdx = state.playerIdx;
        for (var i = 1; i < numPlayers; i++) {
            var candidateIdx = (playerIdx + i) % numPlayers;
            if (hasInfluence(players[candidateIdx])) {
                return candidateIdx;
            }
        }
        debug('no more players');
        return null;
    }

    function createState(stateName, playerIdx, action, target) {
        return {
            name: stateName,
            playerIdx: typeof playerIdx != 'undefined' ? playerIdx : null,
            action: action || null,
            target: target || null
        };
    }

    function debug(obj) {
        console.log(obj);
    }

    return {
        playerJoined: playerJoined,
        playerLeft: playerLeft,
        isActive: isActive,
        command: command
    };
};
