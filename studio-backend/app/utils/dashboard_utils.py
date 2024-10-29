import json

def load_and_replace_grafana_template(file_path, replacements):
    with open(file_path, 'r') as file:
        template = file.read()
        for placeholder, replacement in replacements.items():
            template = template.replace(placeholder, replacement)
        return json.loads(template)