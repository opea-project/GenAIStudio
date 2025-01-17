from comps import  MicroService, ServiceType

def get_service(host_ip = "0.0.0.0", **kwargs): 
    return MicroService(
            name="embedding",
            host=host_ip,
            # port=None if kwargs.get("node_id_as_ip") else 6000,
            port=6000,
            endpoint="/v1/embeddings",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING
        )