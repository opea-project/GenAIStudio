from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class NodeModel(BaseModel):
    category: str
    connected_from: List[str]
    connected_to: List[str]
    hideOutput: bool = Field(default=False)
    id: str
    inMegaservice: bool
    inference_params: Dict[str, Any]
    name: str
    params: Optional[Dict[str, Any]] = Field(default={})
    version: int
    dependent_services: Dict[str, Dict[str, str]] = Field(default={})

class UIConfigModel(BaseModel):
    chat_completion: bool
    chat_input: bool
    doc_input: bool

class ProjectInfoModel(BaseModel):
    chat_completion_ids: List[str]
    chat_input_ids: List[str]
    doc_input_ids: List[str]
    id: str
    name: str
    nodes: Dict[str, NodeModel]
    ui_config: UIConfigModel