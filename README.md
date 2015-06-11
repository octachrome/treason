Treason Coup
------------

A clone of the card game Coup written in Node.js.

To run the server for a multiplayer game:

    npm install
    node server.js [--debug]

Then open http://localhost:8080 in two browser windows.

AI
--

There is a template AI player in `ai-player.js`. To play against it:

    node server.js --ai [--debug]

Then open http://localhost:8080 in your browser.

To implement a better AI, edit `ai-player.js` and change the `onStateChange` method to respond to the current game state.

The game state object:

    {
        stateId: 1,         // a token that is passed back to the server when sending a command
        players: [
            {
                name: "",   // The name of the player
                cash: 2,    // The amount of money owned by the player
                influence: [
                    {
                        role: "unknown",    // The player's role, if known
                        revealed: false     // Whether the influence has been revealed
                    },
                    {
                        ...
                    }
                ]
            },
            {
                ...
            }
        ],
        playerIdx: 0                // The index of your player
        numPlayers: 2               // The number of players in the game
        state: {
            playerIdx: 0,           // The index of the player whose turn it is
            name: "",               // The name of the current game state
            action: "",             // The action which is being attempted in the current turn, or null
            target: 1,              // The index of the player who is targetted by the current action, or null
            role: "",               // The role being used to block the current action, or null
            exchangeOptions: [],    // When exchanging, the roles you can choose from
        }
    }

In state `waiting-for-players`, the game has not yet started.

In state `start-of-turn`, the player whose turn it is may play an action using the command `play-action`.

In state `action-response`, any player may challenge the action (held in the `action` field) using the `challenge` command. Actions which can be blocked by another player can be blocked using the `block` command. Players who do not which to challenge or block should send the `allow` command.

In state `block-response`, the player in the `target` field is attempting to block the action using the role in the `role` field. Any player may challenge the block using the `challenge` command. Players who do not which to challenge should send the `allow` command.

In state `reveal-influence`, the player in the `target` field must reveal an influence using the `reveal` command. This occurs after a coup, a successful assassination, or a challenge.

The `exchange` state occurs after playing the exchange action; the player whose turn it is must choose which of their cards to exchange.

In state `game-won`, the player in the `state.playerIdx` field has won the game.

Commands sent to the server look like this:

    {
        command: "",    // The name of the command: play-action, block, challenge, allow, reveal, exchange
        action: "",     // For the play-action command, the action to play
        target: 0,      // When playing an action which targets another player, the index of the player to target
        role: "",       // For the block and reveal commands, the role to block with or reveal
        roles: [""]     // For the exchange command, the role(s) you wish to keep
        stateId: 1      // Must match the stateId from the latest game state
    }
