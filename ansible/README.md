How to upgrade the server
=========================

Make sure `local_vars.yml` contains the following keys:

- `nginx_passwd`
- `active_color` (`green` or `blue`)
- `host_pattern` (see `hosts` file)

Check which deployment is active:

    ./get-active-deployment.sh

Upgrade the other one, i.e., if the above returns `green`, upgrade `blue`:

    git push origin live:live-blue
    ./run-ansible.sh --tags upgrade-treason

Test the upgraded deployment on http://coup.thebrown.net:8999, then make it active by changing the active color in `local_vars.yml` and running:

    ./run-ansible.sh --tags nginx-conf

Tell people on the old server to refresh:

    ./publish-message.sh 8999 "A new version of the game is available. Refresh your browser to continue."
