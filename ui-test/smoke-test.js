// To run this test:
// - Run the treason server on localhost:8080.
// - Download Chrome webdriver and put it in the path.
// - Download Selenium standalone server and start it.
// - From the project root folder, run ./node_modules/.bin/mocha ui-test

var webdriverio = require('webdriverio');
var options = {
    desiredCapabilities: {
        browserName: 'chrome'
    }
};

describe('Smoke test', function () {
    this.timeout(30000);

    var client;

    beforeEach(function () {
        client = webdriverio
            .remote(options)
            .init()
            .url('http://localhost:8080');

        return client;
    });

    afterEach(function () {
        return client.end();
    });

    it('should login and start a game', function () {
        // Log in.
        return client
            .waitForVisible('input.name-input')
            .setValue('input.name-input', 'TestPlayer')
            .click('button*=Join public game')

            // Add five other players so the game begins.
            .waitForVisible('button*=Add AI')
            .click('button*=Add AI')
            .click('button*=Add AI')
            .click('button*=Add AI')
            .click('button*=Add AI')
            .click('button*=Add AI')

            // The game should begin (it's your turn, or someone else moves and you get to allow it).
            .waitUntil(function () {
                return Promise.all([
                    this.isVisible('button*=Allow'),
                    this.isVisible('button*=tax'),
                ]).then(function (results) {
                    return results[0] || results[1];
                });
            }, 10000);
    });
});
