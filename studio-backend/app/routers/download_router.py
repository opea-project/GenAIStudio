from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

import logging
import tempfile
import os
import zipfile
import shutil
import json

from app.services.exporter_service import convert_proj_info_to_compose
from app.models.pipeline_model import PipelineFlow
from app.services.workflow_info_service import WorkflowInfo
from app.utils.exporter_utils import process_opea_services

router = APIRouter()

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')
compose_readme_file_path = os.path.join(TEMPLATES_DIR, "readmes", "compose-readme.MD")

@router.post("/download-zip")
def create_and_download_zip(request: PipelineFlow, background_tasks: BackgroundTasks) -> FileResponse:
    # Create a temporary directory without the context manager
    temp_dir = tempfile.mkdtemp()

    # Define file paths
    env_file_path = os.path.join(temp_dir, ".env")
    readme_file_path = os.path.join(temp_dir, "readme.MD")
    compose_file_path = os.path.join(temp_dir, "compose.yaml")
    workflow_info_file_path = os.path.join(temp_dir, "workflow-info.json")
    zip_path = os.path.join(temp_dir, "docker-compose.zip")

    # Covnert request to workflow info json
    workflow_info_raw = WorkflowInfo(request.dict())
    workflow_info = json.loads(workflow_info_raw.export_to_json())
    services_info = process_opea_services(workflow_info)
    ports_info = services_info["services"]["app"]["ports_info"]
    additional_files_info = services_info.get("additional_files", [])
    # print("download-zip > additional_files_info", additional_files_info)
    
    # Write the strings to files
    try:
        # .env contents
        with open(env_file_path, 'w') as f:
            f.write("public_host_ip='Your_External_Host_IP'\n")
            # Write each port info to the .env file
            for key, value in ports_info.items():
                f.write(f"{key}={value}\n")
        
        # readme.md contents
        with open(compose_readme_file_path, 'r') as f:
            readme_content = f.read()
        with open(readme_file_path, 'w') as f:
            f.write(readme_content)

        # compose.yaml contents
        compose_content = convert_proj_info_to_compose(workflow_info)
        with open(compose_file_path, 'w') as f:
            f.write(compose_content)

        # workflow-info.json contents
        with open(workflow_info_file_path, 'w') as f:
            f.write(json.dumps(workflow_info, indent=4))

        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Specify the folder structure in the arcname
            zipf.write(env_file_path, arcname=os.path.join("docker-compose", ".env"))
            zipf.write(readme_file_path, arcname=os.path.join("docker-compose", "readme.MD"))
            zipf.write(compose_file_path, arcname=os.path.join("docker-compose", "compose.yaml"))
            zipf.write(workflow_info_file_path, arcname=os.path.join("docker-compose", "workflow-info.json"))
            for file_info in additional_files_info:
                # copy files from the original location to the temp directory
                source_path = file_info["source"]
                target_path = file_info["target"]
                if os.path.isdir(source_path):
                    # Recursively add all files and subdirectories
                    for root, dirs, files in os.walk(source_path):
                        for file in files:
                            full_file_path = os.path.join(root, file)
                            # Preserve the directory structure inside the zip
                            relative_path = os.path.relpath(full_file_path, source_path)
                            zipf.write(full_file_path, arcname=os.path.join("docker-compose", target_path, relative_path))
                else:
                    # Add the single file
                    zipf.write(source_path, arcname=os.path.join("docker-compose", target_path))
        
        # Schedule the cleanup task to run after the response has been sent
        background_tasks.add_task(clean_up_temp_dir, temp_dir)

        return FileResponse(path=zip_path, filename="docker-compose.zip", media_type='application/zip')

    except Exception as e:
        # Clean up the directory immediately if an error occurs before returning the response
        clean_up_temp_dir(temp_dir)
        logging.exception("An error occurred while creating the zip file.")
        raise HTTPException(status_code=500, detail=str(e))

# Define the cleanup function
def clean_up_temp_dir(dir_path: str):
    try:
        shutil.rmtree(dir_path)
    except Exception as e:
        logging.exception(f"An error occurred while deleting the temp directory {dir_path}.")