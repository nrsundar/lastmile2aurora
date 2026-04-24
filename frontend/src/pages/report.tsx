import { useState, useEffect } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Select from "@cloudscape-design/components/select";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import { api } from "../lib/api";

export default function ReportPage() {
  const [queries, setQueries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<any[]>([]);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fixingQuery, setFixingQuery] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<any>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("lm_run_ids") || "[]") as string[];
    setRunIds(stored);
    if (stored.length > 0) setSelectedRunId(stored[0]);
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    setFixResult(null);
    Promise.all([
      api.queries(selectedRunId).then(setQueries).catch(() => setQueries([])),
      api.alerts(selectedRunId).then(setAlerts).catch(() => setAlerts([])),
      api.remediations(selectedRunId).then(setRemediations).catch(() => setRemediations([])),
    ]).finally(() => setLoading(false));
  }, [selectedRunId]);

  const handleAIFix = async (q: any) => {
    const sql = q.translated_sql || q.original_sql || "";
    setFixingQuery(q.query_hash);
    setFixResult(null);
    try {
      const resp = await api.remediate(sql);
      setFixResult({ ...resp, queryName: q.original_sql?.slice(0, 40) });
    } catch (e: any) {
      setFixResult({ error: e.message || "Failed to get AI fix" });
    }
    setFixingQuery(null);
  };

  const handleFixAll = async () => {
    const toFix = queries.filter((q) => q.alert_level === "critical" || q.alert_level === "warn");
    if (toFix.length === 0) return;
    setFixingQuery("batch");
    setFixResult(null);
    const fixes: any[] = [];
    for (const q of toFix) {
      const sql = q.translated_sql || q.original_sql || "";
      try {
        const resp = await api.remediate(sql);
        fixes.push({ ...resp, queryName: q.original_sql?.slice(0, 40) });
      } catch (e: any) {
        fixes.push({ error: e.message, queryName: q.original_sql?.slice(0, 40) });
      }
    }
    setFixResult({ batch: fixes });
    setFixingQuery(null);
  };

  const runOptions = runIds.map((id) => ({
    label: id.replace("run_", "").replace(/_/g, " "),
    value: id,
    description: id,
  }));

  const issueCount = queries.filter((q) => q.alert_level === "critical" || q.alert_level === "warn").length;

  return (
    <ContentLayout
      header={<Header variant="h1" description="View results from your workload runs. Each run is isolated — you only see your own data.">Migration Report</Header>}
    >
      <SpaceBetween size="l">
        <SpaceBetween size="s" direction="horizontal" alignItems="center">
          <Box variant="awsui-key-label">Select Run:</Box>
          {runIds.length > 0 ? (
            <Select
              selectedOption={runOptions.find((o) => o.value === selectedRunId) || null}
              onChange={({ detail }) => setSelectedRunId(detail.selectedOption.value ?? "")}
              options={runOptions}
              placeholder="Select a workload run"
            />
          ) : (
            <Box color="text-body-secondary">No runs yet. Go to the Dashboard and run a workload first.</Box>
          )}
          {selectedRunId && (
            <>
              <Button iconName="refresh" variant="icon" onClick={() => {
                api.queries(selectedRunId).then(setQueries).catch(() => {});
                api.alerts(selectedRunId).then(setAlerts).catch(() => {});
                api.remediations(selectedRunId).then(setRemediations).catch(() => {});
              }} />
              {issueCount > 0 && (
                <Button variant="primary" iconName="gen-ai" loading={fixingQuery === "batch"} onClick={handleFixAll}>
                  AI Fix All ({issueCount})
                </Button>
              )}
            </>
          )}
        </SpaceBetween>

        {/* AI Fix Result */}
        {fixResult && !fixResult.batch && (
          <Container header={<Header variant="h2" actions={<Button onClick={() => setFixResult(null)} iconName="close">Dismiss</Button>}>AI-Powered Query Fix</Header>}>
            {fixResult.error ? (
              <Alert type="error">{fixResult.error}</Alert>
            ) : (
              <SpaceBetween size="m">
                <ColumnLayout columns={2}>
                  <div>
                    <Box variant="h4">Original SQL</Box>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap", background: "#1e293b", color: "#f87171", padding: "16px", borderRadius: "8px" }}>{fixResult.original}</div>
                  </div>
                  <div>
                    <Box variant="h4">Rewritten SQL (AI Fix)</Box>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap", background: "#0f2e1a", color: "#4ade80", padding: "16px", borderRadius: "8px" }}>{fixResult.rewritten}</div>
                  </div>
                </ColumnLayout>
                {fixResult.rationale && <Box><b>Rationale:</b> {fixResult.rationale}</Box>}
              </SpaceBetween>
            )}
          </Container>
        )}

        {/* Batch Fix Results */}
        {fixResult?.batch && (
          <Container header={<Header variant="h2" counter={`(${fixResult.batch.length})`} actions={<Button onClick={() => setFixResult(null)} iconName="close">Dismiss</Button>}>Batch AI Fix Results</Header>}>
            <SpaceBetween size="m">
              {fixResult.batch.map((fix: any, i: number) => (
                <div key={i} style={{ background: fix.error ? "#1e293b" : "#0f2e1a", borderRadius: "8px", padding: "12px 16px", borderLeft: fix.error ? "4px solid #f87171" : "4px solid #4ade80" }}>
                  <Box variant="h4" color={fix.error ? "text-status-error" : "text-status-success"}>{fix.error ? "❌" : "✅"} {fix.queryName}...</Box>
                  {!fix.error && <Box color="text-body-secondary" fontSize="body-s">{fix.rationale?.slice(0, 150)}</Box>}
                </div>
              ))}
            </SpaceBetween>
          </Container>
        )}

        {selectedRunId && (
          <Tabs tabs={[
            { id: "queries", label: `Queries (${queries.length})`, content: (
              <Table
                loading={loading}
                header={<Header variant="h2" counter={`(${queries.length})`}>Monitored Queries</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Hash", cell: (q) => q.query_hash?.slice(0, 8) },
                  { id: "sql", header: "SQL", cell: (q) => <Box variant="code">{q.original_sql?.slice(0, 60)}...</Box> },
                  { id: "src", header: "Oracle (ms)", cell: (q) => q.source_ms?.toFixed(1) ?? "—" },
                  { id: "tgt", header: "Aurora (ms)", cell: (q) => q.target_ms?.toFixed(1) ?? "—" },
                  { id: "delta", header: "Delta", cell: (q) => {
                    if (q.delta_pct == null) return "—";
                    const d = q.delta_pct;
                    return <span style={{ color: d > 20 ? "#d32f2f" : d < -10 ? "#2e7d32" : "#666", fontWeight: Math.abs(d) > 20 ? "bold" : "normal" }}>{d > 0 ? "+" : ""}{d.toFixed(1)}%</span>;
                  }},
                  { id: "status", header: "Status", cell: (q) =>
                    q.alert_level === "critical" ? <StatusIndicator type="error">Critical</StatusIndicator> :
                    q.alert_level === "warn" ? <StatusIndicator type="warning">Warning</StatusIndicator> :
                    <StatusIndicator type="success">OK</StatusIndicator>
                  },
                  { id: "action", header: "Action", cell: (q) =>
                    (q.alert_level === "critical" || q.alert_level === "warn") ? (
                      <Button variant="inline-link" loading={fixingQuery === q.query_hash} onClick={() => handleAIFix(q)} iconName="gen-ai">AI Fix</Button>
                    ) : <span style={{ color: "#4ade80" }}>—</span>
                  },
                ]}
                items={queries}
                empty={<Box textAlign="center">No queries in this run.</Box>}
              />
            )},
            { id: "alerts", label: `Alerts (${alerts.length})`, content: (
              <Table loading={loading} header={<Header variant="h2" counter={`(${alerts.length})`}>Alerts</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Query", cell: (a) => a.query_hash?.slice(0, 8) },
                  { id: "sev", header: "Severity", cell: (a) => a.severity === "critical" ? <StatusIndicator type="error">{a.severity}</StatusIndicator> : <StatusIndicator type="warning">{a.severity}</StatusIndicator> },
                  { id: "msg", header: "Message", cell: (a) => a.message },
                  { id: "time", header: "Time", cell: (a) => new Date(a.created_at).toLocaleString() },
                ]}
                items={alerts}
                empty={<Box textAlign="center">No alerts for this run.</Box>}
              />
            )},
            { id: "fixes", label: `Remediations (${remediations.length})`, content: (
              <Table loading={loading} header={<Header variant="h2" counter={`(${remediations.length})`}>LLM Remediations</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Query", cell: (r) => r.query_hash?.slice(0, 8) },
                  { id: "orig", header: "Original", cell: (r) => <Box variant="code">{r.original_sql?.slice(0, 50)}...</Box> },
                  { id: "fix", header: "Rewritten", cell: (r) => <Box variant="code">{r.rewritten_sql?.slice(0, 50)}...</Box> },
                  { id: "status", header: "Status", cell: (r) => r.status === "applied" ? <StatusIndicator type="success">Applied</StatusIndicator> : <StatusIndicator type="pending">Pending</StatusIndicator> },
                ]}
                items={remediations}
                empty={<Box textAlign="center">No remediations for this run.</Box>}
              />
            )},
          ]} />
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
