var Promise = require('es6-promise').Promise;

function createTestPlayer(game, logHistory) {
    var player = {
        name: 'Test',
        onStateChange: onStateChange,
        onHistoryEvent: onHistoryEvent,
        onChatMessage: function() {}
    };

    var gameProxy = game.playerJoined(player);

    var onNextState;
    var lastState;
    var history = [];

    function onStateChange(state) {
        lastState = state;
        var resolve = onNextState;
        if (resolve) {
            onNextState = null;
            resolve(state);
        }
    }

    function onHistoryEvent(message) {
        history.push(message);
        if (logHistory) {
            console.log(message);
        }
    }

    function getNextState() {
        return new Promise(function (resolve, reject) {
            onNextState = resolve;
        });
    }

    function getHistory() {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                var hist = history;
                history = [];
                resolve(hist);
            }, 10);
        });
    }

    function command(cmd) {
        cmd.stateId = lastState.stateId;
        gameProxy.command(cmd);
    }

    function leaveGame() {
        gameProxy.playerLeft();
    }

    return {
        getNextState: getNextState,
        getHistory: getHistory,
        command: command,
        leaveGame: leaveGame
    };
}

module.exports = createTestPlayer;
