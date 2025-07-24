from fastapi import APIRouter, HTTPException
from kubernetes import client
import re

router = APIRouter()

def find_pod_dependencies(pod, all_pods, services, namespace, core_v1_api):
    """
    Analyze pod dependencies by checking:
    1. Environment variables pointing to other services
    2. Service selectors matching pod labels
    3. ConfigMaps and Secrets that might reference other pods
    4. Init containers waiting for remote services
    """
    dependencies = []
    
    # Get pod environment variables from main containers
    env_vars = []
    configmap_refs = []
    
    if pod.spec.containers:
        for container in pod.spec.containers:
            # Direct environment variables
            if container.env:
                for env in container.env:
                    if env.value:
                        env_vars.append(env.value)
            
            # Environment variables from ConfigMaps
            if container.env_from:
                for env_from in container.env_from:
                    if env_from.config_map_ref:
                        configmap_refs.append(env_from.config_map_ref.name)
    
    # Get environment variables from init containers (for wait-for-remote-service patterns)
    init_env_vars = []
    
    if pod.spec.init_containers:
        for init_container in pod.spec.init_containers:
            # Direct environment variables from init containers
            if init_container.env:
                for env in init_container.env:
                    if env.value:
                        init_env_vars.append(env.value)
            
            # Environment variables from ConfigMaps in init containers
            if init_container.env_from:
                for env_from in init_container.env_from:
                    if env_from.config_map_ref and env_from.config_map_ref.name not in configmap_refs:
                        configmap_refs.append(env_from.config_map_ref.name)
            
            # Check init container commands for wait-for-remote-service patterns
            if init_container.name == "wait-for-remote-service" or "wait-for" in init_container.name.lower():
                if init_container.command:
                    command_str = " ".join(init_container.command)
                    # Look for service endpoints in commands like "nc -z -v -w30 $HEALTHCHECK_ENDPOINT"
                    # Extract service names from HEALTHCHECK_ENDPOINT or similar patterns
                    for env_var in init_env_vars:
                        # Pattern like "tei-0:9003" or "redis-vector-store-0:9001"
                        service_match = re.search(r'([a-zA-Z0-9-]+):\d+', env_var)
                        if service_match:
                            service_name = service_match.group(1)
                            # Find pods that this service targets
                            for service in services.items:
                                if service.metadata.name == service_name and service.spec.selector:
                                    for target_pod in all_pods.items:
                                        if target_pod.metadata.name != pod.metadata.name:
                                            target_labels = target_pod.metadata.labels or {}
                                            if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                                if target_pod.metadata.name not in dependencies:
                                                    dependencies.append(target_pod.metadata.name)
    
    # Fetch ConfigMap data to analyze environment variables
    configmap_env_vars = []
    for configmap_name in configmap_refs:
        try:
            configmap = core_v1_api.read_namespaced_config_map(name=configmap_name, namespace=namespace)
            if configmap.data:
                for key, value in configmap.data.items():
                    if value:
                        configmap_env_vars.append(value)
        except Exception as e:
            print(f"Error fetching ConfigMap {configmap_name}: {str(e)}")
    
    # Combine all environment variables for further analysis
    all_env_vars = env_vars + init_env_vars + configmap_env_vars
    
    # Debug output
    print(f"Analyzing dependencies for pod: {pod.metadata.name}")
    print(f"ConfigMap refs: {configmap_refs}")
    print(f"Total env vars found: {len(all_env_vars)}")
    if all_env_vars:
        print(f"Sample env vars: {all_env_vars[:3]}")  # Show first 3 for debugging
    
    # Check if environment variables reference other services
    for service in services.items:
        service_name = service.metadata.name
        # Check if service name is referenced in environment variables
        for env_val in all_env_vars:
            if service_name in env_val:
                # Find pods that this service targets
                if service.spec.selector:
                    for target_pod in all_pods.items:
                        if target_pod.metadata.name != pod.metadata.name:
                            target_labels = target_pod.metadata.labels or {}
                            if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                if target_pod.metadata.name not in dependencies:
                                    dependencies.append(target_pod.metadata.name)
    
    # Check for service endpoint patterns in environment variables
    # Pattern like "http://service-name:port" or "service-name:port"
    for env_val in all_env_vars:
        # HTTP URL pattern
        http_matches = re.findall(r'https?://([a-zA-Z0-9-]+):\d+', env_val)
        for service_name in http_matches:
            for service in services.items:
                if service.metadata.name == service_name and service.spec.selector:
                    for target_pod in all_pods.items:
                        if target_pod.metadata.name != pod.metadata.name:
                            target_labels = target_pod.metadata.labels or {}
                            if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                if target_pod.metadata.name not in dependencies:
                                    dependencies.append(target_pod.metadata.name)
        
        # Direct service:port pattern
        service_port_matches = re.findall(r'([a-zA-Z0-9-]+):\d+', env_val)
        for service_name in service_port_matches:
            for service in services.items:
                if service.metadata.name == service_name and service.spec.selector:
                    for target_pod in all_pods.items:
                        if target_pod.metadata.name != pod.metadata.name:
                            target_labels = target_pod.metadata.labels or {}
                            if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                if target_pod.metadata.name not in dependencies:
                                    dependencies.append(target_pod.metadata.name)
    
    # Check DNS-based dependencies (common pattern: service-name.namespace.svc.cluster.local)
    dns_pattern = r'([a-zA-Z0-9-]+)\.(' + re.escape(namespace) + r')\.svc\.cluster\.local'
    for env_val in all_env_vars:
        matches = re.findall(dns_pattern, env_val)
        for match in matches:
            service_name = match[0]
            # Find the service and its target pods
            for service in services.items:
                if service.metadata.name == service_name and service.spec.selector:
                    for target_pod in all_pods.items:
                        if target_pod.metadata.name != pod.metadata.name:
                            target_labels = target_pod.metadata.labels or {}
                            if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                if target_pod.metadata.name not in dependencies:
                                    dependencies.append(target_pod.metadata.name)
    
    # Additional pattern matching for service names that might not include ports
    # Look for patterns where service names appear in environment variable values
    service_names = [service.metadata.name for service in services.items]
    for env_val in all_env_vars:
        for service_name in service_names:
            # More flexible matching - look for service name as whole word
            if re.search(r'\b' + re.escape(service_name) + r'\b', env_val):
                for service in services.items:
                    if service.metadata.name == service_name and service.spec.selector:
                        for target_pod in all_pods.items:
                            if target_pod.metadata.name != pod.metadata.name:
                                target_labels = target_pod.metadata.labels or {}
                                if all(target_labels.get(k) == v for k, v in service.spec.selector.items()):
                                    if target_pod.metadata.name not in dependencies:
                                        dependencies.append(target_pod.metadata.name)
    
    return dependencies

@router.get("/podlogs/{namespace}", summary="Fetch all pods in a namespace")
async def get_all_pods_in_namespace(namespace: str):
    core_v1_api = client.CoreV1Api()
    pods = core_v1_api.list_namespaced_pod(namespace=namespace)

    if not pods.items:
        return {"namespace": namespace, "pods": []}

    # Fetch all services in the namespace for dependency analysis
    try:
        services = core_v1_api.list_namespaced_service(namespace=namespace)
    except Exception as e:
        print(f"Error fetching services: {str(e)}")
        services = None

    pod_list = []
    for pod in pods.items:
        pod_name = pod.metadata.name

        # Initialize log_entries and event_entries
        log_entries = []
        event_entries = []

        # Fetch logs related to the pod
        try:
            pod_logs = core_v1_api.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=200)
            if pod_logs and pod_logs.strip():
                for line in pod_logs.splitlines():
                    log_entries.append(line)
            else:
                log_entries.append("** Pod has no logs available")
        except Exception as e:
            print(f"Error fetching logs: {str(e)}")
            log_entries.append("Unable to fetch logs: Pod may not be running or logs are not accessible")

        # Fetch events related to the pod
        try:
            pod_events = core_v1_api.list_namespaced_event(namespace=namespace)
            event_entries = [
                f"[{event.type}] {event.reason}: {event.message} (at {event.last_timestamp})"
                for event in pod_events.items
                if event.involved_object.name == pod_name
            ]
        except Exception as e:
            print(f"Error fetching events: {str(e)}")

        # Analyze pod dependencies
        dependencies = []
        if services:
            try:
                dependencies = find_pod_dependencies(pod, pods, services, namespace, core_v1_api)
                print(f"Pod {pod_name} dependencies: {dependencies}")
            except Exception as e:
                print(f"Error analyzing dependencies for pod {pod_name}: {str(e)}")
                import traceback
                traceback.print_exc()

        # Determine the Ready and Status of the pod
        ready_status = "Unknown"
        pod_status = pod.status.phase
        if pod.metadata.deletion_timestamp:
            pod_status = "Terminating"
        elif pod.status.init_container_statuses:
            ready_count = sum(1 for status in pod.status.init_container_statuses if status.ready)
            total_count = len(pod.status.init_container_statuses)
            if ready_count < total_count:
                pod_status = f"Init:{ready_count}/{total_count}"
            ready_status = f"{ready_count}/{total_count}"
        elif pod.status.container_statuses:
            ready_count = sum(1 for status in pod.status.container_statuses if status.ready)
            total_count = len(pod.status.container_statuses)
            ready_status = f"{ready_count}/{total_count}"

        pod_list.append({
            "name": pod.metadata.name,
            "namespace": pod.metadata.namespace,
            "ready": ready_status,
            "status": pod_status,
            "labels": pod.metadata.labels,
            "annotations": pod.metadata.annotations,
            "logs": log_entries,
            "events": event_entries,
            "dependencies": dependencies,
        })

    return {"namespace": namespace, "pods": pod_list}