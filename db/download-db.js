// Downloads the CouchDB database into gzipped json files.

const fs = require('fs');
const zlib = require('zlib');
const cradle = require('cradle');
const pr = require('promise-ring');
const cliProgress = require('cli-progress');

const connection = new cradle.Connection('http://localhost', 5986, {auth: {username: 'admin', password: 'password'}});
const treasonDb = pr.wrapAll(connection.database('treason_db'));

downloadDB().catch(error => {
    console.error(error);
});

function getIndex() {
    return Promise.resolve().then(() => {
        if (fs.existsSync('index.json.gz')) {
            console.log('Loading index');
            return JSON.parse(zlib.gunzipSync(fs.readFileSync('index.json.gz')));
        }
        else {
            console.log('Fetching index');
            return treasonDb.all().then(results => {
                const stream = zlib.createGzip();
                stream.pipe(fs.createWriteStream('index.json.gz'));
                stream.write(JSON.stringify(results));
                stream.end();
                return results;
            });

        }
    });
}

async function downloadDB() {
    const index = await getIndex();
    const gamesStream = zlib.createGzip();
    gamesStream.pipe(fs.createWriteStream('games.json.gz'));
    gamesStream.write('[\n');
    const usersStream = zlib.createGzip();
    usersStream.pipe(fs.createWriteStream('users.json.gz'));
    usersStream.write('[\n');

    console.log('Processing docs');
    const bar = new cliProgress.SingleBar();
    bar.start(index.length);
    for (let doc of index) {
        if (doc.id) {
            result = await treasonDb.get(doc.id);
            if (result.type == 'game') {
                gamesStream.write(JSON.stringify(result) + ',\n');
            }
            else {
                usersStream.write(JSON.stringify(result) + ',\n');
            }
        }
        bar.increment();
    }
    bar.stop();
    usersStream.end('null]');
    gamesStream.end('null]');
}
