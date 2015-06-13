'use strict';

var shared = require('./web/shared.js');
var actions = shared.actions;
var stateNames = shared.states;

var deepcopy = require('deepcopy');
var escape = require('validator').escape;

var nextGameId = 1;
var nextPlayerId = 1;

var MIN_PLAYERS = 2;
var MAX_PLAYERS = 6;

module.exports = function createGame(debugging) {
    var gameId = nextGameId++;

    var state = {
        stateId: 1,
        gameId: gameId,
        players: [],
        numPlayers: 0,
        state: createState(stateNames.WAITING_FOR_PLAYERS),
        history: []
    };

    var players = [];
    var allows = [];
    var proxies = [];

    var deck = buildDeck();

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

        addHistory(null, playerState.name + ' joined the game');
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
            }
        }
        addHistory(null, player.name + ' left the game');
        emitState();
    }

    function killPlayer(playerIdx, playerLeft) {
        // Reveal all the player's influence.
        var player = state.players[playerIdx];
        var influence = player.influence;
        for (var j = 0; j < influence.length; j++) {
            if (!influence[j].revealed) {
                addHistory(playerIdx, 'revealed ' + influence[j].role);
                influence[j].revealed = true;
            }
        }
        player.influenceCount = 0;
        if (!playerLeft) {
            addHistory(playerIdx, ' suffered a humiliating defeat');
        }
        if (state.state.playerIdx == playerIdx) {
            nextTurn();
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
            state.state = createState(stateNames.GAME_WON, winnerIdx);
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
            for (var i = 0; i < state.numPlayers; i++) {
                var influence = state.players[i].influence;
                for (var j = 0; j < influence.length; j++) {
                    influence[j].role = deck.pop();
                }
            }
            var firstPlayer = Math.floor(Math.random() * state.numPlayers);
            state.state = createState(stateNames.START_OF_TURN, firstPlayer);
        }
    }

    function command(playerIdx, command) {
        debug('command from player: ' + playerIdx);
        debug(command);
        var i;
        var player = state.players[playerIdx];
        if (player == null) {
            throw new GameException('Unknown player');
        }
        if (command.stateId != state.stateId) {
            throw new GameException('Stale state');
        }

        if (command.command == 'start') {
            start();

        } else if (command.command == 'play-action') {
            if (state.state.name != stateNames.START_OF_TURN) {
                throw new GameException('Incorrect state');
            }
            if (state.state.playerIdx != playerIdx) {
                throw new GameException('Not your turn');
            }
            var action = actions[command.action];
            if (action == null) {
                throw new GameException('Unknown action');
            }
            if (player.cash >= 10 && command.action != 'coup') {
                throw new GameException('You must coup with >= 10 cash');
            }
            if (player.cash < action.cost) {
                throw new GameException('Not enough cash');
            }
            if (action.targetted) {
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
                    addHistory(playerIdx, 'attempted to steal from', command.target);
                } else if (command.action == 'assassinate') {
                    addHistory(playerIdx, 'attempted to assassinate', command.target);
                } else if (command.action == 'exchange') {
                    addHistory(playerIdx, 'attempted to exchange');
                } else {
                    addHistory(playerIdx, 'attempted to draw ' + command.action);
                }
                state.state = createState(stateNames.ACTION_RESPONSE, playerIdx, command.action, command.target);
                resetAllows(playerIdx);
            }

        } else if (command.command == 'challenge') {
            if (state.state.name == stateNames.ACTION_RESPONSE) {
                if (playerIdx == state.state.playerIdx) {
                    throw new GameException('Cannot challenge your own action');
                }
                var action = actions[state.state.action];
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
                challenge(playerIdx, state.state.target, state.state.role);

            } else {
                throw new GameException('Incorrect state');
            }

        } else if (command.command == 'reveal') {
            if (state.state.name != stateNames.REVEAL_INFLUENCE) {
                throw new GameException('Incorrect state');
            }
            if (state.state.target != playerIdx) {
                throw new GameException('Not your turn to reveal an influence');
            }
            for (i = 0; i < player.influence.length; i++) {
                var influence = player.influence[i];
                if (influence.role == command.role && !influence.revealed) {
                    influence.revealed = true;
                    player.influenceCount--;
                    addHistory(playerIdx, 'revealed ' + command.role);
                    if (state.state.action == 'exchange' && state.state.target != state.state.playerIdx) {
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
            if (state.state.name != stateNames.ACTION_RESPONSE) {
                throw new GameException('Incorrect state');
            }
            var action = actions[state.state.action];
            if (!action) {
                throw new GameException('Unknown action');
            }
            if (playerIdx == state.state.playerIdx) {
                throw new GameException('Cannot block your own action');
            }
            if (!action.blockedBy) {
                throw new GameException('Action cannot be blocked');
            }
            if (!command.role) {
                throw new GameException('No blocking role specified');
            }
            if (action.blockedBy.indexOf(command.role) < 0) {
                throw new GameException('Action cannot be blocked by that role');
            }
            // Original player is in the playerIdx field; blocking player is in the target field.
            addHistory(playerIdx, 'attempted to block with ' + command.role);
            state.state = createState(stateNames.BLOCK_RESPONSE, state.state.playerIdx, state.state.action, playerIdx, null, command.role);
            resetAllows(playerIdx);

        } else if (command.command == 'allow') {
            if (state.state.name == stateNames.BLOCK_RESPONSE) {
                if (state.state.target == playerIdx) {
                    throw new GameException('Cannot allow your own block');
                }
                allows[playerIdx] = true;
                if (everyoneAllows()) {
                    addHistory(state.state.target, 'blocked with ' + state.state.role);
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
            if (!containsAll(state.state.exchangeOptions, command.roles)) {
                throw new GameException('Invalid choice of roles');
            }
            for (i = 0; i < player.influence.length; i++) {
                if (!player.influence[i].revealed) {
                    player.influence[i].role = command.roles.pop()
                }
            }
            addHistory(playerIdx, ' exchanged roles');
            nextTurn();

        } else {
            throw new GameException('Unknown command');
        }

        emitState();
    }

    function containsAll(array, subarray) {
        array = deepcopy(array);
        for (var i = 0; i < subarray.length; i++) {
            var idx = array.indexOf(subarray[i]);
            if (idx == -1) {
                return false;
            }
            array.splice(idx, 1);
        }
        return true;
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
        var influenceIdx = indexOfInfluence(challengedPlayer, challegedRole);
        if (influenceIdx != null) {
            // Player has role - challenge lost.
            addHistory(playerIdx, 'incorrectly challenged', challengedPlayerIdx);
            if (player.influenceCount <= 1 ||
                (player.influenceCount <= 2 && state.state.name == stateNames.ACTION_RESPONSE && state.state.action == 'assassinate')) {
                // The player is dead (challenging an assassination and failing loses you two influnece)
                // todo: this is only true if the challenger was the target of the assassination
                killPlayer(playerIdx);
            } else {
                if (state.state.name == stateNames.ACTION_RESPONSE && state.state.action != 'exchange') {
                    // The action was unsuccessfully challenged, so play it.
                    // If the action was an exchange, the exchange must place after the reveal.
                    playAction(state.state.playerIdx, state.state);
                }
                state.state = createState(stateNames.REVEAL_INFLUENCE, state.state.playerIdx, state.state.action, playerIdx, 'failed challenge');
            }
            // Deal the challenged player a replacement card.
            var oldRole = challengedPlayer.influence[influenceIdx].role;
            challengedPlayer.influence[influenceIdx].role = swapRole(oldRole);
            addHistory(challengedPlayerIdx, 'exchanged ' + oldRole + ' for a new role');
        } else {
            // Player does not have role - challenge won.
            addHistory(playerIdx, 'successfully challenged', challengedPlayerIdx);
            if (challengedPlayer.influenceCount <= 1 ||
                (challengedPlayer.influenceCount <= 2 && state.state.name == stateNames.BLOCK_RESPONSE && state.state.action == 'assassinate')) {
                // The player is dead (challenging a contessa block of an assassination and succeeding takes out two influence)
                killPlayer(challengedPlayerIdx);
            } else {
                if (state.state.name == stateNames.BLOCK_RESPONSE) {
                    // The block was successfully challenged, so play the original action.
                    playAction(state.state.playerIdx, state.state);
                }
                state.state = createState(stateNames.REVEAL_INFLUENCE, state.state.playerIdx, state.state.action, challengedPlayerIdx, 'successfully challenged');
            }
        }
    }

    function playAction(playerIdx, actionState) {
        debug('playing action');
        var player = state.players[playerIdx];
        var action = actions[actionState.action];
        player.cash += action.gain || 0;
        if (actionState.action == 'assassinate') {
            addHistory(playerIdx, 'assassinated', actionState.target);
            var target = state.players[actionState.target];
            if (target.influenceCount <= 1) {
                killPlayer(actionState.target);
            } else {
                state.state = createState(stateNames.REVEAL_INFLUENCE, playerIdx, actionState.action, actionState.target, 'assassinated');
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'coup') {
            addHistory(playerIdx, 'staged a coup on', actionState.target);
            var target = state.players[actionState.target];
            if (target.influenceCount <= 1) {
                killPlayer(actionState.target);
            } else {
                state.state = createState(stateNames.REVEAL_INFLUENCE, playerIdx, actionState.action, actionState.target, 'coup');
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'steal') {
            var target = state.players[actionState.target];
            addHistory(playerIdx, 'stole from', actionState.target);
            if (target.cash >= 2) {
                target.cash -= 2;
                player.cash += 2;
            } else {
                player.cash += target.cash;
                target.cash = 0;
            }
        } else if (actionState.action == 'exchange') {
            var exchangeOptions = [deck.pop(), deck.pop()].concat(getInfluence(player));
            state.state = createState(stateNames.EXCHANGE, playerIdx, actionState.action, null, null, null, exchangeOptions);
            return false; // Not yet end of turn
        } else {
            addHistory(playerIdx, 'drew ' + actionState.action);
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
            state.state = createState(stateNames.START_OF_TURN, nextPlayerIdx());
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

    function createState(stateName, playerIdx, action, target, message, role, exchangeOptions) {
        return {
            name: stateName,
            playerIdx: playerIdx,
            action: action,
            target: target,
            message: message,
            role: role,
            exchangeOptions: exchangeOptions
        };
    }

    function debug(obj) {
        if (debugging) {
            console.log(obj);
        }
    }

    function shuffle(array) {
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

    function addHistory(playerIdx, message, target) {
        state.history.push({
            playerIdx: playerIdx,
            message: message,
            target: target
        });
    }

    function canJoin() {
        return state.state.name == stateNames.WAITING_FOR_PLAYERS;
    }

    function sendChatMessage(playerIdx, message) {
        message = escape(message).substring(0, 1000);
        for (var i = 0; i < players.length; i++) {
            if (players[i] != null) {
                players[i].onChatMessage(playerIdx, message);
            }
        }
    }

    return {
        canJoin: canJoin,
        playerJoined: playerJoined
    };
};

function GameException(message) {
    this.message = message;
}
