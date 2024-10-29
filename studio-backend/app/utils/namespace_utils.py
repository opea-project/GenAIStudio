import time
from kubernetes.client.rest import ApiException

def wait_for_pod(namespace, pod_name, core_v1_api, timeout=300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            pod = core_v1_api.read_namespaced_pod(name=pod_name, namespace=namespace)
            if pod.status.phase == "Running" and all(container.ready for container in pod.status.container_statuses):
                print(f"Pod {pod_name} is ready")
                return True
            elif pod.status.phase in ["Failed", "Unknown", "Error", "CrashLoopBackOff", "ErrImagePull", "ImagePullBackOff"]:
                print(f"Pod {pod_name} is in a failed state: {pod.status.phase}")
                return False
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