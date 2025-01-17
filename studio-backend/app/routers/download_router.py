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
from app.services.project_info_service import ProjectInfo

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
    project_info_file_path = os.path.join(temp_dir, "project-info.json")
    zip_path = os.path.join(temp_dir, "docker-compose.zip")

    # Covnert request to project info json
    project_info_raw = ProjectInfo(request.dict())
    project_info = json.loads(project_info_raw.export_to_json())
    
    # Write the strings to files
    try:
        # .env contents
        with open(env_file_path, 'w') as f:
            f.write("public_host_ip='Your_External_Host_IP'")
        
        # readme.md contents
        with open(compose_readme_file_path, 'r') as f:
            readme_content = f.read()
        with open(readme_file_path, 'w') as f:
            f.write(readme_content)

        # compose.yaml contents
        compose_content = convert_proj_info_to_compose(project_info)
        with open(compose_file_path, 'w') as f:
            f.write(compose_content)

        # project-info.json contents
        with open(project_info_file_path, 'w') as f:
            f.write(json.dumps(project_info, indent=4))

        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Specify the folder structure in the arcname
            zipf.write(env_file_path, arcname=os.path.join("docker-compose", ".env"))
            zipf.write(readme_file_path, arcname=os.path.join("docker-compose", "readme.MD"))
            zipf.write(compose_file_path, arcname=os.path.join("docker-compose", "compose.yaml"))
            zipf.write(project_info_file_path, arcname=os.path.join("docker-compose", "project-info.json"))
        
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