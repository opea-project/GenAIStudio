import json
import re

class WorkflowInfo:
    def __init__(self, pipeline):
        data = pipeline
        self.id = data['id']
        self.name = data['name']
        self._data = data
        self.generate_dag()
        
    def export_to_json(self, filename=None):
        # Create a dictionary excluding the _data attribute
        export_data = {k: v for k, v in self.__dict__.items() if k != '_data'}
        if filename:
            with open(filename, 'w') as f:
                json.dump(export_data, f, sort_keys=True, indent=4)
        return json.dumps(export_data, sort_keys=True, indent=4)
    
    def generate_dag(self):
        flowData = self._data['flowData']
        dag_nodes = {}
        ui_config = {
            'chat_input': False,
            'chat_completion': False,
            'doc_input': False
        }
        chat_input_ids = []
        chat_completion_ids = []
        doc_input_ids = []

        # Ensure 'nodes' is present in flowData
        if 'nodes' not in flowData:
            raise Exception('nodes not found in flowData')

        for node in flowData['nodes']:
            # Debugging: Print the current node being processed

            if node['category'] == 'Controls':
                node_name = node['name']
                if node_name == 'chat_input':
                    ui_config['chat_input'] = True
                    chat_input_ids.append(node['id'])
                elif node_name == 'doc_input':
                    ui_config['doc_input'] = True
                    doc_input_ids.append(node['id'])
                elif node_name == 'chat_completion':
                    ui_config['chat_completion'] = True
                    chat_completion_ids.append(node['id'])
            node['connected_from'] = []
            node['connected_to'] = []
            node['params'] = {}
            dag_nodes[node['id']] = node  # Collect other nodes

        # Print information about collected nodes
        for id, node_data in dag_nodes.items():
            if 'inputs' in node_data:  # Check if 'inputs' key exists
                for input_key, input_value in node_data['inputs'].items():  # Renamed 'input' to 'input_item' for clarity
                    # Check if input is connected to another node
                    if isinstance(input_value, str):
                        anchorMatch = re.match('\{\{(.*)\.data\.instance\}\}', input_value)
                        if anchorMatch:
                            connected_from_id = anchorMatch.group(1)
                            node_data['connected_from'].append(connected_from_id)
                            dag_nodes[connected_from_id]['connected_to'].append(id)
                            continue

                    if input_key == 'huggingFaceToken' and not input_value:
                        # If huggingFaceToken is empty, set it to 'NA'
                        input_value = 'NA'

                    if input_key == 'openaiApiKey' and not input_value:
                        # If openaiApiKey is empty, set it to 'NA'
                        input_value = 'NA'
                    
                    inputParamObject = [p for p in node_data['inputParams'] if p['name'] == input_key][0]
                    if inputParamObject.get('type') == 'number':
                        input_value = 0 if input_value == '' else float(input_value)
                        node_data['inputs'][input_key] = input_value

                    # Handle llmEngine specific logic
                    llm_engine = node_data['inputs'].get('llmEngine')
                    node_data['params'][input_key] = input_value
                    if llm_engine == "openai":
                        node_data['dependent_services'] = {}
                        continue
                    else:
                        for service_type, service_params in list(node_data['dependent_services'].items()):
                            if llm_engine:
                                if llm_engine == service_type:
                                    if input_key in service_params:
                                        node_data['dependent_services'][service_type][input_key] = input_value
                                        node_data['params'].pop(input_key, None)
                                        continue
                                else:
                                    node_data['dependent_services'].pop(service_type, None)
                                    continue
                            else:
                                if input_key in service_params:
                                    node_data['dependent_services'][service_type][input_key] = input_value
                                    node_data['params'].pop(input_key, None)
                                    continue

                del node_data['inputParams']
                del node_data['inputs']
                del node_data['outputs']
                del node_data['inputAnchors']
                del node_data['outputAnchors']
        self.nodes = dag_nodes
        self.ui_config = ui_config
        self.chat_input_ids = chat_input_ids
        self.chat_completion_ids = chat_completion_ids
        self.doc_input_ids = doc_input_ids

        