'use strict';

var exec = require('child_process').exec;

const server = require('path').basename(__dirname);

var contentPromise = null;

// This is not used in production. Instead, the post-receive hook creates a static version.js.
module.exports = function (req, res) {
    let content = `window.server = "${server}";`
    if (contentPromise == null) {
        contentPromise = new Promise(function (resolve, reject) {
            exec('git describe --tags --long', {cwd: __dirname}, function (err, stdout) {
                if (err) {
                    content += 'window.version = "";';
                } else {
                    var v = stdout.replace(/[\r\n]/g, '');
                    content += `window.version = "${v}";`;
                }
                resolve(content);
            });
        });
    }

    contentPromise.then(function (content) {
        res.set('Content-type', 'text/javascript');
        res.send(content)
    });
};
