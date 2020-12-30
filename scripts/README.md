How to upgrade the server
=========================

This information is out of date. See `../ansible/README.md` instead.


Old upgrade process
-------------------

Check which deployment is active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/get-active-deployment

Upgrade the other one, i.e., if the above returns `green`, upgrade `blue`:

    git push vpscheap live:live-blue

Test the upgraded deployment on http://coup.thebrown.net:8999, then make it active:

    ssh treason@vpscheap /home/treason/deploy-blue/scripts/set-active-deployment blue

Tell people on the old server to refresh:

    curl http://coup.thebrown.net:8999/alert -d 'msg=A new version of the game is available. Refresh your browser to continue.'
