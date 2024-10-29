from comps import  MicroService, ServiceType

def get_service(host_ip = "0.0.0.0", **kwargs): 
    return MicroService(
            name="llm",
            host=host_ip,
            # port=None if kwargs.get("node_id_as_ip") else 9000,
            port=9000,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.LLM
        )