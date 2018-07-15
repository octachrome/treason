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

    describe('Given player0 assassinates player1 with a real assassin', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'assassin');
            game._test_setInfluence(1, 'duke', 'captain');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
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

    describe('Given player0 assassinates player1 with a real assassin', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'assassin');
            game._test_setInfluence(1, 'duke', 'captain');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
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

    describe('Given player0 assassinates player1 with a real assassin, and player2 has only one influence', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'assassin');
            game._test_setInfluence(1, 'duke', 'captain');
            game._test_setInfluence(2, 'duke');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
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

    describe('Given player0 assassinates player1 with a bluffed assassin', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'captain');
            game._test_setInfluence(1, 'duke', 'captain');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
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

    describe('Given player1 blocks player0\'s assassination with a bluffed contessa', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'assassin');
            game._test_setInfluence(1, 'duke', 'captain');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
                target: 1,
                blockingRole: 'contessa'
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

    describe('Given player1 blocks player0\'s assassination with a real contessa', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'assassin');
            game._test_setInfluence(1, 'duke', 'contessa');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
                target: 1,
                blockingRole: 'contessa'
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

            it('Then the assassination should still target player1', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.target).to.be(1);
                });
            });

            describe('When player0 reveals', function () {
                beforeEach(function () {
                    return testPlayers.consumeState(stateNames.REVEAL_INFLUENCE).then(function () {
                        player0.command({
                            command: 'reveal',
                            role: 'assassin'
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

    describe('Given player1 blocks player0\'s assassination with a real contessa, and player0 has only one influence', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'assassin');
            game._test_setInfluence(1, 'duke', 'contessa');
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'assassinate',
                target: 1,
                blockingRole: 'contessa'
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

    describe('Given a player0 exchanges using a real ambassador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'ambassador', 'assassin');
            game._test_setInfluence(1, 'duke');
            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: 0,
                action: 'exchange'
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

            it('Then player0 should be in exchange state', function () {
                return player0.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.EXCHANGE);
                    expect(state.state.playerIdx).to.be(0);
                });
            });
        });
    });

    describe('Given player1 blocks a steal with a bluffed ambassador', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'captain');
            game._test_setInfluence(1, 'duke', 'contessa');
            game._test_setCash(0, 4);
            game._test_setCash(1, 4);
            game._test_setTurnState({
                name: stateNames.BLOCK_RESPONSE,
                playerIdx: 0,
                action: 'steal',
                target: 1,
                blockingRole: 'ambassador'
            });
        });

        describe('When player0 challenges', function () {
            beforeEach(function () {
                player0.command({
                    command: 'challenge'
                });
            });

            it('Then the steal should not be performed yet', function () {
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
                            role: 'contessa'
                        });
                    })
                });

                it('Then the steal should be applied', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].cash).to.be(6);
                        expect(state.players[1].cash).to.be(2);
                    });
                });
            });
        });
    });
});
