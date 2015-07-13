'use strict';

var extend = require('extend');
var randomGen = require('random-seed');

var shared = require('./web/shared');
var stateNames = shared.states;
var actions = shared.actions;

var rankedRoles = ['duke', 'assassin', 'captain', 'contessa', 'ambassador'];
var actionsToRoles = {
    'tax': 'duke',
    'assassinate': 'assassin',
    'steal': 'captain',
    'exchange': 'ambassador'
};

var aiPlayerNames = [
    'Frank',
    'Bob',
    'Stuart',
    'Kevin',
    'Phil',
    'Pete',
    'Carl',
    'Dave',
    'Steve',
    'Tim',
    'Mark',
    'Jim',
    'Tom',
    'Joe',
    'Ed',
    'Ron',
    'Gary',
    'Eric',
    'Walt',
    'Mike'
];

function createAiPlayer(game, options) {
    options = extend({
        moveDelay: 0,
        searchHorizon: 7,
        chanceToBluff: 0.5
    }, options);

    var rand = randomGen.create(options.randomSeed);
    var bluffChoice = rand.random() < options.chanceToBluff;

    var player = {
        name: aiPlayerNames[rand(aiPlayerNames.length)],
        onStateChange: onStateChange,
        onHistoryEvent: onHistoryEvent,
        onChatMessage: function() {}
    };

    try {
        var gameProxy = game.playerJoined(player);
    } catch(e) {
        handleError(e);
        return;
    }

    var state;
    var aiPlayer;
    var currentPlayer;
    var targetPlayer;
    // Array indexed by playerIdx, containing objects whose keys are the roles each player (including us) has claimed
    var claims = [];
    // The last role to be claimed. Used when a challenge is issued, to track which role was challenged.
    var lastRoleClaim;
    var timeout = null;

    function onStateChange(s) {
        state = s;
        if (timeout != null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(onStateChangeAsync, options.moveDelay);
    }

    function onStateChangeAsync() {
        timeout = null;
        aiPlayer = state.players[state.playerIdx];
        currentPlayer = state.players[state.state.playerIdx];
        targetPlayer = state.players[state.state.target];

        initClaims();

        if (state.state.name == stateNames.ACTION_RESPONSE) {
            lastRoleClaim = {
                role: actionsToRoles[state.state.action],
                playerIdx: state.state.playerIdx
            };
        } else if (state.state.name == stateNames.BLOCK_RESPONSE) {
            lastRoleClaim = {
                role: state.state.blockingRole,
                playerIdx: state.state.target
            };
        } else {
            lastRoleClaim = null;
        }

        if (state.state.name == stateNames.START_OF_TURN && currentPlayer == aiPlayer) {
            playOurTurn();
        } else if (state.state.name == stateNames.ACTION_RESPONSE && aiPlayer != currentPlayer) {
            respondToAction();
        } else if (state.state.name == stateNames.FINAL_ACTION_RESPONSE && aiPlayer != currentPlayer) {
            respondToAction();
        } else if (state.state.name == stateNames.BLOCK_RESPONSE && aiPlayer != targetPlayer) {
            respondToBlock();
        } else if (state.state.name == stateNames.REVEAL_INFLUENCE && state.state.playerToReveal == state.playerIdx) {
            revealLowestRanked();
        } else if (state.state.name == stateNames.EXCHANGE && currentPlayer == aiPlayer) {
            exchange();
        }
    }

    function onHistoryEvent(message) {
        var match = message.match(/\{([0-9]+)\} revealed ([a-z]+)/);
        if (match) {
            var playerIdx = match[1];
            var role = match[2];
            // If the player had previously claimed the role, this claim is no longer valid
            delete claims[playerIdx][role];
        } else if (message.indexOf(' challenged') > 0) {
            // If a player was successfully challenged, any earlier claim was a bluff.
            // If a player was incorrectly challenged, they swap the role, so an earlier claim is no longer valid.
            if (lastRoleClaim) {
                delete claims[lastRoleClaim.playerIdx][lastRoleClaim.role];
            }
        }
    }

    function initClaims() {
        for (var i = 0; i < state.numPlayers; i++) {
            if (!claims[i]) {
                claims[i] = {};
            }
        }
    }

    function respondToAction() {
        trackClaim(state.state.playerIdx, state.state.action);
        var blockingRole = getBlockingRole();
        if (blockingRole) {
            debug('blocking');
            command({
                command: 'block',
                blockingRole: blockingRole
            });
            return;
        }

        if (shouldChallenge()) {
            debug('challenging');
            command({
                command: 'challenge'
            });
            return;
        }

        blockingRole = getBluffedBlockingRole();
        if (blockingRole) {
            debug('blocking (bluff)');
            command({
                command: 'block',
                blockingRole: blockingRole
            });
            return;
        }

        debug('allowing');
        command({
            command: 'allow'
        });
    }

    function respondToBlock() {
        trackClaim(state.state.target, state.state.blockingRole);
        if (shouldChallenge()) {
            debug('challenging');
            command({
                command: 'challenge'
            });
        } else {
            debug('allowing');
            command({
                command: 'allow'
            });
        }
    }

    function shouldChallenge() {
        if (!isEndGame()) {
            return false;
        }
        if (state.state.name == stateNames.FINAL_ACTION_RESPONSE) {
            // Cannot challenge after a failed challenge.
            return false;
        }
        if (state.state.action != 'tax' && state.state.action != 'steal' && state.state.action != 'assassinate') {
            // Only challenge actions that could lead to a victory if not challenged.
            return false;
        }
        // Challenge if the opponent would otherwise win soon.
        return simulate() < 0;
    }

    function isEndGame() {
        var opponents = playersByStrength();
        return opponents.length == 1;
    }

    function getBlockingRole() {
        var influence = ourInfluence();
        if (state.state.action == 'foreign-aid' || state.state.target == state.playerIdx) {
            var blockingRoles = actions[state.state.action].blockedBy || [];
            for (var i = 0; i < blockingRoles.length; i++) {
                if (influence.indexOf(blockingRoles[i]) >= 0) {
                    return blockingRoles[i];
                }
            }
        }
        return null;
    }

    function getBluffedBlockingRole() {
        if (state.state.target != state.playerIdx) {
            // Don't bluff unless we're being attacked
            return null;
        }
        var blockingRoles = actions[state.state.action].blockedBy || [];
        if (blockingRoles.length == 0) {
            // Cannot be blocked.
            return null;
        }
        var choice = null;
        for (var i = 0; i < blockingRoles.length; i++) {
            if (claims[state.playerIdx][blockingRoles[i]]) {
                // We have claimed one of the blocking roles before - continue to claim the same role.
                choice = i;
                break;
            }
        }
        if (choice == null) {
            // Randomly choose.
            choice = rand(blockingRoles.length);
        }
        var blockingRole = blockingRoles[choice];

        // For now we can only simulate against a single opponent.
        if (isEndGame() && simulate(blockingRole) > 0) {
            // If bluffing would win us the game, we will probably be challenged, so don't bluff.
            return null;
        } else {
            return blockingRole;
        }
    }

    function trackClaim(playerIdx, actionOrRole) {
        if (actionOrRole == 'foreign-aid' || actionOrRole == 'income') {
            return;
        }
        var role = actionsToRoles[actionOrRole] || actionOrRole;
        claims[playerIdx][role] = true;
        debug('player ' + playerIdx + ' claimed ' + role);
    }

    function playOurTurn() {
        var influence = ourInfluence();
        debug('influence: ' + influence);

        if (influence.indexOf('assassin') >= 0 && aiPlayer.cash >= 3 && assassinTarget() != null) {
            playAction('assassinate', assassinTarget());
        } else if (aiPlayer.cash >= 7) {
            playAction('coup', strongestPlayer());
        } else if (influence.indexOf('captain') >= 0 && captainTarget() != null) {
            playAction('steal', captainTarget());
        } else if (influence.indexOf('duke') >= 0) {
            playAction('tax')
        } else {
            // No good moves - check whether to bluff.
            var possibleBluffs = [];
            if (aiPlayer.cash >= 3 && assassinTarget() != null && shouldBluff('assassinate')) {
                possibleBluffs.push('assassinate');
            }
            if (captainTarget() != null && shouldBluff('steal')) {
                possibleBluffs.push('steal');
            }
            if (shouldBluff('tax')) {
                possibleBluffs.push('tax');
            }
            if (possibleBluffs.length) {
                // Randomly select one.
                var actionName = possibleBluffs[rand(possibleBluffs.length)];
                if (actionName == 'tax') {
                    playAction('tax')
                } else if (actionName == 'steal') {
                    playAction('steal', captainTarget());
                } else if (actionName == 'assassinate') {
                    playAction('assassinate', assassinTarget());
                }
            } else {
                // No bluffing.
                if (influence.indexOf('assassin') < 0 ) {
                    // If we don't have a captain, duke, or assassin, then exchange.
                    playAction('exchange');
                } else {
                    // We have an assassin, but can't afford to assassinate.
                    playAction('income');
                }
            }
        }
    }

    function shouldBluff(actionName) {
        if (!bluffChoice) {
            // We shall not bluff in this game.
            return false;
        }
        var action = actions[actionName];
        if (Object.keys(claims[state.playerIdx]).length > 2 && !claims[state.playerIdx][action.role]) {
            // We have already bluffed a different role: don't bluff any more.
            return false;
        }
        // For now we can only simulate against a single opponent.
        if (isEndGame() && simulate(action.role) > 0) {
            // If bluffing would win us the game, we will probably be challenged, so don't bluff.
            return false;
        } else {
            return true;
        }
    }

    function playAction(action, target) {
        debug('playing ' + action);
        trackClaim(state.playerIdx, action);
        command({
            command: 'play-action',
            action: action,
            target: target
        });
    }

    function command(command) {
        command.stateId = state.stateId;

        try {
            gameProxy.command(command);
        } catch(e) {
            console.error(e);
            console.error(e.stack);
        }
    }

    function ourInfluence() {
        var influence = [];
        for (var i = 0; i < aiPlayer.influence.length; i++) {
            if (!aiPlayer.influence[i].revealed) {
                influence.push(aiPlayer.influence[i].role);
            }
        }
        return influence;
    }

    function getClaimedRoles(playerIdx) {
        var roles = [];
        for (var k in claims[playerIdx]) {
            if (claims[playerIdx][k]) {
                roles.push(k);
            }
        }
        return roles;
    }

    function revealLowestRanked() {
        var influence = ourInfluence();
        var i = rankedRoles.length;
        while (--i) {
            var role = rankedRoles[i];
            if (influence.indexOf(role) >= 0) {
                command({
                    command: 'reveal',
                    role: role
                });
                // Don't claim this role any more.
                delete claims[state.playerIdx][role];
                return;
            }
        }
        debug('failed to choose a role to reveal');
        command({
            command: 'reveal',
            role: influence[0]
        });
    }

    function assassinTarget() {
        return playersByStrength().filter(function (idx) {
            return !claims[idx]['contessa'];
        })[0];
    }

    function captainTarget() {
        return playersByStrength().filter(function (idx) {
            return !claims[idx]['ambassador'] && !claims[idx]['captain'];
        })[0];
    }

    function strongestPlayer() {
        return playersByStrength()[0];
    }

    // Rank opponents by influence first, and money second
    function playersByStrength() {
        // Start with live opponents
        var indices = [];
        for (var i = 0; i < state.numPlayers; i++) {
            if (i != state.playerIdx && state.players[i].influenceCount > 0) {
                indices.push(i);
            }
        }
        return indices.sort(function (a, b) {
            var infa = state.players[a].influenceCount;
            var infb = state.players[b].influenceCount;
            if (infa != infb) {
                return infb - infa;
            } else {
                return state.players[b].cash - state.players[a].cash;
            }
        });
        return indices;
    }

    function exchange() {
        var chosen = [];
        var needed = ourInfluence().length;
        var available = state.state.exchangeOptions;

        for (var j = 0; j < needed; j++) {
            for (var i = 0; i < rankedRoles.length; i++) {
                var candidate = rankedRoles[i];
                if (chosen.indexOf(candidate) >= 0) {
                    // We already have this one
                    continue;
                }
                if (available.indexOf(candidate) >= 0) {
                    chosen.push(candidate);
                    break;
                }
            }
        }
        while (chosen.length < needed) {
            chosen.push(available[0]);
        }
        debug('chose ' + chosen);
        command({
            command: 'exchange',
            roles: chosen
        });
        // After exchanging our roles we can claim anything.
        claims[state.playerIdx] = {};
    }

    // Simulates us and the remaining player playing their best moves to see who would win.
    // If we win, return 1; if the opponent wins, -1; if no one wins within the search horizon, 0.
    // Limitation: if a player loses an influence, it acts as if the player can still play either role.
    // Limitation: doesn't take foreign aid.
    function simulate(bluffedRole) {
        var opponentIdx = strongestPlayer();
        var cash = [
            state.players[opponentIdx].cash,
            state.players[state.playerIdx].cash
        ];
        var influenceCount = [
            state.players[opponentIdx].influenceCount,
            state.players[state.playerIdx].influenceCount
        ];
        var roles = [
            getClaimedRoles(opponentIdx),
            ourInfluence().concat([bluffedRole])
        ];
        debug('simulating with ' + roles[0] + ' and ' + roles[1]);
        debug('their cash: ' + cash[0]);
        debug('our cash: ' + cash[1]);
        var i, turn, other;
        function canSteal() {
            return roles[turn].indexOf('captain') >= 0 && roles[other].indexOf('captain') < 0 &&
                roles[other].indexOf('ambassador') < 0;
        }
        function steal() {
            debug(turn ? 'we steal' : 'they steal');
            if (cash[other] < 2) {
                cash[turn] += cash[other];
                cash[other] = 0;
            } else {
                cash[turn] += 2;
                cash[other] -= 2;
            }
        }
        function canAssassinate() {
            return roles[turn].indexOf('assassin') >= 0 && roles[other].indexOf('contessa') < 0;
        }
        function assassinate() {
            debug(turn ? 'we assassinate' : 'they assassinate');
            cash[turn] -= 3;
            influenceCount[other] -= 1;
        }
        function canTax() {
            return roles[turn].indexOf('duke') >= 0;
        }
        function tax() {
            debug(turn ? 'we tax' : 'they tax');
            cash[turn] += 3;
        }
        function income() {
            debug(turn ? 'we income' : 'they income');
            cash[turn]++;
        }
        function coup() {
            debug(turn ? 'we coup' : 'they coup');
            cash[turn] -= 7;
            influenceCount[other] -= 1;
        }
        // Apply the pending move
        if (state.state.name == stateNames.ACTION_RESPONSE) {
            // The opponent is playing an action; simulate it (unless we are blocking), then run from our turn
            i = 0;
            turn = 0;
            other = 1
            if (!bluffedRole) {
                switch (state.state.action) {
                    case 'steal':
                        steal();
                        break;
                    case 'assassinate':
                        assassinate();
                        break;
                    case 'tax':
                        tax();
                        break;
                    default:
                        debug('unexpected initial action: ' + state.state.action);
                }
                debug('their cash: ' + cash[0]);
                debug('our cash: ' + cash[1]);
            }
        } else if (state.state.name == stateNames.BLOCK_RESPONSE) {
            // The opponent is blocking our action; run from the opponent's turn
            i = 1;
        } else if (state.state.name == stateNames.START_OF_TURN) {
            // It's our turn and we are considering a bluff; run from our turn
            i = 0;
        }
        while (i < options.searchHorizon) {
            i++;
            turn = i % 2;
            other = (i + 1) % 2;
            if (influenceCount[0] == 0) {
                debug('we win simulation');
                return 1;
            }
            if (influenceCount[1] == 0) {
                debug('they win simulation');
                return -1;
            }
            if (canAssassinate() && cash[turn] >= 3) {
                assassinate();
            } else if (cash[turn] >= 7) {
                coup();
            } else if (canSteal() && cash[other] > 0) {
                // To do: only steal if cash >= 2, e.g., if they also have the duke?
                steal();
            } else if (canTax()) {
                tax();
            } else {
                income();
            }
            debug('their cash: ' + cash[0]);
            debug('our cash: ' + cash[1]);
        }
        debug('search horizon exceeded while simulating endgame')
        // We don't know if we would win, but don't do anything rash
        return 0;
    }

    function debug(msg) {
        options.debug && console.log(msg);
    }
}

module.exports = createAiPlayer;
