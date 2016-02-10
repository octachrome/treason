var expect = require('expect.js');

var createGame = require('../game');
var TestPlayers = require('../test-util/test-player');
var createMinimaxPlayer = require('../minimax-player');
var shared = require('../web/shared');
var stateNames = shared.states;

var MINIMAX_IDX = 0;
var OPPONENT_IDX = 1;

describe('Minimax player', function () {
    var game;
    var minimaxPlayer;
    var testPlayer;

    this.timeout(5000);

    describe('Given the opponent player plays first', function () {
        beforeEach(function () {
            game = createGame({
                firstPlayer: OPPONENT_IDX
            });
            minimaxPlayer = createMinimaxPlayer(game);
            var testPlayers = new TestPlayers(game);
            testPlayer = testPlayers.createTestPlayer();
            return testPlayers.waitForNewPlayers(testPlayer).then(function () {
                testPlayer.command({
                    command: 'start'
                });
            });
        });

        describe('When opponent draws tax', function () {
            beforeEach(function () {
                return testPlayer.getNextState().then(function (state) {
                    testPlayer.command({
                        command: 'play-action',
                        action: 'tax',
                        stateId: state.stateId
                    });
                    return testPlayer.getNextState();
                });
            });

            it('should allow', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.players[MINIMAX_IDX].influenceCount).to.be(2);
                    expect(state.players[OPPONENT_IDX].influenceCount).to.be(2);
                    expect(state.players[OPPONENT_IDX].cash).to.be(5);
                });
            });
        });
    });

    describe('Given the minimax player plays first', function () {
        beforeEach(function () {
            game = createGame({
                firstPlayer: MINIMAX_IDX
            });
            minimaxPlayer = createMinimaxPlayer(game);
            var testPlayers = new TestPlayers(game);
            testPlayer = testPlayers.createTestPlayer();
            return testPlayers.waitForNewPlayers(testPlayer).then(function () {
                testPlayer.command({
                    command: 'start'
                });
            });
        });

        it('should attempt to draw tax', function () {
            return testPlayer.getNextState().then(function (state) {
                return testPlayer.getNextState();
            }).then(function (state) {
                expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                expect(state.state.action).to.be('tax');
            });
        });
    });
});
