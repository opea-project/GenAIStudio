### Overview

The ansible scripts used here are using kubeadm method of installing an onpremise kubernetes cluster. It also installed an onpremise harbor for the container registry to be used by the onpremise kubernetes

### Pre-requisite

- enable sshkeys on all target machines and ensure no password prompt needed for ssh connections
- update inventory.ini and var.yml accordingly

### Installation steps:

Run below commands:
```sh
sudo apt install ansible
ansible-galaxy collection install kubernetes.core
ansible-playbook -i inventory.ini kubernetes-cluster.yml
```

To push your local docker images into the harbor container registry, run below:

```sh
docker tag <image>:<tag> <k8_master_ip>:8443/k8s/<image>:<tag>
docker push <k8_master_ip>:8443/k8s/<image>:<tag>
```