'use strict';

var hands = {
    'assassin-duke': {
        earn: 3,
        kill: 3
    },
    'assassin-captain': {
        earn: 1,
        steal: 2,
        kill: 3
    },
    'duke-captain': {
        earn: 3,
        steal: 2,
        kill: 7
    },
    'assassin-foreignaid': {
        earn: 2,
        kill: 3
    },
    'assassin': {
        earn: 1,
        kill: 3
    },
    'duke': {
        earn: 3,
        kill: 7
    },
    'captain': {
        earn: 1,
        steal: 2,
        kill: 7
    },
    'foreignaid': {
        earn: 2,
        kill: 7
    },
    'foreignaid-captain': {
        earn: 2,
        steal: 2,
        kill: 7
    },
    'income': {
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
    if (firstName.indexOf('foreignaid') >= 0 && secondName.indexOf('duke') >= 0) {
        // can't draw foreign aid against duke
        first = {
            earn: 1,
            steal: first.steal,
            kill: first.kill
        };
    }
    if (firstName.indexOf('duke') >= 0 && secondName.indexOf('foreignaid') >= 0) {
        // can't draw foreign aid against duke
        second = {
            earn: 1,
            steal: second.steal,
            kill: second.kill
        };
    }
    if (first.steal && second.steal) {
        // captain vs captain - neither can steal
        first = {
            earn: first.earn,
            steal: null,
            kill: first.kill
        };
        second = {
            earn: second.earn,
            steal: null,
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
        if (us.steal) {
            if (cashes[themIdx] == 0) {
                cashes[usIdx] += us.earn;
                debug(us.name + ' earning ' + us.earn);
            } else if (cashes[themIdx] >= us.steal) {
                debug(us.name + ' stealing ' + us.steal);
                cashes[usIdx] += us.steal;
                cashes[themIdx] -= us.steal;
            } else {
                debug(us.name + ' stealing ' + cashes[themIdx]);
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
