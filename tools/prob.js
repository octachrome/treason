function shuffle(array) {
    var shuffled = [];
    while (array.length) {
        var i = Math.floor(Math.random() * array.length);
        var e = array.splice(i, 1);
        shuffled.push(e[0]);
    }
    return shuffled;
}

function buildDeck() {
    var deck = [];
    for (var i = 0; i < 3; i++) {
        deck = deck.concat(['duque', 'capitão', 'embaixador', 'assassino', 'condessa']);
    }
    return shuffle(deck);
}

var counts = [];
var totals = [];
var players = 4;
for (var i = 0; i < 100000; i++) {
    var cards = [];
    var deck = buildDeck();
    for (var t = 0; t < 2; t++) {
        for (var p = 0; p < players; p++) {
            counts[p] = counts[p] || 0;
            totals[p] = totals[p] || 0;
            cards[p] = cards[p] || [];
            cards[p].push(deck.pop());
        }
    }
    var ours = cards[0];
    var theirs = cards[1];
    if ((ours.indexOf('capitão') >= 0)) {
        totals[0]++;
        if (theirs.indexOf('capitão') < 0 && theirs.indexOf('embaixador') < 0) {
            counts[0]++;
        }
    }

/*    for (var p = 1; p < players; p++) {
        if (cards[p][0] == 'duque' && cards[p][1] == 'duque') {
            counts[p]++;
        }
    }
*/
}
console.log(counts); // 37%
console.log(totals);
console.log(counts[0] / totals[0]);

// In 100 games, 36 games I have duque, 64 games I do not
// In the 36, I play duque in all of them
// In the 64, I play duque in 50%: 32 of them
// I play duque in 68 games total
// Of those 68 games, I have duque in 36 of them
// I am telling the truth 53% of the time


// In 100 games, 34 games I have exactly 1 duque
// In 10 games of those 34, the opponent has at least one duque
// In 24 games, the opponent does not have a duque
// Of those 24, assume they claim duque 50% of the time, 12 games
// So, I will have a duque and the opponent will claim duque in 22 games
// Of which 12 will be a bluff and 10 will be the truth
