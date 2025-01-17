from typing import List, Optional, Dict, Union
from pydantic import BaseModel, Field
from datetime import datetime

class OutputAnchor(BaseModel):
    id: str
    name: str
    label: str
    description: str
    type: str

class InputAnchor(BaseModel):
    label: str
    name: str
    type: str
    id: str

class InputParamOption(BaseModel):
    name: str
    label: str

class InputParam(BaseModel):
    label: str
    name: str
    type: str
    default: Union[str, int, float, bool, None]
    id: str
    optional: Optional[bool] = None
    additionalParams: Optional[bool] = None
    inferenceParams: Optional[bool] = None
    rows: Optional[bool] = None
    options: Optional[List[InputParamOption]] = None

class Node(BaseModel):
    name: str
    version: int
    category: str
    inMegaservice: bool
    inputAnchors: List[InputAnchor]
    inputParams: List[InputParam]
    inputs: Dict[str, str]
    outputs: Dict[str, str]
    outputAnchors: List[OutputAnchor]
    id: str
    dependent_services: Optional[Dict[str, Dict[str, str]]] = None
    hideOutput: Optional[bool] = None

class FlowData(BaseModel):
    nodes: List[Node]

class PipelineFlow(BaseModel):
    id: str
    name: str
    flowData: FlowData
    deployed: bool
    isPublic: bool
    apikeyid: Optional[str] = None
    chatbotConfig: Optional[str] = None
    apiConfig: Optional[str] = None
    analytic: Optional[str] = None
    speechToText: Optional[str] = None
    category: Optional[str] = None
    type: str
    sandboxStatus: Optional[str] = None
    createdDate: datetime
    updatedDate: datetime

class WorkflowId(BaseModel):
    id: str