var expect = require('expect.js');

var createGame = require('../game');
var TestPlayers = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;
var nullDataAccess = require('./null-data-access');

describe('Challenges', function () {
    var game;
    var testPlayers;
    var player0;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame({
            dataAccess: nullDataAccess
        });
        testPlayers = new TestPlayers(game)
        player0 = testPlayers.createTestPlayer();
        player1 = testPlayers.createTestPlayer();
        player2 = testPlayers.createTestPlayer();
        return testPlayers.waitForNewPlayers(player0, player1, player1).then(function () {
            return testPlayers.startGame();
        });
    });

    describe('Given player0 assassinars player1 with a real assassino', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'assassino');
            game._test_setInfluence(1, 'duque', 'capitão');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1
            });
        });

        describe('When player1 challenges', function () {
            beforeEach(function () {
                player1.command({
                    command: 'challenge'
                });
            });

            it('Then player1 should not lose any influence yet', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(2);
                });
            });

            it('Then the player1 should reveal an influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                    expect(state.state.playerToReveal).to.be(1);
                    expect(state.state.playerIdx).to.be(0);
                });
            });
        });
    });

    describe('Given player0 assassinars player1 with a real assassino', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'assassino');
            game._test_setInfluence(1, 'duque', 'capitão');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1
            });
        });

        describe('When player2 challenges', function () {
            beforeEach(function () {
                player2.command({
                    command: 'challenge'
                });
            });

            it('Then player1 should not lose any influence yet', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(2);
                });
            });

            it('Then player2 should reveal an influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                    expect(state.state.playerIdx).to.be(0);
                    expect(state.state.playerToReveal).to.be(2);
                });
            });
        });
    });

    describe('Given player0 assassinars player1 with a real assassino, and player2 has only one influence', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'assassino');
            game._test_setInfluence(1, 'duque', 'capitão');
            game._test_setInfluence(2, 'duque');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1
            });
        });

        describe('When player2 challenges', function () {
            beforeEach(function () {
                player2.command({
                    command: 'challenge'
                });
            });

            it('Then player1 should not lose any influence yet', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(2);
                });
            });

            it('Then player2 should lose their final influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[2].influenceCount).to.be(0);
                });
            });

            it('Then player1 should get a final chance to block', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.FINAL_ACTION_RESPONSE);
                    expect(state.state.playerIdx).to.be(0);
                });
            });
        });
    });

    describe('Given player0 assassinars player1 with a bluffed assassino', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'capitão');
            game._test_setInfluence(1, 'duque', 'capitão');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1
            });
        });

        describe('When player1 challenges', function () {
            beforeEach(function () {
                player1.command({
                    command: 'challenge'
                });
            });

            it('Then player0 should reveal an influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                    expect(state.state.playerIdx).to.be(0);
                    expect(state.state.playerToReveal).to.be(0);
                });
            });
        });
    });

    describe('Given player1 blocks player0\'s assassinoation with a bluffed condessa', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'assassino');
            game._test_setInfluence(1, 'duque', 'capitão');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1,
                blockingRole: 'condessa'
            });
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then player1 should lose two influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(0);
                });
            });

            it('Then the turn should pass to player2', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.state.playerIdx).to.be(2);
                });
            });
        });
    });

    describe('Given player1 blocks player0\'s assassinoation with a real condessa', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'assassino');
            game._test_setInfluence(1, 'duque', 'condessa');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1,
                blockingRole: 'condessa'
            });
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then the player0 should reveal an influence', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                    expect(state.state.playerToReveal).to.be(0);
                });
            });

            it('Then player1 should not lose any influence', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(2);
                });
            });

            it('Then the assassinoation should still target player1', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.target).to.be(1);
                });
            });

            describe('When player0 reveals', function () {
                beforeEach(function () {
                    return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                        player0.command({
                            command: 'reveal',
                            role: 'assassino'
                        });
                    });
                });

                it('Then player1 should not lose any influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(2);
                    });
                });
            });
        });
    });

    describe('Given player1 blocks player0\'s assassinoation with a real condessa, and player0 has only one influence', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'assassino');
            game._test_setInfluence(1, 'duque', 'condessa');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinar',
                target: 1,
                blockingRole: 'condessa'
            });
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then player0 should lose their last influence', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.players[0].influenceCount).to.be(0);
                });
            });

            it('Then player1 should not lose any influence', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(2);
                });
            });

            it('Then the turn should pass to the next player', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.state.playerIdx).to.be(1);
                });
            });
        });
    });

    describe('Given a player0 trocars using a real embaixador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'embaixador', 'assassino');
            game._test_setInfluence(1, 'duque');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'trocar'
            });
        });

        describe('When player1 challenges', function () {
            beforeEach(function () {
                player1.command({
                    command: 'challenge'
                });
            });

            it('Then player1 should die', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[1].influenceCount).to.be(0);
                });
            });

            it('Then player0 should be in trocar state', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.trocar);
                    expect(state.state.playerIdx).to.be(0);
                });
            });
        });
    });

    describe('Given player1 blocks a extorquir with a bluffed embaixador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duque', 'capitão');
            game._test_setInfluence(1, 'duque', 'condessa');
            game._test_setCash(0, 4);
            game._test_setCash(1, 4);
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'extorquir',
                target: 1,
                blockingRole: 'embaixador'
            });
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then the extorquir should not be performed yet', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.players[0].cash).to.be(4);
                    expect(state.players[1].cash).to.be(4);
                });
            });

            it('Then player1 should reveal an influence', function () {
                return player1.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                    expect(state.state.playerIdx).to.be(0);
                    expect(state.state.playerToReveal).to.be(1);
                });
            });

            describe('When player1 reveals', function () {
                beforeEach(function () {
                    return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                        player1.command({
                            command: 'reveal',
                            role: 'condessa'
                        });
                    })
                });

                it('Then the extorquir should be applied', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].cash).to.be(6);
                        expect(state.players[1].cash).to.be(2);
                    });
                });
            });
        });
    });
});
