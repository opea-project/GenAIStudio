from comps import MicroService, ServiceType

def get_service(host_ip="0.0.0.0", **kwargs):
    return MicroService(
        name="asr",
        host=host_ip,
        port=kwargs.get("port", 7066),
        endpoint="/v1/asr",
        use_remote_service=True,
        service_type=ServiceType.ASR
    )
