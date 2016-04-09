'use strict';

var exec = require('child_process').exec;

var versionPromise = null;

module.exports = function (req, res) {
    if (versionPromise == null) {
        versionPromise = new Promise(function (resolve, reject) {
            exec('git describe --tags --long', {cwd: __dirname}, function (err, stdout) {
                if (err) {
                    resolve('window.version = "";');
                } else {
                    var v = stdout.replace(/[\r\n]/g, '');
                    resolve('window.version = "' + v + '";');
                }
            });
        });
    }

    versionPromise.then(function (version) {
        res.set('Content-type', 'text/javascript');
        res.send(version)
    });
};
