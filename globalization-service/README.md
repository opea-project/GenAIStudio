# OPEA Globalization & Governance Service (Topic A)

This service extends OPEA GenAIStudio with a simple globalization & governance layer:

- Per-tenant region & language configuration
- Prompt preview & rewriting with language hints and hallucination notices
- Very basic keyword-based content policy evaluation
- Event logging endpoint for building “internationalization effectiveness” dashboard

## Run locally

```bash
cd globalization-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
Open http://localhost:8080/docs to try the APIs.

Docker

docker build -t globalization-service:0.1.0 .
docker run -p 8080:8080 globalization-service:0.1.0
Integration idea with GenAIStudio / OPEA
Call /v1/globalization/prompt/preview in your app-frontend or studio-frontend
before sending user prompt to OPEA ChatQnA.

Call /v1/globalization/policy/evaluate in your backend to decide allow/deny.

Use /v1/globalization/events as a data source for a “globalization governance dashboard”.