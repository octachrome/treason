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
            role: 'duke'
        },
        'assassinate': {
            cost: 3,
            role: 'assassin',
            targeted: true,
            blockedBy: ['contessa']
        },
        'steal': {
            cost: 0,
            role: 'captain',
            targeted: true,
            blockedBy: ['captain', 'ambassador']
        },
        'exchange': {
            cost: 0,
            role: 'ambassador'
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
        GAME_WON: 'game-won'
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
