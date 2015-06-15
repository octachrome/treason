var expect = require('expect.js');

var createGame = require('../game');
var createTestPlayer = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;

describe('Game', function () {
    var game;
    var player0;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame();
        player0 = createTestPlayer(game);
        player1 = createTestPlayer(game);
        player2 = createTestPlayer(game);
        return player2.getNextState();
    });

    describe('When a player joins', function () {
        var player3;

        beforeEach(function () {
            player3 = createTestPlayer(game);
        })

        it('Then the game should be in state WAITING_FOR_PLAYERS', function () {
            return player3.getNextState().then(function (state) {
                expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
            });
        });
    });

    describe('Challenges', function () {
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

        describe('Given player1 blocks player2\'s assassination with a bluffed contessa', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duke', 'assassin');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.BLOCK_RESPONSE,
                    playerIdx: 0,
                    action: 'assassinate',
                    target: 1,
                    role: 'contessa'
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

        describe('Given player1 blocks player2\'s assassination with a real contessa', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duke', 'assassin');
                game._test_setInfluence(1, 'duke', 'contessa');
                game._test_setTurnState({
                    name: stateNames.BLOCK_RESPONSE,
                    playerIdx: 0,
                    action: 'assassinate',
                    target: 1,
                    role: 'contessa'
                });
            });

            describe('When player0 challenges', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'challenge'
                    });
                });

                it('Then the player0 should reveal a role', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                        expect(state.state.target).to.be(0);
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
});
