'use strict';

var shared = require('./web/shared.js');
var stateNames = shared.states;
var actions = shared.actions;

var rankedRoles = ['duke', 'assassin', 'captain', 'contessa', 'ambassador'];
var actionsToRoles = {
    'tax': 'duke',
    'assassinate': 'assassin',
    'steal': 'captain',
    'exchange': 'ambassador'
};

var playerId = 1;

function createAiPlayer(game, dbg) {
    var player = {
        name: 'Computer ' + playerId++,
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

    function onStateChange(s) {
        state = s;
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
                role: state.state.role,
                playerIdx: state.state.target
            };
        } else {
            lastRoleClaim = null;
        }

        if (state.state.name == stateNames.START_OF_TURN && currentPlayer == aiPlayer) {
            playOurTurn();
        } else if (state.state.name == stateNames.ACTION_RESPONSE && aiPlayer != currentPlayer) {
            respondToAction();
        } else if (state.state.name == stateNames.BLOCK_RESPONSE && aiPlayer != targetPlayer) {
            respondToBlock();
        } else if (state.state.name == stateNames.REVEAL_INFLUENCE && targetPlayer == aiPlayer) {
            revealLowestRanked();
        } else if (state.state.name == stateNames.EXCHANGE && currentPlayer == aiPlayer) {
            exchange();
        }
    }

    function onHistoryEvent(playerIdx, message, target) {
        if (message.indexOf('revealed ') == 0) {
            var role = message.substring('revealed '.length);
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
        var role = getBlockingRole();
        if (role) {
            debug('blocking');
            command({
                command: 'block',
                role: role
            });
            return;
        } else if (shouldChallenge()) {
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

    function respondToBlock() {
        trackClaim(state.state.target, state.state.role);
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
        if (state.state.action != 'tax' && state.state.action != 'steal' && state.state.action != 'assassinate') {
            // Only challenge actions that could lead to a victory if not challenged.
            return false;
        }
        return !weWouldWin();
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
        } else if (influence.indexOf('assassin') < 0 ) {
            // If we don't have a captair, duke, or assassin, then exchange
            playAction('exchange');
        } else {
            // We have an assassin, but can't afford to assassinate
            playAction('income');
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
        return getInfluence(state.playerIdx);
    }

    function getInfluence(playerIdx) {
        var inf = state.players[playerIdx].influence;
        var influence = [];
        for (var i = 0; i < inf.length; i++) {
            if (!inf[i].revealed) {
                influence.push(inf[i].role);
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
            if (influence.indexOf(rankedRoles[i]) >= 0) {
                command({
                    command: 'reveal',
                    role: rankedRoles[i]
                });
                return;
            }
        }
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
        var indices = [];
        for (var i = 0; i < state.numPlayers; i++) {
            if (i != state.playerIdx) {
                indices.push(i);
            }
        }
        return indices.sort(function (a, b) {
            var infa = getInfluence(a).length;
            var infb = getInfluence(b).length;
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
    }

    // Simulates us and the remaining player playing their best moves to see who would win.
    // Limitation: if a player loses an influence, it acts as if the player can still play either role.
    // Limitation: doesn't take foreign aid.
    function weWouldWin() {
        var opponentIdx = strongestPlayer();
        var cash = [
            state.players[opponentIdx].cash,
            state.players[state.playerIdx].cash
        ];
        var influenceCount = [
            getInfluence(opponentIdx).length,
            getInfluence(state.playerIdx).length
        ];
        var roles = [
            getClaimedRoles(opponentIdx),
            ourInfluence()
        ];
        debug('simulating with ' + roles[0] + ' and ' + roles[1]);
        var i, turn, other;
        function canSteal() {
            return roles[turn].indexOf('captain') >= 0 && roles[other].indexOf('captain') < 0 &&
                roles[other].indexOf('ambassador') < 0;
        }
        function steal() {
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
            cash[turn] -= 3;
            influenceCount[other] -= 1;
        }
        function canTax() {
            return roles[turn].indexOf('duke') >= 0;
        }
        function tax() {
            cash[turn] += 3;
        }
        function coup() {
            cash[turn] -= 7;
            influenceCount[other] -= 1;
        }
        // Apply the pending move
        if (state.state.name == stateNames.ACTION_RESPONSE) {
            // The opponent is playing an action; simulate it, then run from our turn
            i = 0;
            turn = 0;
            other = 1
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
        } else if (state.state.name == stateNames.BLOCK_RESPONSE) {
            // The opponent is blocking our action; run from the opponent's turn
            i = 1;
        }
        while (i < 50) {
            i++;
            turn = i % 2;
            other = (i + 1) % 2;
            if (influenceCount[0] == 0) {
                debug('we win simulation');
                return true;
            }
            if (influenceCount[1] == 0) {
                debug('they win simulation');
                return false;
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
                // Income
                cash[turn]++;
            }
        }
        debug('ran out of moves simulating endgame')
        // We don't know if we would win, but don't do anything rash
        return true;
    }

    function debug(msg) {
        dbg && console.log(msg);
    }
}

module.exports = createAiPlayer;
