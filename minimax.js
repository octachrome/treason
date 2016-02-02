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

/**
 * options: {
 *   evaluate: function (gameState, playerIdx) : number
 *   getPossibleMoves: function (gameState) : [move] (will be tried in order)
 *   applyMove: function (gameState, move) : gameState, or [gameStates], where each has a likelihood property
 * }
 *
 * gameState: {
 *   livePlayers: [boolean]
 *   turn: number
 *   *other properties*: <custom>
 * }
 */
function Minimax(options) {
}

Minimax.prototype.getBestMove = function (gameState) {

}
