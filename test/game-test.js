var expect = require('expect.js');

var createGame = require('../game');
var TestPlayers = require('../test-util/test-player');
var shared = require('../web/shared');
var stateNames = shared.states;
var nullDataAccess = require('./null-data-access');

describe('Game', function () {
    var game;
    var testPlayers;
    var player0;
    var player1;
    var player2;

    beforeEach(function () {
        game = createGame({
            firstPlayer: 0,
            dataAccess: nullDataAccess
        });
        testPlayers = new TestPlayers(game);
        player0 = testPlayers.createTestPlayer();
        player1 = testPlayers.createTestPlayer();
        return testPlayers.waitForNewPlayers(player0, player1);
    });

    describe('When a player joins', function () {
        var player2;

        beforeEach(function () {
            player2 = testPlayers.createTestPlayer(game);
        });

        it('Then the game should be in state WAITING_FOR_PLAYERS', function () {
            return player2.getNextState().then(function (state) {
                expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
            });
        });
    });

    describe('Reveals', function () {
        beforeEach(function () {
            player2 = testPlayers.createTestPlayer(game);
            return testPlayers.waitForNewPlayers(player2).then(function () {
                return testPlayers.startGame();
            });
        });

        describe('Given a player is revealing an influence due to a failed embaixador challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'embaixador', 'assassino');
                game._test_setInfluence(1, 'duque', 'capitão');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'trocar',
                    playerToReveal: 1,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'capitão'
                    });
                });

                it('Then player0 should be in trocar state', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.trocar);
                        expect(state.state.playerIdx).to.be(0);
                    });
                });

                it('Then player1 should lose an influence', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to a correct embaixador challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duque', 'capitão');
                game._test_setInfluence(1, 'duque', 'capitão');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'trocar',
                    playerToReveal: 0,
                    reason: 'successful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'duque'
                    });
                });

                it('Then player0 should lose an influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to a failed assassino challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'assassino', 'capitão');
                game._test_setInfluence(1, 'duque', 'embaixador');
                game._test_setInfluence(2, 'duque', 'capitão');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'assassinar',
                    target: 1,
                    reason: 'incorrect-challenge',
                    playerToReveal: 2
                });
            });

            describe('When player2 reveals a role', function () {
                beforeEach(function () {
                    player2.command({
                        command: 'reveal',
                        role: 'capitão'
                    });
                });

                it('Then player1 should not lose any influence yet', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(2);
                    });
                });

                it('Then player1 should have a final chance to block the assassinoation', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.FINAL_ACTION_RESPONSE);
                        expect(state.state.playerIdx).to.be(0);
                        expect(state.state.target).to.be(1);
                    });
                });

                describe('When player1 allows the assassinoation', function () {
                    beforeEach(function () {
                        return testPlayers.consumeState(stateNames.FINAL_ACTION_RESPONSE).then(function () {
                            player1.command({
                                command: 'allow'
                            });
                        });
                    });

                    it('Then player1 should have to reveal an influence', function () {
                        return player1.getNextState().then(function (state) {
                            expect(state.state.name).to.be(stateNames.REVEAL_INFLUENCE);
                            expect(state.state.playerToReveal).to.be(1);
                        });
                    });
                })
            });
        });

        describe('Given a player is revealing an influence due to a correct assassino challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duque', 'capitão');
                game._test_setInfluence(1, 'duque', 'capitão');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'assassinar',
                    target: 1,
                    playerToReveal: 0,
                    reason: 'successful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'duque'
                    });
                });

                it('Then player0 should lose an influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to an incorrect duque challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duque', 'duque');
                game._test_setInfluence(1, 'capitão', 'capitão');
                game._test_setCash(0, 0);
                game._test_setCash(1, 0);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'taxa',
                    playerToReveal: 1,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'capitão'
                    });
                });

                it('Then the taxa should be applied', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].cash).to.be(3);
                    });
                });

                it('Then player1 should lose an influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to an correct duque challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'condessa', 'condessa');
                game._test_setInfluence(1, 'capitão', 'capitão');
                game._test_setCash(0, 0);
                game._test_setCash(1, 0);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'taxa',
                    playerToReveal: 0,
                    reason: 'sucessful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'condessa'
                    });
                });

                it('Then the taxa should not be applied', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].cash).to.be(0);
                    });
                });

                it('Then player0 should lose an influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to an incorrect challenge of a block', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'capitão', 'capitão');
                game._test_setInfluence(1, 'embaixador', 'embaixador');
                game._test_setCash(0, 2);
                game._test_setCash(1, 2);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'extorquir',
                    target: 1,
                    blockingRole: 'embaixador',
                    playerToReveal: 0,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'capitão'
                    });
                });

                it('Then the extorquir should not be applied', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].cash).to.be(2);
                        expect(state.players[1].cash).to.be(2);
                    });
                });

                it('Then player0 should lose an influence', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.players[0].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });
    });

    describe('golpe', function () {
        describe('Given a player is revealing an influence due to a golpe', function () {
            beforeEach(function () {
                return testPlayers.startGame().then(function () {
                    game._test_setInfluence(0, 'embaixador', 'assassino');
                    game._test_setInfluence(1, 'duque', 'capitão');
                    game._test_setTurnState({
                        name: stateNames.REVEAL_INFLUENCE,
                        playerIdx: 0,
                        action: 'golpe',
                        playerToReveal: 1,
                        reason: 'golpe'
                    });
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'capitão'
                    });
                });

                it('Then player1 should lose an influence', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(1);
                    });
                });

                it('Then the turn should pass to player1', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(1);
                    });
                });
            });
        });
    });

    describe('Disconnects', function () {
        beforeEach(function () {
            player2 = testPlayers.createTestPlayer(game);
            return testPlayers.waitForNewPlayers(player2).then(function () {
                return testPlayers.startGame();
            });
        });

        describe('Given player1 is revealing an influence due to a golpe', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'embaixador', 'assassino');
                game._test_setInfluence(1, 'duque', 'capitão');
                game._test_setInfluence(2, 'embaixador', 'embaixador');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'golpe',
                    playerToReveal: 1,
                    reason: 'golpe'
                });
            });

            describe('When player1 leaves the game', function () {
                beforeEach(function () {
                    player1.leaveGame();
                });

                it('Then the turn should pass to player2', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(2);
                    });
                });
            });
        });

        describe('Given player0 is attempting to draw taxa, and player2 has allowed', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'embaixador', 'assassino');
                game._test_setInfluence(1, 'duque', 'capitão');
                game._test_setInfluence(2, 'embaixador', 'embaixador');
                game._test_setTurnState({
                    name: stateNames.ACTION_RESPONSE,
                    playerIdx: 0,
                    action: 'taxa'
                });
                game._test_resetAllows(0);

                player2.command({
                    command: 'allow'
                });
            });

            describe('When player1 leaves the game', function () {
                beforeEach(function () {
                    player1.leaveGame();
                });

                it('Then the turn should pass to player2', function () {
                    return player0.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.START_OF_TURN);
                        expect(state.state.playerIdx).to.be(2);
                    });
                });
            });
        });
    });

    describe('Exchanging', function () {
        describe('Given a game with embaixadors', function () {
            beforeEach(function () {
                return testPlayers.startGame();
            });

            describe('When player0 tries to trocar', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'trocar'
                    });

                    return testPlayers.consumeState(stateNames.ACTION_RESPONSE);
                });

                describe('When player1 allows', function () {
                    beforeEach(function () {
                        player1.command({
                            command: 'allow',
                            action: 'trocar'
                        });
                    });

                    it('Then player0 should choose from four roles', function () {
                        return player0.getNextState().then(function (state) {
                            expect(state.state.name).to.be(stateNames.trocar);
                            expect(state.state.trocarOptions.length).to.be(4);
                        });
                    });
                });
            });
        });

        describe('Given a game with inquisidores', function () {
            beforeEach(function () {
                return testPlayers.startGame('inquisidores');
            });

            describe('When player0 tries to trocar', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'trocar'
                    });

                    return testPlayers.consumeState(stateNames.ACTION_RESPONSE);
                });

                describe('When player1 allows', function () {
                    beforeEach(function () {
                        player1.command({
                            command: 'allow',
                            action: 'trocar'
                        });
                    });

                    it('Then player0 should choose from three roles', function () {
                        return player0.getNextState().then(function (state) {
                            expect(state.state.name).to.be(stateNames.trocar);
                            expect(state.state.trocarOptions.length).to.be(3);
                        });
                    });
                });
            });
        });
    });
});
