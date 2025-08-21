#!/bin/bash

# GenAI Studio Complete Cleanup Script
# This script ensures all namespaces and resources are properly deleted

set -e

echo "========================================"
echo "GenAI Studio Complete Cleanup Script"
echo "========================================"
echo

# Function to check if namespace exists
namespace_exists() {
    kubectl get namespace "$1" &>/dev/null
}

# Function to delete namespace with comprehensive cleanup
cleanup_namespace() {
    local ns=$1
    local manifest_file=$2
    
    if ! namespace_exists "$ns"; then
        echo "✅ Namespace '$ns' does not exist, skipping..."
        return 0
    fi
    
    echo "🧹 Cleaning up namespace: $ns"
    
    # Delete resources using manifest if provided
    echo "  - Deleting resources using manifest: $manifest_file"
    if [ ! -z "$manifest_file" ] && [ -f "$manifest_file" ]; then
        kubectl delete -f "$manifest_file" --timeout=120s --ignore-not-found=true || true
    elif [ ! -z "$manifest_file" ]; then
        echo "  - Namespace $ns has no manifest"
    fi
    
    # Delete Helm releases in the namespace
    echo "  - Checking for Helm releases in $ns..."
    helm list -n "$ns" -q 2>/dev/null | xargs -r -I {} helm delete {} -n "$ns" --timeout=120s || true
    
    # Wait for pods to terminate gracefully
    echo "  - Waiting for pods to terminate gracefully..."
    if kubectl get pods -n "$ns" --no-headers 2>/dev/null | grep -q .; then
        kubectl wait --for=delete pod --all --namespace="$ns" --timeout=180s || true
    else
        echo "    No pods found in namespace $ns"
    fi
    
    # Force delete any remaining pods
    echo "  - Force deleting any remaining pods..."
    REMAINING_PODS=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | awk '{print $1}' || true)
    if [ ! -z "$REMAINING_PODS" ]; then
        echo "    Found remaining pods: $REMAINING_PODS"
        echo "$REMAINING_PODS" | xargs -r kubectl delete pod -n "$ns" --force --grace-period=0 || true
    else
        echo "    No remaining pods to force delete"
    fi
    
    # Delete PVCs
    echo "  - Deleting PersistentVolumeClaims..."
    PVCS=$(kubectl get pvc -n "$ns" --no-headers 2>/dev/null | awk '{print $1}' || true)
    if [ ! -z "$PVCS" ]; then
        echo "    Found PVCs: $PVCS"
        echo "$PVCS" | xargs -r kubectl delete pvc -n "$ns" --timeout=60s || true
    else
        echo "    No PVCs found in namespace $ns"
    fi
    
    # Delete secrets (except default service account token)
    echo "  - Deleting secrets..."
    SECRETS=$(kubectl get secrets -n "$ns" --no-headers 2>/dev/null | grep -v "default-token" | awk '{print $1}' || true)
    if [ ! -z "$SECRETS" ]; then
        echo "    Found secrets: $SECRETS"
        echo "$SECRETS" | xargs -r kubectl delete secret -n "$ns" || true
    else
        echo "    No custom secrets found in namespace $ns"
    fi
    
    # Delete configmaps
    echo "  - Deleting configmaps..."
    CONFIGMAPS=$(kubectl get configmaps -n "$ns" --no-headers 2>/dev/null | grep -v "kube-root-ca.crt" | awk '{print $1}' || true)
    if [ ! -z "$CONFIGMAPS" ]; then
        echo "    Found configmaps: $CONFIGMAPS"
        echo "$CONFIGMAPS" | xargs -r kubectl delete configmap -n "$ns" || true
    else
        echo "    No custom configmaps found in namespace $ns"
    fi
    
    # Finally delete the namespace
    echo "  - Deleting namespace..."
    kubectl delete namespace "$ns" --timeout=120s || true
    
    # If namespace still exists, patch it to remove finalizers
    if namespace_exists "$ns"; then
        echo "  - Namespace still exists, removing finalizers..."
        kubectl patch namespace "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge || true
        kubectl delete namespace "$ns" --force --grace-period=0 || true
    fi
    
    # Final check
    if namespace_exists "$ns"; then
        echo "  ❌ WARNING: Namespace '$ns' still exists after cleanup"
        return 1
    else
        echo "  ✅ SUCCESS: Namespace '$ns' has been deleted"
        return 0
    fi
}

# Main cleanup process
echo "Starting comprehensive cleanup..."
echo

# Change to the setup directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean up sandbox namespaces first
echo "🔍 Looking for sandbox namespaces..."
SANDBOX_NAMESPACES=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep '^sandbox-' || true)

if [ ! -z "$SANDBOX_NAMESPACES" ]; then
    echo "Found sandbox namespaces: $SANDBOX_NAMESPACES"
    for ns in $SANDBOX_NAMESPACES; do
        cleanup_namespace "$ns"
    done
else
    echo "✅ No sandbox namespaces found"
fi

echo

# Clean up main namespaces
MAIN_NAMESPACES=(
    "studio:manifests/studio-manifest.yaml"
    "monitoring:manifests/monitoring-manifest.yaml"
    "tracing:"
    "mysql:"
)

for ns_info in "${MAIN_NAMESPACES[@]}"; do
    IFS=':' read -r ns manifest <<< "$ns_info"
    cleanup_namespace "$ns" "$manifest"
    echo
done

# # Clean up any remaining Helm releases globally
# echo "🧹 Cleaning up any remaining Helm releases..."
# helm list --all-namespaces --filter="mysql|kube-prometheus-stack|clickhouse|pascaliske" -q 2>/dev/null | \
# while read -r release; do
#     if [ ! -z "$release" ]; then
#         echo "  - Deleting Helm release: $release"
#         helm delete "$release" --timeout=60s || true
#     fi
# done

# Check local-path-storage namespace and explain why it's preserved
echo "🔒 Checking local-path-storage namespace..."
if namespace_exists "local-path-storage"; then
    echo "  ✅ INTENTIONALLY PRESERVED: local-path-storage namespace exists"
    echo "  📝 This namespace provides storage provisioning and is NOT cleaned up because:"
    echo "     - It may be used by other applications beyond GenAI Studio"
    echo "     - Deleting it would break any existing PVCs using local-path storage"
    echo "     - The local-path StorageClass would become non-functional"
    echo "     - It's a cluster-wide infrastructure component"
    echo ""
    echo "  💡 To manually remove local-path-storage later (if you're sure it's safe):"
    echo "     kubectl delete namespace local-path-storage"
    echo "     kubectl delete storageclass local-path"
else
    echo "  ℹ️  local-path-storage namespace does not exist"
fi


echo
echo "========================================"
echo "Cleanup Summary"
echo "========================================"

# Final verification
FAILED_CLEANUP=()
NAMESPACES_TO_CHECK="studio monitoring tracing mysql"

for ns in $NAMESPACES_TO_CHECK; do
    if namespace_exists "$ns"; then
        echo "❌ FAILED: Namespace '$ns' still exists"
        FAILED_CLEANUP+=("$ns")
    else
        echo "✅ SUCCESS: Namespace '$ns' deleted"
    fi
done

# Special handling for local-path-storage (intentionally preserved)
if namespace_exists "local-path-storage"; then
    echo "🔒 PRESERVED: Namespace 'local-path-storage' intentionally kept"
else
    echo "ℹ️  INFO: Namespace 'local-path-storage' was not present"
fi

# Check for remaining sandbox namespaces
REMAINING_SANDBOX=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep '^sandbox-' || true)
if [ ! -z "$REMAINING_SANDBOX" ]; then
    echo "❌ FAILED: Remaining sandbox namespaces: $REMAINING_SANDBOX"
    FAILED_CLEANUP+=("sandbox namespaces")
else
    echo "✅ SUCCESS: All sandbox namespaces deleted"
fi

echo
if [ ${#FAILED_CLEANUP[@]} -eq 0 ]; then
    echo "🎉 All namespaces have been successfully cleaned up!"
    exit 0
else
    echo "⚠️  Some namespaces failed to cleanup: ${FAILED_CLEANUP[*]}"
    echo "You may need to manually investigate and clean up these namespaces."
    exit 1
fi
