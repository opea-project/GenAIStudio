# Setup GenAI Studio

## Overview

The genai-studio playbook script will:

1. Install MySQL server on the local machine and configure the studio db user to be secured with SSL encryption.
 
2. Deploy a customized monitoring stack based on prometheus-community/kube-prometheus-stack (which contains both Prometheus and Grafana) in the monitoring namespace with a local-path-provisioner in local-path-storage namespace, for dynamic Persistent Volumes (PVs) provisioning.

3. Deploy tracing namespace containing opentelemetry collector with clikchouse database got llm tracer capability.
 
4. Deploy Keycloak, studio-backend, studio-frontend, and studio-nginx within the studio namespace. Also include local-path-provisioner for sandbox's dynamic Persistent Volumes (PVs) provisioning in case not running deploy-monitoring playbook. A self-signed certificate will be generated for Keycloak usage and stored as secrets within the studio namespace. Additionally, the client SSL certificates generated during the MySQL server installation process will also be stored as secrets in the studio namespace to ensure encrypted communication to the MySQL database.

## Pre-requisite

- Disclaimer: The Ansible script has been tested on a fresh machine without any pre-existing MySQL server installation, studio, or monitoring deployment. Any other environment might require modifications to the Ansible playbooks accordingly.
- Existing kubernetes cluster available. If not, please install by following the [Kubernetes official setup guide](https://kubernetes.io/docs/setup/). Alternatively, you can try out our [setup onpremise kubernetes script](../setup-onpremise-kubernetes/readme.md).
- Update vars.yml accordingly. By default, if you have a locally installed MySQL server, you will need to update the variable `mysql_host` in vars.yml with the external public IP of your localhost. 

## Installation steps:

Run below commands:
```sh
sudo apt install ansible -y
ansible-playbook genai-studio.yml
```

## Quick health test

Run below commands to do a /health test:
```sh
curl http://localhost:30007/studio-backend/health
```
