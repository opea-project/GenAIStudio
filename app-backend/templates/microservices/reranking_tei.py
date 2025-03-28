from comps import  MicroService, ServiceType

def get_service(host_ip = "0.0.0.0", **kwargs): 
    return MicroService(
            name="rerank",
            host=host_ip,
            port=kwargs.get("port", 8000),
            endpoint="/v1/reranking",
            use_remote_service=True,
            service_type=ServiceType.RERANK
        )