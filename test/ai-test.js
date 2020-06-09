var expect = require('expect.js');

var createGame = require('../game');
var TestPlayers = require('../test-util/test-player');
var createAiPlayer = require('../ai-player');
var shared = require('../web/shared');
var stateNames = shared.states;
var nullDataAccess = require('./null-data-access');

var AI_IDX = 0;
var OPPONENT_IDX = 1;

describe('AI', function () {
    var game;
    var aiPlayer;
    var testPlayer;

    beforeEach(function () {
        game = createGame({
            randomSeed: 1,
            firstPlayer: OPPONENT_IDX,
            dataAccess: nullDataAccess
        });
        aiPlayer = createAiPlayer(game, {
            searchHorizon: 7,
            chanceToBluff: 1,
            randomSeed: 1 // Make AI decisions predictably random.
        });
        var testPlayers = new TestPlayers(game);
        testPlayer = testPlayers.createTestPlayer();
        return testPlayers.waitForNewPlayers(testPlayer).then(function () {
            return testPlayers.startGame();
        });
    });

    describe('Given an AI with a duque vs an opponent with a capitão', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'duque');
            game._test_setInfluence(OPPONENT_IDX, 'capitão');
            game._test_setCash(AI_IDX, 6);
            game._test_setCash(OPPONENT_IDX, 2);

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to extorquir', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'extorquir',
                    target: AI_IDX
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should challenge, causing them to lose the game', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
                    expect(state.state.winnerIdx).to.be(OPPONENT_IDX);
                });
            });
        });
    });

    describe('Given an AI with a condessa vs an opponent with a capitão, and the endgame is a long way off', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'condessa', 'condessa');
            game._test_setInfluence(OPPONENT_IDX, 'capitão', 'capitão');
            game._test_setCash(AI_IDX, 6);
            game._test_setCash(OPPONENT_IDX, 2);

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to extorquir', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'extorquir',
                    target: AI_IDX
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should bluff capitão/embaixador', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                    expect(state.state.blockingRole).to.match(/capitão|embaixador/);
                    expect(state.state.playerIdx).to.be(OPPONENT_IDX);
                });
            });
        });

        // todo
        describe('When the opponent attempts to draw ajuda externa', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'ajuda-externa'
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should bluff duque', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                    expect(state.state.blockingRole).to.match(/duque/);
                    expect(state.state.playerIdx).to.be(OPPONENT_IDX);
                });
            });
        });
    });

    describe('Given an AI attempts a extorquir that will win the game', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'capitão');
            game._test_setInfluence(OPPONENT_IDX, 'condessa');
            game._test_setCash(AI_IDX, 6);
            game._test_setCash(OPPONENT_IDX, 6);

            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: AI_IDX,
                action: 'extorquir',
                target: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to block', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'block',
                    blockingRole: 'embaixador'
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                });
            });

            it('Then the AI should challenge, and win', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
                    expect(state.state.winnerIdx).to.be(AI_IDX);
                });
            });
        });
    });

    describe('Given the AI attempts a extorquir, and the endgame is some way off', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'capitão');
            game._test_setInfluence(OPPONENT_IDX, 'condessa');
            game._test_setCash(AI_IDX, 2);
            game._test_setCash(OPPONENT_IDX, 2);

            game._test_setTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: AI_IDX,
                action: 'extorquir',
                target: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to block', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'block',
                    blockingRole: 'embaixador'
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                });
            });

            it('Then the AI should allow the block', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.state.playerIdx).to.be(OPPONENT_IDX);
                });
            });
        });
    });

    describe('Given the AI has no good roles, and the endgame is some way off', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'condessa', 'condessa');
            game._test_setInfluence(OPPONENT_IDX, 'embaixador', 'embaixador');
            game._test_setCash(AI_IDX, 2);
            game._test_setCash(OPPONENT_IDX, 2);
            game._test_setTreasuryReserve(0);
        });

        describe('When it is the AI turn', function () {
            beforeEach(function () {
                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: AI_IDX
                }, true);

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                });
            });

            it('Then the AI should bluff duque or capitão', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.state.action).to.match(/taxa|extorquir/);
                });
            });
        });

        describe('When our capitão bluff has previously been called', function () {
            beforeEach(function () {
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: AI_IDX,
                    action: 'extorquir',
                    target: OPPONENT_IDX,
                    playerToReveal: AI_IDX,
                    reason: 'successful-challenge'
                }, true);

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);

                    return testPlayer.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    });
                });
            });

            describe('When it is the AI turn', function () {
                beforeEach(function () {
                    game._test_setTurnState({
                        name: stateNames.START_OF_TURN,
                        playerIdx: AI_IDX
                    }, true);

                    return testPlayer.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    });
                });

                it('Then the AI should not bluff capitão again', function () {
                    return testPlayer.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                        expect(state.state.playerIdx).to.be(AI_IDX);
                        expect(state.state.action).not.to.be('extorquir');
                    });
                });
            });
        });
    });

    describe('Given the AI has no good roles, and a bluff would win us the game', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'condessa');
            game._test_setInfluence(OPPONENT_IDX, 'embaixador');
            game._test_setCash(AI_IDX, 5);
            game._test_setCash(OPPONENT_IDX, 5);
            game._test_setTreasuryReserve(0);
        });

        describe('When it is the AI turn', function () {
            beforeEach(function () {
                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: AI_IDX
                }, true);

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                });
            });

            it('Then the AI should trocar instead of bluffing a winning move (because we will just get challenged)', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.state.action).to.be('trocar');
                });
            });
        });
    });

    describe('Given the AI has no cash and an embaixador', function () {
        beforeEach(function () {
            game._test_setInfluence(AI_IDX, 'embaixador');
            game._test_setInfluence(OPPONENT_IDX, 'capitão');
            game._test_setCash(AI_IDX, 0);
            game._test_setCash(OPPONENT_IDX, 0);

            game._test_setTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the player extorquirs from the AI', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'extorquir',
                    target: AI_IDX
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should allow the extorquir (because no cash will be lost)', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.players[OPPONENT_IDX].cash).to.be(0);
                });
            });
        });
    });
});
