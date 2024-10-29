from comps import  MicroService, ServiceType

def get_service(host_ip = "0.0.0.0", **kwargs): 
    return MicroService(
            name="retriever",
            host=host_ip,
            # port=None if kwargs.get("node_id_as_ip") else 7000,
            port=7000,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER
        )