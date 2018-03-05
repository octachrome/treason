const fs = require('fs');
const zlib = require('zlib');
const cradle = require('cradle');
const pr = require('promise-ring');
const GameTracker = require('./game-tracker');

const dbname = 'treason_backup_20180303';
const connection = new cradle.Connection();
const treasonDb = pr.wrapAll(connection.database(dbname));
const tracker = new GameTracker();

const eventTypes = {};
Object.keys(GameTracker).forEach(key => {
    if (/^TYPE_/.test(key)) {
        eventTypes[GameTracker[key]] = key.substr('TYPE_'.length);
    }
});

if (process.argv.length < 3) {
    return Promise.resolve().then(() => {
        // return treasonDb.save('_design/extract', {
        //     with_events: {
        //         map: function (doc) {
        //             if (doc.type === 'game' && doc.events) {
        //                 emit(doc._id, doc);
        //             }
        //         }
        //     }
        // });
    }).then(() => treasonDb.view('extract/with_events')).then(results => {
        fs.writeFileSync('raw.json', JSON.stringify(results));
    }).catch(err => console.error(err));
}
else {
    const results = JSON.parse(fs.readFileSync(process.argv[2]));
    const stream = zlib.createGzip();
    stream.pipe(fs.createWriteStream('games.json.gz'));
    stream.write('[\n');
    let i = 0;

    function processResults() {
        while (i < results.length) {
            const result = results[i++];
            const processed = processResult(result);
            if (!processed) continue;
            const cont = stream.write(JSON.stringify(processed, null, 2) + ',\n');
            if (i % 1000 === 0) {
                console.log(`Processed ${i}`);
            }
            if (!cont) {
                stream.once('drain', processResults);
                return;
            }
        }
        stream.end(']');
        console.log(`Processed ${i}`);
    }

    processResults();
}

function processResult(result) {
    const data = result.value;

    const info = {
        roles: ['duke', 'captain', 'assassin', 'contessa', data.gameType === 'original' ? 'ambassador' : 'inquisitor'],
        playerCount: data.players,
    };

    const events = tracker.unpack(new Buffer(data.events, 'base64'), info);

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
        throw new Error('could not identify winner');
    }
    const winners = losers.reverse();
    const playerIds = [];
    data.playerRank.forEach((id, idx) => {
        playerIds[winners[idx]] = id;
    });
    return {
        gameId: result.id,
        gameType: data.gameType,
        playerCount: data.players,
        playerIds: playerIds,
        winner: winners[0],
        playerRank: winners,
        events: events
    };
}
