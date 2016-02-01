var expect = require('expect.js');
var createMinimaxPlayer = require('../minimax-player');

var fakeGame = {
    playerJoined: function () {}
};

var AI_IDX = 0;
var OPPONENT_1_IDX = 1;
var OPPONENT_2_IDX = 2;

describe('Minimax player', function () {
    describe('getPossibleActionMoves', function () {
        describe('Given the minimax player has one opponent and no cash', function () {
            var player, gameState;

            beforeEach(function () {
                player = createMinimaxPlayer(fakeGame);
                gameState = {
                    livePlayers: [true, true],
                    currentPlayer: AI_IDX,
                    state: {
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
                                ]
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
                                    }
                                ]
                            }
                        ],
                        playerIdx: AI_IDX
                    }
                };
                player._test.setAiPlayerIdx(AI_IDX);
            });

            it('should enumerate the zero-cost actions in priority order', function () {
                var moves = player._test.getPossibleActionMoves(gameState)
                expect(moves).to.eql([
                    {
                        command: 'action',
                        action: 'steal',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'tax'
                    },
                    {
                        command: 'action',
                        action: 'exchange'
                    },
                    {
                        command: 'action',
                        action: 'income'
                    },
                    {
                        command: 'action',
                        action: 'foreign-aid'
                    }
                ]);
            });
        });

        describe('Given the minimax player has two opponents and 3 cash', function () {
            var player, gameState;

            beforeEach(function () {
                player = createMinimaxPlayer(fakeGame);
                gameState = {
                    livePlayers: [true, true],
                    currentPlayer: AI_IDX,
                    state: {
                        players: [
                            {
                                cash: 3,
                                influence: [
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    },
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    }
                                ]
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
                                    }
                                ]
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
                                    }
                                ]
                            }
                        ],
                        playerIdx: AI_IDX
                    }
                };
                player._test.setAiPlayerIdx(AI_IDX);
            });

            it('should include assassinate actions', function () {
                var moves = player._test.getPossibleActionMoves(gameState)
                expect(moves).to.eql([
                    {
                        command: 'action',
                        action: 'assassinate',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'assassinate',
                        target: OPPONENT_2_IDX
                    },
                    {
                        command: 'action',
                        action: 'steal',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'steal',
                        target: OPPONENT_2_IDX
                    },
                    {
                        command: 'action',
                        action: 'tax'
                    },
                    {
                        command: 'action',
                        action: 'exchange'
                    },
                    {
                        command: 'action',
                        action: 'income'
                    },
                    {
                        command: 'action',
                        action: 'foreign-aid'
                    }
                ]);
            });
        });

        describe('Given the minimax player has two opponents and 7 cash', function () {
            var player, gameState;

            beforeEach(function () {
                player = createMinimaxPlayer(fakeGame);
                gameState = {
                    livePlayers: [true, true],
                    currentPlayer: AI_IDX,
                    state: {
                        players: [
                            {
                                cash: 7,
                                influence: [
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    },
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    }
                                ]
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
                                    }
                                ]
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
                                    }
                                ]
                            }
                        ],
                        playerIdx: AI_IDX
                    }
                };
                player._test.setAiPlayerIdx(AI_IDX);
            });

            it('should include coup actions', function () {
                var moves = player._test.getPossibleActionMoves(gameState)
                expect(moves).to.eql([
                    {
                        command: 'action',
                        action: 'coup',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'coup',
                        target: OPPONENT_2_IDX
                    },
                    {
                        command: 'action',
                        action: 'assassinate',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'assassinate',
                        target: OPPONENT_2_IDX
                    },
                    {
                        command: 'action',
                        action: 'steal',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'steal',
                        target: OPPONENT_2_IDX
                    },
                    {
                        command: 'action',
                        action: 'tax'
                    },
                    {
                        command: 'action',
                        action: 'exchange'
                    },
                    {
                        command: 'action',
                        action: 'income'
                    },
                    {
                        command: 'action',
                        action: 'foreign-aid'
                    }
                ]);
            });
        });

        describe('Given the minimax player has two opponents and 10 cash', function () {
            var player, gameState;

            beforeEach(function () {
                player = createMinimaxPlayer(fakeGame);
                gameState = {
                    livePlayers: [true, true],
                    currentPlayer: AI_IDX,
                    state: {
                        players: [
                            {
                                cash: 10,
                                influence: [
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    },
                                    {
                                        role: 'ambassador',
                                        revealed: false
                                    }
                                ]
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
                                    }
                                ]
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
                                    }
                                ]
                            }
                        ],
                        playerIdx: AI_IDX
                    }
                };
                player._test.setAiPlayerIdx(AI_IDX);
            });

            it('should only include coup actions', function () {
                var moves = player._test.getPossibleActionMoves(gameState)
                expect(moves).to.eql([
                    {
                        command: 'action',
                        action: 'coup',
                        target: OPPONENT_1_IDX
                    },
                    {
                        command: 'action',
                        action: 'coup',
                        target: OPPONENT_2_IDX
                    }
                ]);
            });
        });
    });
});
