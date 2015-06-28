'use strict';

var createAiPlayer = require('./ai-player');
var shared = require('./web/shared');
var actions = shared.actions;
var stateNames = shared.states;

var format = require('util').format;
var deepcopy = require('deepcopy');
var escape = require('validator').escape;

var nextGameId = 1;
var nextPlayerId = 1;

var MIN_PLAYERS = 2;
var MAX_PLAYERS = 6;

module.exports = function createGame(options) {
    options = options || {};
    var gameId = nextGameId++;

    var state = {
        stateId: 1,
        gameId: gameId,
        players: [],
        numPlayers: 0,
        state: {
            name: stateNames.WAITING_FOR_PLAYERS
        }
    };

    var players = [];
    var allows = [];
    var proxies = [];

    var deck = buildDeck();
    var _test_ignoreShuffle = false;

    var game = {
        canJoin: canJoin,
        playerJoined: playerJoined,
        _test_setTurnState: _test_setTurnState,
        _test_setInfluence: _test_setInfluence,
        _test_setCash: _test_setCash,
        _test_setDeck: _test_setDeck
    };

    function playerJoined(player) {
        if (state.state.name != stateNames.WAITING_FOR_PLAYERS) {
            throw new GameException('Cannot join game ' + gameId + ': it has started');
        }
        if (state.players.length >= MAX_PLAYERS) {
            throw new GameException('Cannot join game ' + gameId + ': it is full');
        }

        var playerState = {
            name: playerName(player.name),
            cash: 2,
            influenceCount: 2,
            influence: [
                {
                    role: 'not dealt',
                    revealed: false
                },
                {
                    role: 'not dealt',
                    revealed: false
                }
            ]
        };
        var playerIdx = state.players.length;
        state.players.push(playerState);
        players.push(player);
        state.numPlayers++;

        if (state.numPlayers == MAX_PLAYERS) {
            start();
        }

        addHistory(playerState.name + ' joined the game');
        emitState();

        var proxy = createGameProxy(playerIdx);
        proxies.push(proxy);
        return proxy;
    }

    function playerName(name) {
        name = name || 'Anonymous';
        for (var i = 0; i < state.players.length; i++) {
            if (state.players[i].name == name) {
                return playerName(name + ' (1)');
            }
        }
        return name;
    }

    function createGameProxy(playerIdx, oldProxy) {
        var proxy = oldProxy || {};
        proxy.command = function (data) {
            command(playerIdx, data);
        };
        proxy.playerLeft = function () {
            playerLeft(playerIdx);
        };
        proxy.sendChatMessage = function (message) {
            sendChatMessage(playerIdx, message);
        };
        return proxy;
    }

    function playerLeft(playerIdx) {
        if (playerIdx == null || playerIdx < 0 || playerIdx >= state.numPlayers) {
            throw new GameException('Unknown player disconnected');
        }
        var player = state.players[playerIdx];
        if (!player) {
            throw new GameException('Unknown player disconnected');
        }
        if (state.state.name == stateNames.WAITING_FOR_PLAYERS) {
            state.players.splice(playerIdx, 1);
            players.splice(playerIdx, 1);
            proxies.splice(playerIdx, 1);
            state.numPlayers--;
            // Rewire the player proxies with the new player index
            for (var i = playerIdx; i < state.numPlayers; i++) {
                createGameProxy(i, proxies[i]);
            }
        } else {
            players[playerIdx] = null;
            if (state.state.name != stateNames.GAME_WON) {
                killPlayer(playerIdx, true);
                if (state.state.playerIdx == playerIdx) {
                    nextTurn();
                }
            }
        }
        addHistory(player.name + ' left the game');
        emitState();
    }

    function killPlayer(playerIdx, playerLeft) {
        // Reveal all the player's influence.
        var player = state.players[playerIdx];
        if (player.influenceCount > 0) {
            var influence = player.influence;
            for (var j = 0; j < influence.length; j++) {
                if (!influence[j].revealed) {
                    addHistory('{%d} revealed %s', playerIdx, influence[j].role);
                    influence[j].revealed = true;
                }
            }
            player.influenceCount = 0;
            if (!playerLeft) {
                addHistory('{%d} suffered a humiliating defeat', playerIdx);
            }
        }
        checkForGameEnd();
    }

    function checkForGameEnd() {
        var winnerIdx = null;
        for (var i = 0; i < state.players.length; i++) {
            if (state.players[i].influenceCount > 0) {
                if (winnerIdx == null) {
                    winnerIdx = i;
                } else {
                    winnerIdx = null;
                    break;
                }
            }
        }
        if (winnerIdx != null) {
            state.state = {
                name: stateNames.GAME_WON,
                playerIdx: winnerIdx
            };
        }
    }

    function getInfluence(player) {
        var influence = [];
        for (var i = 0; i < player.influence.length; i++) {
            if (!player.influence[i].revealed) {
                influence.push(player.influence[i].role);
            }
        }
        return influence;
    }

    function emitState() {
        state.stateId++;
        debug(state);
        for (var i = 0; i < state.players.length; i++) {
            var masked = maskState(i);
            emitStateAsync(i, masked);
        }
    }

    function emitStateAsync(playerIdx, state) {
        setTimeout(function () {
            if (players[playerIdx] != null) {
                players[playerIdx].onStateChange(state);
            }
        }, 0);
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
                        influence[j].role = 'unknown';
                    }
                }
            }
        }
        // If a player is exchanging, show the drawn cards to that player alone.
        if (state.state.playerIdx != playerIdx) {
            masked.state.exchangeOptions = [];
        }
        masked.playerIdx = playerIdx;
        return masked;
    }

    function start() {
        if (state.state.name != stateNames.WAITING_FOR_PLAYERS) {
            throw new GameException('Incorrect state');
        }
        if (state.numPlayers >= MIN_PLAYERS) {
            for (var j = 0; j < state.players[0].influence.length; j++) {
                for (var i = 0; i < state.numPlayers; i++) {
                    state.players[i].influence[j].role = deck.pop();
                }
            }
            var firstPlayer = Math.floor(Math.random() * state.numPlayers);
            state.state = {
                name: stateNames.START_OF_TURN,
                playerIdx: firstPlayer
            };
        }
    }

    function command(playerIdx, command) {
        debug('command from player: ' + playerIdx);
        debug(command);
        var i, action, message;
        var player = state.players[playerIdx];
        if (player == null) {
            throw new GameException('Unknown player');
        }
        if (command.stateId != state.stateId) {
            throw new GameException('Stale state');
        }
        if (command.command == 'start') {
            start();

        } else if (command.command == 'add-ai') {
            if (state.state.name != stateNames.WAITING_FOR_PLAYERS) {
                throw new GameException('Incorrect state');
            }
            createAiPlayer(game, options);

        } else if (command.command == 'play-action') {
            if (state.state.name != stateNames.START_OF_TURN) {
                throw new GameException('Incorrect state');
            }
            if (state.state.playerIdx != playerIdx) {
                throw new GameException('Not your turn');
            }
            action = actions[command.action];
            if (action == null) {
                throw new GameException('Unknown action');
            }
            if (player.cash >= 10 && command.action != 'coup') {
                throw new GameException('You must coup with >= 10 cash');
            }
            if (player.cash < action.cost) {
                throw new GameException('Not enough cash');
            }
            if (action.targeted) {
                if (command.target == null) {
                    throw new GameException('No target specified');
                }
                if (command.target < 0 || command.target >= state.numPlayers) {
                    throw new GameException('Invalid target specified');
                }
                if (state.players[command.target].influenceCount == 0) {
                    throw new GameException('Cannot target dead player');
                }
            }
            player.cash -= action.cost;
            if (action.role == null && action.blockedBy == null) {
                if (playAction(playerIdx, command)) {
                    nextTurn();
                }
            } else {
                debug('checking for blocks/challenges');
                if (command.action == 'steal') {
                    message = format('{%d} attempted to steal from {%d}', playerIdx, command.target);
                } else if (command.action == 'assassinate') {
                    message = format('{%d} attempted to assassinate {%d}', playerIdx, command.target);
                } else if (command.action == 'exchange') {
                    message = format('{%d} attempted to exchange', playerIdx);
                } else {
                    message = format('{%d} attempted to draw %s', playerIdx, command.action);
                }
                state.state = {
                    name: stateNames.ACTION_RESPONSE,
                    playerIdx: playerIdx,
                    action: command.action,
                    target: command.target,
                    message: message
                };
                resetAllows(playerIdx);
            }

        } else if (command.command == 'challenge') {
            if (player.influenceCount == 0) {
                throw new GameException('Dead players cannot challenge');
            }
            if (state.state.name == stateNames.ACTION_RESPONSE) {
                if (playerIdx == state.state.playerIdx) {
                    throw new GameException('Cannot challenge your own action');
                }
                action = actions[state.state.action];
                if (!action) {
                    throw new GameException('Unknown action');
                }
                if (!action.role) {
                    throw new GameException('Action cannot be challenged');
                }
                challenge(playerIdx, state.state.playerIdx, action.role);

            } else if (state.state.name == stateNames.BLOCK_RESPONSE) {
                if (playerIdx == state.state.target) {
                    throw new GameException('Cannot challenge your own block');
                }
                challenge(playerIdx, state.state.target, state.state.blockingRole);

            } else {
                throw new GameException('Incorrect state');
            }

        } else if (command.command == 'reveal') {
            if (state.state.name != stateNames.REVEAL_INFLUENCE) {
                throw new GameException('Incorrect state');
            }
            if (state.state.playerToReveal != playerIdx) {
                throw new GameException('Not your turn to reveal an influence');
            }
            for (i = 0; i < player.influence.length; i++) {
                var influence = player.influence[i];
                if (influence.role == command.role && !influence.revealed) {
                    influence.revealed = true;
                    player.influenceCount--;
                    addHistory('%s; {%d} revealed %s', state.state.message, playerIdx, command.role);
                    action = actions[state.state.action];
                    if (action.blockedBy && !state.state.blockingRole && state.state.message.indexOf('incorrectly challenged') >= 0) {
                        // If the action can be blocked but hasn't yet, and if the player revealed because of a failed challenge,
                        // the targeted player has a final chance to block the action.
                        state.state = {
                            name: stateNames.FINAL_ACTION_RESPONSE,
                            playerIdx: state.state.playerIdx,
                            action: state.state.action,
                            target: state.state.target
                        };
                    } else if (state.state.action == 'exchange' && state.state.playerToReveal != state.state.playerIdx) {
                        // If the challenge was for an exchange, and the challenge was lost, the exchange must place after the reveal.
                        playAction(state.state.playerIdx, state.state);
                    } else {
                        nextTurn();
                    }
                    emitState();
                    return;
                }
            }
            throw new GameException('Could not reveal role');

        } else if (command.command == 'block') {
            if (player.influenceCount == 0) {
                throw new GameException('Dead players cannot block');
            }
            if (state.state.name != stateNames.ACTION_RESPONSE && state.state.name != stateNames.FINAL_ACTION_RESPONSE) {
                throw new GameException('Incorrect state');
            }
            action = actions[state.state.action];
            if (!action) {
                throw new GameException('Unknown action');
            }
            if (playerIdx == state.state.playerIdx) {
                throw new GameException('Cannot block your own action');
            }
            if (!action.blockedBy) {
                throw new GameException('Action cannot be blocked');
            }
            if (!command.blockingRole) {
                throw new GameException('No blocking role specified');
            }
            if (action.blockedBy.indexOf(command.blockingRole) < 0) {
                throw new GameException('Action cannot be blocked by that role');
            }
            // Original player is in the playerIdx field; blocking player is in the target field.
            addHistory(state.state.message);
            state.state = {
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: state.state.playerIdx,
                action: state.state.action,
                target: playerIdx,
                blockingRole: command.blockingRole,
                message: format('{%d} attempted to block with ' + command.blockingRole, playerIdx)
            };
            resetAllows(playerIdx);

        } else if (command.command == 'allow') {
            if (player.influenceCount == 0) {
                throw new GameException('Dead players cannot allow actions');
            }
            if (state.state.name == stateNames.BLOCK_RESPONSE) {
                if (state.state.target == playerIdx) {
                    throw new GameException('Cannot allow your own block');
                }
                allows[playerIdx] = true;
                if (everyoneAllows()) {
                    addHistory('{%d} blocked with %s', state.state.target, state.state.blockingRole);
                    nextTurn();
                } else {
                    return;
                }
            } else if (state.state.name == stateNames.ACTION_RESPONSE) {
                if (state.state.playerIdx == playerIdx) {
                    throw new GameException('Cannot allow your own move');
                }
                allows[playerIdx] = true;
                if (everyoneAllows()) {
                    if (playAction(state.state.playerIdx, state.state)) {
                        nextTurn();
                    }
                } else {
                    return;
                }
            } else {
                throw new GameException('Incorrect state');
            }

        } else if (command.command == 'exchange') {
            if (state.state.name != stateNames.EXCHANGE) {
                throw new GameException('Incorrect state');
            }
            if (state.state.playerIdx != playerIdx) {
                throw new GameException('Not your turn');
            }
            if (!command.roles) {
                throw new GameException('Must specify roles to exchange');
            }
            if (command.roles.length != player.influenceCount) {
                throw new GameException('Wrong number of roles');
            }
            var unchosen = arrayDifference(state.state.exchangeOptions, command.roles);
            if (!unchosen) {
                throw new GameException('Invalid choice of roles');
            }
            // Assign the roles the player selected.
            for (i = 0; i < player.influence.length; i++) {
                if (!player.influence[i].revealed) {
                    player.influence[i].role = command.roles.pop()
                }
            }
            // Return the other roles to the deck.
            deck = shuffle(deck.concat(unchosen));
            addHistory('{%d} exchanged roles', playerIdx);
            nextTurn();

        } else {
            throw new GameException('Unknown command');
        }

        emitState();
    }

    function arrayDifference(array, subarray) {
        array = deepcopy(array);
        for (var i = 0; i < subarray.length; i++) {
            var idx = array.indexOf(subarray[i]);
            if (idx == -1) {
                return false;
            }
            array.splice(idx, 1);
        }
        return array;
    }

    function resetAllows(initiatingPlayerIdx) {
        allows = [];
        // The player who took the action does not need to allow it.
        allows[initiatingPlayerIdx] = true;
    }

    function everyoneAllows() {
        for (var i = 0; i < state.numPlayers; i++) {
            if (state.players[i].influenceCount == 0) {
                // We don't care whether dead players allowed the action.
                continue;
            }
            if (!allows[i]) {
                return false;
            }
        }
        return true;
    }

    function challenge(playerIdx, challengedPlayerIdx, challegedRole) {
        var player = state.players[playerIdx];
        var challengedPlayer = state.players[challengedPlayerIdx];
        if (!challengedPlayer) {
            throw new GameException('Cannot identify challenged player');
        }
        addHistory(state.state.message);

        var influenceIdx = indexOfInfluence(challengedPlayer, challegedRole);
        if (influenceIdx != null) {
            // Player has role - challenge lost.

            // Deal the challenged player a replacement card.
            var oldRole = challengedPlayer.influence[influenceIdx].role;
            challengedPlayer.influence[influenceIdx].role = swapRole(oldRole);

            if (player.influenceCount > 1 && state.state.action == 'exchange') {
                // Special case: the challenger reveals first, then the exchange is played afterwards.
            } else if (state.state.name == stateNames.ACTION_RESPONSE) {
                // Play the challenged action now.
                playAction(state.state.playerIdx, state.state);
            }

            var message = format('{%d} incorrectly challenged {%d}; {%d} exchanged %s for a new role',
                playerIdx, challengedPlayerIdx, challengedPlayerIdx, oldRole);

            // If the challenger is losing their last influence,
            if (player.influenceCount <= 1 ||
                // Or they are losing two influence because the itself action made the challenger reveal an influence,
                // (e.g., someone assassinates you, you incorrectly challenge them, you lose two influence: one for the assassination, one for the failed challenge)
                (state.state.name == stateNames.REVEAL_INFLUENCE && state.state.playerToReveal == playerIdx)) {
                // Then the challenger is dead.
                addHistory(message);
                killPlayer(playerIdx);
                // With an exchange, the player still gets to exchange roles after the challenger dies.
                if (state.state.action != 'exchange') {
                    nextTurn();
                }
            } else {
                state.state = {
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: state.state.action,
                    target: state.state.target,
                    blockingRole: state.state.blockingRole,
                    message: message,
                    playerToReveal: playerIdx
                };
            }
        } else {
            // Player does not have role - challenge won.

            if (state.state.name == stateNames.BLOCK_RESPONSE) {
                // The block was successfully challenged, so play the original action.
                playAction(state.state.playerIdx, state.state);
            }

            var message = format('{%d} successfully challenged {%d}', playerIdx, challengedPlayerIdx);

            // If the challenged player is losing their last influence,
            if (challengedPlayer.influenceCount <= 1 ||
                // Or they are losing two influence because the action itself which failed to be blocked made the challenger reveal an influence,
                // (e.g., someone assassinates you, you bluff contessa, they challenge you, you lose two influence: one for the assassination, one for the successful challenge)
                (state.state.name == stateNames.REVEAL_INFLUENCE && state.state.playerToReveal == challengedPlayerIdx)) {
                // Then the challenged player is dead.
                addHistory(message);
                killPlayer(challengedPlayerIdx);
                nextTurn();
            } else {
                state.state = {
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: state.state.action,
                    target: state.state.target,
                    blockingRole: state.state.blockingRole,
                    message: message,
                    playerToReveal: challengedPlayerIdx
                };
            }
        }
    }

    function playAction(playerIdx, actionState) {
        debug('playing action');
        var target, message;
        var player = state.players[playerIdx];
        var action = actions[actionState.action];
        player.cash += action.gain || 0;
        if (actionState.action == 'assassinate') {
            message = format('{%d} assassinated {%d}', playerIdx, actionState.target);
            target = state.players[actionState.target];
            if (target.influenceCount <= 1) {
                addHistory(message);
                killPlayer(actionState.target);
            } else {
                state.state = {
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: actionState.action,
                    target: actionState.target,
                    blockingRole: actionState.blockingRole,
                    message: message,
                    playerToReveal: actionState.target
                };
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'coup') {
            message = format('{%d} staged a coup on {%d}', playerIdx, actionState.target);
            target = state.players[actionState.target];
            if (target.influenceCount <= 1) {
                addHistory(message);
                killPlayer(actionState.target);
            } else {
                state.state = {
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: actionState.action,
                    target: actionState.target,
                    blockingRole: actionState.blockingRole,
                    message: message,
                    playerToReveal: actionState.target
                };
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'steal') {
            target = state.players[actionState.target];
            addHistory('{%d} stole from {%d}', playerIdx, actionState.target);
            if (target.cash >= 2) {
                target.cash -= 2;
                player.cash += 2;
            } else {
                player.cash += target.cash;
                target.cash = 0;
            }
        } else if (actionState.action == 'exchange') {
            var exchangeOptions = [deck.pop(), deck.pop()].concat(getInfluence(player));
            state.state = {
                name: stateNames.EXCHANGE,
                playerIdx: state.state.playerIdx,
                action: actionState.action,
                exchangeOptions: exchangeOptions
            };
            return false; // Not yet end of turn
        } else {
            addHistory('{%d} drew %s', playerIdx, actionState.action);
        }
        return true; // End of turn
    }

    function swapRole(role) {
        deck.push(role);
        deck = shuffle(deck);
        return deck.pop();
    }

    function nextTurn() {
        debug('next turn');
        if (state.state.name != stateNames.GAME_WON) {
            state.state = {
                name: stateNames.START_OF_TURN,
                playerIdx: nextPlayerIdx()
            };
        }
    }

    function indexOfInfluence(player, role) {
        for (var i = 0; i < player.influence.length; i++) {
            if (player.influence[i].role == role && !player.influence[i].revealed) {
                return i;
            }
        }
        return null;
    }

    function nextPlayerIdx() {
        var playerIdx = state.state.playerIdx;
        for (var i = 1; i < state.numPlayers; i++) {
            var candidateIdx = (playerIdx + i) % state.numPlayers;
            if (state.players[candidateIdx].influenceCount > 0) {
                return candidateIdx;
            }
        }
        debug('no more players');
        return null;
    }

    function debug(obj) {
        if (options.debug) {
            console.log(obj);
        }
    }

    function shuffle(array) {
        if (_test_ignoreShuffle) {
            return array;
        }
        var shuffled = [];
        while (array.length) {
            var i = Math.floor(Math.random() * array.length);
            var e = array.splice(i, 1);
            shuffled.push(e[0]);
        }
        return shuffled;
    }

    function buildDeck() {
        var roles = {};
        for (var actionName in actions) {
            var action = actions[actionName];
            if (action.role) {
                roles[action.role] = true;
            }
            if (action.blockedBy) {
                for (var i = 0; i < action.blockedBy.length; i++) {
                    roles[action.blockedBy[i]] = true;
                }
            }
        }
        var deck = [];
        for (var i = 0; i < 3; i++) {
            deck = deck.concat(Object.keys(roles));
        }
        return shuffle(deck);
    }

    function addHistory() {
        var message = format.apply(null, arguments);
        if (options.logger) {
            options.logger.log('info', 'game %d: %s', gameId, message);
        }
        for (var i = 0; i < state.numPlayers; i++) {
            addHistoryAsync(i, message);
        }
    }

    function addHistoryAsync(dest, message) {
        setTimeout(function () {
            if (players[dest] != null) {
                players[dest].onHistoryEvent(message);
            }
        }, 0);
    }

    function canJoin() {
        return state.state.name == stateNames.WAITING_FOR_PLAYERS;
    }

    function sendChatMessage(playerIdx, message) {
        message = escape(message).substring(0, 1000);
        for (var i = 0; i < players.length; i++) {
            sendChatMessageAsync(i, playerIdx, message);
        }
    }

    function sendChatMessageAsync(dest, playerIdx, message) {
        if (players[dest] != null) {
            players[dest].onChatMessage(playerIdx, message);
        }
    }

    function _test_setTurnState(turn, emit) {
        state.state = turn;
        if (emit) {
            emitState();
        }
    }

    function _test_setInfluence(/*playerIdx, role, role*/) {
        var args = Array.prototype.slice.apply(arguments);
        var playerIdx = args.shift();
        var influence = state.players[playerIdx].influence;
        state.players[playerIdx].influenceCount = args.length;
        for (var i = 0; i < influence.length; i++) {
            var role = args.shift();
            if (role) {
                influence[i].role = role;
                influence[i].revealed = false;
            } else {
                influence[i].revealed = true;
            }
        }
    }

    function _test_setCash(playerIdx, cash) {
        state.players[playerIdx].cash = cash;
    }

    function _test_setDeck(d) {
        deck = d;
        _test_ignoreShuffle = true;
    }

    return game;
};

function GameException(message) {
    this.message = message;
}
