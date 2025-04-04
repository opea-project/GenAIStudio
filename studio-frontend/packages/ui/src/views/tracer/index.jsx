import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { styled } from "@mui/material/styles";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Box,
    Typography,
    Divider,
    TablePagination,
    Fade
} from "@mui/material";
import { tableCellClasses } from '@mui/material/TableCell'


import config from '@/config'

const traceListMock = [
    { trace_id: "191c1fb1992400f8a28a4ed2cf4ea5ee", start: "2025-03-28T19:30:05", end: "2025-03-28T19:30:05" },
    { trace_id: "d1e23fbd80bbbce9b8d4841c2c1f8bb2", start: "2025-03-28T19:30:05", end: "2025-03-28T19:30:05" },
    { trace_id: "f8451764db8ffa42922e59e93cb4695e", start: "2025-03-28T19:29:36", end: "2025-03-28T19:29:36" },
    { trace_id: "fd0453f5995fe0b57d05083c328d3b30", start: "2025-03-28T19:29:36", end: "2025-03-28T19:29:36" }
];

const traceDataMock = {
    "trace_id": "191c1fb1992400f8a28a4ed2cf4ea5ee",
    "spans": [
        {
            "timestamp": "2025-03-28T19:30:05.335611",
            "span_id": "0abb4b73d7abce22",
            "parent_span_id": "",
            "span_name": "schedule",
            "span_kind": "Internal",
            "service_name": "opea",
            "resource_attributes": {
                "service.name": "opea",
                "telemetry.sdk.language": "python",
                "telemetry.sdk.name": "opentelemetry",
                "telemetry.sdk.version": "1.31.1"
            },
            "scope_name": "comps.cores.telemetry.opea_telemetry",
            "scope_version": "",
            "llm_input": null,
            "llm_output": null,
            "duration": 129250933,
            "status_code": "Unset",
            "status_message": "",
            "children": [
                {
                    "timestamp": "2025-03-28T19:30:05.335802",
                    "span_id": "f8980e9f6a2097e5",
                    "parent_span_id": "0abb4b73d7abce22",
                    "span_name": "execute",
                    "span_kind": "Internal",
                    "service_name": "opea",
                    "resource_attributes": {
                        "service.name": "opea",
                        "telemetry.sdk.language": "python",
                        "telemetry.sdk.name": "opentelemetry",
                        "telemetry.sdk.version": "1.31.1"
                    },
                    "scope_name": "comps.cores.telemetry.opea_telemetry",
                    "scope_version": "",
                    "llm_input": null,
                    "llm_output": null,
                    "duration": 114697323,
                    "status_code": "Unset",
                    "status_message": "",
                    "children": [
                        {
                            "timestamp": "2025-03-28T19:30:05.335971",
                            "span_id": "411fd03a56bfcb34",
                            "parent_span_id": "f8980e9f6a2097e5",
                            "span_name": "opea_service@embedding_tei_langchain_0_generate",
                            "span_kind": "Internal",
                            "service_name": "opea",
                            "resource_attributes": {
                                "service.name": "opea",
                                "telemetry.sdk.language": "python",
                                "telemetry.sdk.name": "opentelemetry",
                                "telemetry.sdk.version": "1.31.1"
                            },
                            "scope_name": "comps.cores.telemetry.opea_telemetry",
                            "scope_version": "",
                            "llm_input": "{'query': 'You are a helpful assistant.\\nuser: 2025\\nassistant: Please provide either an exact time frame or specific year so that we can accurately determine b\"Intel\\'s \"third-quarter revenues during those periods as they change overtime due market conditions & company performance dynamics .\\n', 'input': 'You are a helpful assistant.\\nuser: 2025\\nassistant: Please provide either an exact time frame or specific year so that we can accurately determine b\"Intel\\'s \"third-quarter revenues during those periods as they change overtime due market conditions & company performance dynamics .\\n', 'inputs': 'You are a helpful assistant.\\nuser: 2025\\nassistant: Please provide either an exact time frame or specific year so that we can accurately determine b\"Intel\\'s \"third-quarter revenues during those periods as they change overtime due market conditions & company performance dynamics .\\n'}",
                            "llm_output": "{\"object\":\"list\",\"model\":\"BAAI/bge-large-en-v1.5\",\"data\":[{\"index\":0,\"object\":\"embedding\",\"embedding\":[0.045438584,-0.009384035,-0.03649364,0.029956784,0.004572626,-0.013706143,0.04541934,0.019813301]}],\"usage\":{\"prompt_tokens\":55,\"total_tokens\":55,\"completion_tokens\":0}}",
                            "duration": 113867985,
                            "status_code": "Unset",
                            "status_message": "",
                            "children": []
                        }
                    ]
                },
                {
                    "timestamp": "2025-03-28T19:30:05.450597",
                    "span_id": "5b64234df1e7f94a",
                    "parent_span_id": "0abb4b73d7abce22",
                    "span_name": "execute",
                    "span_kind": "Internal",
                    "service_name": "opea",
                    "resource_attributes": {
                        "service.name": "opea",
                        "telemetry.sdk.language": "python",
                        "telemetry.sdk.name": "opentelemetry",
                        "telemetry.sdk.version": "1.31.1"
                    },
                    "scope_name": "comps.cores.telemetry.opea_telemetry",
                    "scope_version": "",
                    "llm_input": null,
                    "llm_output": null,
                    "duration": 5445603,
                    "status_code": "Unset",
                    "status_message": "",
                    "children": [
                        {
                            "timestamp": "2025-03-28T19:30:05.451172",
                            "span_id": "322b645da14cbbee",
                            "parent_span_id": "5b64234df1e7f94a",
                            "span_name": "opea_service@retriever_redis_0_generate",
                            "span_kind": "Internal",
                            "service_name": "opea",
                            "resource_attributes": {
                                "service.name": "opea",
                                "telemetry.sdk.language": "python",
                                "telemetry.sdk.name": "opentelemetry",
                                "telemetry.sdk.version": "1.31.1"
                            },
                            "scope_name": "comps.cores.telemetry.opea_telemetry",
                            "scope_version": "",
                            "llm_input": "{'text': 'You are a helpful assistant.\\nuser: 2025\\nassistant: Please provide either an exact time frame or specific year so that we can accurately determine b\"Intel\\'s \"third-quarter revenues during those periods as they change overtime due market conditions & company performance dynamics .\\n', 'embedding': [0.045438584, -0.009384035, -0.03649364, 0.029956784, 0.004572626, -0.013706143, 0.04541934, 0.019813301], 'search_type': 'similarity'}",
                            "llm_output": "{\"id\":\"77886b9106a1906f16edfd419b221827\",\"retrieved_docs\":[],\"initial_query\":\"You are a helpful assistant.\\nuser: 2025\\nassistant: Please provide either an exact time frame or specific year so that we can accurately determine b\\\"Intel's \\\"third-quarter revenues during those periods as they change overtime due market conditions & company performance dynamics .\\n\",\"top_n\":1,\"metadata\":[]}",
                            "duration": 4429245,
                            "status_code": "Unset",
                            "status_message": "",
                            "children": []
                        }
                    ]
                },
                {
                    "timestamp": "2025-03-28T19:30:05.456122",
                    "span_id": "ac72a4818c8483be",
                    "parent_span_id": "0abb4b73d7abce22",
                    "span_name": "execute",
                    "span_kind": "Internal",
                    "service_name": "opea",
                    "resource_attributes": {
                        "service.name": "opea",
                        "telemetry.sdk.language": "python",
                        "telemetry.sdk.name": "opentelemetry",
                        "telemetry.sdk.version": "1.31.1"
                    },
                    "scope_name": "comps.cores.telemetry.opea_telemetry",
                    "scope_version": "",
                    "llm_input": null,
                    "llm_output": null,
                    "duration": 8550205,
                    "status_code": "Unset",
                    "status_message": "",
                    "children": [
                        {
                            "timestamp": "2025-03-28T19:30:05.456243",
                            "span_id": "3d7c3572e33ddf7e",
                            "parent_span_id": "ac72a4818c8483be",
                            "span_name": "opea_service@llm_tgi_0_asyn_generate",
                            "span_kind": "Internal",
                            "service_name": "opea",
                            "resource_attributes": {
                                "service.name": "opea",
                                "telemetry.sdk.language": "python",
                                "telemetry.sdk.name": "opentelemetry",
                                "telemetry.sdk.version": "1.31.1"
                            },
                            "scope_name": "comps.cores.telemetry.opea_telemetry",
                            "scope_version": "",
                            "llm_input": null,
                            "llm_output": null,
                            "duration": 8394298,
                            "status_code": "Unset",
                            "status_message": "",
                            "children": []
                        }
                    ]
                }
            ]
        }
    ]
}

const TraceNode = ({ node, handleSelect }) => {
  console.log('TraceNode', TraceNode)
  return (
    <Box sx={{ mb: 2 }}>
        <Button fullWidth variant="outlined" onClick={() => handleSelect(node)}>
            <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <Typography>{node.span_name}</Typography>
                <Typography variant="caption" color="text.secondary">{node.duration}ms</Typography>
            </Box>
        </Button>
        {node.children && node.children.length > 0 && (
            <Box sx={{ ml: 2, pl: 1, borderLeft: 1, borderColor: "grey.500" }}>
                {node.children.map((child) => (
                    <TraceNode key={child.span_id} node={child} handleSelect={handleSelect} />
                ))}
            </Box>
        )}
    </Box>
)};

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

export default function LLMTraces() {
    const [traceList, setTraceList] = useState([]);
    const [traceData, setTraceData] = useState({});
    const [selectedTrace, setSelectedTrace] = useState(null);
    const [selectedSpan, setSelectedSpan] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { ns } = useParams();
    console.log("ns: ", ns);

    const studio_server_url = config.studio_server_url;
    const sandbox_tracer_list_endpoint = config.sandbox_tracer_list_endpoint;
    const sandbox_tracer_tree_endpoint = config.sandbox_tracer_tree_endpoint;

    // Fetch trace ids from the server
    const fetchTraces = async (ns) => {
        console.log("fetchTraces", ns);
        const url = `${studio_server_url}/${sandbox_tracer_list_endpoint}/${ns}`;
        try {
            const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
            if (response.ok) {
                const response_data = await response.json();
                console.log("response_data", response_data);
                if (response_data && response_data.trace_ids) {
                    setTraceList(response_data.trace_ids);
                } else {
                    console.error("Invalid response data structure:", response_data);
                    setTraceList(traceListMock); // Fallback to mock data
                }
            } else {
                console.error("Error fetching traces:", response.statusText);
                setTraceList(traceListMock); // Fallback to mock data on error
            }

        } catch (error) {
            console.error("Error fetching traces:", error);
            setTraceList(traceListMock); // Fallback to mock data on error
        }
    };

    // Fetch trace tree from the server
    const fetchTraceTree = async (trace_id) => {
        console.log("fetchTraceTree", trace_id);
        const url = `${studio_server_url}/${sandbox_tracer_tree_endpoint}/${trace_id}`;
        try {
            const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
            const data = response.ok ? await response.json() : traceDataMock; // Use mock data if response is not OK
            setTraceData(data);
        } catch (error) {
            console.error("Error fetching trace tree:", error);
            setTraceData(traceDataMock); // Fallback to mock data on error
        }
    };

    const handleTraceSelect = (trace_id) => {
        console.log("handleTraceSelect", trace_id);
        setSelectedTrace(trace_id);
        setSelectedSpan(null);
    };

    const handleSpanSelect = (span) => {
        setSelectedSpan(span);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };


    // Use Effects
    useEffect(() => {
        console.log("useEffect ns");
        fetchTraces(ns);
    }, [studio_server_url, sandbox_tracer_list_endpoint, ns]);

    useEffect(() => {
        console.log("useEffect selectedTrace", selectedTrace);
        if (selectedTrace) {
            fetchTraceTree(selectedTrace);
        } else {
            setTraceData({});
        }
    }
    , [selectedTrace, studio_server_url, sandbox_tracer_tree_endpoint]);


    return (
        <Box sx={{ display: "flex", height: "100vh", p: 4, gap: 2, position: "relative" }}>
            <Box sx={{ flex: 1, opacity: selectedTrace ? 0.5 : 1 }}>
                <Typography variant="h6" gutterBottom>Traces</Typography>
                <TableContainer component={Paper} sx={{ border: 1, borderColor: "grey.900", borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Trace ID</StyledTableCell>
                                <StyledTableCell>Start</StyledTableCell>
                                <StyledTableCell>End</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        <TableBody>
                            {traceList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((trace) => (
                                <StyledTableRow key={trace.trace_id} hover onClick={() => handleTraceSelect(trace.trace_id)}>
                                    <StyledTableCell>{trace.trace_id}</StyledTableCell>
                                    <StyledTableCell>{trace.start}</StyledTableCell>
                                    <StyledTableCell>{trace.end}</StyledTableCell>
                                </StyledTableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5,10,20,50]}
                    component="div"
                    count={traceList.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Box>
            {selectedTrace && (
                <Box sx={{ position: "absolute", top: 0, right: 0, width: "75%", height: "100%", bgcolor: "white", boxShadow: 3, p: 4, overflow: "auto", borderLeft: 1, display: "flex", flexDirection: "row" }}>
                    <Button sx={{ position: "absolute", top: 8, right: 8 }} onClick={() => setSelectedTrace(null)}>✕</Button>
                    <Box sx={{ flex: 1, pr: 2, borderRight: 1 }}>
                        <Typography variant="h6">Trace ID: {selectedTrace}</Typography>
                        {traceData && traceData.spans ? (
                            <div>
                                {traceData.spans.map((span) => (
                                    <TraceNode key={span.span_id} node={span} handleSelect={handleSpanSelect} />
                                ))}
                            </div>
                        ) : (
                            <p>Loading trace data...</p>
                        )}
                    </Box>
                    {selectedSpan && (
                        <Fade in={true} timeout={500}>
                            <Box sx={{ flex: 1, padding: "16px" }}>
                                <Typography variant="h6">{selectedSpan.span_name}</Typography>
                                <Typography><strong>Timestamp:</strong> {selectedSpan.timestmap}ms</Typography>
                                <Typography><strong>Duration:</strong> {selectedSpan.duration}ms</Typography>
                                <Typography><strong>Status:</strong> {selectedSpan.status_code}</Typography>
                                <Typography><strong>Service:</strong> {selectedSpan.service_name}</Typography>
                                <Typography><strong>LLM Input:</strong> {selectedSpan.llm_input}</Typography>
                                <Typography><strong>LLM Output:</strong> {selectedSpan.llm_output}</Typography>
                                
                            </Box>
                        </Fade>
                    )}
                </Box>
            )}
        </Box>
    );
}
