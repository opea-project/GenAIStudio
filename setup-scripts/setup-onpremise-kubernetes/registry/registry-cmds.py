import requests
import sys
import docker
import time
import os

# Configuration
REGISTRY_URL = "http://localhost:5000"
REGISTRY_DATA_PATH = "/var/lib/registry"

def get_manifest(image_name, image_tag):
    """Get the manifest of an image."""
    response = requests.get(f"{REGISTRY_URL}/v2/{image_name}/manifests/{image_tag}")
    response.raise_for_status()
    return response.json()

def list_images_all():
    """List all images in the registry along with their digests."""
    response = requests.get(f"{REGISTRY_URL}/v2/_catalog")
    response.raise_for_status()
    repositories = response.json().get('repositories', [])
    for repo in repositories:
        tag_response = requests.get(f"{REGISTRY_URL}/v2/{repo}/tags/list")
        tag_response.raise_for_status()
        tags = tag_response.json().get('tags', [])
        if tags:
            for tag in tags:
                manifest_response = requests.head(
                    f"{REGISTRY_URL}/v2/{repo}/manifests/{tag}",
                    headers={'Accept': 'application/vnd.docker.distribution.manifest.v2+json'}
                )
                manifest_response.raise_for_status()
                digest = manifest_response.headers.get('Docker-Content-Digest', '<unknown>')
                print(f"{repo}:{tag} (digest: {digest})")
        else:
            print(f"{repo}:<null>")

def list_repos():
    """List all repository names."""
    response = requests.get(f"{REGISTRY_URL}/v2/_catalog")
    response.raise_for_status()
    repositories = response.json().get('repositories', [])
    print("\n".join(repositories))

def list_images_in_repo(repo):
    """List all images for a given repository."""
    print(f"Listing images for repository {repo}:")
    try:
        response = requests.get(f"{REGISTRY_URL}/v2/{repo}/tags/list")
        response.raise_for_status()
        tags = response.json().get('tags', [])
        if tags:
            for tag in tags:
                print(f"{repo}:{tag}")
        else:
            print(f"{repo}:<null>")
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"Error: Repository '{repo}' not found.")
        else:
            print(f"Error: {e}")

def delete_image(image_tag, run_gc=True):
    """Delete a given image."""
    image, tag = image_tag.split(":")
    print(f"Deleting tag {tag} for image {image}:")
    response = requests.head(f"{REGISTRY_URL}/v2/{image}/manifests/{tag}", headers={'Accept': 'application/vnd.docker.distribution.manifest.v2+json'})
    response.raise_for_status()
    digest = response.headers['Docker-Content-Digest']
    delete_response = requests.delete(f"{REGISTRY_URL}/v2/{image}/manifests/{digest}")
    delete_response.raise_for_status()
    print(f"Deleted {image}:{tag}")
    if run_gc:
        garbage_collect()

def delete_orphaned_repository(repo):
    """Delete the repository itself if the registry supports it and the path has no content."""
    repo_tags_path = os.path.join(REGISTRY_DATA_PATH, 'docker/registry/v2/repositories', repo, "_manifests", "tags")
    repo_path = os.path.join(REGISTRY_DATA_PATH, 'docker/registry/v2/repositories', repo)
    time.sleep(1)
    if os.path.exists(repo_tags_path):
        if not os.listdir(repo_tags_path):
            print(f"Removing orphaned repository: {repo}")
            client = docker.from_env()
            try:
                container = client.containers.get('registry')
                result = container.exec_run(f'rm -rf {repo_path}')
                if result.exit_code == 0:
                    print(f"Deleted repository {repo}.")
                else:
                    print(f"Error deleting repository: {result.output.decode('utf-8')}")
            except docker.errors.NotFound:
                print("Error: Registry container not found.")
            except docker.errors.APIError as e:
                print(f"Error: {e}")
        else:
            print(f"Aborting.. Repository path is not empty: {repo_tags_path}")
            sys.exit(1)
    else:
        print(f"Repository path does not exist: {repo_tags_path}")

def delete_all_images_in_repo(repo):
    """Delete all images in a given repository."""
    print(f"Deleting all images in repository {repo}:")
    try:
        response = requests.get(f"{REGISTRY_URL}/v2/{repo}/tags/list")
        response.raise_for_status()
        tags = response.json().get('tags', [])
        if tags:
            for tag in tags:
                delete_image(f"{repo}:{tag}", run_gc=False)
        else:
            print(f"No images found in repository {repo}.")
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"Error: Repository '{repo}' not found.")
        else:
            print(f"Error: {e}")
    delete_orphaned_repository(repo)
    garbage_collect()

def garbage_collect():
    """Run garbage collection to clean up disk."""
    print("Running garbage collection...")
    client = docker.from_env()
    try:
        container = client.containers.get('registry')
        result = container.exec_run('bin/registry garbage-collect /etc/docker/registry/config.yml')
        if result.exit_code == 0:
            print("Garbage collection completed successfully.")
            print("Restarting registry container...")
            container.restart()
            print("Registry container restarted successfully.")
        else:
            print(f"Error running garbage collection: {result.output.decode('utf-8')}")
    except docker.errors.NotFound:
        print("Error: Registry container not found.")
    except docker.errors.APIError as e:
        print(f"Error: {e}")

def usage_print():
    print("Usage:")
    print("  python registry-cmds.py <command> <subcommand> [options]")
    print()
    print("Commands:")
    print("  python registry-cmds.py images list repos                  List all image repositories")
    print("  python registry-cmds.py images list all                    List all images in the registry")
    print("  python registry-cmds.py images list <repo>                 List all images in a specific repository")
    print("  python registry-cmds.py images delete <image:tag>          Delete a specific image")
    print("  python registry-cmds.py images delete repo <repo>          Delete all images in a given repository.")
    print("  python registry-cmds.py images gc                          Run garbage collection to clean up disk")
    print("  python registry-cmds.py help                               Show this help message")

def main():
    if len(sys.argv) < 3:
        usage_print()
        sys.exit(1)

    command = sys.argv[1]
    subcommand = sys.argv[2]

    if command == "images":
        if subcommand == "list":
            if len(sys.argv) == 4 and sys.argv[3] == "repos":
                list_repos()
            elif len(sys.argv) == 4 and sys.argv[3] == "all":
                list_images_all()
            elif len(sys.argv) == 4 and sys.argv[3] != "all":
                list_images_in_repo(sys.argv[3])
            else:
                print(f"Error: Unknown subcommand '{subcommand}' for 'images list'")
                usage_print()
                sys.exit(1)
        elif subcommand == "delete":
            if sys.argv[3] != "repo":
                if len(sys.argv) != 4:
                    print("Error: 'images delete' requires <image:tag> argument.")
                    usage_print()
                    sys.exit(1)
                delete_image(sys.argv[3])
            else:
                if len(sys.argv) != 5:
                    print("Error: 'images delete repo' requires <repo> argument.")
                    usage_print()
                    sys.exit(1)
                delete_all_images_in_repo(sys.argv[4])
        elif subcommand == "gc":
            garbage_collect()
        else:
            print(f"Error: Unknown subcommand '{subcommand}' for 'images'")
            usage_print()
            sys.exit(1)


    elif command == "help":
        usage_print()

    else:
        print(f"Error: Unknown command '{command}'")
        usage_print()
        sys.exit(1)

if __name__ == "__main__":
    main()