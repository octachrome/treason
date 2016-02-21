var expect = require('expect.js');

var Minimax = require('../minimax');
var MinimaxCoup = require('../minimax-coup');
var shared = require('../web/shared');
var stateNames = shared.states;

var AI_IDX = 0;
var OPPONENT_IDX = 1;

describe('Minimax player', function () {
    var minimax, gameState;

    beforeEach(function () {
        minimax = new Minimax(new MinimaxCoup(AI_IDX));

        gameState = {
            players: [
                {
                    cash: 0,
                    influence: [
                        {
                            role: 'ambassador',
                            revealed: false
                        },
                        {
                            role: 'ambassador',
                            revealed: false
                        }
                    ],
                    influenceCount: 2
                },
                {
                    cash: 0,
                    influence: [
                        {
                            role: 'unknown',
                            revealed: false
                        },
                        {
                            role: 'unknown',
                            revealed: false
                        },
                    ],
                    influenceCount: 2
                }
            ],
            playerIdx: AI_IDX
        };
    });

    function getBestMove() {
        return minimax.getBestMove({
            currentPlayer: AI_IDX,
            state: gameState
        });
    }

    describe('Given the AI can win by couping', function () {
        beforeEach(function () {
            gameState.players[AI_IDX].cash = 8;
            gameState.players[OPPONENT_IDX].influence[0].revealed = true;
            gameState.players[OPPONENT_IDX].influenceCount = 1;
            gameState.state = {
                name: stateNames.START_OF_TURN,
                playerIdx: AI_IDX
            };
        });

        it('should coup', function () {
            var command = getBestMove();
            expect(command.command).to.be('play-action');
            expect(command.action).to.be('coup');
        });
    });

    describe('Given the AI would die if challenged', function () {
        beforeEach(function () {
            gameState.players[AI_IDX].cash = 0;
            gameState.players[AI_IDX].influence[0].revealed = true;
            gameState.players[AI_IDX].influenceCount = 1;
            gameState.players[OPPONENT_IDX].cash = 7;
            gameState.state = {
                name: stateNames.START_OF_TURN,
                playerIdx: AI_IDX
            };
        });

        it('should not claim a role it does not have', function () {
            var command = getBestMove();
            console.log(command);
        });
    });
});
