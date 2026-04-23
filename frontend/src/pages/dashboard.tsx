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
import Tiles from "@cloudscape-design/components/tiles";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Tabs from "@cloudscape-design/components/tabs";
import RadioGroup from "@cloudscape-design/components/radio-group";
import { api } from "../lib/api";

import demoQueries from "../../mock-workload-queries.json";

interface QueryResult {
  query_hash: string;
  name?: string;
  passed: boolean;
  regression?: boolean;
  oracle_ms?: number;
  pg_ms?: number;
}

export default function DashboardPage() {
  // Mode selection
  const [mode, setMode] = useState<string | null>(null);
  const [workloadSize, setWorkloadSize] = useState("small");

  // Custom connection
  const [oracleHost, setOracleHost] = useState("");
  const [oraclePort, setOraclePort] = useState("1521");
  const [oracleService, setOracleService] = useState("");
  const [oracleUser, setOracleUser] = useState("");
  const [oraclePass, setOraclePass] = useState("");
  const [pgHost, setPgHost] = useState("");
  const [pgPort, setPgPort] = useState("5432");
  const [pgDatabase, setPgDatabase] = useState("");
  const [pgUser, setPgUser] = useState("");
  const [pgPass, setPgPass] = useState("");

  // Results
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
      setError(e.message || "Failed to run workload.");
    }
    setSimulating(false);
  };

  const regressions = results.filter((r) => r.regression);
  const passed = results.filter((r) => r.passed && !r.regression);
  const failed = results.filter((r) => !r.passed && !r.regression);

  // Mode selection screen
  if (!mode) {
    return (
      <ContentLayout header={<Header variant="h1" description="Choose how you want to run the migration watchdog.">LastMile2Aurora — Dashboard</Header>}>
        <SpaceBetween size="l">
          <Tiles
            onChange={({ detail }) => setMode(detail.value)}
            value={mode ?? ""}
            columns={2}
            items={[
              {
                value: "demo",
                label: "Demo Mode",
                description: "Use preconfigured Oracle EE 19c and Aurora PG 16 with HammerDB TPC-C workload. Great for demos and workshops.",
                image: <Box textAlign="center" fontSize="display-l">🎯</Box>,
              },
              {
                value: "custom",
                label: "Connect Your Databases",
                description: "Enter your own Oracle source and Aurora PostgreSQL target connection strings. Use your real application workload with tagged queries.",
                image: <Box textAlign="center" fontSize="display-l">🔌</Box>,
              },
            ]}
          />
        </SpaceBetween>
      </ContentLayout>
    );
  }

  // Custom connection form
  if (mode === "custom" && results.length === 0 && !simulating) {
    return (
      <ContentLayout header={<Header variant="h1" description="Enter your Oracle source and Aurora PostgreSQL target connections." actions={<Button variant="link" onClick={() => setMode(null)}>← Back</Button>}>Connect Your Databases</Header>}>
        <SpaceBetween size="l">
          <Alert type="info">
            <b>Tag your queries first!</b> Add SQL comments like <code>/* tag:order_lookup */</code> to your business-critical queries in both Oracle and PostgreSQL code. This tool matches queries by tag, not by SQL hash.
          </Alert>
          <ColumnLayout columns={2}>
            <Container header={<Header variant="h3">Oracle Source</Header>}>
              <SpaceBetween size="m">
                <FormField label="Host"><Input value={oracleHost} onChange={({ detail }) => setOracleHost(detail.value)} placeholder="mydb.xxxxx.us-east-1.rds.amazonaws.com" /></FormField>
                <ColumnLayout columns={2}>
                  <FormField label="Port"><Input value={oraclePort} onChange={({ detail }) => setOraclePort(detail.value)} /></FormField>
                  <FormField label="Service Name"><Input value={oracleService} onChange={({ detail }) => setOracleService(detail.value)} placeholder="ORCL" /></FormField>
                </ColumnLayout>
                <ColumnLayout columns={2}>
                  <FormField label="Username"><Input value={oracleUser} onChange={({ detail }) => setOracleUser(detail.value)} /></FormField>
                  <FormField label="Password"><Input value={oraclePass} onChange={({ detail }) => setOraclePass(detail.value)} type="password" /></FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
            <Container header={<Header variant="h3">Aurora PostgreSQL Target</Header>}>
              <SpaceBetween size="m">
                <FormField label="Host"><Input value={pgHost} onChange={({ detail }) => setPgHost(detail.value)} placeholder="mydb.cluster-xxxxx.us-east-1.rds.amazonaws.com" /></FormField>
                <ColumnLayout columns={2}>
                  <FormField label="Port"><Input value={pgPort} onChange={({ detail }) => setPgPort(detail.value)} /></FormField>
                  <FormField label="Database"><Input value={pgDatabase} onChange={({ detail }) => setPgDatabase(detail.value)} placeholder="mydb" /></FormField>
                </ColumnLayout>
                <ColumnLayout columns={2}>
                  <FormField label="Username"><Input value={pgUser} onChange={({ detail }) => setPgUser(detail.value)} /></FormField>
                  <FormField label="Password"><Input value={pgPass} onChange={({ detail }) => setPgPass(detail.value)} type="password" /></FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          </ColumnLayout>
          <Box textAlign="center">
            <SpaceBetween size="s" direction="horizontal" alignItems="center">
              <Button variant="primary" iconName="search">Test Connections</Button>
              <Button variant="normal">Start Monitoring Tagged Queries</Button>
            </SpaceBetween>
          </Box>
          <Alert type="warning">
            <b>Coming soon:</b> Custom database connections will be available in the next release. For now, use <b>Demo Mode</b> to see the full workflow.
          </Alert>
        </SpaceBetween>
      </ContentLayout>
    );
  }

  // Demo mode — workload selection + results
  return (
    <ContentLayout
      header={
        <Header variant="h1"
          description={mode === "demo" ? "Preconfigured Oracle EE 19c + Aurora PG 16 with tagged demo queries." : "Connected to your databases."}
          actions={<Button variant="link" onClick={() => { setMode(null); setResults([]); }}>← Change Mode</Button>}
        >
          Live Migration Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && <Alert type="error" dismissible onDismiss={() => setError("")}>{error}</Alert>}

        {/* Workload config */}
        {results.length === 0 && !simulating && (
          <Container header={<Header variant="h2">Configure Workload</Header>}>
            <SpaceBetween size="l">
              <FormField label="Workload Size" description="Controls the number of queries and duration of the demo workload.">
                <RadioGroup
                  value={workloadSize}
                  onChange={({ detail }) => setWorkloadSize(detail.value)}
                  items={[
                    { value: "small", label: "🟢 Small — 16 queries, quick validation (~30 seconds)", description: "Best for quick demos" },
                    { value: "medium", label: "🟡 Medium — 16 queries × 3 rounds with varied parameters (~2 minutes)", description: "Best for workshops and POCs" },
                    { value: "large", label: "🔴 Large — 16 queries × 10 rounds, stress test (~5 minutes)", description: "Best for production simulation" },
                  ]}
                />
              </FormField>
              <Box>
                <Button variant="primary" loading={simulating} onClick={runDemo} iconName="caret-right-filled">
                  Run {workloadSize.charAt(0).toUpperCase() + workloadSize.slice(1)} Workload
                </Button>
              </Box>
            </SpaceBetween>
          </Container>
        )}

        {/* Loading */}
        {simulating && (
          <Container>
            <Box textAlign="center" padding="xxl">
              <SpaceBetween size="m">
                <Box variant="h3">Running {workloadSize} workload against Oracle EE and Aurora PG...</Box>
                <Box color="text-body-secondary">Executing tagged queries on both databases and comparing results.</Box>
                <StatusIndicator type="in-progress">Processing queries...</StatusIndicator>
              </SpaceBetween>
            </Box>
          </Container>
        )}

        {/* Results */}
        {results.length > 0 && (
          <SpaceBetween size="l">
            <ColumnLayout columns={4}>
              <Container><Box textAlign="center"><Box variant="awsui-key-label">Queries</Box><Box variant="h1">{results.length}</Box></Box></Container>
              <Container><Box textAlign="center"><Box variant="awsui-key-label">Passed</Box><Box variant="h1" color="text-status-success">{passed.length}</Box></Box></Container>
              <Container><Box textAlign="center"><Box variant="awsui-key-label">Regressions</Box><Box variant="h1" color={regressions.length > 0 ? "text-status-error" : "text-status-success"}>{regressions.length}</Box></Box></Container>
              <Container><Box textAlign="center"><Box variant="awsui-key-label">Mismatches</Box><Box variant="h1" color={failed.length > 0 ? "text-status-warning" : "text-status-success"}>{failed.length}</Box></Box></Container>
            </ColumnLayout>

            <Table
              header={
                <Header variant="h2" actions={<Button onClick={() => setResults([])}>Run Again</Button>}>
                  Query Results — {workloadSize.charAt(0).toUpperCase() + workloadSize.slice(1)} Workload
                </Header>
              }
              columnDefinitions={[
                { id: "name", header: "Query (Tag)", cell: (r) => r.name || r.query_hash?.slice(0, 12), sortingField: "name" },
                { id: "oracle", header: "Oracle (ms)", cell: (r) => r.oracle_ms?.toFixed(1) ?? "—" },
                { id: "pg", header: "Aurora PG (ms)", cell: (r) => r.pg_ms?.toFixed(1) ?? "—" },
                { id: "delta", header: "Delta", cell: (r) => {
                  if (!r.oracle_ms || !r.pg_ms) return "—";
                  const d = ((r.pg_ms - r.oracle_ms) / r.oracle_ms * 100);
                  return <span style={{ color: d > 20 ? "#d32f2f" : d < -10 ? "#2e7d32" : "#666" }}>{d > 0 ? "+" : ""}{d.toFixed(0)}%</span>;
                }},
                { id: "status", header: "Status", cell: (r) =>
                  r.regression ? <StatusIndicator type="error">Regression</StatusIndicator> :
                  r.passed ? <StatusIndicator type="success">Passed</StatusIndicator> :
                  <StatusIndicator type="warning">Mismatch</StatusIndicator>,
                },
              ]}
              items={results}
            />
          </SpaceBetween>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
