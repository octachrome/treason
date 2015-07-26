vm = {
    playerName: ko.observable(localStorageGet('playerName') || ''),
    welcomeMessage: ko.observable(''),
    targetedAction: ko.observable(''),
    weAllowed: ko.observable(false),
    sidebar: ko.observable('chat'),
    history: ko.observableArray(),
    gameUrl: ko.observable(''),
    needName: ko.observable(false)
};
vm.state = ko.mapping.fromJS({
    stateId: null,
    gameId: null,
    players: [],
    playerIdx: null,
    numPlayers: null,
    gameName: null,
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

$(window).on('hashchange load', function() {
    if (location.hash) {
        vm.gameUrl(location.hash.substring(1));
        if (vm.playerName()) {
            join(null, null, vm.gameUrl());
        } else {
            vm.needName(true);
        }
    }
});

ko.bindingHandlers.tooltip = {
    init: function(element, valueAccessor) {
        var local = ko.utils.unwrapObservable(valueAccessor()),
            options = {};

        ko.utils.extend(options, ko.bindingHandlers.tooltip.options);
        ko.utils.extend(options, local);

        $(element).tooltip(options);

        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            $(element).tooltip("destroy");
        });
    },
    options: {
        placement: "right",
        trigger: "click"
    }
};
var socket;
function join(form, event, gameName) {
    //This seems clunky
    if (form && form.privateGameName && form.privateGameName.value) {
        gameName = form.privateGameName.value;
    }
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

        socket.on('gamenotfound', function(data) {
            vm.welcomeMessage('Private game: "' + data.gameName + '" was not found.');
            vm.state.state.name(null);
            vm.needName(false);
        });

        socket.on('disconnect', function () {
            vm.welcomeMessage('Disconnected');
            vm.state.state.name(null); // Opens the welcome screen.
            vm.needName(false);
        });
        socket.on('state', function (data) {
            ko.mapping.fromJS(data, vm.state);
            vm.targetedAction('');
            vm.weAllowed(false);
            $('.activity').scrollTop(0);
            console.log(data);
        });
        socket.on('history', function (data) {
            var items;
            if (data.continuation && vm.history().length) {
                // Collect related history items together.
                items = vm.history()[0];
            } else {
                items = ko.observableArray();
                vm.history.unshift(items);
            }
            items.push({
                icon: data.type,
                message: formatMessage(data.message)
            });
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
            console.error(data);
        });
    }
    socket.emit('join', {
        playerName: vm.playerName(),
        gameName: gameName
    });
}
function create(form, event) {
    _.debounce(new function() {
        if (socket == null) {
            socket = io();
        }

        socket.on('created', function(data) {
            socket.emit('disconnect');
            socket = null;
            location.hash = data.gameName;
        });

        socket.emit('create', {
            gameName: vm.playerName()
        });
    }, 500, true);
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
function playAction(actionName, event) {
    // Sometimes a click event gets fired on a disabled button.
    if ($(event.target).closest('button:enabled').length == 0) {
        return;
    }
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
function formatMessage(message) {
    for (var i = 0; i < vm.state.players().length; i++) {
        var playerName;
        if (i == vm.state.playerIdx()) {
            playerName = 'you';
        } else {
            var player = vm.state.players()[i];
            playerName = player ? player.name() : 'unknown';
        }
        message = message.replace(new RegExp('\\{' + i + '\\}', 'g'), playerName);
    }
    if (message.indexOf('you ') == 0) {
        // Fix caps.
        message = 'Y' + message.substr(1);
    }
    return message;
}
function stateMessage() {
    return formatMessage(vm.state.state.message() || "");
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
function roleDescription(role) {
    if (role === 'ambassador') {
        return 'Draw two from the deck and optionally exchange your influences';
    }
    if (role === 'assassin') {
        return 'Pay $3 to reveal another player\'s influence; blocked by contessa';
    }
    if (role === 'captain') {
        return 'Steal $2 from another player; blocked by captain and ambassador';
    }
    if (role === 'contessa') {
        return 'Block assassination';
    }
    if (role === 'duke') {
        return 'Tax +$3; block foreign aid';
    }
    return '';
}
function buttonActionClass(actionName) {
    var action = actions[actionName];
    if (action && action.role) {
        return 'btn-' + action.role;
    }
    for (var property in actions) {
        if (actions.hasOwnProperty(property) && actions[property].blockedBy) {
            if (actions[property].blockedBy.indexOf(actionName) >= 0) {
                return 'btn-' + actionName;
            }
        }
    }
    return 'btn-default';
}
function buttonRoleClass(role) {
    return 'btn-' + role;
}
function actionNames() {
    // This is the order I want them to appear in the UI.
    return [
        'tax',
        'steal',
        'assassinate',
        'exchange',
        'income',
        'foreign-aid',
        'coup'
    ];
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
function privateGame() {
    return playing() && vm.state.gameName;
}
function gameUrl2() {
    return window.location.protocol + '//' + window.location.host + '/#' + vm.state.gameName();
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
$(window).on('keydown', function (event) {
    var nodeName = event.target.nodeName;
    if (nodeName == 'TEXTAREA' || nodeName == 'INPUT') {
        return;
    }
    if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
        return;
    }
    // Keyboard shortcuts for all action buttons.
    var chr = String.fromCharCode(event.which).toLowerCase();
    if (chr.match(/[a-z]/)) {
        $('button:visible').each(function (idx, el) {
            el = $(el);
            if (el.text().trim().toLowerCase().indexOf(chr) == 0) {
                el.click();
                return false;
            }
        });
    }
});
