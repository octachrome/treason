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

    describe('Given an AI with a duke vs an opponent with a captain', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'duke');
            game.testSetInfluence(OPPONENT_IDX, 'captain');
            game.testSetCash(AI_IDX, 6);
            game.testSetCash(OPPONENT_IDX, 2);

            game.testSetTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to steal', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'steal',
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

    describe('Given an AI with a contessa vs an opponent with a captain, and the endgame is a long way off', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'contessa', 'contessa');
            game.testSetInfluence(OPPONENT_IDX, 'captain', 'captain');
            game.testSetCash(AI_IDX, 6);
            game.testSetCash(OPPONENT_IDX, 2);

            game.testSetTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to steal', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'steal',
                    target: AI_IDX
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should bluff captain/ambassador', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                    expect(state.state.blockingRole).to.match(/captain|ambassador/);
                    expect(state.state.playerIdx).to.be(OPPONENT_IDX);
                });
            });
        });

        // todo
        describe('When the opponent attempts to draw foreign aid', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'foreign-aid'
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should bluff duke', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.BLOCK_RESPONSE);
                    expect(state.state.blockingRole).to.match(/duke/);
                    expect(state.state.playerIdx).to.be(OPPONENT_IDX);
                });
            });
        });
    });

    describe('Given an AI attempts a steal that will win the game', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'captain');
            game.testSetInfluence(OPPONENT_IDX, 'contessa');
            game.testSetCash(AI_IDX, 6);
            game.testSetCash(OPPONENT_IDX, 6);

            game.testSetTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: AI_IDX,
                action: 'steal',
                target: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to block', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'block',
                    blockingRole: 'ambassador'
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

    describe('Given the AI attempts a steal, and the endgame is some way off', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'captain');
            game.testSetInfluence(OPPONENT_IDX, 'contessa');
            game.testSetCash(AI_IDX, 2);
            game.testSetCash(OPPONENT_IDX, 2);

            game.testSetTurnState({
                name: stateNames.ACTION_RESPONSE,
                playerIdx: AI_IDX,
                action: 'steal',
                target: OPPONENT_IDX
            });
        });

        describe('When the opponent attempts to block', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'block',
                    blockingRole: 'ambassador'
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
            game.testSetInfluence(AI_IDX, 'contessa', 'contessa');
            game.testSetInfluence(OPPONENT_IDX, 'ambassador', 'ambassador');
            game.testSetCash(AI_IDX, 2);
            game.testSetCash(OPPONENT_IDX, 2);
            game.testSetTreasuryReserve(0);
        });

        describe('When it is the AI turn', function () {
            beforeEach(function () {
                game.testSetTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: AI_IDX
                }, true);

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                });
            });

            it('Then the AI should bluff duke or captain', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.state.action).to.match(/tax|steal/);
                });
            });
        });

        describe('When our captain bluff has previously been called', function () {
            beforeEach(function () {
                game.testSetTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: AI_IDX,
                    action: 'steal',
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
                    game.testSetTurnState({
                        name: stateNames.START_OF_TURN,
                        playerIdx: AI_IDX
                    }, true);

                    return testPlayer.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    });
                });

                it('Then the AI should not bluff captain again', function () {
                    return testPlayer.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                        expect(state.state.playerIdx).to.be(AI_IDX);
                        expect(state.state.action).not.to.be('steal');
                    });
                });
            });
        });
    });

    describe('Given the AI has no good roles, and a bluff would win us the game', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'contessa');
            game.testSetInfluence(OPPONENT_IDX, 'ambassador');
            game.testSetCash(AI_IDX, 5);
            game.testSetCash(OPPONENT_IDX, 5);
            game.testSetTreasuryReserve(0);
        });

        describe('When it is the AI turn', function () {
            beforeEach(function () {
                game.testSetTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: AI_IDX
                }, true);

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                });
            });

            it('Then the AI should exchange instead of bluffing a winning move (because we will just get challenged)', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.state.action).to.be('exchange');
                });
            });
        });
    });

    describe('Given the AI has no cash and an ambassador', function () {
        beforeEach(function () {
            game.testSetInfluence(AI_IDX, 'ambassador');
            game.testSetInfluence(OPPONENT_IDX, 'captain');
            game.testSetCash(AI_IDX, 0);
            game.testSetCash(OPPONENT_IDX, 0);

            game.testSetTurnState({
                name: stateNames.START_OF_TURN,
                playerIdx: OPPONENT_IDX
            });
        });

        describe('When the player steals from the AI', function () {
            beforeEach(function () {
                testPlayer.command({
                    command: 'play-action',
                    action: 'steal',
                    target: AI_IDX
                });

                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.ACTION_RESPONSE);
                });
            });

            it('Then the AI should allow the steal (because no cash will be lost)', function () {
                return testPlayer.getNextState().then(function (state) {
                    expect(state.state.name).to.be(stateNames.START_OF_TURN);
                    expect(state.state.playerIdx).to.be(AI_IDX);
                    expect(state.players[OPPONENT_IDX].cash).to.be(0);
                });
            });
        });
    });
});
