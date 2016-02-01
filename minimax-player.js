var lodash = require('lodash');
var Minimax = require('./minimax');
var shared = require('./web/shared');
var stateNames = shared.states;
var actions = shared.actions;

function createMinimaxPlayer(game, options) {
    var player = {
        name: 'Minimax',
        onStateChange: onStateChange,
        onHistoryEvent: onHistoryEvent,
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

    var minimax = new Minimax({
        evaluate: evaluate,
        getPossibleMoves: getPossibleMoves,
        applyMove: applyMove
    });

    var aiPlayerIdx;

    function onStateChange(state) {
        aiPlayerIdx = state.playerIdx;
        aiPlayer = state.players[aiPlayerIdx];
        currentPlayer = state.players[state.state.playerIdx];
        targetPlayer = state.players[state.state.target];

        if (state.state.name === stateNames.START_OF_TURN && currentPlayer === aiPlayer) {
            // Start of our turn.
        }
        else if (state.state.name === stateNames.ACTION_RESPONSE && aiPlayer !== currentPlayer) {
            // We can respond to an action:
            //   We may be targeted and be able to block or challenge.
            //   We may not be targeted and only be able to challenge.
        }
        else if (state.state.name === stateNames.FINAL_ACTION_RESPONSE && aiPlayer === targetPlayer) {
            // We have a final chance to block an action against us.
        }
        else if (state.state.name === stateNames.BLOCK_RESPONSE && aiPlayer !== targetPlayer) {
            // Our action or another player's action has been blocked and we have an opportunity to challenge.
        }
        else if (state.state.name === stateNames.REVEAL_INFLUENCE && state.state.playerToReveal === state.playerIdx) {
            // We need to reveal an influence.
        }
        else if (state.state.name === stateNames.EXCHANGE && currentPlayer === aiPlayer) {
            // We must choose which roles to exchange.
        }
        else {
            // We should not respond to this state.
            return;
        }

        minimax.getBestMove({
            livePlayers: getLivePlayers(state),
            currentPlayer: state.playerIdx, // In the minimax state it is always our 'turn', which might just mean our turn to block.
            state: state
        });
    }

    function onHistoryEvent() {
    }

    function evaluate(gameState, playerIdx) {
    }

    /**
     * This function is called for all the players to enumerate all the ways they could react to a given game state.
     * The index of the player who is reacting is given in gameState.currentPlayer.
     */
    function getPossibleMoves(gameState) {
        var state = gameState.state;
        if (state.state.name === stateNames.START_OF_TURN) {
            // Start of a player's turn.
            return getPossibleActionMoves(gameState);
        }
        else if (state.state.name === stateNames.ACTION_RESPONSE) {
            // A player can challenge, allow, or potentially block.
            return [{command: 'challenge'}, {command: 'allow'}].concat(getPossibleBlockMoves(gameState));
        }
        else if (state.state.name === stateNames.FINAL_ACTION_RESPONSE) {
            // A player has a final chance to block.
            return getPossibleBlockMoves(gameState);
        }
        else if (state.state.name === stateNames.BLOCK_RESPONSE) {
            // An action has been blocked and a player has an opportunity to challenge.
            return [{command: 'challenge'}, {command: 'allow'}];
        }
        else if (state.state.name === stateNames.REVEAL_INFLUENCE) {
            // A player must reveal an influence.
            return getPossibleRevealMoves(gameState);
        }
        else if (state.state.name === stateNames.EXCHANGE) {
            // A player must choose which roles to exchange.
            return getPossibleExchangeMoves(gameState);
        }
        else {
            // no possible moves!
            return [];
        }
    }

    function getPossibleActionMoves(gameState) {
        var state = gameState.state;
        var player = state.players[gameState.currentPlayer];
        var i;
        var moves = [];
        if (player.cash >= 7) {
            // Enumerate the player's possible coup targets.
            for (i = 0; i < state.players.length; i++) {
                if (i !== gameState.currentPlayer && countInfluence(state.players[i]) > 0) {
                    moves.push({
                        command: 'action',
                        action: 'coup',
                        target: i
                    });
                }
            }
        }
        if (player.cash >= 10) {
            // At $10+ the player can only coup.
            return moves;
        }
        if (player.cash >= 3) {
            // Enumerate the player's possible assassination targets.
            for (i = 0; i < state.players.length; i++) {
                if (i !== gameState.currentPlayer && countInfluence(state.players[i]) > 0) {
                    moves.push({
                        command: 'action',
                        action: 'assassinate',
                        target: i
                    });
                }
            }
        }
        // Enumerate the player's possible steal targets.
        for (i = 0; i < state.players.length; i++) {
            if (i !== gameState.currentPlayer && countInfluence(state.players[i]) > 0) {
                moves.push({
                    command: 'action',
                    action: 'steal',
                    target: i
                });
            }
        }
        moves.push({
            command: 'action',
            action: 'tax'
        });
        moves.push({
            command: 'action',
            action: 'exchange'
        });
        moves.push({
            command: 'action',
            action: 'income'
        });
        moves.push({
            command: 'action',
            action: 'foreign-aid'
        });
        return moves;
    }

    function getPossibleBlockMoves(gameState) {
        var state = gameState.state;
        var action = actions[state.state.action];
        if (!action.blockedBy) {
            // The action cannot be blocked.
            return [];
        }
        if (action.targeted && state.state.target !== gameState.currentPlayer) {
            // The current player is not targeted and so may not block;
            return [];
        }
        return action.blockedBy.map(function (role) {
            return {
                command: 'block',
                blockingRole: role
            };
        });
    }

    function getPossibleRevealMoves(gameState) {
        if (gameState.currentPlayer === aiPlayerIdx) {
            var moves = [];
            var influence = gameState.state.players[aiPlayerIdx].influence;
            for (var i = 0; i < influence.length; i++) {
                if (!influence.revealed) {
                    moves.push({
                        command: 'reveal',
                        role: influence.role
                    });
                }
            }
            return moves;
        } else {
            // Doesn't matter which influence gets revealed because we don't know them.
            return [{
                command: 'reveal',
                role: 'unknown'
            }];
        }
    }

    function getPossibleExchangeMoves(gameState) {
        var count = countInfluence(gameState.state.players[gameState.currentPlayer]);
        var exchangeOptions = gameState.state.state.exchangeOptions;
        var rolesets;
        if (count === 1) {
            rolesets = exchangeOptions.map(function (role) {
                return [role];
            });
        }
        else if (count === 2) {
            rolesets = [];
            for (var i = 0; i < exchangeOptions.length; i++) {
                for (var j = 0; j < exchangeOptions.length; j++) {
                    if (i !== j) {
                        rolesets.push([exchangeOptions[i], exchangeOptions[j]]);
                    }
                }
            }
            rolesets = lodash.uniqWith(rolesets, function (a, b) {
                return lodash.isEqual(a.sort(), b.sort());
            });
        }
        else {
            // Impossible.
            rolesets = [];
        }
        return rolesets.map(function (roles) {
            return {
                command: 'exchange',
                roles: [roles]
            }
        });
    }

    function applyMove(gameState, move) {
    }

    function getLivePlayers(state) {
        var live = [];
        for (var i = 0; i < state.players.length; i++) {
            var player = state.players[i];
            var hasInfluence = countInfluence(player) > 0;
            live.push(hasInfluence);
        }
    }

    function countInfluence(player) {
        if (player.isObserver) {
            return 0;
        }
        var count = 0;
        for (var i = 0; i < player.influence.length; i++) {
            if (!player.influence[i].revealed) {
                count++;
            }
        }
        return count;
    }

    return {
        _test: {
            getPossibleActionMoves: getPossibleActionMoves,
            setAiPlayerIdx: function (idx) {
                aiPlayerIdx = idx;
            }
        }
    };
}

module.exports = createMinimaxPlayer;
