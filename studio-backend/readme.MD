## Docker Build Instructions
To build the docker image, run below command:
```sh
docker build -t studio-backend:latest -f Dockerfile .
```

To test image on docker runtime, run below commands:
```sh
docker run -d --name studio-backend -p 5001:5000 studio-backend:latest
curl http://localhost:5001/studio-backend/health
```

## Kubernetes Deployment Instructions
Pre-requisite: Ensure the built image is tagged and pushed to your preferred private registry which your kubernetes can access to. 

In order to deploy on kubernetes, modify the manifest.yaml to point to your private registry image and run below commands:
```sh
kubectl create ns studio
kubectl apply -f manifest.yaml -n studio
```

Port forward the svc and run curl test:
```sh
kubectl port-forward -n studio svc/studio-backend-service 5002:5000
curl http://localhost:5002/studio-backend/health
curl -X POST "http://localhost:5002/studio-backend/download-zip" -H "Content-Type: application/json" -d @flowise_pipeline.json --output docker-compose.zip
```