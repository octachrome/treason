var expect = require('expect.js');

var createGame = require('../game');
var createTestPlayer = require('../test-util/test-player');
var createAiPlayer = require('../ai-player');
var shared = require('../web/shared');
var stateNames = shared.states;

describe('AI', function () {
    var game;
    var aiPlayer;
    var testPlayer;

    beforeEach(function () {
        game = createGame();
        aiPlayer = createAiPlayer(game, {
            searchHorizon: 7
        });
        testPlayer = createTestPlayer(game);
        return testPlayer.getNextState();
    });

    describe('Given an AI with a duke vs an opponent with a captain', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke');
            game._test_setInfluence(1, 'captain');
            game._test_setCash(0, 6);
            game._test_setCash(1, 2);

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: 1
            });
        });

        describe('When the opponent attempts to steal', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'steal',
                    target: 0
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the computer should challenge, causing them to lose the game', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.GAME_WON);
                    expect(state.state.playerIdx).to.be(1);
                });
            });
        });
    });

    describe('Given an AI with a duke vs an opponent with a captain, and the endgame is a long way off', function () {
        beforeEach(function () {
            game._test_setInfluence(0, 'duke', 'duke');
            game._test_setInfluence(1, 'captain', 'captain');
            game._test_setCash(0, 6);
            game._test_setCash(1, 2);

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: 1
            });
        });

        describe('When the opponent attempts to steal', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'steal',
                    target: 0
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the computer should bluff captain/ambassador', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                    expect(state.state.blockingRole).to.match(/^(captain|ambassador)$/);
                    expect(state.state.playerIdx).to.be(1);
                });
            });
        });
    });
});
