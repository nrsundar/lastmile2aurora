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
import { VerifyPanel } from "../components/VerifyPanel";
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
  oracle_stats?: { disk_reads?: number; buffer_gets?: number; rows_processed?: number };
  pg_stats?: { shared_blks_read?: number; shared_blks_hit?: number; rows_returned?: number };
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
  const [fixingAll, setFixingAll] = useState(false);
  const [fixProgress, setFixProgress] = useState("");
  const [allFixes, setAllFixes] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [deciding, setDeciding] = useState(false);

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
                oracle_stats: r.oracle_stats,
                pg_stats: r.pg_stats,
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
    setVerifyResult(null);
    setFixProgress(`Analyzing execution plan for "${r.name}"...`);
    try {
      const resp = await api.remediate(sql);
      setFixResult({ ...resp, queryName: r.name, query_hash: r.query_hash });
    } catch (e: any) {
      setFixResult({ error: e.message || "Failed to get AI fix" });
    }
    setFixingQuery(null);
    setFixProgress("");
  };

  const handleVerify = async () => {
    if (!fixResult?.original || !fixResult?.rewritten || !fixResult?.query_hash) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const resp = await api.verifyFix({
        query_hash: fixResult.query_hash,
        original_sql: fixResult.original,
        rewritten_sql: fixResult.rewritten,
        run_id: currentRunId || undefined,
      });
      setVerifyResult(resp);
    } catch (e: any) {
      setVerifyResult({ error: e.message || "Verification failed" });
    }
    setVerifying(false);
  };

  const handleDecide = async (action: "accept" | "reject") => {
    if (!verifyResult?.verification_id) return;
    setDeciding(true);
    try {
      const resp = await api.verifyFixVerdict(verifyResult.verification_id, action);
      setVerifyResult({ ...verifyResult, status: resp.status });
    } catch (e: any) {
      setVerifyResult({ ...verifyResult, decideError: e.message || "Failed to update status" });
    }
    setDeciding(false);
  };

  const handleFixAll = async () => {
    const toFix = results.filter((r) => r.regression || !r.passed);
    if (toFix.length === 0) return;
    setFixingAll(true);
    setAllFixes([]);
    for (let i = 0; i < toFix.length; i++) {
      const r = toFix[i];
      const sql = r.pg_sql || r.oracle_sql || "";
      setFixingQuery(r.query_hash);
      setFixProgress(`Fixing ${i + 1} of ${toFix.length}: "${r.name}"...`);
      try {
        const resp = await api.remediate(sql);
        setAllFixes((prev) => [...prev, { ...resp, queryName: r.name }]);
      } catch (e: any) {
        setAllFixes((prev) => [...prev, { error: e.message, queryName: r.name }]);
      }
    }
    setFixingQuery(null);
    setFixingAll(false);
    setFixProgress("");
  };

  // Mode selection
  if (!mode) {
    return (
      <ContentLayout header={<Header variant="h1" description="Choose how you want to run the migration watchdog.">LastMile2Aurora — Dashboard</Header>}>
        <Tiles onChange={({ detail }) => setMode(detail.value)} value={mode ?? ""} columns={2} items={[
          { value: "demo", label: "Demo Mode", description: "Use preconfigured Oracle EE 19c and Aurora PG 16 with tagged demo queries. Great for demos and workshops.", image: <div className="lm-mode-tile-icon">DM</div> },
          { value: "custom", label: "Connect Your Databases", description: "Enter your own Oracle source and Aurora PostgreSQL target connection strings. Use your real application workload with tagged queries.", image: <div className="lm-mode-tile-icon">DB</div> },
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
                  { value: "small", label: "Small — 16 queries, single pass (~30 sec)", description: "Quick demo" },
                  { value: "medium", label: "Medium — 16 queries × 3 rounds (~2 min)", description: "Workshop / POC" },
                  { value: "large", label: "Large — 16 queries × 10 rounds (~5 min)", description: "Production simulation" },
                ]} />
              </FormField>
              <Button variant="primary" onClick={runDemo} iconName="caret-right-filled">
                Run {workloadSize.charAt(0).toUpperCase() + workloadSize.slice(1)} Workload
              </Button>
            </SpaceBetween>
          </Container>
        )}

        {/* Live progress — Executive Console stat strip */}
        {(simulating || results.length > 0) && (
          <SpaceBetween size="m">
            <div className="lm-stat-strip">
              <div className="lm-stat">
                <div className="lm-stat-label">Status</div>
                <div className="lm-stat-value">
                  <span className={`lm-dot lm-dot--${simulating ? "live" : regressions.length > 0 ? "err" : failed.length > 0 ? "warn" : "ok"}`} />
                  {simulating ? "Running" : "Complete"}
                </div>
              </div>
              <div className="lm-stat">
                <div className="lm-stat-label">Elapsed</div>
                <div className="lm-stat-value">{formatTime(elapsed)}</div>
              </div>
              <div className="lm-stat">
                <div className="lm-stat-label">Passed</div>
                <div className={`lm-stat-value ${passed.length > 0 ? "lm-stat-value--forest" : "lm-stat-value--muted"}`}>{passed.length}</div>
              </div>
              <div className="lm-stat">
                <div className="lm-stat-label">Regressions</div>
                <div className={`lm-stat-value ${regressions.length > 0 ? "lm-stat-value--clay" : "lm-stat-value--muted"}`}>{regressions.length}</div>
              </div>
              <div className="lm-stat">
                <div className="lm-stat-label">Mismatches</div>
                <div className={`lm-stat-value ${failed.length > 0 ? "lm-stat-value--ochre" : "lm-stat-value--muted"}`}>{failed.length}</div>
              </div>
            </div>

            {simulating && (
              <ProgressBar
                value={progress}
                label={`Processing: ${currentQuery}`}
                description={`${results.length} of ${demoQueries.length * (workloadSize === "small" ? 1 : workloadSize === "medium" ? 3 : 10)} queries completed`}
                variant="standalone"
              />
            )}
          </SpaceBetween>
        )}

        {/* Results table — shows live as queries complete */}
        {results.length > 0 && (
          <Table
            header={
              <Header variant="h2" counter={`(${results.length})`} actions={
                <SpaceBetween direction="horizontal" size="s">
                  {!simulating && regressions.length + failed.length > 0 && (
                    <Button onClick={handleFixAll} loading={fixingAll} iconName="gen-ai" variant="primary">
                      AI Fix All ({regressions.length + failed.length})
                    </Button>
                  )}
                  {!simulating && <Button onClick={() => { setResults([]); setAllFixes([]); setFixResult(null); }}>Run Again</Button>}
                </SpaceBetween>
              }>
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
                const cls = d > 20 ? "lm-delta lm-delta--up" : d < -10 ? "lm-delta lm-delta--down" : "lm-delta lm-delta--flat";
                return <span className={cls}>{d > 0 ? "+" : ""}{d.toFixed(0)}%</span>;
              }},
              { id: "ora_io", header: "Oracle Blocks", cell: (r) => {
                const s = r.oracle_stats;
                if (!s) return "—";
                return <span title={`Disk: ${s.disk_reads ?? 0}, Buffer: ${s.buffer_gets ?? 0}`}>{s.disk_reads ?? 0} / {s.buffer_gets ?? 0}</span>;
              }},
              { id: "pg_io", header: "PG Pages", cell: (r) => {
                const s = r.pg_stats;
                if (!s) return "—";
                return <span title={`Read: ${s.shared_blks_read ?? 0}, Hit: ${s.shared_blks_hit ?? 0}`}>{s.shared_blks_read ?? 0} / {s.shared_blks_hit ?? 0}</span>;
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
                ) : <span style={{ color: "var(--lm-ink-300)" }}>—</span>
              },
            ]}
            items={results}
          />
        )}

        {/* AI Fix Progress */}
        {fixProgress && (
          <div style={{ background: "var(--lm-paper)", border: "1px solid var(--lm-border)", borderLeft: "3px solid var(--lm-navy)", borderRadius: "var(--lm-radius-md)", padding: "14px 20px" }}>
            <SpaceBetween size="xs" direction="horizontal" alignItems="center">
              <StatusIndicator type="in-progress">{fixProgress}</StatusIndicator>
              {fixingAll && <Box color="text-body-secondary">Amazon Bedrock (Claude) is analyzing execution plans and rewriting queries...</Box>}
            </SpaceBetween>
          </div>
        )}

        {/* AI Fix Result Panel — single query */}
        {fixResult && (
          <Container header={<Header variant="h2" actions={
            <SpaceBetween direction="horizontal" size="xs">
              {!fixResult.error && fixResult.query_hash && (
                <Button iconName="status-positive" variant="primary" loading={verifying} onClick={handleVerify}>
                  Apply &amp; Verify
                </Button>
              )}
              <Button onClick={() => { setFixResult(null); setVerifyResult(null); }} iconName="close">Dismiss</Button>
            </SpaceBetween>
          }>AI-Powered Query Fix</Header>}>
            {fixResult.error ? (
              <Alert type="error">{fixResult.error}</Alert>
            ) : (
              <SpaceBetween size="l">
                <ColumnLayout columns={2}>
                  <div>
                    <div className="lm-code-label">Original SQL</div>
                    <div className="lm-code lm-code--original">{fixResult.original}</div>
                  </div>
                  <div>
                    <div className="lm-code-label"><span className="lm-dot lm-dot--ok" />Rewritten SQL — AI Fix</div>
                    <div className="lm-code lm-code--rewritten">{fixResult.rewritten}</div>
                  </div>
                </ColumnLayout>
                <Container header={<Header variant="h3">Rationale</Header>}>
                  <Box>{fixResult.rationale}</Box>
                </Container>
                {fixResult.changes?.length > 0 && (
                  <Container header={<Header variant="h3">Changes Applied</Header>}>
                    <ul>{fixResult.changes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                  </Container>
                )}
                {verifyResult && <VerifyPanel verifyResult={verifyResult} deciding={deciding} onDecide={handleDecide} />}
              </SpaceBetween>
            )}
          </Container>
        )}
        {/* Batch Fix Results */}
        {allFixes.length > 0 && (
          <Container header={<Header variant="h2" counter={`(${allFixes.length})`}>Batch AI Fix Results</Header>}>
            <SpaceBetween size="l">
              {allFixes.map((fix, i) => (
                <div key={i} className={`lm-fix-row ${fix.error ? "lm-fix-row--err" : "lm-fix-row--ok"}`}>
                  <SpaceBetween size="s">
                    <div className={`lm-fix-title ${fix.error ? "lm-fix-title--err" : ""}`}>
                      {fix.queryName}
                    </div>
                    {fix.error ? (
                      <Box color="text-status-error">{fix.error}</Box>
                    ) : (
                      <ColumnLayout columns={2}>
                        <div>
                          <div className="lm-code-label">Original</div>
                          <div style={{ fontFamily: "var(--lm-font-mono)", fontSize: "12px", color: "var(--lm-ink-700)", lineHeight: 1.5 }}>{fix.original?.slice(0, 120)}...</div>
                        </div>
                        <div>
                          <div className="lm-code-label"><span className="lm-dot lm-dot--ok" />AI Rewrite</div>
                          <div style={{ fontFamily: "var(--lm-font-mono)", fontSize: "12px", color: "var(--lm-ink-700)", lineHeight: 1.5 }}>{fix.rewritten?.slice(0, 120)}...</div>
                        </div>
                      </ColumnLayout>
                    )}
                    {fix.rationale && <Box color="text-body-secondary" fontSize="body-s">{fix.rationale}</Box>}
                  </SpaceBetween>
                </div>
              ))}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
