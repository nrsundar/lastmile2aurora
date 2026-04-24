import { useState, useEffect, useRef } from "react";
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
import Badge from "@cloudscape-design/components/badge";
import Tiles from "@cloudscape-design/components/tiles";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import RadioGroup from "@cloudscape-design/components/radio-group";
import ProgressBar from "@cloudscape-design/components/progress-bar";
import { api } from "../lib/api";

import demoQueries from "../../mock-workload-queries.json";

interface QueryResult {
  query_hash: string;
  name?: string;
  passed: boolean;
  regression?: boolean;
  oracle_ms?: number;
  pg_ms?: number;
  oracle_sql?: string;
  pg_sql?: string;
}

export default function DashboardPage() {
  const [mode, setMode] = useState<string | null>(null);
  const [workloadSize, setWorkloadSize] = useState("small");
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
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentRunId, setCurrentRunId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fixingQuery, setFixingQuery] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<any>(null);

  // Cleanup timer
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const runDemo = async () => {
    setSimulating(true);
    setError("");
    setResults([]);
    setProgress(0);
    setElapsed(0);

    // Generate unique run_id for this session
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentRunId(runId);

    // Save to localStorage so Reports page can find it
    const stored = JSON.parse(localStorage.getItem("lm_run_ids") || "[]") as string[];
    stored.unshift(runId);
    localStorage.setItem("lm_run_ids", JSON.stringify(stored.slice(0, 20))); // Keep last 20

    const startTime = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);

    const rounds = workloadSize === "small" ? 1 : workloadSize === "medium" ? 3 : 10;
    const totalQueries = demoQueries.length * rounds;
    let completed = 0;

    try {
      for (let round = 0; round < rounds; round++) {
        for (const q of demoQueries) {
          setCurrentQuery(q.name);
          setProgress(Math.round((completed / totalQueries) * 100));

          try {
            const resp = await api.simulate([{ oracle_sql: q.oracle_sql, pg_sql: q.pg_sql }], runId);
            const r = resp.results?.[0];
            if (r) {
              const mapped: QueryResult = {
                query_hash: r.query_hash,
                name: rounds > 1 ? `${q.name} (R${round + 1})` : q.name,
                passed: r.passed,
                regression: r.diff_summary?.performance?.regression,
                oracle_ms: r.diff_summary?.performance?.source_ms,
                pg_ms: r.diff_summary?.performance?.target_ms,
                oracle_sql: q.oracle_sql,
                pg_sql: q.pg_sql,
              };
              setResults((prev) => [mapped, ...prev]);
            }
          } catch {
            // Individual query failure — continue
          }
          completed++;
        }
      }
      setProgress(100);
    } catch (e: any) {
      setError(e.message || "Failed to run workload.");
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSimulating(false);
    setCurrentQuery("");
  };

  const regressions = results.filter((r) => r.regression);
  const passed = results.filter((r) => r.passed && !r.regression);
  const failed = results.filter((r) => !r.passed && !r.regression);
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleAIFix = async (r: QueryResult) => {
    const sql = r.pg_sql || r.oracle_sql || "";
    setFixingQuery(r.query_hash);
    setFixResult(null);
    try {
      const resp = await api.remediate(sql);
      setFixResult(resp);
    } catch (e: any) {
      setFixResult({ error: e.message || "Failed to get AI fix" });
    }
    setFixingQuery(null);
  };

  // Mode selection
  if (!mode) {
    return (
      <ContentLayout header={<Header variant="h1" description="Choose how you want to run the migration watchdog.">LastMile2Aurora — Dashboard</Header>}>
        <Tiles onChange={({ detail }) => setMode(detail.value)} value={mode ?? ""} columns={2} items={[
          { value: "demo", label: "Demo Mode", description: "Use preconfigured Oracle EE 19c and Aurora PG 16 with tagged demo queries. Great for demos and workshops.", image: <Box textAlign="center" fontSize="display-l">🎯</Box> },
          { value: "custom", label: "Connect Your Databases", description: "Enter your own Oracle source and Aurora PostgreSQL target connection strings. Use your real application workload with tagged queries.", image: <Box textAlign="center" fontSize="display-l">🔌</Box> },
        ]} />
      </ContentLayout>
    );
  }

  // Custom connection form
  if (mode === "custom" && results.length === 0 && !simulating) {
    return (
      <ContentLayout header={<Header variant="h1" description="Enter your Oracle source and Aurora PostgreSQL target connections." actions={<Button variant="link" onClick={() => setMode(null)}>← Back</Button>}>Connect Your Databases</Header>}>
        <SpaceBetween size="l">
          <Alert type="info"><b>Tag your queries first!</b> Add SQL comments like <code>/* tag:order_lookup */</code> to your business-critical queries in both Oracle and PostgreSQL code.</Alert>
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
              <Button>Start Monitoring Tagged Queries</Button>
            </SpaceBetween>
          </Box>
          <Alert type="warning"><b>Coming soon:</b> Custom database connections will be available in the next release. For now, use <b>Demo Mode</b>.</Alert>
        </SpaceBetween>
      </ContentLayout>
    );
  }

  // Demo mode — workload config + live results
  return (
    <ContentLayout
      header={<Header variant="h1" description={mode === "demo" ? "Oracle EE 19c → Aurora PG 16 — Tagged demo queries" : "Connected to your databases."} actions={<Button variant="link" onClick={() => { setMode(null); setResults([]); setSimulating(false); }}>← Change Mode</Button>}>Live Migration Dashboard</Header>}
    >
      <SpaceBetween size="l">
        {error && <Alert type="error" dismissible onDismiss={() => setError("")}>{error}</Alert>}

        {/* Workload config — only before running */}
        {results.length === 0 && !simulating && (
          <Container header={<Header variant="h2">Configure Workload</Header>}>
            <SpaceBetween size="l">
              <FormField label="Workload Size">
                <RadioGroup value={workloadSize} onChange={({ detail }) => setWorkloadSize(detail.value)} items={[
                  { value: "small", label: "🟢 Small — 16 queries, single pass (~30 sec)", description: "Quick demo" },
                  { value: "medium", label: "🟡 Medium — 16 queries × 3 rounds (~2 min)", description: "Workshop / POC" },
                  { value: "large", label: "🔴 Large — 16 queries × 10 rounds (~5 min)", description: "Production simulation" },
                ]} />
              </FormField>
              <Button variant="primary" onClick={runDemo} iconName="caret-right-filled">
                Run {workloadSize.charAt(0).toUpperCase() + workloadSize.slice(1)} Workload
              </Button>
            </SpaceBetween>
          </Container>
        )}

        {/* Live progress visualization */}
        {(simulating || results.length > 0) && (
          <div style={{ background: simulating ? "linear-gradient(135deg, #0f172a, #1e293b)" : results.every(r => r.passed) ? "linear-gradient(135deg, #052e16, #166534)" : "linear-gradient(135deg, #1e293b, #334155)", borderRadius: "12px", padding: "24px", color: "white" }}>
            <SpaceBetween size="m">
              <ColumnLayout columns={5}>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Status</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", marginTop: "4px" }}>
                    {simulating ? <span style={{ color: "#38bdf8" }}>⚡ Running</span> : <span style={{ color: "#4ade80" }}>✓ Complete</span>}
                  </div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Elapsed</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "white", marginTop: "4px" }}>{formatTime(elapsed)}</div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Passed</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4ade80", marginTop: "4px" }}>{passed.length}</div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Regressions</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: regressions.length > 0 ? "#f87171" : "#4ade80", marginTop: "4px" }}>{regressions.length}</div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Mismatches</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: failed.length > 0 ? "#fbbf24" : "#4ade80", marginTop: "4px" }}>{failed.length}</div>
                </Box>
              </ColumnLayout>

              {simulating && (
                <SpaceBetween size="xs">
                  <ProgressBar
                    value={progress}
                    label={`Processing: ${currentQuery}`}
                    description={`${results.length} of ${demoQueries.length * (workloadSize === "small" ? 1 : workloadSize === "medium" ? 3 : 10)} queries completed`}
                    variant="standalone"
                  />
                </SpaceBetween>
              )}
            </SpaceBetween>
          </div>
        )}

        {/* Results table — shows live as queries complete */}
        {results.length > 0 && (
          <Table
            header={
              <Header variant="h2" counter={`(${results.length})`} actions={!simulating ? <Button onClick={() => setResults([])}>Run Again</Button> : undefined}>
                Query Results — {workloadSize.charAt(0).toUpperCase() + workloadSize.slice(1)} Workload
              </Header>
            }
            columnDefinitions={[
              { id: "name", header: "Query (Tag)", cell: (r) => r.name || r.query_hash?.slice(0, 12) },
              { id: "oracle", header: "Oracle (ms)", cell: (r) => r.oracle_ms?.toFixed(1) ?? "—" },
              { id: "pg", header: "Aurora PG (ms)", cell: (r) => r.pg_ms?.toFixed(1) ?? "—" },
              { id: "delta", header: "Delta", cell: (r) => {
                if (!r.oracle_ms || !r.pg_ms) return "—";
                const d = ((r.pg_ms - r.oracle_ms) / r.oracle_ms * 100);
                return <span style={{ color: d > 20 ? "#d32f2f" : d < -10 ? "#2e7d32" : "#666", fontWeight: Math.abs(d) > 20 ? "bold" : "normal" }}>{d > 0 ? "+" : ""}{d.toFixed(0)}%</span>;
              }},
              { id: "status", header: "Status", cell: (r) =>
                r.regression ? <StatusIndicator type="error">Regression</StatusIndicator> :
                r.passed ? <StatusIndicator type="success">Passed</StatusIndicator> :
                <StatusIndicator type="warning">Mismatch</StatusIndicator>,
              },
              { id: "action", header: "Action", cell: (r) =>
                (r.regression || !r.passed) ? (
                  <Button variant="inline-link" loading={fixingQuery === r.query_hash} onClick={() => handleAIFix(r)} iconName="gen-ai">
                    AI Fix
                  </Button>
                ) : <span style={{ color: "#4ade80" }}>—</span>
              },
            ]}
            items={results}
          />
        )}

        {/* AI Fix Result Panel */}
        {fixResult && (
          <Container header={<Header variant="h2" actions={<Button onClick={() => setFixResult(null)} iconName="close">Dismiss</Button>}>AI-Powered Query Fix</Header>}>
            {fixResult.error ? (
              <Alert type="error">{fixResult.error}</Alert>
            ) : (
              <SpaceBetween size="l">
                <ColumnLayout columns={2}>
                  <SpaceBetween size="xs">
                    <Box variant="h4">Original SQL</Box>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap", background: "#1e293b", color: "#f87171", padding: "16px", borderRadius: "8px", lineHeight: "1.6" }}>
                      {fixResult.original}
                    </div>
                  </SpaceBetween>
                  <SpaceBetween size="xs">
                    <Box variant="h4">Rewritten SQL (AI Fix)</Box>
                    <div style={{ fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap", background: "#0f2e1a", color: "#4ade80", padding: "16px", borderRadius: "8px", lineHeight: "1.6" }}>
                      {fixResult.rewritten}
                    </div>
                  </SpaceBetween>
                </ColumnLayout>
                <Container header={<Header variant="h3">Rationale</Header>}>
                  <Box>{fixResult.rationale}</Box>
                </Container>
                {fixResult.changes?.length > 0 && (
                  <Container header={<Header variant="h3">Changes Applied</Header>}>
                    <ul>{fixResult.changes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                  </Container>
                )}
              </SpaceBetween>
            )}
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
