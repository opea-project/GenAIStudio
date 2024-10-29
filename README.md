# Generative AI Studio (GenAIStudio)
 GenAI Studio is designed to streamline the creation of custom large language model (LLM) applications. It builds on insights gained from playground experiments, allowing developers to easily build, test, and benchmark their LLM solutions through an intuitive no-code/low-code interface.

 ## Concept
 GenAI Studio reduces the need for manual scripting by encapsulating microservices from OPEA's [GenAIComps](https://github.com/opea-project/GenAIComps) into easily configurable UI blocks. Combined with OPEA's [GenAIInfra](https://github.com/opea-project/GenAIInfra), it generates a one-click deployable package. This approach accelerates the proof-of-concept (POC) process for AI engineers, allowing them to focus on experimentation without the overhead of constructing RAG pipelines or managing infrastructure manually.

![image](https://github.com/user-attachments/assets/f6b59616-4669-4544-81ca-e858d7d9eea1)

 ## Key Components

![image](https://github.com/user-attachments/assets/dc96bf9b-9f81-41c4-97cc-c6e7714e30e8)

 ### Kubernetes Cluster
 The Kubernetes cluster hosts both the Studio, Sandbox and Monitoring namespaces. 
 - **Studio Namespace:** This is the core application namespace containing the Studio AppBuilder UI and Studio server. The UI allows users to manage projects and build GenAI pipelines. The server includes the Evaluation Sandbox Manager and Deployment Package Generator, which handle deployment of user-designed pipelines.
 - **Sandbox Namespace(s):** Managed by the Studio server, these namespaces create sandbox environments where users can test and evaluate their pipelines. 
 - **Monitoring Namespace:** This namespace contains a Prometheus service that collects performance data from each sandbox. The collected metrics are visualized in a Grafana dashboard, enabling users to monitor resource utilization and pipeline performance.

### Studio AppBuilder UI
The Studio AppBuilder UI has two main pages.
- **Landing Page:** Provides an overview of the project list, allowing users to easily manage projects, launch sandboxes, download deployment packages, or manage package manifests.
- **Canvas Page:** A drag-and-drop interface built on Flowise, enabling usersto build proof-of-concept (POC) applications by assembling various configurable microservice blocks into a GenAI pipeline. These microservices form the core components necessary for creating Retrieval-Augmented Generation (RAG) applications. The pipeline can be run and tested within the Studio’s Sandbox environment.

### Sandbox
A sandbox is launched when a user starts a project through the Studio UI. Each sandbox runs independently, allowing for performance testing and monitoring. The sandbox namespace, managed by the Studio server, contains the necessary microservices based on the pipeline design and includes a App UI. Users can test the pipeline's inference performance and track resource utilization via an integrated Grafana dashboard.

### GenAI Microservices
GenAIStudio currently supports a subset of microservices from GenAIComps, including [DataPrep with Redis](https://github.com/opea-project/GenAIComps/tree/main/comps/dataprep/redis), [TEI Embedding](https://github.com/opea-project/GenAIComps/tree/main/comps/embeddings), [Retriever with Redis](https://github.com/opea-project/GenAIComps/tree/main/comps/retrievers/redis), [Reranks](https://github.com/opea-project/GenAIComps/tree/main/comps/reranks), [LLMs](https://github.com/opea-project/GenAIComps/tree/main/comps/llms) and [Guardrails](https://github.com/opea-project/GenAIComps/tree/main/comps/guardrails). This list is expected to grow in future releases, expanding the range of services available for building and testing GenAI pipelines.

### Deployment Package
Users can download the deployment package in a ZIP file from the Studio UI and deploy it locally using Docker Compose. This local setup mirrors the sandbox environment, providing the same app configuration and microservices. It enables users to test their GenAI application on their local machine with identical infrastructure.

## Getting Started
### Setting up GenAIStudio
#### Who needs to set up the Studio?
  
If you're part of a team and want to provide a testing playground for your members, you'll need to set up GenAIStudio. This setup allows your team members to test and evaluate their pipelines in a sandbox environment without worrying about infrastructure management.

However, if you already have access to an existing Studio instance, you can skip the setup process and move directly to the next section to begin working with your projects.

#### Prerequisites

#### Installation

```
git clone https://github.com/opea-project/GenAIStudio
cd GenAIStudio
```
### Navigate through GenAIStudio UI
#### Managing Projects
#### Test Run a Project in Sandbox
#### Monitor Sandbox Performance and Resource Utilization in Grafana Dashboard

### Download and Run GenAI App Deployment Package Locally	
#### Prerequisites
To deploy the downloaded GenAI application locally, ensure that Docker Engine with Docker Compose are installed on your machine. If you haven't installed them yet, please refer to the official [Docker](https://docs.docker.com/engine/install/) documentation for setup instructions.
	
#### Deploying a GenAI Application
The downloaded configuration file contains the necessary settings for the microservices. When you execute Docker Compose, the required Docker images will be automatically pulled from OPEA's Docker repository and deployed, recreating the same environment as the sandbox.

#### Import and run a sample project
To get you onboard quickly on the Studio UI, you can import and run this sample project.













