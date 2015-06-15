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

    function onStateChange(state) {
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

    return {
        getNextState: getNextState
    };
}

module.exports = createTestPlayer;
