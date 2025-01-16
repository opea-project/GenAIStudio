# Build Image to Registry

## Overview

The ansible scripts used here are building, tag and push to the specified container registry of GenAIStudio's dockerfiles

## Pre-requisite

- Docker runtime and container registry have been setup
- Update var.yml accordingly

## Installation steps:

Run below commands:
```sh
sudo apt install ansible -y
ansible-playbook build-image-to-registry.yml
```
