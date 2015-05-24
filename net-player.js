'use strict';

var playerId = 1;

function createNetPlayer(game, socket) {
    var player = {
        name: 'Player ' + playerId++,
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

    socket.on('command', function (data) {
        try {
            gameProxy.command(data);
        } catch(e) {
            handleError(e);
        }
    });
    socket.on('disconnect', function () {
        gameProxy.playerLeft();
    });

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
