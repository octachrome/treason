vm = {
    playerName: ko.observable(localStorageGet('playerName') || ''),
    welcomeMessage: ko.observable(''),
    targetedAction: ko.observable(''),
    weAllowed: ko.observable(false),
    sidebar: ko.observable('chat'),
    history: ko.observableArray()
};
vm.state = ko.mapping.fromJS({
    stateId: null,
    gameId: null,
    players: [],
    playerIdx: null,
    numPlayers: null,
    state: {
        name: null,
        playerIdx: null,
        blockingRole: null,
        action: null,
        target: null,
        message: null,
        exchangeOptions: null,
        playerToReveal: null
    }
});
vm.playerName.subscribe(function (newName) {
    localStorageSet('playerName', newName);
});
var socket;
function join() {
    if (!vm.playerName() || !vm.playerName().match(/^[a-zA-Z0-9_ !@#$*]+$/)) {
        alert('Enter a valid name');
    }
    if (vm.playerName().length > 30) {
        alert('Enter a shorter name');
    }
    vm.history([]);
    $('.chat').html('');
    if (socket == null) {
        // Re-use the same socket. Automatically reconnects if disconnected.
        socket = io();

        socket.on('disconnect', function () {
            vm.welcomeMessage('Disconnected');
            vm.state.state.name(null); // Opens the welcome screen.
        });
        socket.on('state', function (data) {
            ko.mapping.fromJS(data, vm.state);
            vm.targetedAction('');
            vm.weAllowed(false);
            $('.activity').scrollTop(0);
            console.log(data);
        });
        socket.on('history', function (data) {
            vm.history.unshift(data);
        });
        socket.on('chat', function (data) {
            var from;
            if (data.from == vm.state.playerIdx()) {
                from = 'You';
            } else {
                var player = vm.state.players()[data.from];
                from = player ? player.name() : 'Unknown';
            }
            var html = '<b>' + from + ':</b> ' + data.message + '<br/>';
            $('.chat').append(html);
            $('.chat').scrollTop(10000);
        });
        socket.on('error', function (data) {
            alert(data);
        });
        socket.on('game-error', function (data) {
            alert(data);
        });
    }
    socket.emit('join', vm.playerName());
}
function start() {
    command('start');
}
function addAi() {
    command('add-ai');
}
function weAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() == vm.state.playerIdx();
}
function theyAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() != vm.state.playerIdx();
}
function weAreAlive() {
    return ourInfluenceCount() > 0;
}
function currentPlayerName() {
    if (vm.state.state.playerIdx() != null) {
        var player = vm.state.players()[vm.state.state.playerIdx()];
        if (player) {
            return player.name();
        }
    }
    return '';
}
function targetPlayerName() {
    if (vm.state.state.target() != null) {
        var player = vm.state.players()[vm.state.state.target()];
        if (player) {
            return player.name();
        }
    }
    return '';
}
function toRevealPlayerName() {
    if (vm.state.state.playerToReveal() != null) {
        var player = vm.state.players()[vm.state.state.playerToReveal()];
        if (player) {
            return player.name();
        }
    }
    return '';
}
function canPlayAction(actionName) {
    var action = actions[actionName];
    var player = ourPlayer();
    if (!player) {
        return false;
    }
    if (player.cash() >= 10 && actionName != 'coup') {
        return false;
    } else {
        return player.cash() >= action.cost;
    }
}
function playAction(actionName) {
    var action = actions[actionName];
    if (!action) {
        return;
    }
    if (action.targeted) {
        vm.targetedAction(actionName);
    } else {
        command('play-action', {
            action: actionName
        });
    }
}
function cancelAction() {
    vm.targetedAction('');
}
function playTargetedAction(target) {
    command('play-action', {
        action: vm.targetedAction(),
        target: target
    });
}
function command(command, options) {
    var data = $.extend({
        command: command,
        stateId: vm.state.stateId()
    }, options);
    socket.emit('command', data);
}
function weCanBlock() {
    if (!weAreAlive()) {
        return false;
    }
    if (vm.state.state.name() != states.ACTION_RESPONSE && vm.state.state.name() != states.FINAL_ACTION_RESPONSE) {
        return false;
    }
    var action = actions[vm.state.state.action()];
    if (!action) {
        return false;
    }
    if (!action.blockedBy) {
        // ACtion cannot be blocked.
        return false;
    }
    if (!action.targeted) {
        // Untargeted actions foreign aid) can be blocked by anyone.
        return true;
    }
    return vm.state.state.target() == vm.state.playerIdx();
}
function blockingRoles() {
    var action = actions[vm.state.state.action()];
    if (!action) {
        return [];
    }
    return action.blockedBy || [];
}
function weCanChallenge() {
    var action = actions[vm.state.state.action()];
    if (!action) {
        return false;
    }
    if (vm.state.state.name() == states.ACTION_RESPONSE) {
        // Only role-based actions can be challenged.
        return !!action.role;
    } else if (vm.state.state.name() == states.BLOCK_RESPONSE) {
        return true;
    } else {
        return false;
    }
}
function canTarget(playerIdx) {
    if (playerIdx == vm.state.playerIdx()) {
        // Cannot target ourselves.
        return false;
    }
    var player = vm.state.players()[playerIdx];
    if (!player) {
        return false;
    }
    // Cannot target dead player.
    return player.influenceCount() > 0;
}
function block(blockingRole) {
    command('block', {
        blockingRole: blockingRole
    });
}
function challenge() {
    command('challenge');
}
function allow() {
    command('allow');
    vm.weAllowed(true);
}
function weAreTargeted(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.target() == vm.state.playerIdx();
}
function theyAreTargeted(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.target() != vm.state.playerIdx();
}
function weMustReveal() {
    return vm.state.state.name() == states.REVEAL_INFLUENCE && vm.state.state.playerToReveal() == vm.state.playerIdx();
}
function theyMustReveal() {
    return vm.state.state.name() == states.REVEAL_INFLUENCE && vm.state.state.playerToReveal() != vm.state.playerIdx();
}
function ourPlayer() {
    return vm.state.players()[vm.state.playerIdx()];
}
function ourInfluence() {
    var player = ourPlayer();
    return player && player.influence();
}
function ourInfluenceCount() {
    var player = ourPlayer();
    return player && player.influenceCount();
}
function reveal(influence) {
    command('reveal', {
        role: influence.role()
    });
}
function exchange() {
    var checked = $('input:checked');
    var roles = [];
    checked.each(function (index, el) {
        roles.push($(el).data('role'));
    });
    if (roles.length == ourInfluenceCount()) {
        command('exchange', {
            roles: roles
        });
    } else {
        alert('must choose ' + ourInfluenceCount() + ' roles');
    }
}
function displayHistory(hist) {
    var text = '';
    if (hist.playerIdx  == vm.state.playerIdx()) {
        text = 'You ';
    } else if (hist.playerIdx != null) {
        var player = vm.state.players()[hist.playerIdx];
        text = player ? player.name() : 'Unknown';
        text += ' ';
    }
    text += hist.message;
    if (hist.target == vm.state.playerIdx()) {
        text += ' you';
    } else if (hist.target != null) {
        var target = vm.state.players()[hist.target];
        if (target != null) {
            text += ' ' + target.name();
        }
    }
    return text;
}
function labelClass(role, revealed) {
    if (revealed) {
        return 'label-revealed';
    } else if (role == 'not dealt') {
        return 'label-unknown';
    } else {
        return 'label-' + role;
    }
}
function buttonClass(role) {
    return 'btn-' + role;
}
function showCheatSheet() {
    vm.sidebar('cheat');
}
function showChat() {
    vm.sidebar('chat');
}
function playing() {
    return vm.state && vm.state.state && vm.state.state.name() != null;
}
function localStorageGet(key) {
    return window.localStorage ? window.localStorage.getItem(key) : null;
}
function localStorageSet(key, value) {
    if (window.localStorage) {
        window.localStorage.setItem(key, value);
    }
}
function sendMessage(event) {
    if (event.which != 13) {
        return;
    }
    event.preventDefault();
    var message = $('textarea').val();
    if (message) {
        socket.emit('chat', message);
        $('textarea').val('');
    }
}
$(window).on('resize', function () {
    $('.activity').height($(window).height() - 40);
    $('.activity').scrollTop(0);
});
$(function () {
    $('textarea').on('keydown', sendMessage);
    $('.activity').height($(window).height() - 40);
    $('input').focus();
    ko.applyBindings(vm);
});
