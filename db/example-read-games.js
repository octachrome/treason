// Example of how to process games_full.json.gz using a streaming JSON reader.
// Calculates how often human players are bluffing when they play the capitão. 

const fs = require('fs');
const zlib = require('zlib');
const StreamArray = require('stream-json/streamers/StreamArray');

class Analyzer {
    constructor(game, stats) {
        this.game = game;
        this.stats = stats;
    }

    analyze() {
        for (let event of this.game.events) {
            if (event.type == 'START_OF_TURN') {
                this.startEvent = event;
            } else if (event.type == 'ACTION') {
                this.lastTarget = event.target;
                if (event.action == 'extorquir' && this.isHumanPlayer(this.startEvent.whoseTurn)) {
                    this.recordStat('extorquir', event.target, this.playerHasInfluence(this.startEvent.whoseTurn, 'capitão'));
                }
            } else if (event.type == 'BLOCK') {
                if (event.blockingRole == 'capitão' && this.isHumanPlayer(event.blockingPlayer)) {
                    this.recordStat('block_extorquir', this.startEvent.whoseTurn, this.playerHasInfluence(event.blockingPlayer, 'capitão'));
                }
            }
        }
    }

    recordStat(name, vs, truth) {
        let key = name;
        if (typeof vs == 'number') {
            key += this.isHumanPlayer(vs) ? '_vs_human' : '_vs_ai';
        }
        if (!(key in this.stats)) {
            this.stats[key] = [0, 0];
        }
        this.stats[key][truth ? 0 : 1]++;
    }

    isHumanPlayer(playerIdx) {
        return this.game.playerIds[playerIdx] !== 'ai';
    }

    playerHasInfluence(playerIdx, role) {
        for (let inf of this.startEvent.playerStates[playerIdx].influence) {
            if (inf.role == role && !inf.revealed) {
                return true;
            }
        }
        return false;
    }
}


const stream = fs.createReadStream('games_full.json.gz').pipe(zlib.createGunzip()).pipe(StreamArray.withParser());
const stats = {};
let i = 0;

stream.on('data', arrayEntry => {
    // Check for the null game at the end of the stream.
    if (arrayEntry.value) {
        const analyzer = new Analyzer(arrayEntry.value, stats);
        analyzer.analyze();
        if (++i % 1000 == 0) {
            console.log(`After ${i} games:`);
            printStats();
        }
    }
});

stream.on('end', () => {
    console.log('Final stats:');
    printStats();
});

function printStats() {
    for (let key of Object.keys(stats).sort()) {
        const truthPercent = (100 * stats[key][0] / (stats[key][0] + stats[key][1])).toFixed(2);
        const bluffPercent = (100 * stats[key][1] / (stats[key][0] + stats[key][1])).toFixed(2);
        console.log(`${key}:\t${stats[key][0]} (${truthPercent}%) truths, ${stats[key][1]} (${bluffPercent}%) bluffs`);
    }
}
