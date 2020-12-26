#!/bin/bash
set -e
NAME=treason-test
DOCKER="sudo docker"
cp ~/.ssh/id_rsa.pub treason-test-docker/
$DOCKER build -t docker-test treason-test-docker
$DOCKER run --rm --privileged -v /sys/fs/cgroup:/sys/fs/cgroup:ro -d -p 1122:22 -p 1180:80 -p 1199:8999 -p 1443:443 --name $NAME docker-test
# ssh root@localhost -p 1122
