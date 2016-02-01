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
