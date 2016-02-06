var expect = require('expect.js');
var createMinimaxPlayer = require('../minimax-player');
var shared = require('../web/shared');
var stateNames = shared.states;

var fakeGame = {
    playerJoined: function () {}
};

var AI_IDX = 0;
var OPPONENT_1_IDX = 1;
var OPPONENT_2_IDX = 2;

describe('Minimax player', function () {
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
            }
        };
        player._test.setAiPlayerIdx(AI_IDX);
    });

    describe('Possible moves', function () {
        describe('Given it is the start of a turn', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.START_OF_TURN
                };
            });

            describe('Given the minimax player has one opponent and no cash', function () {
                it('should enumerate the zero-cost actions in priority order', function () {
                    var moves = player._test.getPossibleMoves(gameState)
                    expect(moves).to.eql([
                        {
                            command: 'play-action',
                            action: 'steal',
                            target: OPPONENT_1_IDX
                        },
                        {
                            command: 'play-action',
                            action: 'tax'
                        },
                        {
                            command: 'play-action',
                            action: 'exchange'
                        },
                        {
                            command: 'play-action',
                            action: 'income'
                        },
                        {
                            command: 'play-action',
                            action: 'foreign-aid'
                        }
                    ]);
                });
            });

            describe('Given the minimax player has two opponents', function () {
                beforeEach(function () {
                    gameState.state.players.push({
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
                        ],
                        influenceCount: 2
                    });
                });

                describe('Given the minimax player has 3 cash', function () {
                    beforeEach(function () {
                        gameState.state.players[AI_IDX].cash = 3;
                    });

                    it('should include assassinate actions', function () {
                        var moves = player._test.getPossibleMoves(gameState)
                        expect(moves).to.eql([
                            {
                                command: 'play-action',
                                action: 'assassinate',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'assassinate',
                                target: OPPONENT_2_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'steal',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'steal',
                                target: OPPONENT_2_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'tax'
                            },
                            {
                                command: 'play-action',
                                action: 'exchange'
                            },
                            {
                                command: 'play-action',
                                action: 'income'
                            },
                            {
                                command: 'play-action',
                                action: 'foreign-aid'
                            }
                        ]);
                    });
                });

                describe('Given the minimax player has 7 cash', function () {
                    beforeEach(function () {
                        gameState.state.players[AI_IDX].cash = 7;
                    });

                    it('should include coup actions', function () {
                        var moves = player._test.getPossibleMoves(gameState)
                        expect(moves).to.eql([
                            {
                                command: 'play-action',
                                action: 'coup',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'coup',
                                target: OPPONENT_2_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'assassinate',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'assassinate',
                                target: OPPONENT_2_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'steal',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'steal',
                                target: OPPONENT_2_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'tax'
                            },
                            {
                                command: 'play-action',
                                action: 'exchange'
                            },
                            {
                                command: 'play-action',
                                action: 'income'
                            },
                            {
                                command: 'play-action',
                                action: 'foreign-aid'
                            }
                        ]);
                    });
                });

                describe('Given the minimax player has 10 cash', function () {
                    beforeEach(function () {
                        gameState.state.players[AI_IDX].cash = 10;
                    });

                    it('should only include coup actions', function () {
                        var moves = player._test.getPossibleMoves(gameState)
                        expect(moves).to.eql([
                            {
                                command: 'play-action',
                                action: 'coup',
                                target: OPPONENT_1_IDX
                            },
                            {
                                command: 'play-action',
                                action: 'coup',
                                target: OPPONENT_2_IDX
                            }
                        ]);
                    });
                });
            });
        });

        describe('Given we are responding to a player\'s action', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.ACTION_RESPONSE
                };
                gameState.state.players.push({
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
                    ],
                    influenceCount: 2
                });
            });

            describe('Given that an opponent is trying to assassinate the current player', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'assassinate';
                    gameState.state.state.target = AI_IDX;
                    gameState.currentPlayer = AI_IDX;
                });

                it('should include a move to block the assassination, followed by one to allow and one to challenge', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'block',
                            blockingRole: 'contessa'
                        },
                        {
                            command: 'allow'
                        },
                        {
                            command: 'challenge'
                        }
                    ]);
                });
            });

            describe('Given that an opponent is trying to assassinate another opponent', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'assassinate';
                    gameState.state.state.target = OPPONENT_2_IDX;
                    gameState.currentPlayer = AI_IDX;
                });

                it('should not include any blocking moves', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'allow'
                        },
                        {
                            command: 'challenge'
                        }
                    ]);
                });
            });

            describe('Given that the minimax player is trying to steal from the current player', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'steal';
                    gameState.state.state.target = OPPONENT_1_IDX;
                    gameState.currentPlayer = OPPONENT_1_IDX;
                });

                it('should include the moves to block the steal', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'block',
                            blockingRole: 'captain'
                        },
                        {
                            command: 'block',
                            blockingRole: 'ambassador'
                        },
                        {
                            command: 'allow'
                        },
                        {
                            command: 'challenge'
                        }
                    ]);
                });
            });

            describe('Given that an opponent is trying to draw tax', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'tax';
                    gameState.currentPlayer = AI_IDX;
                });

                it('should not include any blocking moves; only allow and challenge', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'allow'
                        },
                        {
                            command: 'challenge'
                        }
                    ]);
                });
            });
        });

        describe('Given it is the final chance to respond to a player\'s action', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.FINAL_ACTION_RESPONSE
                };
                gameState.state.players.push({
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
                    ],
                    influenceCount: 2
                });
            });

            describe('Given that an opponent is trying to assassinate the current player', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'assassinate';
                    gameState.state.state.target = AI_IDX;
                    gameState.currentPlayer = AI_IDX;
                });

                it('should include only a move to block the assassination', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'block',
                            blockingRole: 'contessa'
                        }
                    ]);
                });
            });
        });

        describe('Given that a move has been blocked', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.BLOCK_RESPONSE
                };
                gameState.state.players.push({
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
                    ],
                    influenceCount: 2
                });
            });

            describe('Given that an opponent is trying to assassinate another opponent', function () {
                beforeEach(function () {
                    gameState.state.state.action = 'assassinate';
                    gameState.state.state.target = OPPONENT_1_IDX;
                    gameState.currentPlayer = AI_IDX;
                });

                it('should include moves to allow and to challenge the block', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'allow'
                        },
                        {
                            command: 'challenge'
                        }
                    ]);
                });
            });
        });

        describe('Given that the minimax player must reveal an influence', function () {
            beforeEach(function () {
                gameState.state.players[AI_IDX].influence = [
                    {
                        role: 'duke',
                        revealed: false
                    },
                    {
                        role: 'captain',
                        revealed: false
                    }
                ];
                gameState.state.state = {
                    name: stateNames.REVEAL_INFLUENCE
                };
                gameState.currentPlayer = AI_IDX;
            });

            it('should include moves to reveal each possible role', function () {
                var moves = player._test.getPossibleMoves(gameState);
                expect(moves).to.eql([
                    {
                        command: 'reveal',
                        role: 'duke'
                    },
                    {
                        command: 'reveal',
                        role: 'captain'
                    }
                ]);
            });
        });

        describe('Given that an opponent must reveal an influence', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.REVEAL_INFLUENCE
                };
                gameState.currentPlayer = OPPONENT_1_IDX;
            });

            it('should include a single move to reveal, since we cannot distinguish between an opponent\'s influences', function () {
                var moves = player._test.getPossibleMoves(gameState);
                expect(moves).to.eql([
                    {
                        command: 'reveal',
                        role: 'unknown'
                    }
                ]);
            });
        });

        describe('Given that the minimax player is exchanging', function () {
            describe('Given that the minimax player has one influence', function () {
                beforeEach(function () {
                    gameState.state.players[AI_IDX].influence = [
                        {
                            role: 'duke',
                            revealed: false
                        },
                        {
                            role: 'captain',
                            revealed: true
                        }
                    ];
                    gameState.state.players[AI_IDX].influenceCount = 1;
                });

                describe('Given that all the available roles are different', function () {
                    beforeEach(function () {
                        gameState.state.state = {
                            name: stateNames.EXCHANGE,
                            exchangeOptions: ['duke', 'ambassador', 'contessa']
                        };
                        gameState.currentPlayer = AI_IDX;
                    });

                    it('should include moves to choose each possible role', function () {
                        var moves = player._test.getPossibleMoves(gameState);
                        expect(moves).to.eql([
                            {
                                command: 'exchange',
                                roles: ['duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador']
                            },
                            {
                                command: 'exchange',
                                roles: ['contessa']
                            }
                        ]);
                    });
                });

                describe('Given that there are duplicate roles', function () {
                    beforeEach(function () {
                        gameState.state.state = {
                            name: stateNames.EXCHANGE,
                            exchangeOptions: ['duke', 'ambassador', 'duke']
                        };
                        gameState.currentPlayer = AI_IDX;
                    });

                    it('should include moves to choose each unique role', function () {
                        var moves = player._test.getPossibleMoves(gameState);
                        expect(moves).to.eql([
                            {
                                command: 'exchange',
                                roles: ['duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador']
                            }
                        ]);
                    });
                });
            });

            describe('Given that the minimax player has two influences', function () {
                beforeEach(function () {
                    gameState.state.players[AI_IDX].influence = [
                        {
                            role: 'duke',
                            revealed: false
                        },
                        {
                            role: 'captain',
                            revealed: false
                        }
                    ];
                });

                describe('Given that all the available roles are different', function () {
                    beforeEach(function () {
                        gameState.state.state = {
                            name: stateNames.EXCHANGE,
                            exchangeOptions: ['duke', 'captain', 'ambassador', 'contessa']
                        };
                        gameState.currentPlayer = AI_IDX;
                    });

                    it('should include moves to choose each possible combination of roles', function () {
                        var moves = player._test.getPossibleMoves(gameState);
                        expect(moves).to.eql([
                            {
                                command: 'exchange',
                                roles: ['captain', 'duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador', 'duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['contessa', 'duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador', 'captain']
                            },
                            {
                                command: 'exchange',
                                roles: ['captain', 'contessa']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador', 'contessa']
                            }
                        ]);
                    });
                });

                describe('Given that there are duplicate roles', function () {
                    beforeEach(function () {
                        gameState.state.state = {
                            name: stateNames.EXCHANGE,
                            exchangeOptions: ['duke', 'ambassador', 'duke', 'ambassador']
                        };
                        gameState.currentPlayer = AI_IDX;
                    });

                    it('should include moves to choose the unique combinations of roles', function () {
                        var moves = player._test.getPossibleMoves(gameState);
                        expect(moves).to.eql([
                            {
                                command: 'exchange',
                                roles: ['ambassador', 'duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['duke', 'duke']
                            },
                            {
                                command: 'exchange',
                                roles: ['ambassador', 'ambassador']
                            }
                        ]);
                    });
                });
            });
        });

        describe('Given that an opponent is exchanging', function () {
            describe('Given that the opponent has one influence', function () {
                beforeEach(function () {
                    gameState.state.players[OPPONENT_1_IDX].influence[1].revealed = true;
                    gameState.state.players[OPPONENT_1_IDX].influenceCount = 1;
                    gameState.state.state = {
                        name: stateNames.EXCHANGE,
                        exchangeOptions: ['unknown', 'duke', 'captain']
                    };
                    gameState.currentPlayer = OPPONENT_1_IDX;
                });

                it('should include moves to choose each role', function () {
                    var moves = player._test.getPossibleMoves(gameState);
                    expect(moves).to.eql([
                        {
                            command: 'exchange',
                            roles: ['unknown']
                        },
                        {
                            command: 'exchange',
                            roles: ['duke']
                        },
                        {
                            command: 'exchange',
                            roles: ['captain']
                        }
                    ]);
                });
            });
        });

        describe('Given that the opponent has two influences', function () {
            beforeEach(function () {
                gameState.state.state = {
                    name: stateNames.EXCHANGE,
                    exchangeOptions: ['unknown', 'unknown', 'duke', 'captain']
                };
                gameState.currentPlayer = OPPONENT_1_IDX;
            });

            it('should include moves to choose the unique combinations of roles', function () {
                var moves = player._test.getPossibleMoves(gameState);
                expect(moves).to.eql([
                    {
                        command: 'exchange',
                        roles: ['unknown', 'unknown']
                    },
                    {
                        command: 'exchange',
                        roles: ['duke', 'unknown']
                    },
                    {
                        command: 'exchange',
                        roles: ['captain', 'unknown']
                    },
                    {
                        command: 'exchange',
                        roles: ['captain', 'duke']
                    }
                ]);
            });
        });
    });

    describe('Apply move', function () {
        describe('Challenges', function () {
            describe('Given an opponent tried to exchange with two influences', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.ACTION_RESPONSE,
                        playerIdx: OPPONENT_1_IDX,
                        action: 'exchange'
                    };
                    gameState.currentPlayer = AI_IDX;
                });

                describe('When the AI challenges the exchange', function () {
                    var newStates;

                    beforeEach(function () {
                        newStates = player._test.applyMove(gameState, {
                            command: 'challenge'
                        });
                    });

                    it('should evaluate both possibilities: correct and incorrect', function () {
                        expect(newStates).to.be.an('array');
                    });

                    describe('For the correct challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[0];
                        });

                        it('should be a 36% chance of the challenge being correct', function () {
                            expect(newState.likelihood).to.be(0.36);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the opponent\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(OPPONENT_1_IDX);
                        });

                        it('should be the opponent\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(OPPONENT_1_IDX);
                        });
                    });

                    describe('For the incorrect challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[1];
                        });

                        it('should be a 64% chance of the challenge being incorrect', function () {
                            expect(newState.likelihood).to.be(0.64);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the AI\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(AI_IDX);
                        });

                        it('should be the AI\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(AI_IDX);
                        });
                    });
                });
            });

            describe('Given an opponent tried to exchange with one influence', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.ACTION_RESPONSE,
                        playerIdx: OPPONENT_1_IDX,
                        action: 'exchange'
                    };
                    gameState.state.players[OPPONENT_1_IDX].influence[0].revealed = true;
                    gameState.state.players[OPPONENT_1_IDX].influenceCount = 1;
                    gameState.currentPlayer = AI_IDX;
                });

                describe('When the AI challenges the exchange', function () {
                    var newStates;

                    beforeEach(function () {
                        newStates = player._test.applyMove(gameState, {
                            command: 'challenge'
                        });
                    });

                    it('should evaluate both possibilities: correct and incorrect', function () {
                        expect(newStates).to.be.an('array');
                    });

                    describe('For the correct challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[0];
                        });

                        it('should be a 20% chance of the challenge being correct', function () {
                            expect(newState.likelihood).to.be(0.2);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in game won state', function () {
                            expect(newState.state.state.name).to.be(stateNames.GAME_WON);
                        });

                        it('should be nobody\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(null);
                        });
                    });

                    describe('For the incorrect challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[1];
                        });

                        it('should be a 80% chance of the challenge being incorrect', function () {
                            expect(newState.likelihood).to.be(0.8);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the AI\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(AI_IDX);
                        });

                        it('should be the AI\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(AI_IDX);
                        });
                    });
                });
            });

            describe('Given an opponent tried to block a steal with two influences', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.BLOCK_RESPONSE,
                        playerIdx: AI_IDX,
                        action: 'steal',
                        target: OPPONENT_1_IDX,
                        blockingRole: 'ambassador'
                    };
                    gameState.currentPlayer = AI_IDX;
                });

                describe('When the AI challenges the block', function () {
                    var newStates;

                    beforeEach(function () {
                        newStates = player._test.applyMove(gameState, {
                            command: 'challenge'
                        });
                    });

                    it('should evaluate both possibilities: correct and incorrect', function () {
                        expect(newStates).to.be.an('array');
                    });

                    describe('For the correct challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[0];
                        });

                        it('should be a 36% chance of the challenge being correct', function () {
                            expect(newState.likelihood).to.be(0.36);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the opponent\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(OPPONENT_1_IDX);
                        });

                        it('should be the opponent\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(OPPONENT_1_IDX);
                        });
                    });

                    describe('For the incorrect challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[1];
                        });

                        it('should be a 64% chance of the challenge being incorrect', function () {
                            expect(newState.likelihood).to.be(0.64);
                        });

                        it('should not have a different likelihood for the AI player', function () {
                            expect(newState.likelihoodAi).to.be(undefined);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the AI\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(AI_IDX);
                        });

                        it('should be the AI\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(AI_IDX);
                        });
                    });
                });
            });

            describe('Given an opponent tried to exchange with two influences', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.ACTION_RESPONSE,
                        playerIdx: AI_IDX,
                        action: 'exchange'
                    };
                    gameState.currentPlayer = OPPONENT_1_IDX;
                });

                describe('When the AI challenges the exchange', function () {
                    var newStates;

                    beforeEach(function () {
                        newStates = player._test.applyMove(gameState, {
                            command: 'challenge'
                        });
                    });

                    it('should evaluate both possibilities: correct and incorrect', function () {
                        expect(newStates).to.be.an('array');
                    });

                    describe('For the correct challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[0];
                        });

                        it('should be a 36% chance of the challenge being correct', function () {
                            expect(newState.likelihood).to.be(0.36);
                        });

                        it('should be a 0% chance of the challenge being correct, from the AI\'s point of view', function () {
                            expect(newState.likelihoodAi).to.be(0);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the opponent\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(AI_IDX);
                        });

                        it('should be the opponent\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(AI_IDX);
                        });
                    });

                    describe('For the incorrect challenge', function () {
                        var newState;

                        beforeEach(function () {
                            newState = newStates[1];
                        });

                        it('should be a 64% chance of the challenge being incorrect', function () {
                            expect(newState.likelihood).to.be(0.64);
                        });

                        it('should be a 100% chance of the challenge being incorrect, from the AI\'s point of view', function () {
                            expect(newState.likelihoodAi).to.be(1);
                        });

                        it('should be in reveal state', function () {
                            expect(newState.state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        });

                        it('should be the AI\'s turn to reveal', function () {
                            expect(newState.state.state.playerToReveal).to.be(OPPONENT_1_IDX);
                        });

                        it('should be the AI\'s turn to choose a move', function () {
                            expect(newState.currentPlayer).to.be(OPPONENT_1_IDX);
                        });
                    });
                });
            });
        });

        describe('Whose turn to play', function () {
            beforeEach(function () {
                gameState.state.players.push({
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
                    ],
                    influenceCount: 2
                });
            })

            describe('At the start of a player\'s turn', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.START_OF_TURN,
                        playerIdx: 3
                    };
                });

                it('should be that player\'s turn to move', function () {
                    expect(player._test.whoseTurn(gameState.state)).to.be(3);
                });
            });

            describe('When a player has made an action against another player', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.ACTION_RESPONSE,
                        playerIdx: 2,
                        action: 'assassinate',
                        target: 1,
                        allowed: [false, false, true]
                    };
                });

                it('should be the attacked player\'s turn to move', function () {
                    expect(player._test.whoseTurn(gameState.state)).to.be(1);
                });

                describe('Given the attacked player has already allowed', function () {
                    beforeEach(function () {
                        gameState.state.state.allowed = [false, true, true];
                    });

                    it('should be the first player\'s turn to move', function () {
                        expect(player._test.whoseTurn(gameState.state)).to.be(0);
                    });
                });
            });

            describe('When a player has made an action that does not attack a player', function () {
                beforeEach(function () {
                    gameState.state.state = {
                        name: stateNames.ACTION_RESPONSE,
                        playerIdx: 2,
                        action: 'tax',
                        allowed: [false, false, false]
                    };
                });

                it('should be the first player\'s turn to respond', function () {
                    expect(player._test.whoseTurn(gameState.state)).to.be(0);
                });

                describe('Given the first player has already allowed', function () {
                    beforeEach(function () {
                        gameState.state.state.allowed = [true, false, true];
                    });

                    it('should be the second player\'s turn to move', function () {
                        expect(player._test.whoseTurn(gameState.state)).to.be(1);
                    });
                });
            });
        });
    });
});
