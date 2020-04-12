How to upgrade the server
=========================

Check which deployment is active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/get-active-deployment

Upgrade the other one, i.e., if the above returns `green`, upgrade `blue`:

    git push vpscheap live:live-blue

Test the upgraded deployment, then make it active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/set-active-deployment blue
