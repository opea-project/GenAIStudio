# Setup On-premise Kubernetes Cluster

## Overview

The ansible scripts used here are using kubeadm method of installing an onpremise kubernetes cluster. It also installed an onpremise harbor for the container registry to be used by the onpremise kubernetes

## Pre-requisite

- enable sshkeys on all target machines and ensure no password prompt needed for ssh connections
- update inventory.ini and var.yml accordingly

## Installation steps:

_Note: This script has only been validated on a fresh installed Ubuntu 22.04 machines._

Run below commands:
```sh
sudo apt install ansible -y
ansible-playbook -i inventory.ini onpremise-kubernetes.yml
```

To push your local docker images into the harbor container registry, run below:

```sh
docker tag <image>:<tag> <k8_master_ip>:8443/k8s/<image>:<tag>
docker push <k8_master_ip>:8443/k8s/<image>:<tag>
```
