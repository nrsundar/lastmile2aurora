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
import Badge from "@cloudscape-design/components/badge";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

export default function AdminPage() {
  const { user } = useAuth();
  const [queries, setQueries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.queries().then(setQueries).catch(() => setQueries([])),
      api.alerts().then(setAlerts).catch(() => setAlerts([])),
      api.remediations().then(setRemediations).catch(() => setRemediations([])),
    ]).finally(() => setLoading(false));
  }, []);

  // Derive stats
  const uniqueRuns = [...new Set(queries.map((q) => q.run_id).filter(Boolean))];
  const totalExecutions = queries.reduce((sum, q) => sum + (q.execution_count || 0), 0);
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const passedQueries = queries.filter((q) => q.alert_level === "ok").length;
  const regressions = queries.filter((q) => q.alert_level === "critical").length;
  const warnings = queries.filter((q) => q.alert_level === "warn").length;

  // Group runs with stats
  const runStats = uniqueRuns.map((runId) => {
    const runQueries = queries.filter((q) => q.run_id === runId);
    const runAlerts = alerts.filter((a) => a.run_id === runId);
    return {
      run_id: runId,
      query_count: runQueries.length,
      passed: runQueries.filter((q) => q.alert_level === "ok").length,
      regressions: runQueries.filter((q) => q.alert_level === "critical").length,
      warnings: runQueries.filter((q) => q.alert_level === "warn").length,
      alerts: runAlerts.length,
      user: runQueries[0]?.user_sub?.slice(0, 8) || "—",
    };
  });

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Monitor usage, track workload runs, and review all queries across all users.">
          Admin Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* Summary cards */}
        <ColumnLayout columns={4}>
          <Container>
            <Box textAlign="center">
              <Box variant="awsui-key-label">Total Runs</Box>
              <Box variant="h1">{uniqueRuns.length}</Box>
            </Box>
          </Container>
          <Container>
            <Box textAlign="center">
              <Box variant="awsui-key-label">Total Queries Executed</Box>
              <Box variant="h1">{totalExecutions}</Box>
            </Box>
          </Container>
          <Container>
            <Box textAlign="center">
              <Box variant="awsui-key-label">Unique Queries</Box>
              <Box variant="h1">{queries.length}</Box>
            </Box>
          </Container>
          <Container>
            <Box textAlign="center">
              <Box variant="awsui-key-label">Active Alerts</Box>
              <Box variant="h1" color={criticalAlerts > 0 ? "text-status-error" : "text-status-success"}>{alerts.length}</Box>
            </Box>
          </Container>
        </ColumnLayout>

        {/* Health summary */}
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: "12px", padding: "24px", color: "white" }}>
          <ColumnLayout columns={4}>
            <Box textAlign="center">
              <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Passed</div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4ade80", marginTop: "4px" }}>{passedQueries}</div>
            </Box>
            <Box textAlign="center">
              <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Regressions</div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: regressions > 0 ? "#f87171" : "#4ade80", marginTop: "4px" }}>{regressions}</div>
            </Box>
            <Box textAlign="center">
              <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Warnings</div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: warnings > 0 ? "#fbbf24" : "#4ade80", marginTop: "4px" }}>{warnings}</div>
            </Box>
            <Box textAlign="center">
              <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Remediations</div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#38bdf8", marginTop: "4px" }}>{remediations.length}</div>
            </Box>
          </ColumnLayout>
        </div>

        {/* Tabs */}
        <Tabs tabs={[
          { id: "runs", label: `Workload Runs (${uniqueRuns.length})`, content: (
            <Table
              loading={loading}
              header={<Header variant="h2" counter={`(${uniqueRuns.length})`}>All Workload Runs</Header>}
              columnDefinitions={[
                { id: "run", header: "Run ID", cell: (r) => <Box variant="code">{r.run_id?.slice(0, 24)}</Box> },
                { id: "user", header: "User", cell: (r) => r.user },
                { id: "queries", header: "Queries", cell: (r) => r.query_count },
                { id: "passed", header: "Passed", cell: (r) => <Badge color="green">{r.passed}</Badge> },
                { id: "regressions", header: "Regressions", cell: (r) => r.regressions > 0 ? <Badge color="red">{r.regressions}</Badge> : <Badge color="green">0</Badge> },
                { id: "warnings", header: "Warnings", cell: (r) => r.warnings > 0 ? <Badge color="blue">{r.warnings}</Badge> : "0" },
                { id: "alerts", header: "Alerts", cell: (r) => r.alerts > 0 ? <Badge color="red">{r.alerts}</Badge> : "0" },
              ]}
              items={runStats}
              empty={<Box textAlign="center">No workload runs yet.</Box>}
            />
          )},
          { id: "queries", label: `All Queries (${queries.length})`, content: (
            <Table
              loading={loading}
              header={<Header variant="h2" counter={`(${queries.length})`}>All Monitored Queries</Header>}
              columnDefinitions={[
                { id: "hash", header: "Hash", cell: (q) => q.query_hash?.slice(0, 8) },
                { id: "sql", header: "SQL", cell: (q) => <Box variant="code">{q.original_sql?.slice(0, 60)}...</Box> },
                { id: "count", header: "Executions", cell: (q) => q.execution_count },
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
              ]}
              items={queries}
              empty={<Box textAlign="center">No queries yet.</Box>}
            />
          )},
          { id: "alerts", label: `Alerts (${alerts.length})`, content: (
            <Table
              loading={loading}
              header={<Header variant="h2" counter={`(${alerts.length})`}>All Alerts</Header>}
              columnDefinitions={[
                { id: "hash", header: "Query", cell: (a) => a.query_hash?.slice(0, 8) },
                { id: "sev", header: "Severity", cell: (a) =>
                  a.severity === "critical" ? <StatusIndicator type="error">Critical</StatusIndicator> :
                  <StatusIndicator type="warning">Warning</StatusIndicator>
                },
                { id: "msg", header: "Message", cell: (a) => a.message },
                { id: "run", header: "Run", cell: (a) => <Box variant="code">{(a.run_id || "—").slice(0, 16)}</Box> },
                { id: "time", header: "Time", cell: (a) => new Date(a.created_at).toLocaleString() },
              ]}
              items={alerts}
              empty={<Box textAlign="center">No alerts.</Box>}
            />
          )},
          { id: "fixes", label: `Remediations (${remediations.length})`, content: (
            <Table
              loading={loading}
              header={<Header variant="h2" counter={`(${remediations.length})`}>All LLM Remediations</Header>}
              columnDefinitions={[
                { id: "hash", header: "Query", cell: (r) => r.query_hash?.slice(0, 8) },
                { id: "orig", header: "Original", cell: (r) => <Box variant="code">{r.original_sql?.slice(0, 50)}...</Box> },
                { id: "fix", header: "Rewritten", cell: (r) => <Box variant="code">{r.rewritten_sql?.slice(0, 50)}...</Box> },
                { id: "status", header: "Status", cell: (r) =>
                  r.status === "applied" ? <StatusIndicator type="success">Applied</StatusIndicator> :
                  <StatusIndicator type="pending">Pending</StatusIndicator>
                },
                { id: "time", header: "Created", cell: (r) => new Date(r.created_at).toLocaleString() },
              ]}
              items={remediations}
              empty={<Box textAlign="center">No remediations.</Box>}
            />
          )},
        ]} />
      </SpaceBetween>
    </ContentLayout>
  );
}
