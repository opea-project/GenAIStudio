from fastapi import APIRouter, HTTPException
from kubernetes import client

router = APIRouter()

@router.get("/podlogs/{namespace}", summary="Fetch all pods in a namespace")
async def get_all_pods_in_namespace(namespace: str):
    core_v1_api = client.CoreV1Api()
    pods = core_v1_api.list_namespaced_pod(namespace=namespace)

    if not pods.items:
        return {"namespace": namespace, "pods": []}

    pod_list = []
    for pod in pods.items:
        pod_name = pod.metadata.name

        # Initialize log_entries and event_entries
        log_entries = []
        event_entries = []

        # Fetch logs related to the pod
        try:
            pod_logs = core_v1_api.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=200)
            for line in pod_logs.splitlines():
                log_entries.append(line)
        except Exception as e:
            print(f"Error fetching logs: {str(e)}")

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
        })

    return {"namespace": namespace, "pods": pod_list}