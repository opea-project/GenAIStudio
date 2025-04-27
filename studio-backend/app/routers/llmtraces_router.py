from fastapi import APIRouter, HTTPException
from clickhouse_driver import Client
import os


router = APIRouter()

# Initialize ClickHouse client
clickhouse_host, clickhouse_port = os.getenv('CLICKHOUSE_DNS', 'clickhouse.tracing.svc.cluster.local:9000').split(':')
clickhouse_port = int(clickhouse_port)
client = Client(host=clickhouse_host, port=clickhouse_port)

@router.get("/trace-ids/{namespace}")
async def list_trace_ids(namespace: str):
    try:
        query = """
        SELECT DISTINCT tts.TraceId, tts.Start, tts.End
        FROM otel.otel_traces_trace_id_ts AS tts
        INNER JOIN otel.otel_traces AS ot ON tts.TraceId = ot.TraceId
        WHERE ot.ResourceAttributes['k8s.namespace.name'] = %(namespace)s
        """
        print(f"Query: {query}")
        result = client.execute(query, {'namespace': namespace})

        if not result:
            raise HTTPException(status_code=404, detail="No TraceIds found")

        trace_ids = [{"trace_id": row[0], "start": row[1], "end": row[2]} for row in result]

        return {
            "trace_ids": trace_ids
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error fetching trace IDs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/trace-tree/{trace_id}")
async def get_trace_tree(trace_id: str):
    try:
        query = """
        SELECT Timestamp, SpanId, ParentSpanId, SpanName, SpanKind, ServiceName, ResourceAttributes, ScopeName, ScopeVersion, SpanAttributes, Duration, StatusCode, StatusMessage
        FROM otel.otel_traces
        WHERE TraceId = %(trace_id)s
        """
        result = client.execute(query, {'trace_id': trace_id})

        if not result:
            raise HTTPException(status_code=404, detail="TraceId not found")

        spans_by_id = {}

        for row in result:
            (timestamp, span_id, parent_span_id, span_name, span_kind, service_name, resource_attributes, scope_name, scope_version, span_attributes, duration, status_code, status_message) = row

            llm_input = span_attributes.get('llm.input') if span_attributes and isinstance(span_attributes, dict) else None
            llm_output = span_attributes.get('llm.output') if span_attributes and isinstance(span_attributes, dict) else None

            spans_by_id[span_id] = {
                "timestamp": timestamp,
                "span_id": span_id,
                "parent_span_id": parent_span_id,
                "span_name": span_name,
                "span_kind": span_kind,
                "service_name": service_name,
                "resource_attributes": resource_attributes,
                "scope_name": scope_name,
                "scope_version": scope_version,
                "llm_input": llm_input,
                "llm_output": llm_output,
                "duration": duration,
                "status_code": status_code,
                "status_message": status_message,
                "children": []
            }

        root_spans = []
        for span in spans_by_id.values():
            parent_span_id = span["parent_span_id"]
            if parent_span_id and parent_span_id in spans_by_id:
                spans_by_id[parent_span_id]["children"].append(span)
            else:
                root_spans.append(span)

        return {
            "trace_id": trace_id,
            "spans": root_spans
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error fetching trace tree: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")