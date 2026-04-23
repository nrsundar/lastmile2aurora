import { useState, useEffect } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Box from "@cloudscape-design/components/box";
import Select from "@cloudscape-design/components/select";
import Button from "@cloudscape-design/components/button";
import { api } from "../lib/api";

export default function ReportPage() {
  const [queries, setQueries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<any[]>([]);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load available run IDs from the user's history
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("lm_run_ids") || "[]") as string[];
    setRunIds(stored);
    if (stored.length > 0) {
      setSelectedRunId(stored[0]); // Most recent
    }
  }, []);

  // Fetch data when run_id changes
  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    Promise.all([
      api.queries(selectedRunId).then(setQueries).catch(() => setQueries([])),
      api.alerts(selectedRunId).then(setAlerts).catch(() => setAlerts([])),
      api.remediations(selectedRunId).then(setRemediations).catch(() => setRemediations([])),
    ]).finally(() => setLoading(false));
  }, [selectedRunId]);

  const runOptions = runIds.map((id) => ({
    label: id.replace("run_", "").replace(/_/g, " "),
    value: id,
    description: id,
  }));

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="View results from your workload runs. Each run is isolated — you only see your own data.">
          Migration Report
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* Run selector */}
        <Box>
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
              <Button iconName="refresh" variant="icon" onClick={() => {
                api.queries(selectedRunId).then(setQueries).catch(() => {});
                api.alerts(selectedRunId).then(setAlerts).catch(() => {});
              }} />
            )}
          </SpaceBetween>
        </Box>

        {selectedRunId && (
          <Tabs tabs={[
            { id: "queries", label: `Queries (${queries.length})`, content: (
              <Table
                loading={loading}
                header={<Header variant="h2" counter={`(${queries.length})`}>Monitored Queries</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Hash", cell: (q) => q.query_hash?.slice(0, 8) },
                  { id: "sql", header: "SQL", cell: (q) => <Box variant="code">{q.original_sql?.slice(0, 80)}...</Box> },
                  { id: "src", header: "Oracle (ms)", cell: (q) => q.source_ms?.toFixed(1) ?? "—" },
                  { id: "tgt", header: "Aurora (ms)", cell: (q) => q.target_ms?.toFixed(1) ?? "—" },
                  { id: "delta", header: "Delta %", cell: (q) => {
                    if (q.delta_pct == null) return "—";
                    const d = q.delta_pct;
                    return <span style={{ color: d > 20 ? "#d32f2f" : d < -10 ? "#2e7d32" : "#666", fontWeight: Math.abs(d) > 20 ? "bold" : "normal" }}>{d > 0 ? "+" : ""}{d.toFixed(1)}%</span>;
                  }},
                  { id: "alert", header: "Status", cell: (q) =>
                    q.alert_level === "critical" ? <StatusIndicator type="error">Critical</StatusIndicator> :
                    q.alert_level === "warn" ? <StatusIndicator type="warning">Warning</StatusIndicator> :
                    <StatusIndicator type="success">OK</StatusIndicator>
                  },
                ]}
                items={queries}
                empty={<Box textAlign="center">No queries in this run.</Box>}
              />
            )},
            { id: "alerts", label: `Alerts (${alerts.length})`, content: (
              <Table
                loading={loading}
                header={<Header variant="h2" counter={`(${alerts.length})`}>Alerts</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Query", cell: (a) => a.query_hash?.slice(0, 8) },
                  { id: "sev", header: "Severity", cell: (a) =>
                    a.severity === "critical" ? <StatusIndicator type="error">{a.severity}</StatusIndicator> :
                    <StatusIndicator type="warning">{a.severity}</StatusIndicator>
                  },
                  { id: "msg", header: "Message", cell: (a) => a.message },
                  { id: "time", header: "Time", cell: (a) => new Date(a.created_at).toLocaleString() },
                ]}
                items={alerts}
                empty={<Box textAlign="center">No alerts for this run.</Box>}
              />
            )},
            { id: "fixes", label: `Remediations (${remediations.length})`, content: (
              <Table
                loading={loading}
                header={<Header variant="h2" counter={`(${remediations.length})`}>LLM Remediations</Header>}
                columnDefinitions={[
                  { id: "hash", header: "Query", cell: (r) => r.query_hash?.slice(0, 8) },
                  { id: "orig", header: "Original", cell: (r) => <Box variant="code">{r.original_sql?.slice(0, 60)}...</Box> },
                  { id: "fix", header: "Rewritten", cell: (r) => <Box variant="code">{r.rewritten_sql?.slice(0, 60)}...</Box> },
                  { id: "status", header: "Status", cell: (r) =>
                    r.status === "applied" ? <StatusIndicator type="success">Applied</StatusIndicator> :
                    <StatusIndicator type="pending">Pending</StatusIndicator>
                  },
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
