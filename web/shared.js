(function () {
    'use strict';

    var actions = {
        'coup': {
            cost: 7,
            targeted: true
        },
        'income': {
            cost: 0,
            gain: 1
        },
        'foreign-aid': {
            cost: 0,
            gain: 2,
            blockedBy: ['duke']
        },
        'tax': {
            cost: 0,
            gain: 3,
            roles: 'duke'
        },
        'assassinate': {
            cost: 3,
            roles: 'assassin',
            targeted: true,
            blockedBy: ['contessa']
        },
        'steal': {
            cost: 0,
            roles: 'captain',
            targeted: true,
            blockedBy: ['captain', 'ambassador', 'inquisitor']
        },
        'exchange': {
            cost: 0,
            roles: ['ambassador', 'inquisitor']
        },
        'interrogate': {
            cost: 0,
            roles: 'inquisitor',
            targeted: true
        }
    };

    var states = {
        WAITING_FOR_PLAYERS: 'waiting-for-players',
        START_OF_TURN: 'start-of-turn',
        ACTION_RESPONSE: 'action-response',
        FINAL_ACTION_RESPONSE: 'final-action-response',
        BLOCK_RESPONSE: 'block-response',
        REVEAL_INFLUENCE: 'reveal-influence',
        EXCHANGE: 'exchange',
        INTERROGATE: 'interrogate'
    };

    if (typeof window != 'undefined') {
        window.actions = actions;
        window.states = states;
    } else {
        module.exports = {
            actions: actions,
            states: states
        };
    }
})();
