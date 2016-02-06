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
var shared = require('./web/shared');
var actions = shared.actions;
var stateNames = shared.states;

var format = require('util').format;
var deepcopy = require('deepcopy');
var EventEmitter = require('events').EventEmitter;

module.exports = function createGameCore(options) {
    options = options || {};

    var state;

    var gameCore = new EventEmitter();
    gameCore.applyCommand = applyCommand;
    gameCore.allow = allow;

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
            gameCore.emit('end');
            return true;
        } else {
            return false;
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

    function applyCommand(s, playerIdx, command) {
        state = s;

        var i, action, message;
        var player = state.players[playerIdx];

        if (command.command == 'play-action') {
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
                if (playAction(playerIdx, command, false)) {
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
                setState({
                    name: stateNames.ACTION_RESPONSE,
                    playerIdx: playerIdx,
                    action: command.action,
                    target: command.target,
                    message: message,
                    allowed: initAllowed(playerIdx)
                });
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
                    addHistoryEx(state.state.reason, state.state.continuation, '%s; {%d} revealed %s', state.state.message, playerIdx, command.role);
                    if (state.state.reason == 'incorrect-challenge') {
                        if (afterIncorrectChallenge()) {
                            nextTurn();
                        }
                    } else if (state.state.reason == 'successful-challenge') {
                        if (afterSuccessfulChallenge()) {
                            nextTurn();
                        }
                    } else {
                        // The reveal is due to a coup or assassination.
                        nextTurn();
                    }
                    return state;
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
            if (state.state.name == stateNames.ACTION_RESPONSE) {
                addHistory(state.state.action, state.state.message);
            }
            setState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: state.state.playerIdx,
                action: state.state.action,
                target: playerIdx,
                blockingRole: command.blockingRole,
                message: format('{%d} attempted to block with ' + command.blockingRole, playerIdx),
                allowed: initAllowed(playerIdx)
            });

        } else if (command.command == 'allow') {
            if (player.influenceCount == 0) {
                throw new GameException('Dead players cannot allow actions');
            }
            var newState = allow(state, playerIdx);
            if (!newState) {
                // Do not emit state.
                return;
            } else {
                state = newState;
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
            unchosen.forEach(replaceRole);
            addHistoryEx('exchange', state.state.continuation, '{%d} exchanged roles', playerIdx);
            nextTurn();

        } else {
            throw new GameException('Unknown command');
        }

        return state;
    }

    function allow(state, playerIdx) {
        if (state.state.name == stateNames.BLOCK_RESPONSE) {
            if (state.state.target == playerIdx) {
                throw new GameException('Cannot allow your own block');
            }
            state.state.allowed[playerIdx] = true;
            if (everyoneAllowed()) {
                contHistory('block', '{%d} blocked with %s', state.state.target, state.state.blockingRole);
                nextTurn();
                return state;
            } else {
                return null;
            }
        } else if (state.state.name == stateNames.ACTION_RESPONSE || state.state.name == stateNames.FINAL_ACTION_RESPONSE) {
            if (state.state.playerIdx == playerIdx) {
                throw new GameException('Cannot allow your own action');
            }
            if (state.state.name == stateNames.FINAL_ACTION_RESPONSE) {
                if (state.state.target != playerIdx) {
                    throw new GameException('Only the targeted player can allow the action');
                }
            } else {
                state.state.allowed[playerIdx] = true;
                if (!everyoneAllowed()) {
                    return null;
                }
            }
            // Create a new history item if everyone allowed the initial action, with no other events.
            var continuation = state.state.name != stateNames.ACTION_RESPONSE;
            if (playAction(state.state.playerIdx, state.state, continuation)) {
                nextTurn();
            }
            return state;
        } else {
            throw new GameException('Incorrect state');
        }
    }

    function afterSuccessfulChallenge() {
        // The reveal is due to a successful challenge.
        if (state.state.blockingRole) {
            // A block was successfully challenged - the action goes ahead.
            return playAction(state.state.playerIdx, state.state, true);
        } else {
            // The original action was successfully challenged - it does not happen - next turn.
            return true;
        }
    }

    function afterIncorrectChallenge() {
        var action = actions[state.state.action];

        // The reveal is due to a failed challenge.
        if (state.state.blockingRole) {
            // A block was incorrectly challenged - the action is blocked - next turn.
            return true;
        } else {
            // The original action was challenged.
            var target = state.players[state.state.target];
            if (action.blockedBy && target.influenceCount > 0) {
                // The targeted player has a final chance to block the action.
                setState({
                    name: stateNames.FINAL_ACTION_RESPONSE,
                    playerIdx: state.state.playerIdx,
                    action: state.state.action,
                    target: state.state.target,
                    message: state.state.message
                });
                return false;
            } else {
                // The action cannot be blocked - it goes ahead.
                return playAction(state.state.playerIdx, state.state, true);
            }
        }
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

    function initAllowed(initiatingPlayerIdx) {
        var allowed = [];
        // The player who took the action does not need to allow it.
        allowed[initiatingPlayerIdx] = true;
        return allowed;
    }

    function everyoneAllowed() {
        for (var i = 0; i < state.numPlayers; i++) {
            if (state.players[i].influenceCount == 0) {
                // We don't care whether dead players allowed the action.
                continue;
            }
            if (!state.state.allowed[i]) {
                return false;
            }
        }
        return true;
    }

    function challenge(playerIdx, challengedPlayerIdx, challegedRole) {
        var revealedRole, endOfTurn;
        var player = state.players[playerIdx];
        var challengedPlayer = state.players[challengedPlayerIdx];
        if (!challengedPlayer) {
            throw new GameException('Cannot identify challenged player');
        }
        if (state.state.blockingRole) {
            // Someone already blocked, so the history item is a continuation.
            contHistory('block', state.state.message);
        } else {
            // Otherwise, this is the first history item (<player> attempted to <action>).
            addHistory(state.state.action, state.state.message);
        }

        var influenceIdx = indexOfInfluence(challengedPlayer, challegedRole);
        if (influenceIdx != null) {
            // Player has role - challenge lost.

            // Deal the challenged player a replacement card.
            var oldRole = challengedPlayer.influence[influenceIdx].role;
            challengedPlayer.influence[influenceIdx].role = swapRole(oldRole);

            var message = format('{%d} incorrectly challenged {%d}; {%d} exchanged %s for a new role',
                playerIdx, challengedPlayerIdx, challengedPlayerIdx, oldRole);

            // If the challenger is losing their last influence,
            if (player.influenceCount <= 1) {
                // Then the challenger is dead. Reveal an influence.
                revealedRole = revealFirstInfluence(player);
                contHistory('incorrect-challenge', '%s; {%d} revealed %s', message, playerIdx, revealedRole);

                endOfTurn = afterIncorrectChallenge();

                afterPlayerDeath(playerIdx);

                if (endOfTurn) {
                    nextTurn();
                }
            } else {
                // The action will take place after the reveal.
                setState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: state.state.action,
                    target: state.state.target,
                    blockingRole: state.state.blockingRole,
                    message: message,
                    reason: 'incorrect-challenge',
                    playerToReveal: playerIdx,
                    continuation: true
                });
            }
        } else {
            // Player does not have role - challenge won.
            var message = format('{%d} successfully challenged {%d}', playerIdx, challengedPlayerIdx);

            // If someone assassinates you, you bluff contessa, and they challenge you, then you lose two influence: one for the assassination, one for the successful challenge.
            var wouldLoseTwoInfluences = state.state.name == stateNames.BLOCK_RESPONSE && state.state.action == 'assassinate' &&
                state.state.target == challengedPlayerIdx;

            // If the challenged player is losing their last influence,
            if (challengedPlayer.influenceCount <= 1 || wouldLoseTwoInfluences) {
                // Then the challenged player is dead. Reveal an influence.
                revealedRole = revealFirstInfluence(challengedPlayer);
                contHistory('successful-challenge', '%s; {%d} revealed %s', message, challengedPlayerIdx, revealedRole);

                if (challengedPlayer.influenceCount == 0) {
                    afterPlayerDeath(challengedPlayerIdx);
                }

                endOfTurn = afterSuccessfulChallenge();

                if (endOfTurn) {
                    nextTurn();
                }
            } else {
                setState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: state.state.action,
                    target: state.state.target,
                    blockingRole: state.state.blockingRole,
                    message: message,
                    reason: 'successful-challenge',
                    playerToReveal: challengedPlayerIdx,
                    continuation: true
                });
            }
        }
    }

    function revealFirstInfluence(player) {
        var influence = player.influence;
        for (var j = 0; j < influence.length; j++) {
            if (!influence[j].revealed) {
                influence[j].revealed = true;
                player.influenceCount--;
                return influence[j].role;
            }
        }
        return null;
    }

    function playAction(playerIdx, actionState, cont) {
        debug('playing action');
        var target, message, revealedRole;
        var player = state.players[playerIdx];
        var action = actions[actionState.action];
        player.cash += action.gain || 0;
        if (actionState.action == 'assassinate') {
            message = format('{%d} assassinated {%d}', playerIdx, actionState.target);
            target = state.players[actionState.target];
            if (target.influenceCount == 1) {
                revealedRole = revealFirstInfluence(target);
                addHistoryEx('assassinate', cont, '%s; {%d} revealed %s', message, actionState.target, revealedRole);
                afterPlayerDeath(actionState.target);
            } else if (target.influenceCount > 1) {
                setState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: actionState.action,
                    target: actionState.target,
                    blockingRole: actionState.blockingRole,
                    message: message,
                    reason: 'assassinate',
                    playerToReveal: actionState.target,
                    continuation: cont
                });
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'coup') {
            message = format('{%d} staged a coup on {%d}', playerIdx, actionState.target);
            target = state.players[actionState.target];
            if (target.influenceCount <= 1) {
                revealedRole = revealFirstInfluence(target);
                addHistoryEx('coup', cont, '%s; {%d} revealed %s', message, actionState.target, revealedRole);
                afterPlayerDeath(actionState.target);
            } else {
                setState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: state.state.playerIdx,
                    action: actionState.action,
                    target: actionState.target,
                    blockingRole: actionState.blockingRole,
                    message: message,
                    reason: 'coup',
                    playerToReveal: actionState.target,
                    continuation: cont
                });
                return false; // Not yet end of turn
            }
        } else if (actionState.action == 'steal') {
            target = state.players[actionState.target];
            addHistoryEx('steal', cont, '{%d} stole from {%d}', playerIdx, actionState.target);
            if (target.cash >= 2) {
                target.cash -= 2;
                player.cash += 2;
            } else {
                player.cash += target.cash;
                target.cash = 0;
            }
        } else if (actionState.action == 'exchange') {
            var exchangeOptions = [drawRole(), drawRole()].concat(getInfluence(player));
            setState({
                name: stateNames.EXCHANGE,
                playerIdx: state.state.playerIdx,
                action: actionState.action,
                exchangeOptions: exchangeOptions,
                // After exchanging, need to know whether to create a new history item or continue existing one
                continuation: cont
            });
            return false; // Not yet end of turn
        } else {
            addHistoryEx(actionState.action, cont, '{%d} drew %s', playerIdx, actionState.action);
        }
        return true; // End of turn
    }

    function setState(s) {
        debug('State change from ' + state.state.name + ' to ' + s.name);
        state.state = s;
    }

    function swapRole(role) {
        replaceRole(role);
        return drawRole();
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

        gameCore.emit('history', {
            message: message,
            type: type,
            continuation: continuation
        });
    }

    function drawRole() {
        return options.drawRole();
    }

    function replaceRole() {
        return (options.replaceRole || function nop() {})();
    }

    return gameCore;
};

function GameException(message) {
    this.message = message;
}
