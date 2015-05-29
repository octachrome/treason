'use strict';

var playerId = 1;

function createNetPlayer(game, socket, playerName) {
    var player = {
        name: playerName || ('Player ' + playerId++),
        onStateChange: onStateChange,
        setExchangeOptions: setExchangeOptions
    };

    try {
        var gameProxy = game.playerJoined(player);
    } catch(e) {
        handleError(e);
        return;
    }

    function onStateChange(state) {
        socket.emit('state', state);
    }

    function setExchangeOptions(options) {
        socket.emit('exchange-options', options);
    }

    var onCommand = function(data) {
        try {
            if (gameProxy != null) {
                gameProxy.command(data);
            }
        } catch(e) {
            handleError(e);
        }
    }

    var onDisconnect = function () {
        if (gameProxy != null) {
            socket.removeListener('command', onCommand);
            gameProxy.playerLeft();
            gameProxy = null;
            game = null;
        }
    }
    socket.on('command', onCommand);
    socket.on('disconnect', onDisconnect);
    // If the player joins another game, leave this one.
    socket.on('join', onDisconnect);

    function handleError(e) {
        var message;
        if (e instanceof Error) {
            console.error(e);
            console.error(e.stack);
            message = 'Internal error';
        } else {
            message = e.message;
        }
        socket.emit('game-error', message);
    }
}

module.exports = createNetPlayer;
