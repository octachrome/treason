How to upgrade the server
=========================

Check which deployment is active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/get-active-deployment

Upgrade the other one, i.e., if the above returns `green`, upgrade `blue`:

    git push vpscheap live:live-blue

Test the upgraded deployment on http://golpe.thebrown.net:8999, then make it active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/set-active-deployment blue

Tell people on the old server to refresh:

    curl http://golpe.thebrown.net:8999/alert -d 'msg=A new version of the game is available. Refresh your browser to continue.'
