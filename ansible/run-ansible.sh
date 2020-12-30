#!/bin/bash
set -e
if [ ! -d env ]; then
    virtualenv env
    . env/bin/activate
    pip install ansible
    ansible-galaxy install -r requirements.yml
else
    . env/bin/activate
fi
ansible-playbook -i ./hosts server.yml $*
