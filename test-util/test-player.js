var shared = require('../web/shared');
var stateNames = shared.states;

function TestPlayers(game, opts) {
    var options = opts || {};
    var testPlayers = [];

    this.consumeState = function (stateName) {
        var promises = testPlayers.map(function (testPlayer) {
            return testPlayer.getNextState(stateName);
        });
        return Promise.all(promises).then(function (states) {
            var firstId = states.pop().stateId;
            states.forEach(function (state) {
                if (state.stateId !== firstId) {
                    throw new Error('Inconsistent states');
                }
            });
        });
    }

    this.waitForNewPlayers = function () {
        var promises = [];
        var players = Array.prototype.slice.apply(arguments);
        for (var i = 0; i < players.length; i++) {
            for (var j = 0; j < testPlayers.length - i; j++) {
                promises.push(testPlayers[j].getNextState(stateNames.WAITING_FOR_PLAYERS));
            }
        }
        return Promise.all(promises);
    }

    this.startGame = function (gameType) {
        testPlayers[0].command({
            command: 'start',
            gameType: gameType
        });
        return this.consumeState(stateNames.START_OF_TURN);
    }

    this.createTestPlayer = function (playerName) {
        var player = {
            name: playerName || ('player' + testPlayers.length),
            onStateChange: onStateChange,
            onHistoryEvent: onHistoryEvent,
            onChatMessage: function() {}
        };

        var gameProxy = game.playerJoined(player);

        var lastState;
        var states = [];
        var resolvers = [];
        var history = [];

        function onStateChange(state) {
            if (options.logState) {
                console.log(player.name + ' pushed ' + state.state.name);
            }
            lastState = state;
            if (resolvers.length) {
                var resolver = resolvers.shift();
                if (options.logState) {
                    console.log('  ' + player.name + ' read ' + state.state.name + '[' + state.stateId + '] at ' + resolver.src);
                }
                if (resolver.expected  && state.state.name !== resolver.expected) {
                    console.log('  Expected state ' + resolver.expected + ' but got ' + state.state.name + '[' + state.stateId + '] at ' + resolver.src);
                    throw new Error('Expected state ' + resolver.expected + ' but got ' + state.state.name + '[' + state.stateId + '] at ' + resolver.src);
                }
                resolver.resolve(state);
            } else {
                states.push(state);
            }
        }

        function onHistoryEvent(message) {
            history.push(message);
            if (options.logHistory) {
                console.log(message);
            }
        }

        function getCallSource() {
            var match = new Error().stack.match(/(\w+-test\.js:\d+)/);
            return match && match[1];
        }

        function getNextState(stateName) {
            if (states.length) {
                var state = states.shift();
                if (options.logState) {
                    console.log('  ' + player.name + ' read ' + state.state.name + '[' + state.stateId + '] at ' + getCallSource());
                }
                if (stateName && state.state.name !== stateName) {
                    console.log('  Expected state ' + stateName + ' but got ' + state.state.name + '[' + state.stateId + '] at ' + getCallSource());
                    throw new Error('Expected state ' + stateName + ' but got ' + state.state.name + '[' + state.stateId + '] at ' + getCallSource());
                }
                return Promise.resolve(state);
            } else {
                return new Promise(function (resolve) {
                    resolvers.push({
                        resolve: resolve,
                        src: getCallSource(),
                        expected: stateName
                    });
                });
            }
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

        var testPlayer = {
            getNextState: getNextState,
            getHistory: getHistory,
            command: command,
            leaveGame: leaveGame
        };
        testPlayers.push(testPlayer);
        return testPlayer;
    }
}

module.exports = TestPlayers;
