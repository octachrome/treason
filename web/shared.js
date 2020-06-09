(function () {
    'use strict';

    var actions = {
        'golpe': {
            cost: 7,
            targeted: true
        },
        'renda': {
            cost: 0,
            gain: 1
        },
        'ajuda-externa': {
            cost: 0,
            gain: 2,
            blockedBy: ['duque']
        },
        'taxa': {
            cost: 0,
            gain: 3,
            roles: 'duque'
        },
        'assassinar': {
            cost: 3,
            roles: 'assassino',
            targeted: true,
            blockedBy: ['condessa']
        },
        'extorquir': {
            cost: 0,
            roles: 'capitão',
            targeted: true,
            blockedBy: ['capitão', 'embaixador', 'inquisidor']
        },
        'trocar': {
            cost: 0,
            roles: ['embaixador', 'inquisidor']
        },
        'interrogar': {
            cost: 0,
            roles: 'inquisidor',
            targeted: true
        },
        'trocar-religiao': {
            gameType: 'reforma',
            cost: 1
        },
        'converter': {
            gameType: 'reforma',
            cost: 2,
            targeted: true
        },
        'desviar': {
            gameType: 'reforma',
            cost: 0,
            roles: '!duque'
        }
    };

    var states = {
        WAITING_FOR_PLAYERS: 'waiting-for-players',
        START_OF_TURN: 'start-of-turn',
        ACTION_RESPONSE: 'action-response',
        FINAL_ACTION_RESPONSE: 'final-action-response',
        BLOCK_RESPONSE: 'block-response',
        REVEAL_INFLUENCE: 'reveal-influence',
        trocar: 'trocar',
        interrogar: 'interrogar'
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
