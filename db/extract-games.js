// Decodes the events from games downloaded from CouchDB.

const fs = require('fs');
const zlib = require('zlib');
const cliProgress = require('cli-progress');
const GameTracker = require('../game-tracker');

const tracker = new GameTracker();

const filename = process.argv.length >= 3 ? process.argv[2] : 'games.json.gz';
console.log(`Reading ${filename}`);
const games = JSON.parse(zlib.gunzipSync(fs.readFileSync(filename)));
const numToExtract = process.argv.length >= 4 ? parseInt(process.argv[3]) : games.length;

console.log('Processing games');
const stream = zlib.createGzip();
stream.pipe(fs.createWriteStream('games_full.json.gz'));
stream.write('[\n');
const bar = new cliProgress.SingleBar();
bar.start(numToExtract);
let i = 0;
let skipped = 0;
processGames();

function processGames() {
    while (i < numToExtract) {
        const game = games[i++];
        if (!game || !game.events) {
            skipped++;
            continue;
        }
        let processed;
        try {
            processed = processGame(game);
        } catch (e) {
            console.log(e.stack);
            if (e.message != 'Player overflow') {
                fs.writeFileSync('game.json', JSON.stringify(game));
                break;
            }
            skipped++;
        }
        bar.increment();
        if (processed) {
            const cont = stream.write(JSON.stringify(processed) + ',\n');
            if (!cont) {
                stream.once('drain', processGames);
                return;
            }
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

    let events = tracker.unpack(Buffer.from(data.events, 'base64'), info);
    tracker.removeObservers(events, data.players);
    const {playerIds, winners} = tracker.identifyPlayers(events, data);

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
