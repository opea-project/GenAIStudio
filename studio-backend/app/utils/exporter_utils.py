import os
import copy

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')

manifest_map = {
        "redis_vector_store" : "microsvc-manifests/redis-vector-db.yaml",
        "tei" : "microsvc-manifests/tei.yaml",
        "tgi" : "microsvc-manifests/tgi.yaml",
        "opea_service@prepare_doc_redis_prep" : "microsvc-manifests/data-prep.yaml",
        "opea_service@embedding_tei_langchain" : "microsvc-manifests/embedding-usvc.yaml",
        "opea_service@retriever_redis" : "microsvc-manifests/retriever-usvc.yaml",
        "opea_service@reranking_tei" : "microsvc-manifests/reranking-usvc.yaml", 
        "opea_service@llm_tgi" : "microsvc-manifests/llm-uservice.yaml",
        "app" : "app/app.manifest.yaml",
        "opea_service@supervisor_agent" : "microsvc-manifests/supervisor-agent.yaml",
        "opea_service@rag_agent" : "microsvc-manifests/rag-agent.yaml",
        "opea_service@sql_agent" : "microsvc-manifests/sql-agent.yaml",
    }

compose_map = {
        "redis_vector_store" : "microsvc-composes/redis-vector-db.yaml",
        "tei" : "microsvc-composes/tei.yaml",
        "tgi" : "microsvc-composes/tgi.yaml",
        "opea_service@prepare_doc_redis_prep" : "microsvc-composes/data-prep.yaml",
        "opea_service@embedding_tei_langchain" : "microsvc-composes/embedding-usvc.yaml",
        "opea_service@retriever_redis" : "microsvc-composes/retriever-usvc.yaml",
        "opea_service@reranking_tei" : "microsvc-composes/reranking-usvc.yaml", 
        "opea_service@llm_tgi" : "microsvc-composes/llm-uservice.yaml",
        "app" : "app/app.compose.yaml"
}

# Define a dictionary mapping opea service types to their ports
opea_endpoint_paths = {
    "opea_service@prepare_doc_redis_prep" : "/v1/dataprep",
    "opea_service@embedding_tei_langchain" : "/v1/embeddings",
    "opea_service@retriever_redis" : "/v1/retrieval",
    "opea_service@reranking_tei" : "/v1/reranking", 
    "opea_service@llm_tgi" : "/v1/chat/completions",
}

# Define a dictionary mapping opea service types to their ports
opea_url_name = {
    "opea_service@prepare_doc_redis_prep" : "APP_DATA_PREP_SERVICE_URL",
    "opea_service@embedding_tei_langchain" : "APP_EMBEDDINGS_SERVICE_URL",
    "opea_service@retriever_redis" : "APP_RETRIEVAL_SERVICE_URL",
    "opea_service@reranking_tei" : "APP_RERANKING_SERVICE_URL", 
    "opea_service@llm_tgi" : "APP_CHAT_COMPLETEION_SERVICE_URL",
}

def process_opea_services(proj_info_json):
    base_port = 9000
    # Create a deep copy of the proj_info_json to avoid modifying the original data
    proj_info_copy = copy.deepcopy(proj_info_json)

    # Filter nodes to include only those with keys containing 'opea_service@'
    # and extract their 'dependent_services', 'connected_from', and 'connected_to'
    filtered_nodes_with_dependent_services_and_connections = {
        key: {
            'service_type': value['name'],
            'dependent_services': value['dependent_services'],
            'connected_from': value['connected_from'],
            'connected_to': value['connected_to'],
            'params': value['params']
        }
        for key, value in proj_info_copy['nodes'].items()
        if 'opea_service@' in key
    }
    filtered_data = {
        'nodes': filtered_nodes_with_dependent_services_and_connections
    }

    # Load the JSON data into a Python dictionary
    opea_data = filtered_data

    # Initialize the services dictionary and counters for each service type
    services = {}
    service_counters = {}
    service_keys = {}
    
    # Check for redis_vector_store references in nodes
    redis_vector_store_references = set()
    for node_name, node_info in opea_data['nodes'].items():
        connected_from = node_info.get('connected_from', [])
        connected_to = node_info.get('connected_to', [])
        for connection in connected_from + connected_to:
            if 'redis_vector_store' in connection:
                redis_vector_store_references.add(connection)
    
    # Handle redis_vector_store instances
    for redis_store_name in redis_vector_store_references:
        suffix = redis_store_name.split('_')[-1]
        service_id = f"redis_vector_store_{suffix}"
        endpoint_name = service_id.replace("_","-")
        # Use the default Redis port if this is the first instance, otherwise increment
        # port = 6379 if suffix == "0" else 6379 + int(suffix)
        # port_insight = 8001 if suffix == "0" else 8001 + int(suffix)
        base_port += 1
        port = base_port
        base_port += 1
        port_insight = base_port
        port_key = f"{service_id}_port"
        
        services[service_id] = {
            'service_type': 'redis_vector_store',
            'endpoint': endpoint_name,
            'port': port,
            'port_key': port_key,
            'port_insight': port_insight
        }
    
    # Handle other dependent services
    for node_name, node_info in opea_data['nodes'].items():
        for service_type, service_info in node_info.get('dependent_services', {}).items():
            # Skip redis_vector_store as it's handled separately
            if service_type == 'redis_vector_store':
                continue
            
            # Create a unique key for the service based on its modelName and huggingFaceToken
            service_key = (service_info['modelName'], service_info['huggingFaceToken'])
            
            # Check if the service has already been added
            if service_key not in service_keys:
                # If not, create a new entry for the service
                counter = service_counters.get(service_type, 0)
                service_id = f"{service_type}_{counter}"
                endpoint_name = f"{service_type}-{counter}"
                # port = dependent_starting_ports.get(service_type, 2081) + counter
                base_port += 1
                port = base_port
                port_key = f"{service_id}_port"
                
                services[service_id] = {
                    'service_type': service_type,
                    'endpoint': endpoint_name,
                    'port': port,
                    'port_key': port_key,
                    **service_info  # Unpack the service_info dictionary
                }
                
                # Map the service key to the service_id and increment the counter
                service_keys[service_key] = service_id
                service_counters[service_type] = counter + 1
            else:
                # If the service already exists, use the existing entry
                service_id = service_keys[service_key]
                endpoint_name = services[service_id]['endpoint']
                port = services[service_id]['port']
                
            # Update the node info with the service endpoint and port
            node_info['dependent_services'][service_type] = {
                'endpoint': endpoint_name,
                'port': port,
                **service_info  # Unpack the service_info dictionary
            }

    # Initialize a dictionary to hold the updated nodes with service mappings
    updated_nodes = {}

    # Iterate through the nodes to update their dependent_services
    for node_name, node_info in opea_data['nodes'].items():
        # Initialize a dictionary to hold the service info for dependent_services
        service_info_dict = {}
        
        # Generate an endpoint name for the opea_service@ entry
        # Remove the 'opea_service@' prefix and append the node_name suffix if any
        node_suffix = node_name.split('_')[-1] if '_' in node_name else ''
        service_type_cleaned = node_info['service_type'].replace('opea_service@', '')
        opea_service_endpoint = f"{service_type_cleaned.replace('_','-')}-{node_suffix}".strip('-')
        
        # Iterate through the dependent_services to map to the service info
        for service_type, service_info in node_info.get('dependent_services', {}).items():
            # Find the corresponding service ID using the service endpoint
            service_id = next((sid for sid, sinfo in services.items() if sinfo['endpoint'] == service_info['endpoint']), None)
            
            # If a corresponding service ID is found, add the service info to the dictionary
            if service_id:
                # Use a prefix for the keys based on the service type
                if service_type in ['tgi', 'vllm']:
                    prefix = 'llm'
                else:
                    prefix = service_type
                service_info_dict[f"{prefix}_endpoint"] = services[service_id]['endpoint']
                service_info_dict[f"{prefix}_port"] = services[service_id]['port']
                service_info_dict[f"modelName"] = services[service_id]['modelName']
                service_info_dict[f"huggingFaceToken"] = services[service_id]['huggingFaceToken']
        
        # Iterate through the connected_to and connected_to to map to the service info
        connected_from = node_info.get('connected_from', [])
        connected_to = node_info.get('connected_to', [])

        if 'supervisor_agent' in node_name:
            service_info_dict['connected_agent'] = []

        for connected_service in connected_from + connected_to:

            if 'supervisor_agent' in node_name:
                if 'agent' in connected_service:
                    service_info_dict['connected_agent'].append(connected_service)
            
            # Find the corresponding service ID using
            service_id = next((sid for sid, _ in services.items() if sid == connected_service), None)

            # If a corresponding service ID is found, add the service info to the dictionary
            if service_id:
                # Use a prefix for the keys based on the service type
                if services[service_id]['service_type'] in ['tgi', 'vllm']:
                    prefix = 'llm'
                else:
                    prefix = services[service_id]['service_type']
                service_info_dict[f"{prefix}_endpoint"] = services[service_id]['endpoint']
                service_info_dict[f"{prefix}_port"] = services[service_id]['port']

        # Assign dynamic port
        base_port += 1
        port_key = f"{opea_service_endpoint.replace('-', '_')}_port"
        
        # Update the node with the service info and the generated endpoint
        updated_nodes[node_name] = {
            'endpoint': opea_service_endpoint,
            'service_type': node_info['service_type'],
            'port': base_port,
            'port_key': port_key,
            **node_info['params'],
            **service_info_dict  # Unpack the service_info_dict
        }

    # Update the supervisor_agent nodes with connected agents' endpoints and ports
    for node_name, node_info in updated_nodes.items():
        if 'supervisor_agent' in node_name:
            for connected_agent in node_info['connected_agent']:
                prefix = updated_nodes[connected_agent]['service_type'].replace('opea_service@', '')
                updated_nodes[node_name][f"{prefix}_endpoint"] = updated_nodes[connected_agent]['endpoint']
                updated_nodes[node_name][f"{prefix}_port"] = updated_nodes[connected_agent]['port']
            updated_nodes[node_name].pop('connected_agent', None)
        if 'rag_agent' in node_name:
            updated_nodes[node_name]['megasvc_endpoint'] = "app-backend:8888/v1/app-backend"
            updated_nodes[node_name]['rag_name'] = node_name.replace('opea_service@', '')
        if "llmEngine" in node_info and node_info["llmEngine"] == "openai":
            updated_nodes[node_name]['llm_endpoint'] = "NA"
            updated_nodes[node_name]['llm_port'] = "NA"

    # Merge the updated_nodes with the services dictionary
    services.update(updated_nodes)

    # Extract endpoint list from all the services up until now
    endpoint_list = [service["endpoint"] for service in services.values()]

    # Extract ui_config_info
    ui_config_info = {}
    for node_name, node_info in services.items():
        if 'opea_service@' in node_name and 'agent' in node_name:
            ui_config_info[node_info['endpoint']] = {
                'port': node_info["port"]
            }
        elif 'opea_service@' in node_name:
            ui_config_info[node_info['endpoint']] = {
                'endpoint_path': opea_endpoint_paths[node_info["service_type"]],
                'port': node_info["port"],
                'url_name': opea_url_name[node_info["service_type"]]
            }

    # Get ports info for env
    ports_info = {}

    for service_name, config in ui_config_info.items():
        port_key = f"{service_name.replace('-', '_')}_port"
        ports_info[port_key] = config["port"]

    services.update(
        {
            'app': {
                'service_type': 'app',
                'endpoint_list': endpoint_list,
                "ui_config_info": ui_config_info,
                "ports_info": ports_info
            }
        }

    )

    services_info = {
        'services': services
    }

    # Return the processed data with updated services
    return services_info
    