var expect = require('expect.js');

var createGame = require('../game');
var TestPlayers = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;
var nullDataAccess = require('./null-data-access');

describe('History', function () {
    var game;
    var testPlayers;
    var player0;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame({
            debug: false,
            dataAccess: nullDataAccess
        });
        testPlayers = new TestPlayers(game);
        player0 = testPlayers.createTestPlayer();
        player1 = testPlayers.createTestPlayer();
        return testPlayers.waitForNewPlayers(player0, player1);
    });

    describe('Given there are two players', function () {
        beforeEach(function () {
            return testPlayers.startGame();
        });

        describe('Given player0 has a capitão and player1 has an embaixador', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'capitão', 'condessa');
                game._test_setInfluence(1, 'embaixador', 'condessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });

                return player0.getHistory();
            });

            describe('When player0 tries to extorquir from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'extorquir',
                        target: 1
                    });
                });

                // A stole from B
                describe('When player1 allows', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'allow',
                            });
                        });
                    });

                    it('Then the history should record that player0 stole from player1', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql(['{0} stole from {1}']);
                        });
                    });
                });

                // A attempted to extorquir from B; B blocked with embaixador
                describe('When player1 blocks and player0 allows the block', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'embaixador'
                            });

                            return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                player0.command({
                                    command: 'allow'
                                });
                            });
                        });
                    });

                    it('Then the history should record that player0 attempted to extorquir, and then that player1 blocked', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to extorquir from {1}',
                                '{1} blocked with embaixador'
                            ]);
                        });
                    });
                });

                describe('When player1 incorrectly challenges and reveals an influence', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'challenge'
                            });

                            return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'condessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record that player0 attempted to extorquir, and then that player1 failed to challenge and revealed', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to extorquir from {1}',
                                '{1} incorrectly challenged {0}; {0} trocard capitão for a new role; {1} revealed condessa'
                            ]);
                        });
                    });

                    // A attempted to extorquir from B; B incorrectly challenged A; B revealed condessa; A stole from B
                    describe('When player1 allows the extorquir after a failed challenge', function () {
                        beforeEach(function () {
                            return testPlayers.consumeState(stateNames.FINAL_ACTION_RESPONSE).then(function (state) {
                                player1.command({
                                    command: 'allow'
                                });
                            });
                        });

                        it('Then the history should record the attempt, the incorrect challenge, and the final extorquir', function () {
                            return player0.getHistory().then(function (history) {
                                expect(history).to.eql([
                                    '{0} attempted to extorquir from {1}',
                                    '{1} incorrectly challenged {0}; {0} trocard capitão for a new role; {1} revealed condessa',
                                    '{0} stole from {1}'
                                ]);
                            });
                        });
                    });

                    // A attempted to extorquir from B; B incorrectly challenged A; B revealed condessa; B blocked with embaixador
                    describe('When player1 blocks the extorquir after a failed challenge', function () {
                        beforeEach(function () {
                            return testPlayers.consumeState(stateNames.FINAL_ACTION_RESPONSE).then(function (state) {
                                player1.command({
                                    command: 'block',
                                    blockingRole: 'embaixador'
                                });
                            });
                        });

                        describe('When player0 allows the block', function () {
                            beforeEach(function () {
                                return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                    player0.command({
                                        command: 'allow'
                                    });
                                });
                            });

                            it('Then the history should record the attempt, the incorrect challenge, and the final block', function () {
                                return player0.getHistory().then(function (history) {
                                    expect(history).to.eql([
                                        '{0} attempted to extorquir from {1}',
                                        '{1} incorrectly challenged {0}; {0} trocard capitão for a new role; {1} revealed condessa',
                                        '{1} blocked with embaixador'
                                    ]);
                                });
                            });
                        });

                        // A attempted to extorquir from B; B incorrectly challenged A; B revealed condessa; B attempted to block with embaixador; A incorrectly challenged B; A revealed condessa
                        describe('When player0 incorrectly challenges the block', function () {
                            beforeEach(function () {
                                return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                    player0.command({
                                        command: 'challenge'
                                    });
                                    return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                        player0.command({
                                            command: 'reveal',
                                            role: 'condessa'
                                        });
                                    });
                                });
                            });

                            it('Then the history should record the attempt, the incorrect challenge, the block attempt, and the second incorrect challenge', function () {
                                return player0.getHistory().then(function (history) {
                                    expect(history).to.eql([
                                        '{0} attempted to extorquir from {1}',
                                        '{1} incorrectly challenged {0}; {0} trocard capitão for a new role; {1} revealed condessa',
                                        '{1} attempted to block with embaixador',
                                        '{0} incorrectly challenged {1}; {1} trocard embaixador for a new role; {0} revealed condessa'
                                    ]);
                                });
                            });
                        });
                    });
                });

                // A attempted to extorquir from B; B attempted to block with embaixador; A incorrectly challenged B; A revealed condessa
                describe('When player1 blocks and player0 incorrectly challenges the block', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'embaixador'
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                player0.command({
                                    command: 'reveal',
                                    role: 'condessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record the extorquir attempt, the block attempt, and the incorrect challenge', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to extorquir from {1}',
                                '{1} attempted to block with embaixador',
                                '{0} incorrectly challenged {1}; {1} trocard embaixador for a new role; {0} revealed condessa'
                            ]);
                        });
                    });
                });
            });
        });

        describe('Given player0 does not have a capitão and player1 does not have an embaixador', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'condessa', 'condessa');
                game._test_setInfluence(1, 'condessa', 'condessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });

                return player0.getHistory();
            });

            describe('When player0 tries to extorquir from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'extorquir',
                        target: 1
                    });
                });

                // A attempted to extorquir from B; B successfully challenged A; A revealed condessa
                describe('When player1 successfully challenges and player0 reveals', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'challenge'
                            });

                            return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                player0.command({
                                    command: 'reveal',
                                    role: 'condessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt and the challenge', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to extorquir from {1}',
                                '{1} successfully challenged {0}; {0} revealed condessa'
                            ]);
                        })
                    });
                });

                // A attempted to extorquir from B; B attempted to block with embaixador; A successfully challenged B; B revealed condessa; A stole from B
                describe('When player1 blocks and player0 successfully challenges the block', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'embaixador'
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'condessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt, the block, the challenge and the final extorquir', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to extorquir from {1}',
                                '{1} attempted to block with embaixador',
                                '{0} successfully challenged {1}; {1} revealed condessa',
                                '{0} stole from {1}'
                            ]);
                        })
                    });
                });
            });
        });

        describe('Given player0 is assassinoating player1 with a real assassino', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'assassino');
                game._test_setInfluence(1, 'embaixador');

                game._test_setTurnState({
                    name: stateNames.ACTION_RESPONSE,
                    playerIdx: 0,
                    action: 'assassinar',
                    message: '{0} attempted to assassinar {1}',
                    target: 1
                });

                return player0.getHistory();
            });

            describe('When player1 challenges', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'challenge'
                    });
                });

                it('Then the history should record the attempted assassinoation, the failed challenge', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to assassinar {1}',
                            '{1} incorrectly challenged {0}; {0} trocard assassino for a new role; {1} revealed embaixador',
                            '{1} suffered a humiliating defeat'
                        ]);
                    });
                });
            });
        });

        describe('Given player1 is blocking an assassinoation with a bluffed condessa', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'assassino');
                game._test_setInfluence(1, 'duque', 'duque');

                game._test_setTurnState({
                    name: stateNames.BLOCK_RESPONSE,
                    playerIdx: 0,
                    action: 'assassinar',
                    message: '{1} attempted to block with condessa',
                    target: 1,
                    blockingRole: 'condessa'
                });

                return player0.getHistory();
            });

            describe('When player0 challenges', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'challenge'
                    });
                });

                it('Then the history should record the attempted assassinoation, the failed challenge', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{1} attempted to block with condessa',
                            '{0} successfully challenged {1}; {1} revealed duque',
                            '{0} assassinard {1}; {1} revealed duque',
                            '{1} suffered a humiliating defeat'
                        ]);
                    });
                });
            });
        });

        describe('Given player1 is blocking an assassinoation with a bluffed condessa and has only one influence left', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'assassino');
                game._test_setInfluence(1, 'duque');

                game._test_setTurnState({
                    name: stateNames.BLOCK_RESPONSE,
                    playerIdx: 0,
                    action: 'assassinar',
                    message: '{1} attempted to block with condessa',
                    target: 1,
                    blockingRole: 'condessa'
                });

                return player0.getHistory();
            });

            describe('When player0 challenges', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'challenge'
                    });
                });

                it('Then the history should record the attempted assassinoation, the failed challenge', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{1} attempted to block with condessa',
                            '{0} successfully challenged {1}; {1} revealed duque',
                            '{1} suffered a humiliating defeat'
                        ]);
                    });
                });
            });
        });
    });

    describe('Given there are three players', function () {
        beforeEach(function () {
            player2 = testPlayers.createTestPlayer();
            return testPlayers.waitForNewPlayers(player2).then(function () {
                return testPlayers.startGame();
            });
        });

        // A attempted to extorquir from B; B incorrectly challenged A; B revealed condessa; B attempted to block with embaixador; A successfully challenged B; B revealed condessa; A stole from B
        describe('Given player0 has a capitão and player1 does not have an embaixador', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'capitão', 'condessa');
                game._test_setInfluence(1, 'condessa', 'condessa');
                game._test_setInfluence(2, 'condessa', 'condessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });
            });

            describe('When player0 tries to extorquir from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'extorquir',
                        target: 1
                    });
                });

                describe('When player1 incorrectly challenges then finally blocks, and player0 successfully challenges the block', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'challenge'
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'condessa'
                                });
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.FINAL_ACTION_RESPONSE).then(function () {
                                player1.command({
                                    command: 'block',
                                    blockingRole: 'embaixador'
                                });
                            });
                        }).then(function () {
                            return testPlayers.consumeState(stateNames.BLOCK_RESPONSE).then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt, the challenge, the block, the challenge and the final extorquir', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                'player0 joined the game',
                                'player1 joined the game',
                                'player2 joined the game',
                                '{0} attempted to extorquir from {1}',
                                '{1} incorrectly challenged {0}; {0} trocard capitão for a new role; {1} revealed condessa',
                                '{1} attempted to block with embaixador',
                                '{0} successfully challenged {1}; {1} revealed condessa',
                                '{1} suffered a humiliating defeat',
                                '{0} stole from {1}'
                            ]);
                        })
                    });
                });
            });
        });
    });
});
