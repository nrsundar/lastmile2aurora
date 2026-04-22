import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import { useAuth } from "../hooks/useAuth";
import { useWebSocket } from "../hooks/useWebSocket";
import { api } from "../lib/api";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { events, connected } = useWebSocket();
  const [simulating, setSimulating] = useState(false);
  const [simResults, setSimResults] = useState<any[]>([]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const runDemo = async () => {
    setSimulating(true);
    try {
      const queries = (await import("../../mock-workload-queries.json")).default;
      const resp = await api.simulate(queries.map((q: any) => ({ oracle_sql: q.oracle_sql, pg_sql: q.pg_sql })));
      setSimResults(resp.results || []);
    } catch (e) {
      console.error(e);
    }
    setSimulating(false);
  };

  const allEvents = simResults.length > 0 ? simResults : events;
  const regressions = allEvents.filter((e: any) => e.regression || e.diff_summary?.performance?.regression);
  const passed = allEvents.filter((e: any) => e.passed);
  const failed = allEvents.filter((e: any) => !e.passed && !e.regression);

  return (
    <ContentLayout
      header={
        <Header variant="h1" actions={<Button variant="primary" loading={simulating} onClick={runDemo}>Run Demo Workload</Button>}>
          Live Migration Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={4}>
          <Container>
            <Box variant="h3">Connection</Box>
            <StatusIndicator type={connected ? "success" : "error"}>{connected ? "Live" : "Disconnected"}</StatusIndicator>
          </Container>
          <Container>
            <Box variant="h3">Queries Observed</Box>
            <Box variant="h1">{events.length}</Box>
          </Container>
          <Container>
            <Box variant="h3">Regressions</Box>
            <Box variant="h1" color={regressions.length > 0 ? "text-status-error" : "text-status-success"}>{regressions.length}</Box>
          </Container>
          <Container>
            <Box variant="h3">Passed</Box>
            <Box variant="h1" color="text-status-success">{passed.length}</Box>
          </Container>
        </ColumnLayout>

        <Table
          header={<Header variant="h2">Real-Time Query Stream</Header>}
          columnDefinitions={[
            { id: "hash", header: "Query", cell: (e) => e.query_hash?.slice(0, 8) ?? "—" },
            { id: "oracle", header: "Oracle (ms)", cell: (e) => e.oracle_ms?.toFixed(1) ?? "—" },
            { id: "pg", header: "Aurora PG (ms)", cell: (e) => e.pg_ms?.toFixed(1) ?? "—" },
            {
              id: "status",
              header: "Status",
              cell: (e) =>
                e.regression ? (
                  <StatusIndicator type="error">Regression</StatusIndicator>
                ) : e.passed ? (
                  <StatusIndicator type="success">Passed</StatusIndicator>
                ) : (
                  <StatusIndicator type="warning">Mismatch</StatusIndicator>
                ),
            },
          ]}
          items={allEvents.slice(0, 50)}
          empty={<Box textAlign="center">No queries observed yet. Click "Run Demo Workload" to start.</Box>}
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
