'use strict';

var shared = require('./web/shared.js');
var stateNames = shared.states;

var rankedRoles = ['duke', 'assassin', 'captain', 'contessa', 'ambassador'];

var playerId = 1;
var dbg = false;

function createAiPlayer(game) {
    var player = {
        name: 'Computer ' + playerId++,
        onStateChange: onStateChange,
        onChatMessage: function() {}
    };

    try {
        var gameProxy = game.playerJoined(player);
    } catch(e) {
        handleError(e);
        return;
    }

    var state;
    var aiPlayer;
    var currentPlayer;
    var targetPlayer;

    function onStateChange(s) {
        state = s;
        aiPlayer = state.players[state.playerIdx];
        currentPlayer = state.players[state.state.playerIdx];
        targetPlayer = state.players[state.state.target];

        if (state.state.name == stateNames.START_OF_TURN && currentPlayer == aiPlayer) {
            playOurTurn();

        } else if ((state.state.name == stateNames.ACTION_RESPONSE && aiPlayer != currentPlayer) ||
            (state.state.name == stateNames.BLOCK_RESPONSE && aiPlayer != targetPlayer)) {
            // Allow other players' actions and blocks
            debug('allowing');
            command({
                command: 'allow'
            });

        } else if (state.state.name == stateNames.REVEAL_INFLUENCE && targetPlayer == aiPlayer) {
            revealLowestRanked();
        } else if (state.state.name == stateNames.EXCHANGE && currentPlayer == aiPlayer) {
            exchange();
        }
    }

    function playOurTurn() {
        var influence = ourInfluence();
        debug('influence: ' + influence);

        if (influence.indexOf('assassin') >= 0 && aiPlayer.cash >= 3) {
            debug('assassinate');
            // todo: and if that player does not have a contessa?
            command({
                command: 'play-action',
                action: 'assassinate',
                target: chooseTarget()
            });
        } else if (aiPlayer.cash >= 7) {
            debug('coup');
            command({
                command: 'play-action',
                action: 'coup',
                target: chooseTarget()
            });
        } else if (influence.indexOf('captain') >= 0) {
            debug('steal');
            command({
                command: 'play-action',
                action: 'steal',
                target: chooseTarget()
            });
        } else if (influence.indexOf('duke') >= 0) {
            debug('tax');
            command({
                command: 'play-action',
                action: 'tax',
                target: chooseTarget()
            });
        } else if (influence.indexOf('assassin') < 0 ) {
            debug('exchange');
            command({
                command: 'play-action',
                action: 'exchange'
            });
        } else {
            debug('income');
            command({
                command: 'play-action',
                action: 'income'
            });
        }
    }

    function command(command) {
        command.stateId = state.stateId;

        try {
            gameProxy.command(command);
        } catch(e) {
            console.error(e);
            console.error(e.stack);
        }
    }

    function ourInfluence() {
        var influence = [];
        for (var i = 0; i < aiPlayer.influence.length; i++) {
            if (!aiPlayer.influence[i].revealed) {
                influence.push(aiPlayer.influence[i].role);
            }
        }
        return influence;
    }

    function revealLowestRanked() {
        var influence = ourInfluence();
        var i = rankedRoles.length;
        while (--i) {
            if (influence.indexOf(rankedRoles[i]) >= 0) {
                command({
                    command: 'reveal',
                    role: rankedRoles[i]
                });
                return;
            }
        }
    }

    // Choose the player with the most influence first, and the most money second
    function chooseTarget() {
        var target = null;
        for (var i = 0; i < state.numPlayers; i++) {
            if (i == state.playerIdx) {
                // Do not target ourselves.
                continue;
            }
            if (target == null) {
                target = i;
            } else if (getInfluenceByIdx(i).length > getInfluenceByIdx(target).length) {
                target = i;
            } else if (getInfluenceByIdx(i).length == getInfluenceByIdx(target).length &&
                state.players[i].cash > state.players[target].cash) {
                target = i;
            }
        }
        debug('targetting ' + target);
        return target;
    }

    function exchange() {
        var chosen = [];
        var needed = ourInfluence().length;
        var available = state.state.exchangeOptions;

        for (var j = 0; j < needed; j++) {
            for (var i = 0; i < rankedRoles.length; i++) {
                var candidate = rankedRoles[i];
                if (chosen.indexOf(candidate) >= 0) {
                    // We already have this one
                    continue;
                }
                if (available.indexOf(candidate) >= 0) {
                    chosen.push(candidate);
                }
            }
        }
        while (chosen.length < needed) {
            chosen.push(available[0]);
        }
        debug('chose ' + chosen);
        command({
            command: 'play-action',
            action: 'exchange',
            roles: chosen
        });
    }

    function debug(msg) {
        dbg && console.log(msg);
    }
}

module.exports = createAiPlayer;
