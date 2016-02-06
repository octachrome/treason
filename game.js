/*
 * Copyright 2015 Christopher Brown
 *
 * This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
 *
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/ or send a letter to:
 *     Creative Commons
 *     PO Box 1866
 *     Mountain View
 *     CA 94042
 *     USA
 */
'use strict';
var fs = require('fs');
var rand = require('random-seed')();
var createAiPlayer = require('./ai-player');
var shared = require('./web/shared');
var actions = shared.actions;
var stateNames = shared.states;
var createGameCore = require('./game-core');

var format = require('util').format;
var inherits = require('util').inherits;
var deepcopy = require('deepcopy');
var escape = require('validator').escape;
var EventEmitter = require('events').EventEmitter;

var nextGameId = 1;
var nextPlayerId = 1;

var MIN_PLAYERS = 2;
var MAX_PLAYERS = 6;

var epithets;

fs.readFile(__dirname + '/epithets.txt', function(err, data) {
    if (err) {
        throw err;
    }
    epithets = data.toString().split(/\r?\n/);
});

module.exports = function createGame(options) {
    options = options || {};
    var gameId = nextGameId++;

    var state = {
        stateId: 1,
        gameId: gameId,
        players: [],
        numPlayers: 0,
        gameName: options.gameName,
        created: options.created,
        state: {
            name: stateNames.WAITING_FOR_PLAYERS
        }
    };

    var players = [];
    var proxies = [];

    var deck = buildDeck();
    var _test_ignoreShuffle = false;

    var game = new EventEmitter();
    game.canJoin = canJoin;
    game.playerJoined = playerJoined;
    game._test_setTurnState = _test_setTurnState;
    game._test_setInfluence = _test_setInfluence;
    game._test_setCash = _test_setCash;
    game._test_setDeck = _test_setDeck;

    var gameCore = createGameCore({
        drawRole: function () {
            return deck.pop();
        },
        replaceRole: function (role) {
            deck.push(role);
            deck = shuffle(deck);
        },
        debug: options.debug
    });
    gameCore.on('end', function () {
        game.emit('end');
    });
    gameCore.on('history', function (hist) {
        addHistory0(hist.type, hist.continuation, hist.message);
    });

    function playerJoined(player) {
        var isObserver = false;
        if (state.state.name != stateNames.WAITING_FOR_PLAYERS) {
            isObserver = true;
            if (!state.gameName) {
                throw new GameException('Cannot join game ' + gameId + ': it has started');
            }
        }
        if (state.players.length >= MAX_PLAYERS) {
            isObserver = true;
            if (!state.gameName) {
                throw new GameException('Cannot join game ' + gameId + ': it is full');
            }
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
            ],
            isObserver: isObserver
        };

        if (isObserver) {
            playerState.cash = 0;
            playerState.influenceCount = 0;
            playerState.influence = [];
        }

        var playerIdx = state.players.length;
        state.players.push(playerState);
        players.push(player);
        state.numPlayers++;

        if (state.numPlayers === MAX_PLAYERS) {
            start();
        }

        addHistory('player-joined', playerState.name + ' joined the game' +(isObserver ? ' as an observer': ''));
        emitState();

        var proxy = createGameProxy(playerIdx);
        if (isObserver) {
            proxy.command = new function() {};
        }
        proxies.push(proxy);
        return proxy;
    }

    function playerName(name) {
        name = name || 'Anonymous';
        for (var i = 0; i < state.players.length; i++) {
            if (state.players[i].name == name) {
                var epithet = epithets[rand(epithets.length)];
                return playerName(name + ' ' + epithet);
            }
        }
        return name;
    }

    function createGameProxy(playerIdx, oldProxy) {
        var proxy = oldProxy || {};
        proxy.command = function (data) {
            command(playerIdx, data);
        };
        proxy.playerLeft = function (rejoined) {
            playerLeft(playerIdx, rejoined);
        };
        proxy.sendChatMessage = function (message) {
            sendChatMessage(playerIdx, message);
        };
        proxy.getGameName = function () {
            return state.gameName;
        }
        return proxy;
    }

    function playerLeft(playerIdx, rejoined) {
        if (playerIdx == null || playerIdx < 0 || playerIdx >= state.numPlayers) {
            throw new GameException('Unknown player disconnected');
        }
        var player = state.players[playerIdx];
        if (!player) {
            throw new GameException('Unknown player disconnected');
        }
        var historySuffix = [];
        if (state.state.name == stateNames.WAITING_FOR_PLAYERS || player.isObserver) {
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
                // Reveal all the player's influence.
                var influence = player.influence;
                for (var j = 0; j < influence.length; j++) {
                    if (!influence[j].revealed) {
                        historySuffix.push(format('{%d} revealed %s', playerIdx, influence[j].role));
                        influence[j].revealed = true;
                    }
                }
                player.influenceCount = 0;
                var end = checkForGameEnd();
                if (!end) {
                    if (state.state.playerIdx == playerIdx) {
                        nextTurn();
                    } else if (state.state.name == stateNames.REVEAL_INFLUENCE && state.state.playerToReveal == playerIdx) {
                        nextTurn();
                    } else if ((state.state.name == stateNames.ACTION_RESPONSE || state.state.name == stateNames.BLOCK_RESPONSE)
                        && !state.state.allowed[playerIdx]) {
                        state = gameCore.allow(state, playerIdx) || state;
                    }
                }
            }
        }
        addHistory('player-left', player.name + ' left the game' + (rejoined ? ' to play again' : ''));
        for (var k = 0; k < historySuffix.length; k++) {
            contHistory('player-left', historySuffix[k]);
        }
        checkOnlyAiLeft();
        emitState();
    }

    function checkOnlyAiLeft() {
        for (var i = 0; i < players.length; i++) {
            if (players[i] && (players[i].type || 'human') === 'human') {
                return;
            }
        }
        destroyGame();
    }

    function destroyGame() {
        debug('destroying game');
        players = [];
        proxies = [];
        game.emit('end');
    }

    function afterPlayerDeath(playerIdx) {
        addHistory('player-died', '{%d} suffered a humiliating defeat', playerIdx);
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
            setState({
                name: stateNames.GAME_WON,
                playerIdx: winnerIdx
            });
            game.emit('end');
            return true;
        } else {
            return false;
        }
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
            setState({
                name: stateNames.START_OF_TURN,
                playerIdx: firstPlayer
            });
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
            throw new GameException('Stale state (' + command.stateId + '!=' + state.stateId + ')');
        }
        if (command.command == 'start') {
            start();

        } else if (command.command == 'add-ai') {
            if (state.state.name != stateNames.WAITING_FOR_PLAYERS) {
                throw new GameException('Incorrect state');
            }
            createAiPlayer(game, options);

        } else {
            var newState = gameCore.applyCommand(state, playerIdx, command);
            if (!newState) {
                // Do not emit state.
                return;
            } else {
                state = newState;
            }
        }

        emitState();
    }

    function setState(s) {
        debug('State change from ' + state.state.name + ' to ' + s.name);
        state.state = s;
    }

    function nextTurn() {
        debug('next turn');
        if (state.state.name != stateNames.GAME_WON) {
            setState({
                name: stateNames.START_OF_TURN,
                playerIdx: nextPlayerIdx()
            });
        }
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

    // Add a new history item (not a continuation).
    function addHistory(/*type, format_string, format_args...*/) {
        var args = Array.prototype.slice.apply(arguments);
        args.splice(1, 0, false);
        addHistoryEx.apply(null, args);
    }

    // Add a continuation history item.
    function contHistory(/*type, format_string, format_args...*/) {
        var args = Array.prototype.slice.apply(arguments);
        args.splice(1, 0, true);
        addHistoryEx.apply(null, args);
    }

    // Add a history item, which may or may not be a continuation.
    function addHistoryEx(/*type, continuation, format_string, format_args...*/) {
        var args = Array.prototype.slice.apply(arguments);
        var type = args.shift();
        var continuation = args.shift();
        var message = format.apply(null, args);
        addHistory0(type, continuation, message);
    }

    function addHistory0(type, continuation, message) {
        if (options.logger) {
            options.logger.log('info', 'game %d: %s', gameId, message);
        }
        for (var i = 0; i < state.numPlayers; i++) {
            addHistoryAsync(i, message, type, continuation);
        }
    }

    function addHistoryAsync(dest, message, type, continuation) {
        setTimeout(function () {
            if (players[dest] != null) {
                players[dest].onHistoryEvent(message, type, continuation);
            }
        }, 0);
    }

    function canJoin() {
        return state.state.name == stateNames.WAITING_FOR_PLAYERS || state.gameName;
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
        setState(turn);
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
