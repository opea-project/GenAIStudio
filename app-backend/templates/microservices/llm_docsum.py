from comps import  MicroService, ServiceType

def get_service(host_ip = "0.0.0.0", **kwargs): 
    return MicroService(
            name="llm",
            host=host_ip,
            port=kwargs.get("port", 9000),
            endpoint="/v1/docsum",
            use_remote_service=True,
            service_type=ServiceType.LLM
        )