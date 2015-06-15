var expect = require('expect.js');

var createGame = require('../game');
var createTestPlayer = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;

describe('Game', function () {
    var game;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame();
        player1 = createTestPlayer(game);
        player2 = createTestPlayer(game);
        return player2.getNextState();
    });

    describe('When a player joins', function () {
        it('Should be in state WAITING_FOR_PLAYERS', function () {
            var player3 = createTestPlayer(game);
            return player3.getNextState().then(function (state) {
                expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
            });
        });
    });
});
