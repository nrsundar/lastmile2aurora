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
import Alert from "@cloudscape-design/components/alert";
import { api } from "../lib/api";

import demoQueries from "../../mock-workload-queries.json";

interface QueryResult {
  query_hash: string;
  name?: string;
  passed: boolean;
  regression?: boolean;
  oracle_ms?: number;
  pg_ms?: number;
  diff_summary?: any;
}

export default function DashboardPage() {
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState("");

  const runDemo = async () => {
    setSimulating(true);
    setError("");
    try {
      const resp = await api.simulate(
        demoQueries.map((q: any) => ({ oracle_sql: q.oracle_sql, pg_sql: q.pg_sql }))
      );
      const mapped = (resp.results || []).map((r: any, i: number) => ({
        query_hash: r.query_hash,
        name: demoQueries[i]?.name ?? r.query_hash,
        passed: r.passed,
        regression: r.diff_summary?.performance?.regression,
        oracle_ms: r.diff_summary?.performance?.source_ms,
        pg_ms: r.diff_summary?.performance?.target_ms,
      }));
      setResults(mapped);
    } catch (e: any) {
      setError(e.message || "Failed to run demo. Check that the backend API is reachable.");
    }
    setSimulating(false);
  };

  const regressions = results.filter((r) => r.regression);
  const passed = results.filter((r) => r.passed && !r.regression);
  const failed = results.filter((r) => !r.passed && !r.regression);

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Real-time monitoring for Oracle → Aurora PostgreSQL migrations. Detects performance regressions and auto-remediates via LLM.">
          LastMile2Aurora — Live Migration Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">How It Works</Header>}>
          <ColumnLayout columns={3}>
            <Box>
              <Box variant="h4">1. Monitor</Box>
              <Box variant="p">Queries run against both Oracle (source) and Aurora PostgreSQL (target) simultaneously. Every result is compared in real-time.</Box>
            </Box>
            <Box>
              <Box variant="h4">2. Detect</Box>
              <Box variant="p">Deep diff compares row counts, schemas, and cell-by-cell data. Performance regressions (&gt;20% slower) trigger alerts.</Box>
            </Box>
            <Box>
              <Box variant="h4">3. Remediate</Box>
              <Box variant="p">LLM-powered auto-fix rewrites slow queries for PostgreSQL. Human-in-the-loop or fully autonomous mode.</Box>
            </Box>
          </ColumnLayout>
        </Container>

        {error && <Alert type="error" dismissible onDismiss={() => setError("")}>{error}</Alert>}

        <Container
          header={
            <Header
              variant="h2"
              description="Runs 16 Oracle queries against both databases and compares results."
              actions={<Button variant="primary" loading={simulating} onClick={runDemo}>Run Demo Workload</Button>}
            >
              Live Query Stream
            </Header>
          }
        >
          <ColumnLayout columns={4}>
            <Box textAlign="center">
              <Box variant="h3">Queries</Box>
              <Box variant="h1">{results.length}</Box>
            </Box>
            <Box textAlign="center">
              <Box variant="h3">Passed</Box>
              <Box variant="h1" color="text-status-success">{passed.length}</Box>
            </Box>
            <Box textAlign="center">
              <Box variant="h3">Regressions</Box>
              <Box variant="h1" color={regressions.length > 0 ? "text-status-error" : "text-status-success"}>{regressions.length}</Box>
            </Box>
            <Box textAlign="center">
              <Box variant="h3">Failed</Box>
              <Box variant="h1" color={failed.length > 0 ? "text-status-warning" : "text-status-success"}>{failed.length}</Box>
            </Box>
          </ColumnLayout>
        </Container>

        <Table
          header={<Header variant="h2">Query Results</Header>}
          columnDefinitions={[
            { id: "name", header: "Query", cell: (r) => r.name || r.query_hash?.slice(0, 12) },
            { id: "oracle", header: "Oracle (ms)", cell: (r) => r.oracle_ms?.toFixed(1) ?? "—" },
            { id: "pg", header: "Aurora PG (ms)", cell: (r) => r.pg_ms?.toFixed(1) ?? "—" },
            {
              id: "status",
              header: "Status",
              cell: (r) =>
                r.regression ? <StatusIndicator type="error">Regression</StatusIndicator> :
                r.passed ? <StatusIndicator type="success">Passed</StatusIndicator> :
                <StatusIndicator type="warning">Mismatch</StatusIndicator>,
            },
          ]}
          items={results}
          empty={
            <Box textAlign="center" padding="l">
              <Box variant="h4">No queries observed yet</Box>
              <Box variant="p">Click <b>Run Demo Workload</b> above to execute 16 Oracle queries against both databases and compare results in real-time.</Box>
            </Box>
          }
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
