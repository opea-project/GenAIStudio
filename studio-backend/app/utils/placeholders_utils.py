
import yaml
import textwrap
import json
import re
import os
from collections import OrderedDict

# Custom representer for multiline strings to ensure they are dumped properly
def represent_literal(dumper, data):
    if '\n' in data:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)
def represent_int(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:int', str(data))
def represent_ordereddict(dumper, data):
    return dumper.represent_dict(data.items())

# Add the custom representer to the SafeDumper
yaml.add_representer(str, represent_literal, Dumper=yaml.SafeDumper)
yaml.add_representer(int, represent_int, Dumper=yaml.SafeDumper)
yaml.add_representer(OrderedDict, represent_ordereddict, Dumper=yaml.SafeDumper)

# Function to load multiple YAML documents using OrderedDict
def ordered_load_all(stream, Loader=yaml.SafeLoader, object_pairs_hook=OrderedDict):
    class OrderedLoader(Loader):
        pass
    def construct_mapping(loader, node):
        loader.flatten_mapping(node)
        return object_pairs_hook(loader.construct_pairs(node))
    OrderedLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
        construct_mapping)
    return yaml.load_all(stream, OrderedLoader)

# Recursive function to replace placeholders in manifest templates
def replace_manifest_placeholders(obj, variables):
    if isinstance(obj, dict):
        for key, value in obj.items():
            # Skip nginx.conf as it contains {} that will clashe with .format()
            if key == "default.conf" or key == "project-info.json":
                continue
            if isinstance(value, str):
                # Replace ${REGISTRY} and ${TAG} with the value from environment variables
                value = value.replace("${REGISTRY}", os.getenv("REGISTRY", "opea"))
                value = value.replace("${TAG}", os.getenv("TAG", "latest"))
                value = value.replace("${HTTP_PROXY}", os.getenv("SBX_HTTP_PROXY", ""))
                value = value.replace("${NO_PROXY}", os.getenv("SBX_NO_PROXY", ""))
                # Attempt to replace placeholders in the string
                formatted_value = value.format(**variables)
                # If the key is a port-related field and the formatted value is a digit, convert to int
                if key in ['port', 'targetPort', 'containerPort'] and formatted_value.isdigit():
                    obj[key] = int(formatted_value)
                else:
                    obj[key] = formatted_value
            else:
                # Recursively call the function for nested structures
                obj[key] = replace_manifest_placeholders(value, variables)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            obj[index] = replace_manifest_placeholders(value, variables)
    return obj

def replace_dynamic_manifest_placeholder(value_str, service_info, proj_info_json):
    indent_str = ' ' * 8

    if service_info['service_type'] == 'app':
        ui_env_config_info_str = ""
        ui_nginx_config_info_str = ""
        backend_project_info_str = ""
        for key, value in service_info['ui_config_info'].items():
            # For __UI_CONFIG_INFO_ENV_PLACEHOLDER__
            url_name = value['url_name']
            endpoint_path = value['endpoint_path']
            env_block = f"{indent_str}- name: {url_name}\n{indent_str}  value: {endpoint_path}\n"
            ui_env_config_info_str += env_block

            # For __UI_CONFIG_INFO_ENV_PLACEHOLDER__
            endpoint_path = value['endpoint_path']
            port = value['port']
            location_block = textwrap.dedent(f"""
            location {endpoint_path} {{
                proxy_pass http://{key}:{port};
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }}
            """)
            indented_location_block = textwrap.indent(location_block, indent_str)
            ui_nginx_config_info_str += indented_location_block

        # For __BACKEND_PROJECT_INFO_JSON_PLACEHOLDER__
        backend_project_info_str = json.dumps(proj_info_json, indent=4)

        # Get app images from environment variables
        app_frontend_image = os.getenv("APP_FRONTEND_IMAGE", "opea/app-frontend:latest")
        app_backend_image = os.getenv("APP_BACKEND_IMAGE", "opea/app-backend:latest")

        # Replace the unique placeholders with the actual strings
        final_config = value_str.replace("__UI_CONFIG_INFO_ENV_PLACEHOLDER__", ui_env_config_info_str.strip()).replace(
            "__UI_CONFIG_INFO_NGINX_PLACEHOLDER__", ui_nginx_config_info_str.strip()).replace(
            "__BACKEND_PROJECT_INFO_JSON_PLACEHOLDER__", backend_project_info_str.replace(f"\n", f"\n{indent_str}")).replace(
            "__APP_FRONTEND_IMAGE__", app_frontend_image).replace(
            "__APP_BACKEND_IMAGE__", app_backend_image)
    
    else:
        final_config = value_str

    # print(final_config)
    return final_config

# Recursive function to replace placeholders in nested dictionaries and lists
def replace_compose_placeholders(obj, variables):
    if isinstance(obj, dict):
        new_obj = {}
        for key, value in obj.items():
            # Replace placeholders in the key
            new_key = re.sub(r'\{\{(.*?)\}\}', lambda m: str(variables.get(m.group(1), m.group(0))), key)
            new_obj[new_key] = replace_compose_placeholders(value, variables)
        return new_obj
    elif isinstance(obj, list):
        return [replace_compose_placeholders(value, variables) for value in obj]
    elif isinstance(obj, str):
        # Replace {{}} placeholders in strings
        value = re.sub(r'\{\{(.*?)\}\}', lambda m: str(variables.get(m.group(1), m.group(0))), obj)
        value = value.replace("${REGISTRY}", os.getenv("REGISTRY", "opea"))
        value = value.replace("${TAG}", os.getenv("TAG", "latest"))
        return value
    return obj

def replace_dynamic_compose_placeholder(value_str, service_info):
    indent_str = ' ' * 2

    if service_info['service_type'] == 'app':
        backend_endpoint_list_str = ""
        ui_env_config_info_str = ""
        # For __BACKEND_ENDPOINTS_LIST_PLACEHOLDER__
        for endpoint in service_info['endpoint_list']:
            endpoint_block = f"{indent_str}- {endpoint}\n"
            backend_endpoint_list_str += endpoint_block

        # For __UI_CONFIG_INFO_ENV_PLACEHOLDER__
        for _, value in service_info['ui_config_info'].items():
            url_name = value['url_name']
            endpoint_path = value['endpoint_path']
            endpoint_block = f"{indent_str}  - {url_name}={endpoint_path}\n"
            ui_env_config_info_str += endpoint_block
        
        # Get app images from environment variables
        app_frontend_image = os.getenv("APP_FRONTEND_IMAGE", "opea/app-frontend:latest")
        app_backend_image = os.getenv("APP_BACKEND_IMAGE", "opea/app-backend:latest")

        # Replace the unique placeholders with the actual strings
        final_config = value_str.replace("__BACKEND_ENDPOINTS_LIST_PLACEHOLDER__", backend_endpoint_list_str.strip()).replace(
            "__UI_CONFIG_INFO_ENV_PLACEHOLDER__", ui_env_config_info_str.strip()).replace(
            "__APP_FRONTEND_IMAGE__", app_frontend_image).replace(
            "__APP_BACKEND_IMAGE__", app_backend_image)
    
    else:
        final_config = value_str

    # print(final_config)
    return final_config