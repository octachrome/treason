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
var Minimax = require('./minimax');
var MinimaxCoup = require('./minimax-coup');
var shared = require('./web/shared');
var stateNames = shared.states;

function createMinimaxPlayer(game, options) {
    var player = {
        name: 'Minimax',
        onStateChange: onStateChange,
        onHistoryEvent: function () {},
        onChatMessage: function() {},
        type: 'minimax'
    };

    try {
        var gameProxy = game.playerJoined(player);
    }
    catch(e) {
        handleError(e);
        return;
    }

    var minimax;

    function onStateChange(state) {
        aiPlayerIdx = state.playerIdx;

        if (state.state.name === stateNames.START_OF_TURN && state.state.playerIdx === aiPlayerIdx) {
            // Start of our turn.
        }
        else if (state.state.name === stateNames.ACTION_RESPONSE && aiPlayerIdx !== state.state.playerIdx) {
            // We can respond to an action:
            //   We may be targeted and be able to block or challenge.
            //   We may not be targeted and only be able to challenge.
        }
        else if (state.state.name === stateNames.FINAL_ACTION_RESPONSE && aiPlayerIdx === state.state.target) {
            // We have a final chance to block an action against us.
        }
        else if (state.state.name === stateNames.BLOCK_RESPONSE && aiPlayerIdx !== state.state.target) {
            // Our action or another player's action has been blocked and we have an opportunity to challenge.
        }
        else if (state.state.name === stateNames.REVEAL_INFLUENCE && state.state.playerToReveal === state.playerIdx) {
            // We need to reveal an influence.
        }
        else if (state.state.name === stateNames.EXCHANGE && state.state.playerIdx === aiPlayerIdx) {
            // We must choose which roles to exchange.
        }
        else {
            // We should not respond to this state.
            return;
        }

        if (!minimax) {
            minimax = new Minimax(new MinimaxCoup(aiPlayerIdx));
        }

        try {
            var command = minimax.getBestMove({
                currentPlayer: aiPlayerIdx, // In the minimax state it is always our 'turn', which might just mean our turn to block, etc.
                state: state,
            });
            command.stateId = state.stateId;
            gameProxy.command(command);
        }
        catch (e) {
            if (e.stack) {
                console.error(e.stack);
            }
            else {
                console.error(e);
            }
        }
    }
}

module.exports = createMinimaxPlayer;
