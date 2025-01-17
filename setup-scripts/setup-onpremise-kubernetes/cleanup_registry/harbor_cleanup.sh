#!/bin/bash

# Usage Example:
# ./harbor_cleanup.sh --domain https://10.0.0.1:8443
# ./harbor_cleanup.sh --domain https://10.0.0.1:8443 --username admin --password Harbor12345

# Note:
# - Make sure to have all required dependencies installed before running the script: sudo apt-get install jq, curl
# - To check if there are remaining images: curl -u "admin:Harbor12345" -k -s -v "https://10.0.0.1:8443/api/v2.0/projects/k8s/repositories" | jq '.[].name'

# Default values
DEFAULT_HARBOR_USERNAME="admin"
DEFAULT_HARBOR_PASSWORD="Harbor12345"

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --domain) HARBOR_DOMAIN="$2"; shift ;;
        --username) HARBOR_USERNAME="$2"; shift ;;
        --password) HARBOR_PASSWORD="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Use default values if not provided
HARBOR_USERNAME="${HARBOR_USERNAME:-$DEFAULT_HARBOR_USERNAME}"
HARBOR_PASSWORD="${HARBOR_PASSWORD:-$DEFAULT_HARBOR_PASSWORD}"

# List all repositories in the project
REPOSITORIES=$(curl -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" -k -s "$HARBOR_DOMAIN/api/v2.0/projects/k8s/repositories" | jq -r '.[].name | sub("^k8s/"; "")')

for repo in $REPOSITORIES; do
    echo "=======start========"
    echo "$repo"
    # List all artifacts in the repository
    ARTIFACTS=$(curl -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" -k -s "$HARBOR_DOMAIN/api/v2.0/projects/k8s/repositories/$repo/artifacts")

    # Loop through each artifact
    echo "$ARTIFACTS" | jq -c '.[]' | while read -r artifact; do
        DIGEST=$(echo "$artifact" | jq -r '.digest')
    
        # Delete the artifact using its digest and print the response
        echo "Deleting digest: $DIGEST"
        RESPONSE=$(curl -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" -k -X DELETE -w "%{http_code}" -o /dev/null "$HARBOR_DOMAIN/api/v2.0/projects/k8s/repositories/$repo/artifacts/$DIGEST")
        
        if [ "$RESPONSE" == "200" ] || [ "$RESPONSE" == "202" ]; then
            echo "Artifact with digest $DIGEST deleted successfully."
        else
            echo "Failed to delete artifact with digest $DIGEST. HTTP response code: $RESPONSE."
        fi
    done

    # Delete the repository after all artifacts have been deleted
    REPO_DELETE_RESPONSE=$(curl -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" -k -X DELETE -w "%{http_code}" -o /dev/null "$HARBOR_DOMAIN/api/v2.0/projects/k8s/repositories/$repo")
    
    if [ "$REPO_DELETE_RESPONSE" == "200" ] || [ "$REPO_DELETE_RESPONSE" == "202" ]; then
        echo "Repository $repo deleted successfully."
    else
        echo "Failed to delete repository $repo. HTTP response code: $REPO_DELETE_RESPONSE."
    fi

    echo "=======end========"
    echo " "
done

# Trigger garbage collection
GC_RESPONSE=$(curl -s -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" -X POST "$HARBOR_DOMAIN/api/v2.0/system/gc/schedule" -H "Content-Type: application/json" -d '{"schedule":{"type":"Manual"}}')
echo "Garbage collection triggered: $GC_RESPONSE"

while true; do
    GC_STATUS=$(curl -s -u "$HARBOR_USERNAME:$HARBOR_PASSWORD" "$HARBOR_DOMAIN/api/v2.0/system/gc" | jq -r '.[0].job_status')
    echo "Current garbage collection job status: $GC_STATUS"
    
    if [ "$GC_STATUS" != "Running" ]; then
        echo "Garbage collection job has finished with status: $GC_STATUS"
        break
    fi
    
    # Wait for a bit before checking again
    sleep 30
done