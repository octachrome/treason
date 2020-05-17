// Decodes the events from games downloaded from CouchDB.

const fs = require('fs');
const zlib = require('zlib');
const cliProgress = require('cli-progress');
const GameTracker = require('../game-tracker');

const tracker = new GameTracker();

const eventTypes = {};
Object.keys(GameTracker).forEach(key => {
    if (/^TYPE_/.test(key)) {
        eventTypes[GameTracker[key]] = key.substr('TYPE_'.length);
    }
});

const filename = process.argv.length >= 3 ? process.argv[2] : 'games.json.gz';
console.log(`Reading ${filename}`);
const games = JSON.parse(zlib.gunzipSync(fs.readFileSync(filename)));

console.log('Processing games');
const stream = zlib.createGzip();
stream.pipe(fs.createWriteStream('games_full.json.gz'));
stream.write('[\n');
const bar = new cliProgress.SingleBar();
bar.start(games.length);
let i = 0;
let skipped = 0;
processGames();

function processGames() {
    while (i < games.length) {
        const game = games[i++];
        if (!game || !game.events) {
            skipped++;
            continue;
        }
        const processed = processGame(game);
        bar.increment();
        if (!processed) {
            skipped++;
            continue;
        }
        const cont = stream.write(JSON.stringify(processed) + ',\n');
        if (!cont) {
            stream.once('drain', processGames);
            return;
        }
    }
    stream.end('null]');
    bar.stop();
    console.log(`Processed ${i}, skipped ${skipped}`);
}

function processGame(data) {
    const info = {
        roles: ['duke', 'captain', 'assassin', 'contessa', data.gameType === 'original' ? 'ambassador' : 'inquisitor'],
        playerCount: data.players,
    };

    const events = tracker.unpack(Buffer.from(data.events, 'base64'), info);

    const losers = [];

    events.forEach(event => {
        event.type = eventTypes[event.type]; 
        if (event.playerStates) {
            event.playerStates.forEach((state, idx) => {
                if (state.influence.every(influence => influence.revealed)) {
                    if (losers.indexOf(idx) === -1) {
                        losers.push(idx);
                    }
                }
            });
        }
    });

    if (losers.length !== data.players - 1) {
        return null;
    }

    // Add the winning player index.
    for (let i = 0; i < data.players; i++) {
        if (losers.indexOf(i) === -1) {
            losers.push(i);
            break;
        }
    }
    if (data.players !== losers.length) {
        return null;
    }
    const winners = losers.reverse();
    const playerIds = [];
    data.playerRank.forEach((id, idx) => {
        playerIds[winners[idx]] = id;
    });
    return {
        gameId: data._id,
        gameType: data.gameType,
        playerCount: data.players,
        playerIds: playerIds,
        winner: winners[0],
        playerRank: winners,
        events: events
    };
}
