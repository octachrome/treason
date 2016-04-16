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
vm = {
    playerName: ko.observable(localStorageGet('playerName') || ''),
    playerId: ko.observable(localStorageGet('playerId') || ''),
    activeUsers: ko.observable(),
    bannerMessage: ko.observable(''),
    targetedAction: ko.observable(''),
    weAllowed: ko.observable(false),
    chosenExchangeOptions: ko.observable({}),
    sidebar: ko.observable('chat'),
    history: ko.observableArray(),
    gameUrl: ko.observable(''),
    needName: ko.observable(false),
    rankings: ko.observableArray(),
    rankButtonText: ko.observable('Show my rankings'),
    showingGlobalRank: ko.observable(true),
    notifsEnabled: ko.observable(JSON.parse(localStorageGet('notifsEnabled') || false))
};
vm.state = ko.mapping.fromJS({
    stateId: null,
    gameId: null,
    players: [],
    playerIdx: null,
    numPlayers: null,
    gameName: null,
    roles: [],
    state: {
        name: null,
        playerIdx: null,
        blockingRole: null,
        action: null,
        target: null,
        message: null,
        exchangeOptions: null,
        playerToReveal: null,
        confession: null
    }
});
vm.playerName.subscribe(function (newName) {
    localStorageSet('playerName', newName);
});
vm.bannerVisible = ko.computed(function () {
    return !playing() && vm.bannerMessage();
});
vm.notifsEnabled.subscribe(function (enabled) {
    localStorageSet('notifsEnabled', enabled);
});
vm.notifToggleText = ko.computed(function () {
    return vm.notifsEnabled() ? 'Disable notifications' : 'Enable notifications';
});

if (window.location.href.indexOf('amazonaws') >= 0) {
    vm.bannerMessage('Update your bookmarks to <a href="http://coup.thebrown.net">http://coup.thebrown.net</a>');
}

$(window).on('hashchange load', function() {
    if (location.hash) {
        vm.gameUrl(decodeURIComponent(location.hash.substring(1)));
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
var socket = io();
socket.on('connect', function() {
    socket.on('handshake', function(data) {
        vm.activeUsers(data.activeUsers);
        vm.playerId(data.playerId);
        localStorageSet('playerId', data.playerId);
    });
    socket.emit('registerplayer', {
        playerName: vm.playerName(),
        playerId: vm.playerId()
    });
});
socket.on('disconnect', function () {
    vm.bannerMessage('Disconnected');
    $('#privateGameCreatedModal').modal('hide');//close the modal in case it was open when we disconnected
    vm.state.state.name(null); // Opens the welcome screen.
    vm.needName(false);
});
socket.on('state', function (data) {
    ko.mapping.fromJS(data, vm.state);
    vm.targetedAction('');
    vm.weAllowed(false);
    vm.chosenExchangeOptions({});
    $('.activity').scrollTop(0);
    $('.action-bar').effect('highlight', {color: '#ddeeff'}, 'fast');
    notifyPlayerOfState();
});
socket.on('history', function (data) {
    var items;
    // Collect related history items together (but don't bother searching too far back).
    for (var i = 0; i < 10 && i < vm.history().length; i++) {
        if (vm.history()[i]()[0].histGroup == data.histGroup) {
            items = vm.history()[i];
            break;
        }
    }
    if (!items) {
        items = ko.observableArray();
        vm.history.unshift(items);
    }
    items.push({
        icon: data.type,
        message: formatMessage(data.message),
        histGroup: data.histGroup
    });
});
socket.on('chat', function (data) {
    var from;
    if (data.from == vm.state.playerIdx()) {
        from = 'You';
    } else {
        var player = vm.state.players()[data.from];
        from = player ? player.name() : 'Unknown';
        notifyPlayer(from + ' says: ' + data.message);
    }
    var html = '<b>' + from + ':</b> ' + data.message + '<br/>';
    $('.chat').append(html);
    $('.chat').scrollTop(10000);
});
socket.on('created', function(data) {
    socket.emit('disconnect');
    location.hash = data.gameName;
    //if you created a private game, we show you the welcome modal
    $('#privateGameCreatedModal').modal({})
});
socket.on('error', function (data) {
    alert(data);
});
socket.on('game-error', function (data) {
    console.error(data);
});
socket.on('rankings', function (data) {
    vm.rankings(data);
});

function playAgain() {
    // If we were playing a private game, rejoin the same one. Otherwise, join a new public game.
    join(null, null, vm.gameUrl());
}
function join(form, event, gameName) {
    if (isInvalidPlayerName()) {
        return;
    }
    //This seems clunky
    if (form && form.privateGameName && form.privateGameName.value) {
        gameName = form.privateGameName.value;
    }
    if (gameName) {
        //Firefox encodes URLs copied from the address bar.
        gameName = decodeURIComponent(gameName);
    }
    vm.history([]);
    $('.chat').html('');
    socket.emit('join', {
        playerName: vm.playerName(),
        gameName: gameName
    });
}

var create = _.debounce(function (form, event) {
    if (isInvalidPlayerName()) {
        return;
    }

    socket.emit('create', {
        gameName: vm.playerName(),
        playerName: vm.playerName()
    });
}, 500, true);

var showRankings = _.debounce(function (form, event) {
    if (vm.showingGlobalRank()) {
        vm.showingGlobalRank(false);
        vm.rankButtonText('Show global rankings');
        socket.emit('showmyrank');
    } else {
        vm.showingGlobalRank(true);
        vm.rankButtonText('Show my rankings');
        socket.emit('showrankings');
    }
}, 500, true);

function isInvalidPlayerName() {
    if (!vm.playerName() || !vm.playerName().match(/^[a-zA-Z0-9_ !@#$*]+$/) || !vm.playerName().trim()) {
        alert('Enter a valid name');
        return true;
    }
    if (vm.playerName().length > 30) {
        alert('Enter a shorter name');
        return true;
    }
    return false;
}
function start(gameType) {
    command('start', {
        gameType: gameType
    });
}
function canAddAi() {
    return vm.state.players().length < 6;
}
function addAi() {
    command('add-ai');
}
function canRemoveAi() {
    return vm.state.players().some(function (player) {
        return player.ai();
    });
}
function removeAi() {
    command('remove-ai');
}
function weAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() == vm.state.playerIdx();
}
function theyAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() != vm.state.playerIdx();
}
function gameOver() {
    return theyAreInState('game-won') || weAreInState('game-won');
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
function actionPresentInGame(actionName) {
    var action = actions[actionName];
    return !action.roles || getGameRole(action.roles);
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
    if (vm.state.state.playerIdx() === vm.state.playerIdx()) {
        // Cannot block our own action.
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
    return _.intersection(action.blockedBy || [], vm.state.roles());
}
function weCanChallenge() {
    var action = actions[vm.state.state.action()];
    if (!action) {
        return false;
    }
    if (vm.state.state.name() == states.ACTION_RESPONSE) {
        if (vm.state.state.playerIdx() === vm.state.playerIdx()) {
            // Cannot challenge our own action.
            return false;
        }
        // Only role-based actions can be challenged.
        return !!action.roles;
    } else if (vm.state.state.name() == states.BLOCK_RESPONSE) {
        if (vm.state.state.target() === vm.state.playerIdx()) {
            // Cannot challenge our own block.
            return false;
        }
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
function toggleExchangeOption(index) {
    var options = vm.chosenExchangeOptions();
    if (options[index]) {
        delete options[index];
    } else {
        options[index] = vm.state.state.exchangeOptions()[index];
    }
    vm.chosenExchangeOptions(options);
}
function exchangeOptionClass(index) {
    if (vm.chosenExchangeOptions()[index]) {
        return buttonRoleClass(vm.state.state.exchangeOptions()[index]);
    } else {
        return 'btn-default';
    }
}
function chosenExchangeOptions() {
    var roles = [];
    var options = vm.chosenExchangeOptions();
    for (key in options) {
        if (options[key]) {
            roles.push(options[key]);
        }
    }
    return roles;
}
function exchangeOptionsValid() {
    return chosenExchangeOptions().length == ourInfluenceCount();
}
function exchange() {
    var roles = chosenExchangeOptions();
    if (roles.length == ourInfluenceCount()) {
        command('exchange', {
            roles: roles
        });
    }
}
function interrogate(forceExchange) {
    command('interrogate', {
        forceExchange: forceExchange
    });
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
        return 'Draw two from the deck and exchange your influences';
    }
    if (role === 'inquisitor') {
        return 'Draw one from the deck and exchange OR look at one opponent\'s role and optionally force an exchange';
    }
    if (role === 'assassin') {
        return 'Pay $3 to reveal another player\'s influence; blocked by contessa';
    }
    if (role === 'captain') {
        return 'Steal $2 from another player; blocked by captain and ' + getGameRole(['ambassador', 'inquisitor']);
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
    if (action && action.roles) {
        return 'btn-' + actionName;
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
function historyBorderClass(items) {
    if (items.length) {
        return 'hist-' + items[0].icon;
    } else {
        return '';
    }
}
function actionNames() {
    // This is the order I want them to appear in the UI.
    return [
        'tax',
        'steal',
        'assassinate',
        'interrogate',
        'exchange',
        'income',
        'foreign-aid',
        'coup'
    ];
}
function getGameRole(roles) {
    var gameRoles = vm.state && vm.state.roles && vm.state.roles() || [];
    return _.intersection(gameRoles, _.flatten([roles]))[0];

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
    return playing() && vm.state.gameName && vm.state.gameName();
}
function calculatedGameUrl() {
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
function animateHistory(e) {
    var el = $(e).filter('li');

    if (el.data('icon') == 'player-died') {
        el.effect('shake', {times: '5'}, 1000);
    } else {
        el.effect('slide', {direction: 'left'}, 400)
            .effect('highlight', {color: '#ddeeff'}, 1000);
    }
}

var windowVisible = true;
$(window).on('focus', function () {
    windowVisible = true;
});
$(window).on('blur', function () {
    windowVisible = false;
});
function notifyPlayer(message) {
    if (vm.notifsEnabled() && !windowVisible) {
        // Only notify if the user is looking at a different window.
        new Notification(message);
    }
}
function notifyPlayerOfState() {
    if (weAreInState(states.START_OF_TURN)) {
        notifyPlayer('Your turn');
    }
    else if (weAreInState(states.EXCHANGE)) {
        notifyPlayer('Choose the roles to keep');
    }
    else if (weCanBlock() || weCanChallenge()) {
        notifyPlayer(stateMessage());
    }
    else if (weAreInState(states.EXCHANGE)) {
        notifyPlayer('Choose the roles to keep');
    }
    else if (weMustReveal()) {
        notifyPlayer('You must reveal an influence');
    }
    else if (weAreInState(states.GAME_WON)) {
        notifyPlayer('You have won!');
    }
    else if (theyAreInState(states.GAME_WON)) {
        notifyPlayer(currentPlayerName() + ' has won!');
    }
}
function notifsSupported() {
    return window.Notification;
}
function toggleNotifs() {
    var enabled = vm.notifsEnabled();
    if (!enabled) {
        // Enabling...
        Promise.resolve(Notification.permission).then(function (permission) {
            if (permission !== 'granted') {
                // Get permission to use notifications.
                return Notification.requestPermission();
            }
            else {
                return permission;
            }
        }).then(function (permission) {
            if (permission === 'granted') {
                vm.notifsEnabled(true);
            }
        });
    }
    else {
        vm.notifsEnabled(false);
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
