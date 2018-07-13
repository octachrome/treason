/*
 * Copyright 2015-2016 Christopher Brown and Jackie Niebling.
 *
 * This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
 *
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/ or send a letter to:
 *     Creative Commons
 *     PO Box 1866
 *     Mountain View
 *     CA 94042
 *     USA
 */
'use strict';

var extend = require('extend');
var randomGen = require('random-seed');
var fs = require('fs');
var lodash = require('lodash');
var md5 = require('md5');

var shared = require('./web/shared');
var stateNames = shared.states;
var actions = shared.actions;

var rankedRoles = ['duke', 'assassin', 'captain', 'inquisitor', 'contessa', 'ambassador'];
// The weights show how likely a role is to be revealed by AI
// E.g. ambassador is 3 times more likely to be revealed than duke
var roleWeights = {'duke': 3, 'assassin': 4, 'captain': 5, 'inquisitor': 6, 'contessa': 6, 'ambassador': 9};

// https://www.randomlists.com/random-first-names
// http://listofrandomnames.com/
// http://random-name-generator.info/
var aiPlayerNames = fs.readFileSync(__dirname + '/names.txt', 'utf8').split(/\r?\n/);

function createAiPlayer(game, options) {
    options = extend({
        moveDelay: 0,           // How long the AI will "think" for before playing its move (ms)
        moveDelaySpread: 0,     // How much randomness to apply to moveDelay (ms)
        searchHorizon: 7,       // How many moves the AI will search ahead for an end-game
        chanceToBluff: 0.5,     // Fraction of games in which the AI will bluff
        chanceToChallenge: 0.1  // Fraction of turns in which the AI will challenge (not in the end-game)
    }, options);

    var rand = randomGen.create(options.randomSeed);

    var player = {
        name: aiPlayerNames[rand(aiPlayerNames.length)],
        onStateChange: onStateChange,
        onHistoryEvent: onHistoryEvent,
        onChatMessage: function() {},
        ai: true,
        playerId: 'ai'
    };

    try {
        var gameProxy = game.playerJoined(player);
    } catch(e) {
        handleError(e);
        return;
    }

    var bluffChoice;
    var state;
    var aiPlayer;
    var currentPlayer;
    var targetPlayer;
    // Array indexed by playerIdx, containing objects whose keys are the roles each player (including us) has claimed
    var claims = [];
    // The last role to be claimed. Used when a challenge is issued, to track which role was challenged.
    var lastRoleClaim;
    var timeout = null;
    // Roles that we have bluffed and then been called on - can no longer bluff these.
    var calledBluffs = [];
    var needReset = true;

    function onStateChange(s) {
        state = s;
        if (timeout != null) {
            clearTimeout(timeout);
        }
        if (state.state.name === stateNames.WAITING_FOR_PLAYERS) {
            needReset = true;
        }
        else {
            // Reset when the game actually starts: the first state after WAITING_FOR_PLAYERS.
            if (needReset) {
                reset();
                needReset = false;
            }
            var delay = rand.intBetween(options.moveDelay - options.moveDelaySpread, options.moveDelay + options.moveDelaySpread);
            timeout = setTimeout(onStateChangeAsync, delay);
        }
    }

    function onStateChangeAsync() {
        timeout = null;
        aiPlayer = state.players[state.playerIdx];
        currentPlayer = state.players[state.state.playerIdx];
        targetPlayer = state.players[state.state.target];

        if (state.state.name == stateNames.ACTION_RESPONSE) {
            // If we respond to an action, we need to know who claimed what role
            lastRoleClaim = {
                role: getRoleForAction(state.state.action),
                playerIdx: state.state.playerIdx
            };
        } else if (state.state.name == stateNames.BLOCK_RESPONSE) {
            // If we respond to a block, we need to know who claimed the blocking role
            lastRoleClaim = {
                role: state.state.blockingRole,
                playerIdx: state.state.target
            };
        } else if (state.state.name != stateNames.REVEAL_INFLUENCE) {
            // Reset last claimed role for other states unless we're revealing our influence
            // In that case we need to remember last claimed role to update calledBluffs
            // This update is performed on history event which happens after state changes
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
            revealByProbability();
        } else if (state.state.name == stateNames.EXCHANGE && currentPlayer == aiPlayer) {
            exchange();
        }
    }

    function reset() {
        claims = [];
        calledBluffs = [];
        for (var i = 0; i < state.numPlayers; i++) {
            claims[i] = {};
            calledBluffs[i] = {};
        }

        lastRoleClaim = null;
        bluffChoice = rand.random() < options.chanceToBluff;
    }

    function getRoleForAction(actionName) {
        var action = actions[actionName];
        if (!action) {
            return null;
        }
        if (!action.roles) {
            return null;
        }
        return lodash.intersection(state.roles, lodash.flatten([action.roles]))[0];
    }

    function onHistoryEvent(message) {
        var match = message.match(/\{([0-9]+)\} revealed ([a-z]+)/);
        if (match) {
            var playerIdx = match[1];
            var role = match[2];
            // If the player had previously claimed the role, this claim is no longer valid
            if (claims[playerIdx]) {
                delete claims[playerIdx][role];
            }
        }
        if (message.indexOf(' challenged') > 0 && lastRoleClaim && claims[lastRoleClaim.playerIdx]) {
            // If a player was successfully challenged, any earlier claim was a bluff.
            // If a player was incorrectly challenged, they swap the role, so an earlier claim is no longer valid.
            delete claims[lastRoleClaim.playerIdx][lastRoleClaim.role];
        }
        if (message.indexOf(' successfully challenged') > 0 && lastRoleClaim && calledBluffs[lastRoleClaim.playerIdx]) {
            // If a player was successfully challenged, remember it to prevent him from claiming that role again
            calledBluffs[lastRoleClaim.playerIdx][lastRoleClaim.role] = true;
        }
    }

    function respondToAction() {
        trackClaim(state.state.playerIdx, state.state.action);
        if (state.state.action === 'steal' && aiPlayer.cash === 0) {
            // If someone wants to steal nothing from us, go ahead.
            debug('allowing');
            command({
                command: 'allow'
            });
            return;
        }

        var blockingRole = getBlockingRole();
        if (blockingRole) {
            debug('blocking');
            trackClaim(state.playerIdx, blockingRole);
            command({
                command: 'block',
                blockingRole: blockingRole
            });
            return;
        }

        // Don't bluff in the final action response - it will just get challenged.
        if (state.state.name == stateNames.ACTION_RESPONSE) {
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
                trackClaim(state.playerIdx, blockingRole);
                command({
                    command: 'block',
                    blockingRole: blockingRole
                });
                return;
            }
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
        // We're challenging only actions and blocks
        if (state.state.name != stateNames.ACTION_RESPONSE && state.state.name != stateNames.BLOCK_RESPONSE) {
            return false;
        }

        // Challenge if somebody claims to have role that was revealed 3 times or we have the rest of them
        var claimedRole = state.state.name == stateNames.ACTION_RESPONSE ? getRoleForAction(state.state.action) : state.state.blockingRole;
        var usedRoles = countRevealedRoles(claimedRole);
        for (var i = 0; i < aiPlayer.influence.length; i++) {
            if (!aiPlayer.influence[i].revealed && aiPlayer.influence[i].role === claimedRole) {
                usedRoles++;
            }
        }
        if (usedRoles === 3) {
            return true;
        }

        // Challenge if somebody claimed this role and lost
        if (state.state.name == stateNames.ACTION_RESPONSE && calledBluffs[state.state.playerIdx] && calledBluffs[state.state.playerIdx][claimedRole]) {
            // If someone claims an action again after being successfully challenged
            return true;
        }
        if (state.state.name == stateNames.BLOCK_RESPONSE && calledBluffs[state.state.target] && calledBluffs[state.state.target][claimedRole]) {
            // If someone claims a blocking action again after being successfully challenged
            return true;
        }

        if (state.state.name == stateNames.ACTION_RESPONSE && state.state.action === 'assassinate'
            && state.players[state.playerIdx].influenceCount === 1) {
            // Challenge if you're being assassinated, it's your last influence and all contessas have been revealed
            var contessas = countRevealedRoles('contessa');
            if (contessas === 3) {
                return true;
            }
            // If all contessas have been revealed or claimed then we challenge the assassin
            for (var i = 0; i < state.numPlayers; i++) {
                if (i != state.playerIdx && state.players[i].influenceCount > 0 && claims[i]['contessa']) {
                    contessas++;
                }
            }
            if (contessas >= 3) {
                return true;
            }
            // Challenge if we already bluffed contessa and were caught
            if (calledBluffs[state.playerIdx] && calledBluffs[state.playerIdx]['contessa']) {
                return true;
            }
            // Otherwise we will bluff contessa
            return false;
        }

        // Only challenge actions that could lead to a victory if not challenged.
        if (!actionIsWorthChallenging()) {
            return false;
        }

        if (isEndGame()) {
            var result = simulate();
            // Challenge if the opponent would otherwise win soon.
            if (result < 0) {
                return true;
            }
            // Don't bother challenging if we're going to win anyway.
            if (result > 0) {
                return false;
            }
        }

        // Challenge at random.
        return rand.random() < options.chanceToChallenge;
    }

    function actionIsWorthChallenging() {
        // Worth challenging anyone drawing tax.
        if (state.state.action == 'tax') {
            return true;
        }
        // Worth challenging someone assassinating us or stealing from us,
        // Or someone trying to block us from assassinating or stealing.
        if ((state.state.action == 'steal' || state.state.action == 'assassinate') &&
            (state.state.playerIdx == state.playerIdx || state.state.target == state.playerIdx)) {
            return true;
        }
        return false;
    }

    function countRevealedRoles(role) {
        var count = 0;
        for (var i = 0; i < state.numPlayers; i++) {
            for (var j = 0; j < state.players[i].influence.length; j++) {
                if (state.players[i].influence[j].revealed && state.players[i].influence[j].role === role) {
                    count++;
                }
            }
        }
        return count;
    }

    function isEndGame() {
        var opponents = playersByStrength();
        return opponents.length == 1;
    }

    // This function adds randomness to AI decision making process
    // Even if some decision seem a good idea, sometimes AI will make a different call
    // Otherwise AIs are predictable and human opponents can predict their moves
    function randomizeChoice() {
        // At the end AIs won't make random choices as it might make them lose
        if (isEndGame() && state.players[state.playerIdx].influenceCount === 1) {
            return false;
        }
        return rand.intBetween(0, 9) < 1;
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
        if (state.state.action != 'foreign-aid' && state.state.target != state.playerIdx) {
            // Don't bluff unless this is an action we can block.
            return null;
        }
        var blockingRoles = actions[state.state.action].blockedBy || [];
        blockingRoles = lodash.intersection(state.roles, blockingRoles);
        if (blockingRoles.length == 0) {
            // Cannot be blocked.
            return null;
        }
        blockingRoles = shuffle(blockingRoles.slice());

        var choice = null;
        for (var i = 0; i < blockingRoles.length; i++) {
            if (shouldBluff(blockingRoles[i])) {
                // Now that we've bluffed, recalculate whether or not to bluff next time.
                bluffChoice = rand.random() < options.chanceToBluff;
                return blockingRoles[i];
            }
        }
        // No bluffs are appropriate.
        return null;
    }

    function shuffle(array) {
        var shuffled = [];
        while (array.length) {
            var i = Math.floor(Math.random() * array.length);
            var e = array.splice(i, 1);
            shuffled.push(e[0]);
        }
        return shuffled;
    }

    function trackClaim(playerIdx, actionOrRole) {
        // if action is characterless (income, foreign aid or coup) don't update claims
        if (actions[actionOrRole] && !actions[actionOrRole].roles) {
            return;
        }
        var role = getRoleForAction(actionOrRole) || actionOrRole;
        claims[playerIdx][role] = true;
        debug('player ' + playerIdx + ' claimed ' + role);
    }

    function playOurTurn() {
        var influence = ourInfluence();
        debug('influence: ' + influence);

        if (aiPlayer.cash >= 7) {
            playAction('coup', strongestPlayer());
        } else if (influence.indexOf('assassin') >= 0 && aiPlayer.cash >= 3 && assassinTarget() != null && !randomizeChoice()) {
            playAction('assassinate', assassinTarget());
        } else if (influence.indexOf('captain') >= 0 && captainTarget() != null && !randomizeChoice()) {
            playAction('steal', captainTarget());
        } else if (influence.indexOf('duke') >= 0 && !randomizeChoice()) {
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
            if (possibleBluffs.length && !randomizeChoice()) {
                // Randomly select one.
                var actionName = possibleBluffs[rand(possibleBluffs.length)];
                if (actionName == 'tax') {
                    playAction('tax')
                } else if (actionName == 'steal') {
                    playAction('steal', captainTarget());
                } else if (actionName == 'assassinate') {
                    playAction('assassinate', assassinTarget());
                }
                // Now that we've bluffed, recalculate whether or not to bluff next time.
                bluffChoice = rand.random() < options.chanceToBluff;
            } else {
                // No bluffing.
                if (influence.indexOf('assassin') < 0 && !randomizeChoice()) {
                    // If we don't have a captain, duke, or assassin, then exchange.
                    playAction('exchange');
                } else {
                    // We have an assassin, but can't afford to assassinate.
                    if (countRevealedRoles('duke') == 3) {
                        playAction('foreign-aid');
                    } else {
                        playAction('income');
                    }
                }
            }
        }
    }

    function shouldBluff(actionNameOrRole) {
        var role;
        if (actions[actionNameOrRole]) {
            role = actions[actionNameOrRole].role;
        } else {
            role = actionNameOrRole;
        }
        if (calledBluffs[state.playerIdx] && calledBluffs[state.playerIdx][role]) {
            // Don't bluff a role that we previously bluffed and got caught out on.
            return false;
        }
        if (countRevealedRoles(role) == 3) {
            // Don't bluff a role that has already been revealed three times.
            return false;
        }
        if (actionNameOrRole === 'contessa' && state.state.action === 'assassinate' && state.players[state.playerIdx].influenceCount === 1) {
            // Bluff contessa if only 1 influence left as otherwise we lose
            return true;
        }
        if (!bluffChoice && !claims[state.playerIdx][role]) {
            // We shall not bluff (unless we already claimed this role earlier).
            return false;
        }
        if (Object.keys(claims[state.playerIdx]).length > 2 && !claims[state.playerIdx][role]) {
            // We have already bluffed a different role: don't bluff any more.
            return false;
        }
        // For now we can only simulate against a single opponent.
        if (isEndGame() && simulate(role) > 0) {
            // If bluffing would win us the game, we will probably be challenged, so don't bluff.
            return false;
        } else {
            // We will bluff.
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

    function revealByProbability() {
        var influence = ourInfluence();
        var chosenInfluence = 0;

        if (influence.length > 1) {
            var influenceProbability = [];
            for (var i = 0; i < influence.length; i++) {
                for (var j = 0; j < roleWeights[influence[i]]; j++) {
                    influenceProbability.push(i);
                }
            }
            chosenInfluence = influenceProbability[rand.intBetween(0, influenceProbability.length-1)];
        }
        command({
            command: 'reveal',
            role: influence[chosenInfluence]
        });
        // Don't claim this role any more.
        if (claims[state.playerIdx]) {
            delete claims[state.playerIdx][influence[chosenInfluence]];
        }
    }

    function assassinTarget() {
        return playersByStrength().filter(function (idx) {
            return !canBlock(idx, 'assassinate');
        })[0];
    }

    function captainTarget() {
        return playersByStrength().filter(function (idx) {
            return !canBlock(idx, 'steal') && state.players[idx].cash > 0;
        })[0];
    }

    function canBlock(playerIdx, actionName) {
        return lodash.intersection(actions[actionName].blockedBy, getClaimedRoles(playerIdx)).length > 0;
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
        var randomNumber = rand(1000000000000000);

        return indices.sort(function (a, b) {
            var infa = state.players[a].influenceCount;
            var infb = state.players[b].influenceCount;

            if (infa != infb) {
                return infb - infa;
            } else if (state.players[b].cash != state.players[a].cash) {
                return state.players[b].cash - state.players[a].cash;
            } else { // if both players have the same amount of influences and cash then choose one by random
                // player names are used so that MD5 hashes are different for each player
                return md5(randomNumber + state.players[a].name) < md5(randomNumber + state.players[b].name) ? -1 : 1;
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
        calledBluffs[state.playerIdx] = {};
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
        function otherCanBlock(actionName) {
            return lodash.intersection(roles[other], actions[actionName].blockedBy).length > 0;
        }
        function canSteal() {
            return roles[turn].indexOf('captain') >= 0 && !otherCanBlock('steal');
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
            return roles[turn].indexOf('assassin') >= 0 && !otherCanBlock('assassinate');
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
        options.debug && console.log(JSON.stringify(msg, null, 4));
    }

    function handleError(e) {
        if (e instanceof Error) {
            console.error(e);
            console.error(e.stack);
        }
    }
}

module.exports = createAiPlayer;
