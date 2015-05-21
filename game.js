'use strict';

var shared = require('./web/shared.js');
var actions = shared.actions;

var stateNames = {
    WAITING_FOR_PLAYERS: 'waiting-for-players',
    START_OF_TURN: 'start-of-turn',
    BLOCK_CHALLENGE: 'block-challenge',
    REVEAL_INFLUENCE: 'reveal-influence'
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
                    role: 'duke',
                    revealed: false
                },
                {
                    role: 'captain',
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
        if (playerIdx == null) {
            debug('unknown player disconnected');
            return;
        }
        sockets[playerIdx] = null;
        killPlayer(playerIdx);
        emitState();
    }

    function killPlayer(playerIdx) {
        // Reveal all the player's influence.
        var influence = state.players[playerIdx].influence;
        for (var j = 0; j < influence.length; j++) {
            influence[j].revealed = true;
        }

        if (state.state.playerIdx == playerIdx) {
            nextTurn();
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
            if (countInfluence(state.players[i])) {
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
        }
    }

    function countInfluence(player) {
        var count = 0;
        for (var i = 0; i < player.influence.length; i++) {
            if (!player.influence[i].revealed) {
                count++;
            }
        }
        return count;
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
        debug('from: ' + playerIdx);
        var player = state.players[playerIdx];
        if (player == null) {
            debug('unknown player');
            return;
        }
        if (command.stateId != state.stateId) {
            debug('stale state');
            return;
        }

        if (command.command == 'play-action') {
            if (state.state.name != stateNames.START_OF_TURN) {
                debug('incorrect state');
                return;
            }
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
                if (!countInfluence(state.players[command.target])) {
                    debug('cannot target dead player');
                    return;
                }
            }
            if (action.role == null && action.blockedBy == null) {
                playPendingAction();
                nextTurn();
            } else {
                debug('checking for blocks/challenges');
                state.state = createState(stateNames.BLOCK_CHALLENGE, playerIdx, command.action, command.target);
            }
        } else if (command.command == 'challenge') {
            if (state.state.name != stateNames.BLOCK_CHALLENGE) {
                debug('incorrect state');
            }
            var action = actions[state.state.action];
            if (!action) {
                debug('unknown action');
                return;
            }
            if (!action.role) {
                debug('action cannot be challenged');
                return;
            }
            var challengedPlayerIdx = state.state.playerIdx;
            var challengedPlayer = state.players[challengedPlayerIdx];
            if (!challengedPlayer) {
                debug('cannot identify challenged player');
                return;
            }
            if (playerHasRole(challengedPlayer, action.role)) {
                // Challenge lost.
                var influenceCount = countInfluence(player);
                if (influenceCount <= 1 || (influenceCount <= 2 && state.state.action == 'assassination')) {
                    // The player is dead (challenging an assassination and failing loses two influnece)
                    killPlayer(playerIdx);
                    checkForGameEnd();
                } else {
                    playPendingAction();
                    state.state = createState(stateNames.REVEAL_INFLUENCE, challengedPlayerIdx, null, playerIdx, 'failed challenge');
                }
            } else {
                // Challenge won.
                var influenceCount = countInfluence(challengedPlayer);
                if (influenceCount <= 1) {
                    // The player is dead
                    killPlayer(challengedPlayerIdx);
                    checkForGameEnd();
                } else {
                    state.state = createState(stateNames.REVEAL_INFLUENCE, challengedPlayerIdx, null, challengedPlayerIdx, 'successfully challenged');
                }
            }
        } else if (command.command == 'reveal') {
            if (state.state.name != stateNames.REVEAL_INFLUENCE) {
                debug('incorrect state');
                return;
            }
            if (state.state.target != playerIdx) {
                debug('not your turn to reveal an influence');
                return;
            }
            for (var i = 0; i < player.influence.length; i++) {
                var influence = player.influence[i];
                if (influence.role == command.role && !influence.revealed) {
                    influence.revealed = true;
                    // todo: is it always next turn?
                    nextTurn();
                    checkForGameEnd();
                    emitState();
                    return;
                }
            }
            debug('could not reveal role');
            return;
        } else if (command.command == 'allow') {
            playPendingAction();
            nextTurn();
        } else {
            debug('unknown command');
            return;
        }
        emitState();
    }

    function playPendingAction() {
        debug('playing action');
        var player = state.players[state.state.playerIdx];
        var action = actions[state.state.action];
        player.cash -= action.cost;
    }

    function nextTurn() {
        state.state = createState(stateNames.START_OF_TURN, nextPlayerIdx());
    }

    function playerHasRole(player, role) {
        for (var i = 0; i < player.influence.length; i++) {
            if (player.influence[i].role == role && !player.influence[i].revealed) {
                return true;
            }
        }
        return false;
    }

    function nextPlayerIdx() {
        var playerIdx = state.state.playerIdx;
        for (var i = 1; i < numPlayers; i++) {
            var candidateIdx = (playerIdx + i) % numPlayers;
            if (countInfluence(state.players[candidateIdx])) {
                return candidateIdx;
            }
        }
        debug('no more players');
        return null;
    }

    function createState(stateName, playerIdx, action, target, message) {
        return {
            name: stateName,
            playerIdx: typeof playerIdx != 'undefined' ? playerIdx : null,
            action: action || null,
            target: typeof target != 'undefined' ? target : null,
            message: message || null
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
