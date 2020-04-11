var crypto = require('crypto');

module.exports = {
    // Called when the server initially starts
    init: () => Promise.resolve(),
    // Called when a new player logs in for the first time or an existing player changes their name
    register: id => id || Promise.resolve(crypto.randomBytes(16).toString('hex')),
    // Called at the start of a game
    constructGameStats: () => {
        return {
            players: 0,
            humanPlayers: 0,
            type: 'game',
            playerRank: [],
            playerDisconnect: [],
            gameStarted: new Date().getTime(),
            gameFinished: 0,
            gameType: 'original'
        };
    },
    // Called when a game ends normally (with a winner)
    recordGameData: () => Promise.resolve(),
    // Called when a player leaves in the middle of a game
    recordPlayerDisconnect: () => Promise.resolve(),
    // Returns the rankings, either the top N, or the N around a player's position
    getPlayerRankings: () => Promise.resolve([])
};