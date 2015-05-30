'use strict';

var playerId = 1;

function createNetPlayer(game, socket, playerName) {
    var player = {
        name: playerName || ('Player ' + playerId++),
        onStateChange: onStateChange,
        setExchangeOptions: setExchangeOptions,
        onChatMessage: onChatMessage
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

    function onChatMessage(playerIdx, message) {
        socket.emit('chat', {
            from: playerIdx,
            message: message
        });
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

    var sendChatMessage = function (message) {
        if (gameProxy != null) {
            gameProxy.sendChatMessage(message);
        }
    }

    var onDisconnect = function () {
        if (gameProxy != null) {
            socket.removeListener('command', onCommand);
            socket.removeListener('chat', sendChatMessage);
            gameProxy.playerLeft();
            gameProxy = null;
            game = null;
        }
    }
    socket.on('command', onCommand);
    socket.on('chat', sendChatMessage);
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
