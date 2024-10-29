import os
import yaml
from collections import OrderedDict

from app.utils.exporter_utils import TEMPLATES_DIR, manifest_map, compose_map, process_opea_services
from app.utils.placeholders_utils import ordered_load_all, replace_manifest_placeholders, replace_dynamic_manifest_placeholder, replace_compose_placeholders, replace_dynamic_compose_placeholder

def convert_proj_info_to_manifest(proj_info_json, output_file=None):

    print("Converting project info json to manifest.")

    opea_services = process_opea_services(proj_info_json)
    # print(json.dumps(opea_services, indent=4))

    output_manifest = []

    for service_name, service_info in opea_services["services"].items():
        # print(f"Importing {service_name} service into manifest")
        service_file_path = os.path.join(TEMPLATES_DIR, manifest_map[service_info["service_type"]])
        with open(service_file_path, "r") as service_file:
            service_manifest_read = service_file.read()
        service_manifest_raw = list(ordered_load_all(replace_dynamic_manifest_placeholder(service_manifest_read, service_info, proj_info_json), yaml.SafeLoader))
        service_manifest = [replace_manifest_placeholders(doc, service_info) for doc in service_manifest_raw]
        output_manifest.extend((doc, service_name) for doc in service_manifest)

    manifest_string = ""
    for index, (doc, service_name) in enumerate(output_manifest):
        # Skip if the document is None
        if doc is None:
            continue

        # Ensure doc is an OrderedDict and contains the 'metadata' key
        if isinstance(doc, OrderedDict) and 'metadata' in doc:
            metadata = doc['metadata']
            # Ensure metadata is an OrderedDict and contains the 'name' key
            if isinstance(metadata, OrderedDict) and 'name' in metadata:
                # Check if the name is 'nginx'
                if 'app-nginx' in metadata['name'] and output_file is None:
                    continue
                print(f"Processing {metadata['name']} service")
                
        # Accumulate the YAML document in the manifest string
        manifest_string += '---\n'
        manifest_string += "# Copyright (C) 2024 Intel Corporation\n"
        manifest_string += "# SPDX-License-Identifier: Apache-2.0\n"
        manifest_string += yaml.safe_dump(doc, default_flow_style=False, width=float("inf"), allow_unicode=True)
    
    # If an output file is specified, write the manifest string to the file
    if output_file:
        with open(output_file, "w") as f:
            f.write(manifest_string)
        print(f"Manifest written to {output_file}")
    else:
        # Otherwise, return the manifest string
        return manifest_string

def convert_proj_info_to_compose(proj_info_json, output_file=None):

    print("Converting project info json to compose.")

    opea_services = process_opea_services(proj_info_json)
    # print(json.dumps(opea_services, indent=4))

    output_compose = []

    for service_name, service_info in opea_services["services"].items():
        # print(f"Importing {service_name} service into compose")
        service_file_path = os.path.join(TEMPLATES_DIR, compose_map[service_info["service_type"]])
        with open(service_file_path, "r") as service_file:
            service_compose_read = service_file.read()
        service_compose_raw = list(ordered_load_all(replace_dynamic_compose_placeholder(service_compose_read, service_info), yaml.SafeLoader))
        service_compose = [replace_compose_placeholders(doc, service_info) for doc in service_compose_raw]
        output_compose.extend((doc, service_name) for doc in service_compose)

    # Initialize an empty string to hold the combined content
    compose_string = ""

    # Write the source and copyright header for each document
    compose_string += "# Copyright (C) 2024 Intel Corporation\n"
    compose_string += "# SPDX-License-Identifier: Apache-2.0\n\n"

    combined_services = {}
    for doc, service_name in (output_compose):
        combined_services.update(doc)

    services_data = {
        "services": combined_services
    }

    networks_data = {
        "networks": {
            "default": {
                "driver": "bridge"
            }
        }
    }

    # Convert the YAML data to strings and concatenate them to compose_string
    services_yaml = yaml.safe_dump(services_data, default_flow_style=False, sort_keys=False)
    compose_string += services_yaml
    compose_string += "\n"

    networks_yaml = yaml.safe_dump(networks_data, default_flow_style=False, sort_keys=False)
    compose_string += networks_yaml

    # If an output file is specified, write the compose string to the file
    if output_file:
        with open(output_file, "w") as f:
            f.write(compose_string)
        print(f"Compose written to {output_file}")
    else:
        # Otherwise, return the compose string
        return compose_string