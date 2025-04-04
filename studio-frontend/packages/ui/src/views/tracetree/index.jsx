import React from 'react';

// Recursive component to render each span and its children
const SpanNode = ({ span }) => {
  return (
    <div style={{ marginLeft: '20px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
      <div>
        <strong>{span.span_name}</strong> (ID: {span.span_id})
      </div>
      <div>Timestamp: {span.timestamp}</div>
      <div>Duration: {span.duration} ns</div>
      <div>Status: {span.status_code}</div>
      <div>Service: {span.service_name}</div>
      <div>LLM Input: {span.llm_input ? span.llm_input : 'N/A'}</div>
      <div>LLM Output: {span.llm_output ? span.llm_output : 'N/A'}</div>
      {span.children && span.children.length > 0 && (
        <div>
          {span.children.map((childSpan) => (
            <SpanNode key={childSpan.span_id} span={childSpan} />
          ))}
        </div>
      )}
    </div>
  );
};

// Main component to render the trace tree
const TraceTree = ({ traceData }) => {
  return (
    <div>
      <h2>Trace ID: {traceData.trace_id}</h2>
      {traceData.spans.map((span) => (
        <SpanNode key={span.span_id} span={span} />
      ))}
    </div>
  );
};

export default TraceTree;