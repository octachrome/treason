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
                    bytes[offset++] = playerState.cash & 255;
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
    return new Buffer(bytes);
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
    while (offset < buffer.length) {
        var first = buffer[offset++];
        var type = first >> 4;
        var event = {
            type: type
        };
        events.push(event);
        switch (type) {
            case GameTracker.TYPE_START_OF_TURN:
            case GameTracker.TYPE_GAME_OVER:
                event.whoseTurn = first & 0xf;
                event.playerStates = [];
                for (var p = 0; p < gameInfo.playerCount; p++) {
                    var cash = buffer[offset++];
                    var influence = buffer[offset++];
                    event.playerStates.push({
                        cash: cash,
                        influence: [this.decodeInfluence(influence >> 4), this.decodeInfluence(influence & 0xf)]
                    });
                }
                if (offset < buffer.length) {
                    events.push(this.decodeActionEvent(buffer[offset++]));
                }
                break;
            case GameTracker.TYPE_CHALLENGE_SUCCESS:
            case GameTracker.TYPE_CHALLENGE_FAIL:
                event.challenger = first & 0xf;
                event.challenged = buffer[offset++] & 0xf;
                break;
            case GameTracker.TYPE_BLOCK:
                event.blockingPlayer = first & 0xf;
                event.blockingRole = this.decodeRole(buffer[offset++]);
                break;
            case GameTracker.TYPE_PLAYER_LEFT:
                event.player = first & 0xf;
                break;
        }
    }
    return events;
};

GameTracker.prototype.decodeInfluence = function (influenceCode) {
    return {
        revealed: !!(influenceCode & 8),
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
