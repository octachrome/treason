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

    describe('Challenges', function () {
        beforeEach(function () {
            player2 = createTestPlayer(game);
            return player2.getNextState();
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
                        return player0.getNextState().then(function () {
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
                        return player1.getNextState().then(function () {
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
                    message: 'incorrectly challenged'
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
                    message: 'successfully challenged'
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
                game._test_setInfluence(0, 'duke', 'captain');
                game._test_setInfluence(1, 'duke', 'captain');
                game._test_setInfluence(2, 'duke', 'captain');
                game._test_setTurnState({
                    name: stateNames.REVEAL_INFLUENCE,
                    playerIdx: 0,
                    action: 'assassinate',
                    target: 1,
                    message: 'incorrectly challenged',
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
                    message: 'successfully challenged'
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
                    message: 'incorrectly challenged'
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
                    message: 'sucessfuly challenged'
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
                    message: 'incorrectly challenged'
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
                    message: 'staged a coup'
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

    describe('History', function () {
        describe('Given player0 has a captain and player1 has an ambassador', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'captain', 'contessa');
                game._test_setInfluence(1, 'ambassador', 'contessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });

                return player0.getHistory();
            });

            describe('When player0 tries to steal from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'steal',
                        target: 1
                    });
                });

                // A stole from B
                describe('When player1 allows', function () {
                    beforeEach(function () {
                        player1.getNextState().then(function () {
                            player1.command({
                                command: 'allow',
                            });
                        });
                    });

                    it('Then the history should record that player0 stole from player1', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql(['{0} stole from {1}']);
                        });
                    });
                });

                // A attempted to steal from B; B blocked with ambassador
                describe('When player1 blocks and player0 allows the block', function () {
                    beforeEach(function () {
                        player1.getNextState().then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'ambassador'
                            });

                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'allow'
                                });
                            });
                        });
                    });

                    it('Then the history should record that player0 attempted to steal, and then that player1 blocked', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} blocked with ambassador'
                            ]);
                        });
                    });
                });

                describe('When player1 incorrectly challenges and reveals an influence', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'challenge'
                            });

                            return player1.getNextState().then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'contessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record that player0 attempted to steal, and then that player1 failed to challenge and revealed', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa'
                            ]);
                        });
                    });

                    // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; A stole from B
                    describe('When player1 allows the steal after a failed challenge', function () {
                        beforeEach(function () {
                            return player1.getNextState().then(function (state) {
                                player1.command({
                                    command: 'allow'
                                });
                            });
                        });

                        it('Then the history should record the attempt, the incorrect challenge, and the final steal', function () {
                            return player0.getHistory().then(function (history) {
                                expect(history).to.eql([
                                    '{0} attempted to steal from {1}',
                                    '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                    '{0} stole from {1}'
                                ]);
                            });
                        });
                    });

                    // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B blocked with ambassador
                    describe('When player1 blocks the steal after a failed challenge', function () {
                        beforeEach(function () {
                            return player1.getNextState().then(function (state) {
                                player1.command({
                                    command: 'block',
                                    blockingRole: 'ambassador'
                                });
                            });
                        });

                        describe('When player0 allows the block', function () {
                            beforeEach(function () {
                                return player0.getNextState().then(function () {
                                    player0.command({
                                        command: 'allow'
                                    });
                                });
                            });

                            it('Then the history should record the attempt, the incorrect challenge, and the final block', function () {
                                return player0.getHistory().then(function (history) {
                                    expect(history).to.eql([
                                        '{0} attempted to steal from {1}',
                                        '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                        '{1} blocked with ambassador'
                                    ]);
                                });
                            });
                        });

                        // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B attempted to block with ambassador; A incorrectly challenged B; A revealed contessa
                        describe('When player0 incorrectly challenges the block', function () {
                            beforeEach(function () {
                                return player0.getNextState().then(function () {
                                    player0.command({
                                        command: 'challenge'
                                    });
                                }).then(function () {
                                    return player0.getNextState().then(function () {
                                        player0.command({
                                            command: 'reveal',
                                            role: 'contessa'
                                        });
                                    });
                                });
                            });

                            it('Then the history should record the attempt, the incorrect challenge, the block attempt, and the second incorrect challenge', function () {
                                return player0.getHistory().then(function (history) {
                                    expect(history).to.eql([
                                        '{0} attempted to steal from {1}',
                                        '{1} incorrectly challenged {0}; {0} exchanged captain for a new role; {1} revealed contessa',
                                        '{1} attempted to block with ambassador',
                                        '{0} incorrectly challenged {1}; {1} exchanged ambassador for a new role; {0} revealed contessa'
                                    ]);
                                });
                            });
                        });
                    });
                });

                // A attempted to steal from B; B attempted to block with ambassador; A incorrectly challenged B; A revealed contessa
                describe('When player1 blocks and player0 incorrectly challenges the block', function () {
                    beforeEach(function () {
                        player1.getNextState().then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'ambassador'
                            });

                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            }).then(function () {
                                player0.getNextState().then(function () {
                                    player0.command({
                                        command: 'reveal',
                                        role: 'contessa'
                                    });
                                });
                            });
                        });
                    });

                    it('Then the history should record the steal attempt, the block attempt, and the incorrect challenge', function () {
                        return player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} attempted to block with ambassador',
                                '{0} incorrectly challenged {1}; {1} exchanged ambassador for a new role; {0} revealed contessa'
                            ]);
                        });
                    });
                });
            });
        });

        describe('Given player0 does not have a captain and player1 does not have an ambassador', function () {
            beforeEach(function () {
                game._test_setInfluence(0, 'contessa', 'contessa');
                game._test_setInfluence(1, 'contessa', 'contessa');

                game._test_setTurnState({
                    name: stateNames.START_OF_TURN,
                    playerIdx: 0
                });

                return player0.getHistory();
            });

            describe('When player0 tries to steal from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'steal',
                        target: 1
                    });
                });

                // A attempted to steal from B; B successfully challenged A; A revealed contessa
                describe('When player1 successfully challenges and player0 reveals', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'challenge'
                            });

                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'reveal',
                                    role: 'contessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt and the challenge', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} successfully challenged {0}; {0} revealed contessa'
                            ]);
                        })
                    });
                });

                // A attempted to steal from B; B attempted to block with ambassador; A successfully challenged B; B revealed contessa; A stole from B
                describe('When player1 blocks and player0 successfully challenges the block', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'block',
                                blockingRole: 'ambassador'
                            });
                        }).then(function () {
                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            });
                        }).then(function () {
                            return player1.getNextState().then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'contessa'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt, the block, the challenge and the final steal', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} attempted to block with ambassador',
                                '{0} successfully challenged {1}; {1} revealed contessa',
                                '{0} stole from {1}'
                            ]);
                        })
                    });
                });
            });
        });

        // A attempted to steal from B; B incorrectly challenged A; B revealed contessa; B attempted to block with ambassador; A successfully challenged B; B revealed contessa; A stole from B
        describe('Given player0 has a captain and player1 does not have an ambassador', function () {
            beforeEach(function () {
                player2 = createTestPlayer(game);
                return player2.getNextState().then(function () {
                    game._test_setInfluence(0, 'captain', 'contessa');
                    game._test_setInfluence(1, 'contessa', 'contessa');
                    game._test_setInfluence(2, 'contessa', 'contessa');

                    game._test_setTurnState({
                        name: stateNames.START_OF_TURN,
                        playerIdx: 0
                    });

                    return player0.getHistory();
                });
            });

            describe('When player0 tries to steal from player1', function () {
                beforeEach(function () {
                    player0.command({
                        command: 'play-action',
                        action: 'steal',
                        target: 1
                    });
                });

                describe('When player1 incorrectly challenges then finally blocks, and player0 successfully challenges the block', function () {
                    beforeEach(function () {
                        return player1.getNextState().then(function () {
                            player1.command({
                                command: 'challenge'
                            });
                        }).then(function () {
                            return player1.getNextState().then(function () {
                                player1.command({
                                    command: 'reveal',
                                    role: 'contessa'
                                });
                            });
                        }).then(function () {
                            return player1.getNextState().then(function () {
                                player1.command({
                                    command: 'block',
                                    blockingRole: 'ambassador'
                                });
                            });
                        }).then(function () {
                            return player0.getNextState().then(function () {
                                player0.command({
                                    command: 'challenge'
                                });
                            });
                        });
                    });

                    it('Then the history should record the attempt, the challenge, the block, the challenge and the final steal', function () {
                        player0.getHistory().then(function (history) {
                            expect(history).to.eql([
                                '{0} attempted to steal from {1}',
                                '{1} incorrectly challenged {0}; {0} exchanged captain for another role; {1} revealed contessa',
                                '{1} attempted to block with ambassador',
                                '{0} successfully challenged {1}; {1} revealed contessa',
                                '{0} stole from {1}'
                            ]);
                        })
                    });
                });
            });
        });
    });
});
