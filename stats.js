var cradle = require('cradle');
var pr = require('promise-ring');

var connection = new cradle.Connection();
var actions = pr.wrapAll(connection.database('treason_actions'));
var responses = pr.wrapAll(connection.database('treason_responses'));

var ready = Promise.all([
    actions.exists().then(function (exists) {
        if (!exists) {
            return actions.create();
        }
    }),
    responses.exists().then(function (exists) {
        if (!exists) {
            return responses.create();
        }
    })
]);

ready.catch(function (err) {
    console.err('Stats failed to initialize:');
    console.err(err);
});

module.exports = {
    action: function (action) {
        return ready.then(function () {
            return actions.save(action);
        });
    },
    response: function (response) {
        return ready.then(function () {
            return responses.save(response);
        });
    }
};
