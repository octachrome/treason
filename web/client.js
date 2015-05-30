vm = {
    playerName: ko.observable(localStorageGet('playerName') || ''),
    welcomeMessage: ko.observable(''),
    exchangeOptions: ko.observableArray(),
    exchangeKeep: ko.observable(0),
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
        role: null,
        action: null,
        target: null,
        message: null
    },
    history: []
});
vm.playerName.subscribe(function (newName) {
    localStorageSet('playerName', newName);
});
var socket;
function join() {
    if (!vm.playerName()) {
        alert('Enter a name');
    }
    if (socket == null) {
        // Re-use the same socket. Automatically reconnects if disconnected.
        socket = io();

        socket.on('disconnect', function () {
            vm.welcomeMessage('Disconnected');
            vm.state.state.name(null); // Opens the welcome screen.
        });
        socket.on('state', function (data) {
            ko.mapping.fromJS(data, vm.state);
            $('.activity').scrollTop(10000);
            console.log(data);
        });
        socket.on('exchange-options', function (cards) {
            var options = cards;
            var keep = 0;
            var influences = ourInfluence();
            for (var i = 0; i < influences.length; i++) {
                var inf = influences[i];
                if (!inf.revealed()) {
                    options.push(inf.role);
                    keep++;
                }
            }
            vm.exchangeOptions(options);
            vm.exchangeKeep(keep);
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
function weAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() == vm.state.playerIdx();
}
function theyAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() != vm.state.playerIdx();
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
    if (weAreInState('start-of-turn')) {
        var action = actions[actionName];
        var target;
        if (action.targetted) {
            target = (vm.state.state.playerIdx() + 1) % vm.state.numPlayers();
        }
        command('play-action', {
            action: actionName,
            target: target
        });
    }
}
function command(command, options) {
    var data = $.extend({
        command: command,
        stateId: vm.state.stateId()
    }, options);
    socket.emit('command', data);
}
function weCanBlock() {
    if (vm.state.state.name() != 'action-response') {
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
    if (!action.targetted) {
        // Untargetted actions foreign aid) can be blocked by anyone.
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
    if (vm.state.state.name() == 'action-response') {
        // Only role-based actions can be challenged.
        return !!action.role;
    } else if (vm.state.state.name() == 'block-response') {
        return true;
    } else {
        return false;
    }
}
function block(role) {
    command('block', {
        role: role
    });
}
function challenge() {
    command('challenge');
}
function allow() {
    command('allow');
}
function weAreTargetted(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.target() == vm.state.playerIdx();
}
function theyAreTargetted(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.target() != vm.state.playerIdx();
}
function ourPlayer() {
    return vm.state.players()[vm.state.playerIdx()];
}
function ourInfluence() {
    var player = ourPlayer();
    return player && player.influence();
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
    if (roles.length == vm.exchangeKeep()) {
        command('exchange', {
            roles: roles
        });
    } else {
        alert('must choose ' + vm.exchangeKeep() + ' roles');
    }
}
function displayHistory(hist) {
    var text = '';
    if (hist.playerIdx() == vm.state.playerIdx()) {
        text = 'You';
    } else {
        var player = vm.state.players()[hist.playerIdx()];
        text = player ? player.name() : 'Unknown';
    }
    text += ' ' + hist.message();
    var targetIdx = hist.target && hist.target();
    if (targetIdx == vm.state.playerIdx()) {
        text += ' you';
    } else if (targetIdx != null) {
        var target = vm.state.players()[targetIdx];
        if (target != null) {
            text += ' ' + target.name();
        }
    }
    return text;
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
$(window).on('resize', function () {
    $('.activity').height($(window).height() - 40);
    $('.activity').scrollTop(10000);
});
$(function () {
    $('.activity').height($(window).height() - 40);
    ko.applyBindings(vm);
});
