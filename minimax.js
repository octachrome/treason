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
module.exports = Minimax;

var lodash = require('lodash');

/**
 * options: {
 *   evaluate: function (gameState, playerIdx) : number
 *   getPossibleMoves: function (gameState) : [move] (will be tried in order)
 *   applyMove: function (gameState, move) : gameState, or [gameStates], where each has a likelihood property
 * }
 *
 * gameState: {
 *   currentPlayer: number
 *   *other properties*: <custom>
 * }
 */
function Minimax(game, maxDepth) {
    this.game = game;
    this.maxDepth = maxDepth || 6;
    this.playerIndices = [];
}

Minimax.prototype.getBestMove = function (gameState) {
    var startTime = new Date().getTime();
    this.aiPlayerIdx = gameState.currentPlayer;
    var result = this.search(gameState, 0);
    var duration = new Date().getTime() - startTime;
    console.log('Search took ' + duration + 'ms');
    console.log('');
    return result.move;
};

var traceDepth = -1;
function trace(depth, move, outcomes) {
    if (depth <= traceDepth) {
        var indent = '';
        for (var i = 0; i < depth; i++) {
            indent += ' ';
        }
        console.log(indent + JSON.stringify(outcomes));
    }
}

Minimax.prototype.search = function (gameState, depth) {
    var self = this;
    self.playerIndices[gameState.currentPlayer] = true;

    var moves = self.game.getPossibleMoves(gameState);
    var outcomes = moves.map(function (move) {
        var initialState = lodash.cloneDeep(gameState);
        delete initialState.likelihood;
        delete initialState.aiLikelihood;
        var newStates = self.game.applyMove(initialState, move);
        if (!Array.isArray(newStates)) {
            newStates.likelihood = 1;
            newStates = [newStates];
        }
        var weightedOutcomes = newStates.map(function (newState) {
            var outcome;
            if (newState.currentPlayer == null || depth >= self.maxDepth) {
                outcome = {
                    move: move,
                    scores: self.playerIndices.map(function (ignored, playerIdx) {
                        return self.game.evaluate(newState, playerIdx);
                    })
                };
            }
            else {
                outcome = self.search(newState, depth + 1);
            }
            outcome.scores = outcome.scores.map(function (score, playerIdx) {
                if (newState.aiLikelihood != null && playerIdx === self.aiPlayerIdx) {
                    return score * newState.aiLikelihood;
                }
                else {
                    return score * newState.likelihood;
                }
            });
            return outcome;
        });
        trace(depth, move, weightedOutcomes);

        var outcome = weightedOutcomes.reduce(function (outcome1, outcome2) {
            return {
                move: outcome1.move,
                scores: outcome1.scores.map(function (score1, idx) {
                    var score2 = outcome2.scores[idx];
                    return score1 + score2;
                })
            };
        });
        // Substitute the move from this search branch.
        outcome.move = move;
        return outcome;
    });

    var currentPlayer = gameState.currentPlayer;
    var bestOutcome = outcomes.reduce(function (outcome1, outcome2) {
        if (outcome1.scores[currentPlayer] > outcome2.scores[currentPlayer]) {
            return outcome1;
        }
        else {
            return outcome2;
        }
    });
    return bestOutcome;
};
