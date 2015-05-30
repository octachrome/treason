'use strict';

var shared = require('./web/shared.js');
var stateNames = shared.states;

var playerId = 1;

function createAiPlayer(game) {
    var player = {
        name: 'Computer ' + playerId++,
        onStateChange: onStateChange,
        setExchangeOptions: setExchangeOptions,
        onChatMessage: function() {}
    };

    try {
        var gameProxy = game.playerJoined(player);
    } catch(e) {
        handleError(e);
        return;
    }

    function onStateChange(state) {
        if (state.state.name == stateNames.START_OF_TURN && state.state.playerIdx == state.playerIdx) {
            var player = state.players[state.state.playerIdx];
            if (player.cash >= 10) {
                // We must coup
                var target = (state.state.playerIdx + 1) % state.numPlayers;
                command({
                    stateId: state.stateId,
                    command: 'play-action',
                    action: 'coup',
                    target: target
                });
            } else {
                // We're the duke, of course.
                command({
                    stateId: state.stateId,
                    command: 'play-action',
                    action: 'tax'
                });
            }

        } else if ((state.state.name == stateNames.ACTION_RESPONSE || state.state.name == stateNames.BLOCK_RESPONSE)
            && state.state.playerIdx != state.playerIdx) {
            // Allow other players' actions and blocks
            command({
                stateId: state.stateId,
                command: 'allow'
            });

        } else if (state.state.name == stateNames.REVEAL_INFLUENCE && state.state.target == state.playerIdx) {
            // Reveal our first influence
            var player = state.players[state.state.target];
            command({
                stateId: state.stateId,
                command: 'reveal',
                role: player.influence[0].role
            });
        }
    }

    function setExchangeOptions(options) {
    }

    function command(command) {
        try {
            gameProxy.command(command);
        } catch(e) {
            console.error(e);
            console.error(e.stack);
        }
    }
}

module.exports = createAiPlayer;
