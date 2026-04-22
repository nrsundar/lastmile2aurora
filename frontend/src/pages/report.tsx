import { useState, useEffect } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Box from "@cloudscape-design/components/box";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useLocation } from "wouter";

export default function ReportPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [queries, setQueries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.queries().then(setQueries).catch(console.error);
    api.alerts().then(setAlerts).catch(console.error);
    api.remediations().then(setRemediations).catch(console.error);
  }, [user]);

  if (!user) { navigate("/auth"); return null; }

  return (
    <ContentLayout header={<Header variant="h1">Migration Report</Header>}>
      <Tabs tabs={[
        { id: "queries", label: `Monitored Queries (${queries.length})`, content: (
          <Table
            header={<Header variant="h2">All Monitored Queries</Header>}
            columnDefinitions={[
              { id: "hash", header: "Hash", cell: (q) => q.query_hash?.slice(0, 8) },
              { id: "sql", header: "SQL", cell: (q) => <Box variant="code">{q.original_sql?.slice(0, 80)}...</Box> },
              { id: "count", header: "Executions", cell: (q) => q.execution_count },
              { id: "src", header: "Oracle (ms)", cell: (q) => q.source_ms?.toFixed(1) ?? "—" },
              { id: "tgt", header: "Aurora (ms)", cell: (q) => q.target_ms?.toFixed(1) ?? "—" },
              { id: "delta", header: "Delta %", cell: (q) => q.delta_pct != null ? `${q.delta_pct > 0 ? "+" : ""}${q.delta_pct.toFixed(1)}%` : "—" },
              { id: "alert", header: "Status", cell: (q) =>
                q.alert_level === "critical" ? <StatusIndicator type="error">Critical</StatusIndicator> :
                q.alert_level === "warn" ? <StatusIndicator type="warning">Warning</StatusIndicator> :
                <StatusIndicator type="success">OK</StatusIndicator>
              },
            ]}
            items={queries}
            empty={<Box textAlign="center">No queries monitored yet.</Box>}
          />
        )},
        { id: "alerts", label: `Alerts (${alerts.length})`, content: (
          <Table
            header={<Header variant="h2">Active Alerts</Header>}
            columnDefinitions={[
              { id: "hash", header: "Query", cell: (a) => a.query_hash?.slice(0, 8) },
              { id: "type", header: "Type", cell: (a) => a.alert_type },
              { id: "sev", header: "Severity", cell: (a) =>
                a.severity === "critical" ? <StatusIndicator type="error">{a.severity}</StatusIndicator> :
                <StatusIndicator type="warning">{a.severity}</StatusIndicator>
              },
              { id: "msg", header: "Message", cell: (a) => a.message },
              { id: "time", header: "Time", cell: (a) => new Date(a.created_at).toLocaleString() },
            ]}
            items={alerts}
            empty={<Box textAlign="center">No active alerts.</Box>}
          />
        )},
        { id: "fixes", label: `Remediations (${remediations.length})`, content: (
          <Table
            header={<Header variant="h2">LLM Remediations</Header>}
            columnDefinitions={[
              { id: "hash", header: "Query", cell: (r) => r.query_hash?.slice(0, 8) },
              { id: "orig", header: "Original", cell: (r) => <Box variant="code">{r.original_sql?.slice(0, 60)}...</Box> },
              { id: "fix", header: "Rewritten", cell: (r) => <Box variant="code">{r.rewritten_sql?.slice(0, 60)}...</Box> },
              { id: "status", header: "Status", cell: (r) =>
                r.status === "applied" ? <StatusIndicator type="success">Applied</StatusIndicator> :
                <StatusIndicator type="pending">Pending</StatusIndicator>
              },
              { id: "time", header: "Created", cell: (r) => new Date(r.created_at).toLocaleString() },
            ]}
            items={remediations}
            empty={<Box textAlign="center">No remediations yet.</Box>}
          />
        )},
      ]} />
    </ContentLayout>
  );
}
