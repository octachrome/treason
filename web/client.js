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
/*
 * UI states:
 * logged out (/)                   !playing && !loggedIn
 *   joining a game (/#3)               && needName
 * in lobby                         !playing && loggedIn
 *   creating a private game (/)        (none)
 *   joining a game from click (/)      (none)
 *   joining a game from url (/#3)      (none)
 *     password is wrong/missing        (none)
 *     game does not exist              (none)
 * in game (/#3)                    playing
 * in password game (/#3-pwd)       playing
 *
 * Proposed:
 * user visits URL /#3
 *   state="joining #3"
 *     join dialog shown
 *       user clicks join
 *         join msg sent to server
 *           server replies joined
 *             state="playing #3"
 *           server replies password required
 *             state="joining #3", "password required"
 *               user enters password and joins
 *                 server replies joined
 *                   state="playing #3"
 *                 server replies password incorrect
 *                   state="joining #3", "password required", "password incorrect"
 * user clicks game #2 in lobby
 *   URL changes to /#2
 *     etc.
 */
vm = {
    playerName: ko.observable(localStorageGet('playerName') || ''), // The name of the current player.
    playerId: ko.observable(localStorageGet('playerId') || ''), // The id of the current user.
    bannerMessage: ko.observable(''), // Shown in a banner at the top of the screen.
    targetedAction: ko.observable(''), // During a coup, steal or assassination, the player that the user is targeting.
    weAllowed: ko.observable(false), // If true, the user has allowed the current action.
    chosenExchangeOptions: ko.observable({}), // During an exchange, the roles that the user has selected so far.
    sidebar: ko.observable('chat'), // Which pane is shown in the sidebar: chat or cheat sheet.
    history: ko.observableArray(), // List of all history items in the game in play.
    needName: ko.observable(false), // If true, the user is trying to join a game but they haven't logged in.
    rankings: ko.observableArray(), // List of the displayed player rankings.
    showingGlobalRank: ko.observable(true), // If true, global rankings are shown; if false, your rankings are shown.
    notifsEnabled: ko.observable(JSON.parse(localStorageGet('notifsEnabled') || false)), // True if notifications are enabled.
    loggedIn: ko.observable(false), // True if the user has a player name and id.
    games: ko.observableArray([]), // List of all public games.
    players: ko.observableArray([]), // List of all online players (in the global chat).
    password: ko.observable(''), // The password that the user is typing in the join game modal dialog.
    incorrectPassword: ko.observable(false), // True if the user tried to join the game with the wrong password.
    currentGame: ko.observable(''), // The id of the game currently shown in the join game modal dialog.
    gameInfo: ko.observable(), // Info about the game  currently shown in the join game modal dialog.
    globalChatMessages: ko.observableArray(['Welcome to Treason Coup']), // The global chat messages that have been received.
    globalMessage: ko.observable(''), // The message the user is typing into the global chat box.
    wantToStart: ko.observable(null), // The player clicked start, but not everyone is ready, so we're showing a confirm msg (holds the type of game the player wanted to start).
    playingGame: ko.observable(null), // The id of the game that we are currently playing, or null if there is no active game.
    playingPassword: ko.observable(null), // The password of the game that we are currently playing, or null if there is no active game.
    disableSubmitButton: ko.observable(false) // If the player has already hit the submit button to create a new player, this will prevent them from repeatedly creating more.
};
vm.state = ko.mapping.fromJS({
    stateId: null,
    gameId: null,
    players: [],
    playerIdx: null,
    numPlayers: null,
    maxPlayers: null,
    gameName: null,
    roles: [],
    state: {
        name: null,
        playerIdx: null,
        winnerIdx: null,
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
vm.state.state.name.subscribe(function (stateName) {
    if (!stateName) {
        vm.playingGame(null);
        vm.playingPassword(null);
    }
});
vm.playing = vm.playingGame;
vm.bannerVisible = ko.computed(function () {
    return !vm.playing() && vm.bannerMessage();
});
vm.notifsEnabled.subscribe(function (enabled) {
    localStorageSet('notifsEnabled', enabled);
});
vm.notifToggleText = ko.computed(function () {
    return vm.notifsEnabled() ? 'Disable notifications' : 'Enable notifications';
});
vm.rankButtonText = ko.computed(function () {
    return vm.showingGlobalRank() ? 'Show my rankings' : 'Show global rankings';
});
vm.canStartGame = ko.computed(function () {
    var p = ourPlayer();
    return p && p.isReady() === true && countReadyPlayers() >= 2;
});
vm.waitingToPlay = ko.computed(function () {
    var player = ourPlayer();
    return player && player.isReady() && vm.state.state.name() == 'waiting-for-players';
});
// If players leave so the game cannot be started, hide the confirm msg about whether to start the game.
vm.canStartGame.subscribe(function (canStart) {
    if (!canStart) {
        vm.wantToStart(null);
    }
});
// Reset wantToStart when a new game starts.
vm.waitingToPlay.subscribe(function (waiting) {
    if (!waiting) {
        vm.wantToStart(null);
    }
});

if (window.location.href.indexOf('amazonaws') >= 0) {
    vm.bannerMessage('Update your bookmarks to <a href="http://coup.thebrown.net">http://coup.thebrown.net</a>');
}

function hashGameId() {
    var hash = location.hash.match(/#([0-9]+)(?:-(.+))?/);
    return hash && hash[1] || null;
}
function hashGamePassword() {
    var hash = location.hash.match(/#([0-9]+)(?:-(.+))?/);
    return hash && hash[2] || null;
}
$(window).on('hashchange load', function (event) {
    var gameId = hashGameId();
    if (gameId == vm.playingGame()) {
        // Already playing this game.
        return;
    }
    if (gameId) {
        vm.currentGame(gameId);
        vm.password(hashGamePassword());
        if (vm.playerName()) {
            initCurrentGameInfo(vm.currentGame());
            vm.incorrectPassword(false);
            $('#joinGameModal').modal('show');
            $('#joinGameModal input').focus().select();
        } else {
            vm.needName(true);
        }
    }
    else if (vm.playing()) {
        onLeaveGame(event.originalEvent.oldURL);
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
    if (vm.playerName() && vm.playerId()) {
        socket.emit('registerplayer', {
            playerName: vm.playerName(),
            playerId: vm.playerId()
        });
    }
    socket.on('handshake', function(data, fn) {
        vm.playerId(data.playerId);
        localStorageSet('playerId', data.playerId);
        vm.loggedIn(true);
        vm.games(data.games);
        vm.players(data.players);
        fn('done logging in');
    });
    socket.on('updategames', function(data) {
        vm.games(data.games);
    });
    socket.on('updateplayers', function(data) {
        vm.players(data.players);
    });
    socket.on('globalchatmessage', function(data) {
        vm.globalChatMessages.push(data);

        var globalMessageContainer = $('#global-chat-container');
        globalMessageContainer[0].scrollTop = globalMessageContainer[0].scrollHeight;
    });
});
socket.on('disconnect', function () {
    vm.bannerMessage('Disconnected');
    vm.state.state.name(null); // Opens the welcome screen.
    vm.needName(false);
    vm.loggedIn(false);
    location = location.href.split('#')[0]
});
socket.on('state', function (data) {
    if (!data) {
        // Null state means we left the game - reset observables.
        vm.state.state.name(null);
        vm.currentGame('');
        vm.password('');
        vm.gameInfo('');
        vm.playingGame(null);
        vm.playingPassword(null);
    }
    else {
        ko.mapping.fromJS(data, vm.state);
        vm.targetedAction('');
        vm.weAllowed(false);
        vm.chosenExchangeOptions({});
        $('.activity').scrollTop(0);
        $('.action-bar').effect('highlight', {color: '#ddeeff'}, 'fast');
        notifyPlayerOfState();
    }
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
    vm.password(data.password);
    vm.currentGame(data.gameName);
    join(null, null, vm.currentGame());
});
socket.on('joined', function(data) {
    vm.playingGame(data.gameName);
    vm.history([]);
    $('.chat').html('');

    var hash;
    if (data.password) {
        vm.playingPassword(data.password);
        hash = '#' + data.gameName + '-' + data.password;
    } else {
        hash = '#' + data.gameName;
    }
    history.pushState(null, '', hash);
    hideModals();
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
socket.on('gamenotfound', function (data) {
    alert('Game not found');
    location.hash = '';
    hideModals();
});
socket.on('incorrectpassword', function () {
    vm.incorrectPassword(true);
});

function playAgain() {
    vm.history([]);
    command('ready');
}
function join(form, event, gameName) {
    if (isInvalidPlayerName()) {
        return;
    }
    socket.emit('join', {
        playerName: vm.playerName(),
        gameName: gameName,
        password: vm.password()
    });
}

function enter(form, event) {
    if (isInvalidPlayerName()) {
        return;
    }
    if (vm.disableSubmitButton()) {
        return;
    }
    vm.disableSubmitButton(true);

    socket.emit('registerplayer', {
        playerName: vm.playerName(),
        playerId: vm.playerId()
    });
}

var create = _.debounce(function (form, event, publicGame) {
    if (isInvalidPlayerName()) {
        return;
    }

    if (publicGame) {
        vm.password('');
    }

    socket.emit('create', {
        gameName: vm.playerName(),
        playerName: vm.playerName(),
        password: vm.password()
    });
}, 500, true);

var showRankings = _.debounce(function (form, event) {
    if (vm.showingGlobalRank()) {
        vm.showingGlobalRank(false);
        socket.emit('showmyrank');
    } else {
        vm.showingGlobalRank(true);
        socket.emit('showrankings');
    }
}, 500, true);

function showUserProfileDialog() {
    $('#userProfileDialog').modal('show');
    $('#userProfileDialog input').focus().select();
}

function confirmUserProfileDialog() {
    location.reload();
}

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
    if (countNonReadyPlayers() > 0) {
        vm.wantToStart(gameType);
    }
    else {
        confirmStart(gameType);
    }
}
function confirmStart(gameType) {
    command('start', {
        gameType: gameType || vm.wantToStart()
    });
}
function cancelStart() {
    vm.wantToStart(null);
}
function canAddAi() {
    var p = ourPlayer();
    return p && p.isReady() === true && countReadyPlayers() < vm.state.maxPlayers();
}
function addAi() {
    command('add-ai');
}
function canRemoveAi() {
    var p = ourPlayer();
    if (!p || p.isReady() !== true) {
        return false;
    }
    return vm.state.players().some(function (player) {
        return player.ai();
    });
}
function removeAi() {
    command('remove-ai');
}
function countReadyPlayers() {
    var readyCount = 0;
    vm.state.players().forEach(function (player) {
        if (player.isReady()) {
            readyCount++;
        }
    });
    return readyCount;
}
function countNonReadyPlayers() {
    var nonReadyCount = 0;
    vm.state.players().forEach(function (player) {
        if (player.connected() && !player.isReady()) {
            nonReadyCount++;
        }
    });
    return nonReadyCount;
}
function weAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() == vm.state.playerIdx();
}
function theyAreInState(stateName) {
    return vm.state.state.name() == stateName && vm.state.state.playerIdx() != vm.state.playerIdx();
}
function weHaveWon() {
    return vm.state.state.winnerIdx() == vm.state.playerIdx();
}
function theyHaveWon() {
    return vm.state.state.winnerIdx() != null && vm.state.state.winnerIdx() != vm.state.playerIdx();
}
function canPlayAgain() {
    return vm.state.state.name() == 'waiting-for-players';
}
function weAreAlive() {
    return ourInfluenceCount() > 0;
}
function currentPlayerName() {
    return playerName(vm.state.state.playerIdx());
}
function targetPlayerName() {
    return playerName(vm.state.state.target());
}
function toRevealPlayerName() {
    return playerName(vm.state.state.playerToReveal());
}
function winnerName() {
    return playerName(vm.state.state.winnerIdx());
}
function playerName(playerIdx) {
    var player = vm.state.players()[playerIdx];
    if (player) {
        return player.name();
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
function leaveGame() {
    location.hash = '';
}
function onLeaveGame(oldUrl) {
    if (confirm('Are you sure you want to leave this game?')) {
        command('leave');
    }
    else {
        history.pushState(null, '', oldUrl);
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
function sendGlobalMessage() {
    if (vm.globalMessage() != '') {
        socket.emit('sendglobalchatmessage', vm.globalMessage());
        vm.globalMessage('');
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
    else if (weHaveWon()) {
        notifyPlayer('You have won!');
    }
    else if (theyHaveWon()) {
        notifyPlayer(winnerName() + ' has won!');
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
function initCurrentGameInfo(gameName) {
    var games = vm.games();
    for (var i = 0; i < games.length; i++) {
        var game = games[i];
        if (game.gameName == gameName) {
            vm.gameInfo(game);
            break;
        }
    }
}
function hideModals() {
    $('div.modal').modal('hide');
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

$('document').ready(function() {
    var $joinGameModal = $('#joinGameModal');
    $joinGameModal.on('show.bs.modal', function (event) {
        var gameName = $(event.relatedTarget).data('game-name');
        initCurrentGameInfo(gameName);
    });
    $joinGameModal.on('hidden.bs.modal', function () {
        // If the join game modal was cancelled, restore the original hash.
        if (vm.playingGame() != hashGameId()) {
            var hash = vm.playingGame() || '';
            if (vm.playingPassword()) {
                hash += '-' + vm.playingPassword();
            }
            location.hash = hash;
        }
        vm.gameInfo('');
    });
    $('#newGameModal').on('shown.bs.modal', function () {
        $('#newGameModal input').focus().select();
    });
});
