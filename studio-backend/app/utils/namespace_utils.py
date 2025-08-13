import time
from kubernetes.client.rest import ApiException

def wait_for_namespace_ready(namespace, core_v1_api):
    success, failed_pods = wait_for_all_pods(namespace, core_v1_api)
    if not success and failed_pods:
        print(f"Namespace {namespace} has failed pods:")
        for failed_pod in failed_pods:
            print(f"  - {failed_pod['name']}: {failed_pod['reason']}")
    
    return success

def wait_for_deployment(namespace, deployment_name, apps_v1_api):
    while True:
        try:
            deployment = apps_v1_api.read_namespaced_deployment(name=deployment_name, namespace=namespace)
            if deployment.status.available_replicas == deployment.spec.replicas:
                print(f"Deployment {deployment_name} is ready")
                return True
        except ApiException as e:
            print(f"Exception when reading deployment {deployment_name}: {e}")
            return False
        time.sleep(5)

def wait_for_service(namespace, service_name, core_v1_api):
    while True:
        try:
            service = core_v1_api.read_namespaced_service(name=service_name, namespace=namespace)
            if service.spec.cluster_ip:
                print(f"Service {service_name} is ready")
                return True
        except ApiException as e:
            print(f"Exception when reading service {service_name}: {e}")
            return False
        time.sleep(5)

def wait_for_all_pods(namespace, core_v1_api):
    print(f"Starting to wait for all pods in namespace {namespace}")
    while True:
        try:
            pods = core_v1_api.list_namespaced_pod(namespace=namespace)
            
            if not pods.items:
                print(f"No pods found in namespace {namespace}")
                return True, [], []
            
            failed_pods = []
            pending_pods = []
            
            for pod in pods.items:
                pod_name = pod.metadata.name
                # print(f"Pod {pod_name} - Phase: {pod.status.phase}")
                
                # Check for terminal failed states first
                if pod.status.phase in ["Failed", "Unknown"]:
                    print(f"Pod {pod_name} is in a terminal failed state: {pod.status.phase}")
                    failed_pods.append({
                        'name': pod_name,
                        'phase': pod.status.phase,
                        'reason': 'Pod phase is terminal failure'
                    })
                    continue
                
                # Check container statuses for failure conditions
                pod_failed = False
                if pod.status.container_statuses:
                    for i, container_status in enumerate(pod.status.container_statuses):
                        container_name = container_status.name if container_status.name else f"container-{i}"
                        # print(f"Pod {pod_name} container {container_name} - Ready: {container_status.ready}")
                        
                        if container_status.state.waiting:
                            waiting_reason = container_status.state.waiting.reason
                            # print(f"Pod {pod_name} container {container_name} is waiting: {waiting_reason}")
                            
                            # Only fail on waiting states that indicate permanent failures
                            if waiting_reason in [
                                "ErrImagePull", "ImagePullBackOff", "InvalidImageName", 
                                "CreateContainerConfigError", "CreateContainerError"]:
                                print(f"Pod {pod_name} is in a failed state: {waiting_reason}")
                                failed_pods.append({
                                    'name': pod_name,
                                    'phase': pod.status.phase,
                                    'reason': f'Container {container_name} waiting: {waiting_reason}'
                                })
                                pod_failed = True
                                break
                            elif waiting_reason == "CrashLoopBackOff":
                                # For CrashLoopBackOff, check restart count
                                restart_count = container_status.restart_count
                                print(f"Pod {pod_name} container {container_name} in CrashLoopBackOff (restarts: {restart_count})")
                                # Fail faster on CrashLoopBackOff - if we have 2 or more restarts, it's likely a persistent issue
                                if restart_count >= 2:
                                    print(f"Pod {pod_name} has multiple restarts ({restart_count}), marking as failed")
                                    failed_pods.append({
                                        'name': pod_name,
                                        'phase': pod.status.phase,
                                        'reason': f'Container {container_name} CrashLoopBackOff with {restart_count} restarts'
                                    })
                                    pod_failed = True
                                    break
                            elif waiting_reason in ["PodInitializing", "ContainerCreating"]:
                                pass
                                # print(f"Pod {pod_name} container {container_name} is initializing")
                        elif container_status.state.terminated:
                            terminated_reason = container_status.state.terminated.reason
                            exit_code = container_status.state.terminated.exit_code
                            print(f"Pod {pod_name} container {container_name} terminated: {terminated_reason} (exit code: {exit_code})")
                            # Only fail on terminated containers if the pod phase is also Failed
                            # This allows containers that terminated but were restarted by Kubernetes to continue
                            if terminated_reason in ["Error", "ContainerCannotRun", "DeadlineExceeded"] and pod.status.phase == "Failed":
                                print(f"Pod {pod_name} container terminated with error and pod is in Failed state: {terminated_reason}")
                                failed_pods.append({
                                    'name': pod_name,
                                    'phase': pod.status.phase,
                                    'reason': f'Container {container_name} terminated: {terminated_reason}'
                                })
                                pod_failed = True
                                break
                        elif container_status.state.running:
                            pass
                            # print(f"Pod {pod_name} container {container_name} is running")
                else:
                    print(f"Pod {pod_name} has no container statuses yet")
                
                if pod_failed:
                    continue
                
                # Check if pod is running and ready
                if pod.status.phase == "Running":
                    if pod.status.container_statuses and all(container.ready for container in pod.status.container_statuses):
                        pass
                        # print(f"Pod {pod_name} is ready!")
                    else:
                        pending_pods.append(pod_name)
                else:
                    pending_pods.append(pod_name)
            
            # If any pods failed, return immediately
            if failed_pods:
                print(f"Found {len(failed_pods)} failed pods:")
                for failed_pod in failed_pods:
                    print(f"  - {failed_pod['name']}: {failed_pod['reason']}")
                return False, failed_pods
            
            # If all pods are ready, return success
            if not pending_pods:
                print(f"All pods in namespace {namespace} are ready!")
                return True, []
            
            print(f"Waiting for {len(pending_pods)} pods to be ready: {pending_pods}")
            
        except ApiException as e:
            print(f"Exception when listing pods in namespace {namespace}: {e}")
            return False, [{'name': 'unknown', 'phase': 'unknown', 'reason': f'API Exception: {e}'}], []
        
        time.sleep(5)