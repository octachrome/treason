const debug = require('debug')('GameTracker');

module.exports = GameTracker;

function GameTracker() {
    this.events = [];
}

GameTracker.TYPE_START_OF_TURN = 1;
GameTracker.TYPE_ACTION = 2;
GameTracker.TYPE_CHALLENGE_SUCCESS = 3;
GameTracker.TYPE_CHALLENGE_FAIL = 4;
GameTracker.TYPE_BLOCK = 5;
GameTracker.TYPE_PLAYER_LEFT = 6;
GameTracker.TYPE_GAME_OVER = 7;

GameTracker.EventTypes = {};
Object.keys(GameTracker).forEach(key => {
    if (/^TYPE_/.test(key)) {
        GameTracker.EventTypes[GameTracker[key]] = key.substr('TYPE_'.length);
    }
});

GameTracker.prototype.startOfTurn = function (state) {
    this._recordState(GameTracker.TYPE_START_OF_TURN, state);
};

GameTracker.prototype.gameOver = function (state) {
    this._recordState(GameTracker.TYPE_GAME_OVER, state);
};

GameTracker.prototype._recordState = function (type, state) {
    this.events.push({
        type: type,
        whoseTurn: state.state.playerIdx,
        playerStates: state.players.map(function (playerState) {
            return {
                cash: playerState.cash,
                influence: playerState.influence.map(function (influence) {
                    return {
                        role: influence.role,
                        revealed: influence.revealed
                    };
                })
            };
        })
    });
};

GameTracker.prototype.action = function (action, target) {
    this.events.push({
        type: GameTracker.TYPE_ACTION,
        action: action,
        target: target
    });
};

GameTracker.prototype.challenge = function (challenger, challenged, success) {
    this.events.push({
        type: success ? GameTracker.TYPE_CHALLENGE_SUCCESS : GameTracker.TYPE_CHALLENGE_FAIL,
        challenger: challenger,
        challenged: challenged
    });
};

GameTracker.prototype.block = function (blockingPlayer, blockingRole) {
    this.events.push({
        type: GameTracker.TYPE_BLOCK,
        blockingPlayer: blockingPlayer,
        blockingRole: blockingRole
    });
};

GameTracker.prototype.playerLeft = function (player) {
    this.events.push({
        type: GameTracker.TYPE_PLAYER_LEFT,
        player: player
    });
};

GameTracker.prototype.toJson = function () {
    return JSON.stringify(this.events);
};

GameTracker.prototype.pack = function () {
    var bytes = [];
    var offset = 0;
    var tracker = this;
    this.events.forEach(function (event) {
        switch (event.type) {
            case GameTracker.TYPE_START_OF_TURN:
            case GameTracker.TYPE_GAME_OVER:
                bytes[offset++] = (event.type << 4) | (event.whoseTurn & 0xf);
                event.playerStates.forEach(function (playerState) {
                    bytes[offset++] = playerState.cash & 0xff;
                    bytes[offset++] = (tracker.encodeInfluence(playerState.influence[0]) << 4) |
                        tracker.encodeInfluence(playerState.influence[1]);
                });
                break;
            case GameTracker.TYPE_ACTION:
                // No type code because it always follows START_OF_TURN.
                bytes[offset++] = tracker.encodeAction(event.action, event.target);
                break;
            case GameTracker.TYPE_CHALLENGE_SUCCESS:
            case GameTracker.TYPE_CHALLENGE_FAIL:
                bytes[offset++] = (event.type << 4) | (event.challenger & 0xf);
                bytes[offset++] = (event.challenged & 0xf);
                break;
            case GameTracker.TYPE_BLOCK:
                bytes[offset++] = (event.type << 4) | (event.blockingPlayer & 0xf);
                bytes[offset++] = tracker.encodeRole(event.blockingRole);
                break;
            case GameTracker.TYPE_PLAYER_LEFT:
                bytes[offset++] = (event.type << 4) | (event.player & 0xf);
                break;
        }
    });
    return Buffer.from(bytes);
};

GameTracker.prototype.encodeInfluence = function (influence) {
    if (influence) {
        return (influence.revealed ? 8 : 0) | this.encodeRole(influence.role);
    }
    else {
        return 0;
    }
};

GameTracker.prototype.encodeRole = function (role) {
    if (role === 'duke') {
        return 1;
    }
    else if (role === 'captain') {
        return 2;
    }
    else if (role === 'assassin') {
        return 3;
    }
    else if (role === 'ambassador' || role === 'inquisitor') {
        return 4;
    }
    else if (role === 'contessa') {
        return 5;
    }
};

GameTracker.prototype.encodeAction = function (action, target) {
    if (action === 'tax') {
        return 1 << 4;
    }
    else if (action === 'foreign-aid') {
        // Secondary duke action.
        return (8+1) << 4;
    }
    else if (action === 'steal') {
        return (2 << 4) | (target & 0xf);
    }
    else if (action === 'assassinate') {
        return (3 << 4) | (target & 0xf);
    }
    else if (action === 'exchange') {
        return 4 << 4;
    }
    else if (action === 'interrogate') {
        // Secondary inquisitor action.
        return ((8+4) << 4) | (target & 0xf);
    }
    else if (action === 'coup') {
        return (5 << 4) | (target & 0xf);
    }
    else if (action === 'income') {
        return (8+5) << 4;
    }
};

GameTracker.prototype.unpack = function (buffer, gameInfo) {
    this.gameInfo = gameInfo;
    var events = [];
    var offset = 0;
    gameInfo.playerStateCount = 0;
    gameInfo.disconnects = 0;
    while (offset < buffer.length) {
        this._debugEventByte(offset, buffer[offset], true);
        var first = buffer[offset++];
        var type = first >> 4;
        var event = {
            type: type
        };
        events.push(event);
        switch (type) {
            case GameTracker.TYPE_GAME_OVER:
                if (offset < events.length) {
                    throw new Error('Unexpected game over event');
                }
            case GameTracker.TYPE_START_OF_TURN:
                event.whoseTurn = first & 0xf;
                if (event.challenger >= gameInfo.playerStateCount) {
                    throw new Error('Unknown current player');
                }
                event.playerStates = [];
                // Detect player states: this includes observers, which gameInfo.playerCount does not account for.
                // Observers can also join mid-game.
                let playersFound = 0;
                let statesFound = 0;
                while (playersFound < gameInfo.playerCount) {
                    this._debugEventByte(offset, buffer[offset]);
                    const cash = buffer[offset++];
                    this._debugEventByte(offset, buffer[offset]);
                    const influence = buffer[offset++]
                    event.playerStates.push({
                        cash: cash,
                        influence: [this.decodeInfluence(influence >> 4), this.decodeInfluence(influence & 0xf)]
                    });
                    if (influence != 0 || cash != 0) {
                        playersFound++;
                    }
                    statesFound++;
                }
                // Skip past any additional observers at the end.
                while (offset + 1 < buffer.length && buffer[offset] == 0 && buffer[offset+1] == 0) {
                    statesFound++;
                    offset += 2;
                }
                gameInfo.playerStateCount = statesFound;
                debug(`>   found ${statesFound} states, ${gameInfo.playerCount} players`);

                // START_OF_TURN is usually followed by ACTION, which is not labelled with a type field,
                // but one or more PLAYER_LEFT events may also occur, in which case, any of these events can
                // follow it: START_OF_TURN, GAME_OVER, ACTION.
                while (offset < buffer.length) {
                    const action = this.decodeActionEvent(buffer[offset++]);
                    try {
                        this.validateActionEvent(action, gameInfo.playerStateCount);
                        events.push(action);
                        debug('>   action detected');
                        break;
                    } catch (e) {
                        const type2 = buffer[offset - 1] >> 4;
                        const player2 = buffer[offset - 1] & 0xf;
                        this._debugEventByte(offset - 1, buffer[offset - 1], true);
                        if (type2 == GameTracker.TYPE_PLAYER_LEFT) {
                            // Cannot validate player2, because an observer can join after the start of turn and leave before the action!
                            debug(`>   player ${player2} left`);
                            events.push({type: type2, player: player2});
                            gameInfo.disconnects++;
                            if (player2 == event.whoseTurn) {
                                // If the player whose turn it was left the game, a new START_OF_TURN event will occur.
                                debug('>   skipping turn');
                                break;
                            }
                        } else if (type2 == GameTracker.TYPE_GAME_OVER && player2 < gameInfo.playerStateCount) {
                            // Break out and parse this event properly.
                            debug('>   game over');
                            offset--;
                            break;
                        } else {
                            for (let i = 0; i < 5 && offset + i < buffer.length; i++) {
                                this._debugEventByte(offset + i, buffer[offset + i]);
                            }
                            throw e;
                        }
                    }
                }
                break;
            case GameTracker.TYPE_CHALLENGE_SUCCESS:
            case GameTracker.TYPE_CHALLENGE_FAIL:
                event.challenger = first & 0xf;
                event.challenged = buffer[offset++] & 0xf;
                if (event.challenger >= gameInfo.playerStateCount) {
                    throw new Error('Unknown challenger player');
                }
                if (event.challenged >= gameInfo.playerStateCount) {
                    throw new Error('Unknown challenged player');
                }
                break;
            case GameTracker.TYPE_BLOCK:
                event.blockingPlayer = first & 0xf;
                event.blockingRole = this.decodeRole(buffer[offset++]);
                if (event.blockingPlayer >= gameInfo.playerStateCount) {
                    throw new Error('Unknown blocking player');
                }
                break;
            case GameTracker.TYPE_PLAYER_LEFT:
                event.player = first & 0xf;
                gameInfo.disconnects++;
                break;
        }
    }
    if (!events || events.length == 0) {
        throw new Error('No events');
    }
    if (events[0].type != GameTracker.TYPE_START_OF_TURN) {
        throw new Error('Missing initial start of turn event');
    }
    if (events[events.length - 1].type != GameTracker.TYPE_GAME_OVER) {
        throw new Error('Missing final game over event');
    }
    return events;
};

GameTracker.prototype._debugEventByte = function (offset, byte, showType) {
    if (!debug.enabled) {
        return;
    }
    let x = byte;
    const qw = [];
    const hw = [];
    for (let j = 0; j < 2; j++) {
        hw.push(x & 0xf);
        qw.push((x & 0x8) ? 1 : 0);
        qw.push(x & 0x7);
        x = x >> 4;
    }
    debug(offset, showType ? GameTracker.EventTypes[hw[1]] : '', byte, hw.reverse(), qw.reverse());
};

GameTracker.prototype.validateActionEvent = function (event, playerStateCount) {
    const ACTION_INFO = {
        'tax': {
            targeted: false
        },
        'foreign-aid': {
            targeted: false
        },
        'steal': {
            targeted: true
        },
        'assassinate': {
            targeted: true
        },
        'exchange': {
            targeted: false
        },
        'interrogate': {
            targeted: true
        },
        'coup': {
            targeted: true
        },
        'income': {
            targeted: false
        }
    };
    if (!(event.action in ACTION_INFO)) {
        throw new Error(`Unknown action: ${event.action}`);
    }
    if (ACTION_INFO[event.action].targeted && event.target >= playerStateCount) {
        throw new Error('Unknown player targeted by action');
    }
};

GameTracker.prototype.decodeInfluence = function (influenceCode) {
    return {
        revealed: !!(influenceCode & 0x8),
        role: this.decodeRole(influenceCode & 0x7)
    };
};

GameTracker.prototype.decodeRole = function (roleCode) {
    if (roleCode === 1) {
        return 'duke';
    }
    else if (roleCode === 2) {
        return 'captain';
    }
    else if (roleCode === 3) {
        return 'assassin';
    }
    else if (roleCode === 4) {
        return this.gameInfo.roles.indexOf('ambassador') >= 0 ? 'ambassador' : 'inquisitor';
    }
    else if (roleCode === 5) {
        return 'contessa';
    }
};

GameTracker.prototype.decodeActionEvent = function (actionCode) {
    var target;
    var action;
    switch (actionCode >> 4) {
        case 1:
            action = 'tax';
            break;
        case 8+1:
            action = 'foreign-aid';
            break;
        case 2:
            action = 'steal';
            target = actionCode & 0xf;
            break;
        case 3:
            action = 'assassinate';
            target = actionCode & 0xf;
            break;
        case 4:
            action = 'exchange';
            break;
        case 8+4:
            action = 'interrogate';
            target = actionCode & 0xf;
            break;
        case 5:
            action = 'coup';
            target = actionCode & 0xf;
            break;
        case 8+5:
            action = 'income';
            break;
    }
    var event = {
        type: GameTracker.TYPE_ACTION,
        action: action
    };
    if (target != null) {
        event.target = target;
    }
    return event;
};
