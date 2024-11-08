import time
from kubernetes.client.rest import ApiException

def wait_for_pod(namespace, pod_name, core_v1_api, timeout=300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            pod = core_v1_api.read_namespaced_pod(name=pod_name, namespace=namespace)
            if pod.status.phase == "Running":
                if all(container.ready for container in pod.status.container_statuses):
                    print(f"Pod {pod_name} is ready")
                    return True
                else:
                    for container_status in pod.status.container_statuses:
                        if container_status.state.waiting and container_status.state.waiting.reason in [
                            "CrashLoopBackOff", "ErrImagePull", "ImagePullBackOff"]:
                            print(f"Pod {pod_name} is in a failed state: {container_status.state.waiting.reason}")
                            return False
            else:
                print(f"Pod {pod_name} is not Running. status: {pod.status.phase}")
            
        except ApiException as e:
            print(f"Exception when reading pod {pod_name}: {e}")
            return False
        time.sleep(5)
    print(f"Pod {pod_name} did not become ready in time")
    return False

def wait_for_deployment(namespace, deployment_name, apps_v1_api, timeout=300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            deployment = apps_v1_api.read_namespaced_deployment(name=deployment_name, namespace=namespace)
            if deployment.status.available_replicas == deployment.spec.replicas:
                print(f"Deployment {deployment_name} is ready")
                return True
        except ApiException as e:
            print(f"Exception when reading deployment {deployment_name}: {e}")
            return False
        time.sleep(5)
    print(f"Deployment {deployment_name} did not become ready in time")
    return False

def wait_for_service(namespace, service_name, core_v1_api, timeout=300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            service = core_v1_api.read_namespaced_service(name=service_name, namespace=namespace)
            if service.spec.cluster_ip:
                print(f"Service {service_name} is ready")
                return True
        except ApiException as e:
            print(f"Exception when reading service {service_name}: {e}")
            return False
        time.sleep(5)
    print(f"Service {service_name} did not become ready in time")
    return False