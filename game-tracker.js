function GameTracker() {
    this.events = [];
}

GameTracker.TYPE_START_OF_TURN = 1;
GameTracker.TYPE_ACTION = 2;
GameTracker.TYPE_CHALLENGE_SUCCESS = 3;
GameTracker.TYPE_CHALLENGE_FAIL = 4;
GameTracker.TYPE_BLOCK = 5;
GameTracker.TYPE_ACTION_RESOLVED = 6;

GameTracker.prototype.startOfTurn = function (turnState) {
    this.events.push({
        type: GameTracker.TYPE_START_OF_TURN,
        whoseTurn: turnState.playerIdx,
        playerStates: turnState.players.map(function (playerState) {
            return {
                cash: playerState.cash,
                influence: playerStates.influence.map(function (influence) {
                    return {
                        role: influence.role,
                        revealed: influence.revealed
                    };
                })
            };
        })
    });
};

GameTracker.action = function (action, target) {
    this.events.push({
        type: GameTracker.TYPE_ACTION,
        action: action,
        target: target
    });
};

GameTracker.challenge = function (challenger, challenged, success) {
    this.events.push({
        type: success ? GameTracker.TYPE_CHALLENGE_SUCCESS : GameTracker.TYPE_CHALLENGE_FAIL,
        challenger: challenger,
        challenged: challenged
    });
};

GameTracker.block = function (blockingPlayer, blockingRole) {
    this.events.push({
        type: GameTracker.TYPE_BLOCK,
        blockingPlayer: blockingPlayer,
        blockingRole: blockingRole
    });
};

GameTracker.actionResolved = function (roleParams) {
    this.events.push({
        type: GameTracker.TYPE_ACTION_RESOLVED,
        roleParams: roleParams
    });
};
