(function () {
    'use strict';

    var actions = {
        'coup': {
            cost: 7,
            targetted: true
        },
        'income': {
            cost: -1
        },
        'foreign-aid': {
            cost: -2,
            blockedBy: ['duke']
        },
        'tax': {
            cost: -3,
            role: 'duke'
        },
        'assassinate': {
            cost: 3,
            role: 'assassin',
            targetted: true,
            blockedBy: ['contessa']
        },
        'steal': {
            cost: 0,
            role: 'captain',
            targetted: true,
            blockedBy: ['captain', 'ambassador']
        },
        'exchange': {
            cost: 0,
            role: 'ambassador'
        }
    };

    if (typeof window != 'undefined') {
        window.actions = actions;
    } else {
        module.exports = {
            actions: actions
        };
    }
})();
