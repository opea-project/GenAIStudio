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
    Stack,
    Typography,
    Divider,
    TablePagination,
    Fade
} from "@mui/material";
import { tableCellClasses } from '@mui/material/TableCell'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import chatflowsApi from '@/api/chatflows';
import useApi from '@/hooks/useApi';

import config from '@/config'

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
    const [workflowName, setWorkflowName] = useState('');

    const { ns } = useParams();
    console.log("ns: ", ns);

    const studio_server_url = config.studio_server_url;
    const sandbox_tracer_list_endpoint = config.sandbox_tracer_list_endpoint;
    const sandbox_tracer_tree_endpoint = config.sandbox_tracer_tree_endpoint;

    const getAllOpeaflowsApi = useApi(chatflowsApi.getAllOpeaflows);

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
                    setTraceList([]);
                }
            } else {
                console.error("Error fetching traces:", response.statusText);
                setTraceList([]);
            }
        } catch (error) {
            console.error("Error fetching traces:", error);
            setTraceList([]);
        }
    };

    // Fetch trace tree from the server
    const fetchTraceTree = async (trace_id) => {
        console.log("fetchTraceTree", trace_id);
        const url = `${studio_server_url}/${sandbox_tracer_tree_endpoint}/${trace_id}`;
        try {
            const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
            const data = response.ok ? await response.json() : [];
            setTraceData(data);
        } catch (error) {
            console.error("Error fetching trace tree:", error);
            setTraceData([]);
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

    useEffect(() => {
        getAllOpeaflowsApi.request();
    }, []);

    useEffect(() => {
        if (getAllOpeaflowsApi.data && ns) {
            // Namespace is usually sandbox-<workflow.id>
            const flows = getAllOpeaflowsApi.data;
            const found = flows.find(flow => `sandbox-${flow.id}` === ns);
            setWorkflowName(found ? found.name : '');
        }
    }, [getAllOpeaflowsApi.data, ns]);


    return (
        <Box sx={{ display: "flex", height: "100vh", gap: 2, position: "relative", p: 3 }}>
            <Stack flexDirection='column' sx={{ gap: 0, flex: 1, opacity: selectedTrace ? 0.5 : 1 }}>
                <Box>
                    <Typography 
                        sx={{
                            fontSize: '1.5rem',
                            color: '#1162cc',
                            fontWeight: 600,
                            mb: 2,
                            mt: 1.5
                        }}
                        variant='h1'
                    >
                        LLM Call Traces
                    </Typography>
                    {workflowName && (
                        <Typography variant="h6" gutterBottom>
                            Workflow name: {workflowName}
                        </Typography>
                    )}
                </Box>
                {traceList.length > 0 ? (
                    <>
                        <Typography variant="h6" gutterBottom>Traces:</Typography>
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
                            rowsPerPageOptions={[5, 10, 20, 50]}
                            component="div"
                            count={traceList.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                ) : (
                    <Typography variant="body1" sx={{ mt: 2 }}>No traces found</Typography>
                )}
            </Stack>
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
