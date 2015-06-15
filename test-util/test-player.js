var Promise = require('es6-promise').Promise;

function createTestPlayer(game) {
    var player = {
        name: 'Test',
        onStateChange: onStateChange,
        onHistoryEvent: function() {},
        onChatMessage: function() {}
    };

    var gameProxy = game.playerJoined(player);

    var onNextState;
    var lastState;

    function onStateChange(state) {
        lastState = state;
        if (onNextState) {
            onNextState(state);
            onNextState = null;
        }
    }

    function getNextState() {
        return new Promise(function (resolve, reject) {
            onNextState = resolve;
        });
    }

    function command(cmd) {
        cmd.stateId = lastState.stateId;
        gameProxy.command(cmd);
    }

    return {
        getNextState: getNextState,
        command: command
    };
}

module.exports = createTestPlayer;
