'use strict';

var hands = {
    'assassino-duque': {
        earn: 3,
        kill: 3
    },
    'assassino-capitão': {
        earn: 1,
        extorquir: 2,
        kill: 3
    },
    'duque-capitão': {
        earn: 3,
        extorquir: 2,
        kill: 7
    },
    'assassino-foreignaid': {
        earn: 2,
        kill: 3
    },
    'assassino': {
        earn: 1,
        kill: 3
    },
    'duque': {
        earn: 3,
        kill: 7
    },
    'capitão': {
        earn: 1,
        extorquir: 2,
        kill: 7
    },
    'foreignaid': {
        earn: 2,
        kill: 7
    },
    'foreignaid-capitão': {
        earn: 2,
        extorquir: 2,
        kill: 7
    },
    'renda': {
        earn: 1,
        kill: 7
    }
};

function playAll() {
    for (var firstName in hands) {
        for (var secondName in hands) {
            if (firstName != secondName) {
                play(firstName, secondName, 0, true);
                play(secondName, firstName, 0, true);
            }
        }
    }
}

function sort() {
    var names = Object.keys(hands);
    names.sort(function (a, b) {
        if (a == b) {
            return 0;
        }
        // Ignore the advantage of playing first
        return play(a, b, 0) - play(b, a, 0);
    });

    console.log(names);

    for (var i = 0; i < names.length; i++) {
        for (var j = i + 1; j < names.length; j++) {
            var firstName = names[i];
            var secondName = names[j];
            var score = play(firstName, secondName) - play(secondName, firstName);
            if (score > 0) {
                console.log('circular?');
            }
        }
    }
}

sort();
// playAll();

function play(firstName, secondName, cash, log) {
    var start = new Date().getTime();
    var first = hands[firstName];
    var second = hands[secondName];
    if (firstName.indexOf('foreignaid') >= 0 && secondName.indexOf('duque') >= 0) {
        // can't draw ajuda externa against duque
        first = {
            earn: 1,
            extorquir: first.extorquir,
            kill: first.kill
        };
    }
    if (firstName.indexOf('duque') >= 0 && secondName.indexOf('foreignaid') >= 0) {
        // can't draw ajuda externa against duque
        second = {
            earn: 1,
            extorquir: second.extorquir,
            kill: second.kill
        };
    }
    if (first.extorquir && second.extorquir) {
        // capitão vs capitão - neither can extorquir
        first = {
            earn: first.earn,
            extorquir: null,
            kill: first.kill
        };
        second = {
            earn: second.earn,
            extorquir: null,
            kill: second.kill
        };
    }

    first.name = firstName;
    second.name = secondName;

    log && console.log(firstName + ' vs ' + secondName + ' with ' + cash + ' cash');
    var pair = [first, second];
    var cashes = [cash, cash];
    var turn = 0;
    while (true) {
        var usIdx = turn % 2;
        var themIdx = (turn + 1) % 2;
        var us = pair[usIdx];
        var them = pair[themIdx];
        if (cashes[usIdx] >= us.kill) {
            debug(us.name + ' killing');
            cashes[usIdx] -= us.kill;
            break;
        }
        if (us.extorquir) {
            if (cashes[themIdx] == 0) {
                cashes[usIdx] += us.earn;
                debug(us.name + ' earning ' + us.earn);
            } else if (cashes[themIdx] >= us.extorquir) {
                debug(us.name + ' extorquiring ' + us.extorquir);
                cashes[usIdx] += us.extorquir;
                cashes[themIdx] -= us.extorquir;
            } else {
                debug(us.name + ' extorquiring ' + cashes[themIdx]);
                cashes[usIdx] += cashes[themIdx];
                cashes[themIdx] = 0;
            }
        } else {
            debug(us.name + ' earning ' + us.earn);
            cashes[usIdx] += us.earn;
        }
        turn++;
        if (turn > 20) {
            log && console.log('draw');
            return 0;
        }
    }

    log && console.log(us.name + ' kills first (player ' + (turn % 2) + ')');
    log && console.log('first player cash: ' + cashes[0]);
    log && console.log('second player cash: ' + cashes[1]);
    log && console.log(new Date().getTime() - start + 'ms');
    log && console.log();
    return (turn % 2) ? -1 : 1;
}

function debug(msg) {
    // console.log(msg);
}
