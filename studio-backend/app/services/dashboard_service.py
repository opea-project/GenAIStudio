import json
import os
import requests
import base64

from app.utils.dashboard_utils import load_and_replace_grafana_template 

# Read environment variables
template_file_path = os.path.join(os.path.dirname(__file__), '..', 'templates', 'grafana-dashboards', 'sandbox-dashboard.json')

def import_grafana_dashboards(namespace_name):

    print("Getting post_url")
    grafana_url = os.getenv("GRAFANA_DNS", "localhost:30007")
    post_url = f"http://{grafana_url}/grafana/api/dashboards/db"

    print("Getting headers")
    # Encode username and password for basic authentication
    auth_str = f"admin:prom-operator"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {b64_auth_str}"
    }

    print("Getting payload data")
    placeholders = {
        "___DASHBOARD_TITLE___": namespace_name,
        "___DASHBOARD_UID___": namespace_name.replace("sandbox-",""),
        "___EXPR_NAMESPACE___": namespace_name}
    dashboard_json = load_and_replace_grafana_template(template_file_path, placeholders)
    
    print(f"Importing dashboard {namespace_name}")
    print(f"post_url: {post_url}")
    try:
        response = requests.post(post_url, headers=headers, data=json.dumps(dashboard_json))
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
    except Exception as e:
        print(f"Exception occurred: {e}")
    
    return response.text
    
def delete_dashboard(namespace_name):
    grafana_url = os.getenv("GRAFANA_DNS", "localhost:30007")
    post_url = f"http://{grafana_url}/grafana/api/dashboards/uid/{namespace_name.replace('sandbox-','')}"
    auth_str = f"admin:prom-operator"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {b64_auth_str}"
    }
    print(f"Deleting dashboard {namespace_name}")
    print(f"post_url: {post_url}")
    try:
        response = requests.delete(post_url, headers=headers)
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
    except Exception as e:
        print(f"Exception occurred: {e}")