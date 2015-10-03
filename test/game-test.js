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
        return player1.getNextState();
    });

    describe('When a player joins', function () {
        var player3;

        beforeEach(function () {
            player3 = createTestPlayer(game);
        });

        it('Then the game should be in state WAITING_FOR_PLAYERS', function () {
            return player3.getNextState().then(function (state) {
                expect(state.state.name).to.be(stateNames.WAITING_FOR_PLAYERS);
            });
        });
    });

    describe('Reveals', function () {
        beforeEach(function () {
            player2 = createTestPlayer(game);
            return player2.getNextState();
        });

        describe('Given a player is revealing an influence due to a failed ambassador challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'ambassador', 'assassin');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'exchange',
                    playerToReveal: 1,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'captain'
                    });
                });

                it('Then player0 should be in exchange state', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.EXCHANGE);
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

        describe('Given a player is revealing an influence due to a correct ambassador challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duke', 'captain');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'exchange',
                    playerToReveal: 0,
                    reason: 'successful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'duke'
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

        describe('Given a player is revealing an influence due to a failed assassin challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'assassin', 'captain');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setInfluence(2, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'assassinate',
                    target: 1,
                    reason: 'incorrect-challenge',
                    playerToReveal: 2
                });
            });

            describe('When player2 reveals a role', function () {
                beforeEach(function () {
                    player2.command({
                        command: 'reveal',
                        role: 'captain'
                    });
                });

                it('Then player1 should not lose any influence yet', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.players[1].influenceCount).to.be(2);
                    });
                });

                it('Then player1 should have a final chance to block the assassination', function () {
                    return player1.getNextState().then(function (state) {
                        expect(state.state.name).to.be(stateNames.FINAL_ACTION_RESPONSE);
                        expect(state.state.playerIdx).to.be(0);
                        expect(state.state.target).to.be(1);
                    });
                });
            });
        });

        describe('Given a player is revealing an influence due to a correct assassin challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duke', 'captain');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'assassinate',
                    target: 1,
                    playerToReveal: 0,
                    reason: 'successful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'duke'
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

        describe('Given a player is revealing an influence due to an incorrect duke challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'duke', 'duke');
                game._test_setInfluence(1, 'captain', 'captain');
                game._test_setCash(0, 0);
                game._test_setCash(1, 0);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'tax',
                    playerToReveal: 1,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'captain'
                    });
                });

                it('Then the tax should be applied', function () {
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

        describe('Given a player is revealing an influence due to an correct duke challenge', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'contessa', 'contessa');
                game._test_setInfluence(1, 'captain', 'captain');
                game._test_setCash(0, 0);
                game._test_setCash(1, 0);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'tax',
                    playerToReveal: 0,
                    reason: 'sucessful-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'contessa'
                    });
                });

                it('Then the tax should not be applied', function () {
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
                game._test_setInfluence(0, 'captain', 'captain');
                game._test_setInfluence(1, 'ambassador', 'ambassador');
                game._test_setCash(0, 2);
                game._test_setCash(1, 2);
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'steal',
                    target: 1,
                    blockingRole: 'ambassador',
                    playerToReveal: 0,
                    reason: 'incorrect-challenge'
                });
            });

            describe('When player0 reveals a role', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'reveal',
                        role: 'captain'
                    });
                });

                it('Then the steal should not be applied', function () {
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

    describe('Coup', function () {
        describe('Given a player is revealing an influence due to a coup', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'ambassador', 'assassin');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'coup',
                    playerToReveal: 1,
                    reason: 'coup'
                });
            });

            describe('When player1 reveals a role', function () {
                beforeEach(function () {
                    player1.command({
                        command: 'reveal',
                        role: 'captain'
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
            player2 = createTestPlayer(game);
            return player2.getNextState();
        });

        describe('Given player1 is revealing an influence due to a coup', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'ambassador', 'assassin');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'coup',
                    playerToReveal: 1,
                    reason: 'coup'
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

        describe('Given player0 is attempting to draw tax, and player2 has allowed', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'ambassador', 'assassin');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.ACTION_RESPONSE,
                    playerIdx: 0,
                    action: 'tax'
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
});
