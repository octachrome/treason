A database containing around 600,000 online games of Coup recorded from http://treason.thebrown.net is available here: https://s3-eu-west-1.amazonaws.com/treason.thebrown.net/games.json.gz. It is 150 MB compressed, 400 MB when uncompressed.

The database is a JSON array, where each entry in the array is an object representing a single game. Each game object has the following fields:

    gameId          string          a unique id for the game
    gameType        string          the type of game ("original" or "inquisitors")
    playerCount     number          the number of players in the game
    playerIds       Array<string>   the unique ids of the players in the game (AI players have the id "ai")
    winner          number          the player who won the game, as an index into the players array
    playerRank      Array<number>   the ranking of the players, as indices into the players array
                                    i.e., [winner, player who came second, ..., player who lost]
    events          string          the events of the game

The events field represents the actions that the players took and their consequences. Events are encoded as a base64 string, which can be decoded into JSON objects using `game-tracker.js` in this project. There is also a script, `extract-games.js`, which will decode the events from all the games from `games.json.gz` and write them to a file called `games_full.json.gz`. This file is also available for download here: https://s3-eu-west-1.amazonaws.com/treason.thebrown.net/games_full.json.gz. Beware: this file is a lot larger, 8 GB when decompressed. I advise you to instead use `games.json.gz` and only decode the games you are interested in.

Each event object has a `type` field which determines the other fields that will be present. All the possible events are described by example below:

    {
      "type": "START_OF_TURN",  // the start of each turn begins with an event of this type
      "whoseTurn": 2,           // index of the player whose turn it is
      "playerStates": [
        {
          "cash": 2,            // how much money the player has
          "influence": [
            {
              "revealed": false,    // initially false; true once the role has been revealed to the other players
              "role": "ambassador"  // can be "duke", "captain", "assassin", "contessa", "ambassador", or "inquisitor"
            },
            {
              "revealed": false,
              "role": "assassin"
            }
          ]
        },
        // repeated for each player in the playerIds array
      ]
    }

    {
      "type": "ACTION",     // an event of this type occurs directly after the start of each turn
      "action": "steal",    // can be "foreign-aid", "steal", "assassinate", "exchange", "interrogate", "coup", or "income"
      "target": 4           // the player who is targeted (not all actions have a target)
    }

    {
      "type": "BLOCK",              // an event of this type occurs when a player attempts to block an action
      "blockingPlayer": 2,          // the player who is doing the blocking
      "blockingRole": "contessa"    // the role they claimed to block with; one of "contessa" (blocks assassination), "duke" (blocks foreign aid), "captain", "ambassador" or "inquisitor" (these three all block stealing)
    }

    {
      "type": "CHALLENGE_SUCCESS"   // can occur after an ACTION event or a BLOCK event
      "challenger": 2,              // the player who called the challenge
      "challenged": 0               // the player whose action or block was challenged
    }

    {
      "type": "CHALLENGE_FAIL"   // can occur after an ACTION event or a BLOCK event
      "challenger": 2,           // the player who called the challenge
      "challenged": 0            // the player whose action or block was challenged
    }

    {
      "type": "PLAYER_LEFT",    // records when a player leaves the game before the end (can occur at any time)
      "player": 4               // the player who left the game
    }

    {
      "type": "GAME_OVER",      // occurs once all players but one have been eliminated
      "playerStates": [...]     // same as in START_OF_TURN event
    }


Notes:

- In the `events` array, players are always identified using their numerical index into the playerIds array; never using their player id.
- The first player is random; it is not always player 0.
- Due to a bug, the player who blocked foreign aid is not always recorded. If unknown, `blockingPlayer` is set to `-1`.

I think the rules below summarise the possible sequences in which events can occur, where `*` means repeated zero or more times, `?` means may appear zero or one times, `A | B` means either A or B, and parentheses indicate where these operators are applied to sub-sequences of events.

    (
        START_OF_TURN
        PLAYER_LEFT*
        ACTION
        PLAYER_LEFT*
        (CHALLENGE_SUCCESS|CHALLENGE_FAIL)?
        PLAYER_LEFT*
        (
            BLOCK
            PLAYER_LEFT*
            (CHALLENGE_SUCCESS|CHALLENGE_FAIL)?
            PLAYER_LEFT*
        )?
    )*
    GAME_OVER
