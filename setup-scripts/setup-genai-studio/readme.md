### Overview

The genai-studio playbook script will:

1. Deploy a persistent volume for prometheus and a customized monitoring stack based on prometheus-community/kube-prometheus-stack (which contains both Prometheus and Grafana) in the monitoring namespace.

2. Deploy the studio-backend, studio-frontend and also a studio-nginx in the studio namespace.


### Pre-requisite

- Existing kubernetes cluster available. If not, refer to setup-onpremise-kubernetes/readme.md
- Update var.yml accordingly

### Installation steps:

Run below commands:
```sh
sudo apt install ansible
ansible-galaxy collection install kubernetes.core
ansible-playbook genai-studio-playbook.yml
```

### Quick health test

Run below commands to do a /health test:
```sh
curl http://localhost:30007/studio-backend/health
```