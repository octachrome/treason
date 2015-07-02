var expect = require('expect.js');

var createGame = require('../game');
var createTestPlayer = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;

describe('History', function () {
    var game;
    var player0;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame();
        player0 = createTestPlayer(game);
        player1 = createTestPlayer(game);
        return player1.getNextState();
    });

    describe('Given player0 has a captain and player1 has an ambassador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'captain', 'contessa');
            game._test_setInfluence(1, 'ambassador', 'contessa');

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: 0
            });

            return player0.getHistory();
        });

        describe('When player0 tries to steal from player1', function () {
            beforeEach(function () {
                player0.command({
                    command: 'play-action',
                    action: 'steal',
                    target: 1
                });
            });

            // A stole from B
            describe('When player1 allows', function () {
                beforeEach(function () {
                    player1.getNextState().then(function () {
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

            // A attempted to steal from B; B blocked with ambassador
            describe('When player1 blocks and player0 allows the block', function () {
                beforeEach(function () {
                    player1.getNextState().then(function () {
                        player1.command({
                            command: 'block',
                            blockingRole: 'ambassador'
                        });

                        return player0.getNextState().then(function () {
                            player0.command({
                                command: 'allow'
                            });
                        });
                    });
                });

                it('Then the history should record that player0 attempted to steal, and then that player1 blocked', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} blocked with ambassador'
                        ]);
                    });
                });
            });

            describe('When player1 incorrectly challenges and reveals an influence', function () {
                beforeEach(function () {
                    return player1.getNextState().then(function () {
                        player1.command({
                            command: 'challenge'
                        });

                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'reveal',
                                role: 'contessa'
                            });
                        });
                    });
                });

                it('Then the history should record that player0 attempted to steal, and then that player1 failed to challenge and revealed', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa'
                        ]);
                    });
                });

                // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; A stole from B
                describe('When player1 allows the steal after a failed challenge', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function (state) {
                            player1.command({
                                command: 'allow'
                            });
                        });
                    });

                    it('Then the history should record the attempt, the incorrect challenge, and the final steal', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                '{0} stole from {1}'
                            ]);
                        });
                    });
                });

                // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B blocked with ambassador
                describe('When player1 blocks the steal after a failed challenge', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function (state) {
                            player1.command({
                                command: 'block',
                                blockingRole: 'ambassador'
                            });
                        });
                    });

                    describe('When player0 allows the block', function () {
                        beforeEach(function () {
                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'allow'
                                });
                            });
                        });

                        it('Then the history should record the attempt, the incorrect challenge, and the final block', function () {
                            return player0.getHistory().then(function (history) {
                                expect(history).to.eql([
                                    '{0} attempted to steal from {1}',
                                    '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                    '{1} blocked with ambassador'
                                ]);
                            });
                        });
                    });

                    // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B attempted to block with ambassador; A incorrectly challenged B; A revealed contessa
                    describe('When player0 incorrectly challenges the block', function () {
                        beforeEach(function () {
                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            }).then(function () {
                                return player0.getNextState().then(function () {
                                    player0.command({
                                        command: 'reveal',
                                        role: 'contessa'
                                    });
                                });
                            });
                        });

                        it('Then the history should record the attempt, the incorrect challenge, the block attempt, and the second incorrect challenge', function () {
                            return player0.getHistory().then(function (history) {
                                expect(history).to.eql([
                                    '{0} attempted to steal from {1}',
                                    '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                    '{1} attempted to block with ambassador',
                                    '{0} incorrectly challenged {1}; {1} exchanged ambassador for a new role; {0} revealed contessa'
                                ]);
                            });
                        });
                    });
                });
            });

            // A attempted to steal from B; B attempted to block with ambassador; A incorrectly challenged B; A revealed contessa
            describe('When player1 blocks and player0 incorrectly challenges the block', function () {
                beforeEach(function () {
                    player1.getNextState().then(function () {
                        player1.command({
                            command: 'block',
                            blockingRole: 'ambassador'
                        });

                        return player0.getNextState().then(function () {
                            player0.command({
                                command: 'challenge'
                            });
                        }).then(function () {
                            player0.getNextState().then(function () {
                                player0.command({
                                    command: 'reveal',
                                    role: 'contessa'
                                });
                            });
                        });
                    });
                });

                it('Then the history should record the steal attempt, the block attempt, and the incorrect challenge', function () {
                    return player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} attempted to block with ambassador',
                            '{0} incorrectly challenged {1}; {1} exchanged ambassador for a new role; {0} revealed contessa'
                        ]);
                    });
                });
            });
        });
    });

    describe('Given player0 does not have a captain and player1 does not have an ambassador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'contessa', 'contessa');
            game._test_setInfluence(1, 'contessa', 'contessa');

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: 0
            });

            return player0.getHistory();
        });

        describe('When player0 tries to steal from player1', function () {
            beforeEach(function () {
                player0.command({
                    command: 'play-action',
                    action: 'steal',
                    target: 1
                });
            });

            // A attempted to steal from B; B successfully challenged A; A revealed contessa
            describe('When player1 successfully challenges and player0 reveals', function () {
                beforeEach(function () {
                    return player1.getNextState().then(function () {
                        player1.command({
                            command: 'challenge'
                        });

                        return player0.getNextState().then(function () {
                            player0.command({
                                command: 'reveal',
                                role: 'contessa'
                            });
                        });
                    });
                });

                it('Then the history should record the attempt and the challenge', function () {
                    player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} successfully challenged {0}; {0} revealed contessa'
                        ]);
                    })
                });
            });

            // A attempted to steal from B; B attempted to block with ambassador; A successfully challenged B; B revealed contessa; A stole from B
            describe('When player1 blocks and player0 successfully challenges the block', function () {
                beforeEach(function () {
                    return player1.getNextState().then(function () {
                        player1.command({
                            command: 'block',
                            blockingRole: 'ambassador'
                        });
                    }).then(function () {
                        return player0.getNextState().then(function () {
                            player0.command({
                                command: 'challenge'
                            });
                        });
                    }).then(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'reveal',
                                role: 'contessa'
                            });
                        });
                    });
                });

                it('Then the history should record the attempt, the block, the challenge and the final steal', function () {
                    player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} attempted to block with ambassador',
                            '{0} successfully challenged {1}; {1} revealed contessa',
                            '{0} stole from {1}'
                        ]);
                    })
                });
            });
        });
    });

    // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B attempted to block with ambassador; A successfully challenged B; B revealed contessa; A stole from B
    describe('Given player0 has a captain and player1 does not have an ambassador', function () {
        beforeEach(function () {
            player2 = createTestPlayer(game);
            return player2.getNextState().then(function () {
                game._test_setInfluence(0, 'captain', 'contessa');
                game._test_setInfluence(1, 'contessa', 'contessa');
                game._test_setInfluence(2, 'contessa', 'contessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });

                return player0.getHistory();
            });
        });

        describe('When player0 tries to steal from player1', function () {
            beforeEach(function () {
                player0.command({
                    command: 'play-action',
                    action: 'steal',
                    target: 1
                });
            });

            describe('When player1 incorrectly challenges then finally blocks, and player0 successfully challenges the block', function () {
                beforeEach(function () {
                    return player1.getNextState().then(function () {
                        player1.command({
                            command: 'challenge'
                        });
                    }).then(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'reveal',
                                role: 'contessa'
                            });
                        });
                    }).then(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'ambassador'
                            });
                        });
                    }).then(function () {
                        return player0.getNextState().then(function () {
                            player0.command({
                                command: 'challenge'
                            });
                        });
                    });
                });

                it('Then the history should record the attempt, the challenge, the block, the challenge and the final steal', function () {
                    player0.getHistory().then(function (history) {
                        expect(history).to.eql([
                            '{0} attempted to steal from {1}',
                            '{1} incorrectly challenged {0}; {0} exchanged captain for another role; {1} revealed contessa',
                            '{1} attempted to block with ambassador',
                            '{0} successfully challenged {1}; {1} revealed contessa',
                            '{0} stole from {1}'
                        ]);
                    })
                });
            });
        });
    });

    describe('Given player0 is assassinating player1 with a real assassin', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'assassin');
            game._test_setInfluence(1, 'ambassador');

            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
                message: '{0} attempted to assassinate {1}',
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

            it('Then the history should record the attempted assassination, the failed challenge', function () {
                return player0.getHistory().then(function (history) {
                    expect(history).to.eql([
                        '{0} attempted to assassinate {1}',
                        '{1} incorrectly challenged {0}; {0} exchanged assassin for a new role; {1} revealed ambassador',
                        '{1} suffered a humiliating defeat'
                    ]);
                });
            });
        });
    });

    describe('Given player1 is blocking an assassination with a bluffed contessa', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'assassin');
            game._test_setInfluence(1, 'duke', 'duke');

            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
                message: '{1} attempted to block with contessa',
                target: 1,
                blockingRole: 'contessa'
            });

            return player0.getHistory();
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then the history should record the attempted assassination, the failed challenge', function () {
                return player0.getHistory().then(function (history) {
                    expect(history).to.eql([
                        '{1} attempted to block with contessa',
                        '{0} successfully challenged {1}; {1} revealed duke',
                        '{0} assassinated {1}; {1} revealed duke',
                        '{1} suffered a humiliating defeat'
                    ]);
                });
            });
        });
    });
});
