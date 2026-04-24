import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Flashbar, { FlashbarProps } from "@cloudscape-design/components/flashbar";
import Tabs from "@cloudscape-design/components/tabs";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Icon from "@cloudscape-design/components/icon";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Alert from "@cloudscape-design/components/alert";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { user, login, register, confirm } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<FlashbarProps.MessageDefinition[]>([]);

  if (user) { navigate("/dashboard"); return null; }

  const showError = (msg: string) => setFlash([{ type: "error", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);
  const showSuccess = (msg: string) => setFlash([{ type: "success", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);

  const handleSignIn = async () => {
    if (!email || !password) return showError("Email and password required.");
    setLoading(true);
    try { await login(email, password); navigate("/dashboard"); } catch (e: any) { showError(e.message || "Sign in failed."); } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) return showError("All fields required.");
    if (!email.toLowerCase().endsWith("@amazon.com")) return showError("Only @amazon.com email addresses can register.");
    setLoading(true);
    try { await register(email, password, name); setPendingEmail(email); setTab("confirm"); showSuccess("Account created! Check your email for a verification code."); } catch (e: any) { showError(e.message || "Sign up failed."); } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!code) return showError("Verification code required.");
    setLoading(true);
    try { await confirm(pendingEmail || email, code); showSuccess("Verified! Sign in now."); setTab("signin"); } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  return (
    <ContentLayout header={<Box padding={{ top: "l" }} />}>
      <SpaceBetween size="xl">
        {/* Hero */}
        <Box textAlign="center" padding={{ bottom: "s" }}>
          <SpaceBetween size="xxs">
            <Box variant="h1" fontSize="display-l" fontWeight="bold" color="text-status-info">LastMile2Aurora</Box>
            <Box variant="p" fontSize="heading-l" color="text-body-secondary">
              Validate that your migrated queries <b>perform the same on Aurora PostgreSQL</b> as they did on Oracle — and if they don't, <b>fix them with AI</b>.
            </Box>
            <Box variant="p" color="text-body-secondary">
              Real-time performance watchdog for Oracle → Aurora PostgreSQL migrations
            </Box>
          </SpaceBetween>
        </Box>

        {/* Feature cards */}
        <ColumnLayout columns={3}>
          <div style={{ background: "linear-gradient(180deg, #f0f9ff 0%, #fff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #d1e5f0" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #0972d3, #44b9d6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="search" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Tag &amp; Track</Box>
              <Box color="text-body-secondary">Tag your business-critical queries with SQL comments (<code>/* tag:order_lookup */</code>). This tool tracks only tagged queries across both databases, matching them by tag — not by SQL hash.</Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #fff8f0 0%, #fff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #f0d9b5" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #d97706, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="status-warning" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Compare Performance</Box>
              <Box color="text-body-secondary">Side-by-side comparison: execution time, Oracle data blocks read vs PostgreSQL pages read, row counts, and data correctness. Detects regressions and data volume mismatches.</Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #fff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #bbf7d0" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #16a34a, #4ade80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="gen-ai" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">AI-Powered Fix</Box>
              <Box color="text-body-secondary">When a query regresses, Amazon Bedrock (Claude) analyzes the execution plan and rewrites the query for PostgreSQL. Human-in-the-loop approval or fully autonomous.</Box>
            </SpaceBetween>
          </div>
        </ColumnLayout>

        {/* Architecture diagram */}
        <Container header={<Header variant="h2">Architecture</Header>}>
          <img src="/architecture.svg" alt="LastMile2Aurora Architecture" style={{ width: "100%", maxWidth: "900px", margin: "0 auto", display: "block" }} />
        </Container>

        {/* How it works — for customers */}
        <ExpandableSection headerText="How It Works — For Your Migration Team" variant="container" defaultExpanded>
          <SpaceBetween size="l">
            <ColumnLayout columns={2}>
              <SpaceBetween size="m">
                <Box variant="h4">Step-by-Step</Box>
                <div style={{ fontFamily: "monospace", fontSize: "13px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", lineHeight: "2.2" }}>
                  <b>1.</b> <b>Tag your queries</b> — Add SQL comments to your top business-critical queries:<br/>
                  <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>SELECT /* tag:order_lookup */ * FROM orders WHERE...</code><br/>
                  <b>2.</b> <b>Connect databases</b> — Enter your Oracle source and Aurora PG target connection strings<br/>
                  <b>3.</b> <b>Run your workload</b> — Use your existing application or load generator<br/>
                  <b>4.</b> <b>Monitor live</b> — Dashboard shows tagged queries from both databases in real-time<br/>
                  <b>5.</b> <b>Review regressions</b> — See Oracle blocks read vs PG pages read, execution times, row counts<br/>
                  <b>6.</b> <b>Fix with AI</b> — Click Auto-Remediate on any regression — LLM rewrites the query<br/>
                  <b>7.</b> <b>Export report</b> — Cutover readiness proof for your team
                </div>

                <Box variant="h4">Why Tags?</Box>
                <Box color="text-body-secondary">
                  Oracle and PostgreSQL generate different SQL hashes for the same logical query (different syntax, different plans). Tags are the only reliable way to match the same business query across both databases. Identify your top business-critical queries, tag them in your application code, and maintain the same tags in both the Oracle and PostgreSQL versions.
                </Box>
              </SpaceBetween>

              <SpaceBetween size="m">
                <Box variant="h4">Performance Metrics Compared</Box>
                <div style={{ fontSize: "13px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Metric</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Oracle</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Aurora PG</th>
                    </tr></thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px 8px", fontWeight: "bold" }}>I/O</td><td style={{ padding: "6px 8px" }}>Data Blocks Read</td><td style={{ padding: "6px 8px" }}>shared_blks_read (Pages)</td></tr>
                      <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px 8px", fontWeight: "bold" }}>Execution Time</td><td style={{ padding: "6px 8px" }}>V$SQL elapsed_time</td><td style={{ padding: "6px 8px" }}>pg_stat total_exec_time</td></tr>
                      <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px 8px", fontWeight: "bold" }}>Rows</td><td style={{ padding: "6px 8px" }}>rows_processed</td><td style={{ padding: "6px 8px" }}>rows returned</td></tr>
                      <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px 8px", fontWeight: "bold" }}>Executions</td><td style={{ padding: "6px 8px" }}>executions</td><td style={{ padding: "6px 8px" }}>calls</td></tr>
                      <tr><td style={{ padding: "6px 8px", fontWeight: "bold" }}>Data Volume</td><td style={{ padding: "6px 8px" }} colSpan={2}>⚠️ Mismatch = likely different test data, not a real regression</td></tr>
                    </tbody>
                  </table>
                </div>

                <Box variant="h4">Demo Mode</Box>
                <div style={{ fontSize: "13px", background: "#fefce8", padding: "16px", borderRadius: "8px", border: "1px solid #fde047" }}>
                  <b>This demo</b> uses preconfigured Oracle EE 19c and Aurora PG 16 databases with HammerDB TPC-C workload. In production, you connect your own databases and use your real application workload.
                  <br/><br/>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "2px solid #fde047" }}>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Profile</th>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Duration</th>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Load</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={{ padding: "4px 8px" }}>🟢 Small</td><td style={{ padding: "4px 8px" }}>6 min</td><td style={{ padding: "4px 8px" }}>2 virtual users</td></tr>
                      <tr><td style={{ padding: "4px 8px" }}>🟡 Medium</td><td style={{ padding: "4px 8px" }}>30 min</td><td style={{ padding: "4px 8px" }}>4 virtual users</td></tr>
                      <tr><td style={{ padding: "4px 8px" }}>🔴 Large</td><td style={{ padding: "4px 8px" }}>60 min</td><td style={{ padding: "4px 8px" }}>8 virtual users</td></tr>
                    </tbody>
                  </table>
                </div>
              </SpaceBetween>
            </ColumnLayout>
          </SpaceBetween>
        </ExpandableSection>

        {/* Oracle quirks banner */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: "12px", padding: "20px 32px", color: "white" }}>
          <ColumnLayout columns={2}>
            <Box>
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Oracle Quirks Detected &amp; Fixed by AI</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>
                SYSDATE • (+) joins • ROWNUM • DUAL • NVL • DECODE • .NEXTVAL • CONNECT BY • MERGE • TO_CHAR/TO_DATE • TRUNC • SUBSTR • || concat • CLOB/BLOB • Hints
              </div>
            </Box>
            <Box textAlign="right">
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Powered By</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>Amazon Bedrock (Claude) • Aurora PostgreSQL 16 • Oracle EE 19c</div>
            </Box>
          </ColumnLayout>
        </div>

        {/* Auth form */}
        <Flashbar items={flash} />
        <ColumnLayout columns={2}>
          <SpaceBetween size="l">
            <Box variant="h2">Get Started</Box>
            <Box color="text-body-secondary" fontSize="heading-s">
              Sign in to access the live migration dashboard. Run demo workloads, translate Oracle SQL, and validate performance.
            </Box>
            <SpaceBetween size="xxs">
              <Box>✓ Tag-based query matching across Oracle and PostgreSQL</Box>
              <Box>✓ Oracle data blocks vs PG pages comparison</Box>
              <Box>✓ Real Oracle EE 19c + Aurora PostgreSQL 16</Box>
              <Box>✓ AI-powered query remediation via Amazon Bedrock</Box>
              <Box>✓ Data volume mismatch detection</Box>
            </SpaceBetween>
          </SpaceBetween>
          <Container>
            <Tabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
              { id: "signin", label: "Sign In", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignIn} fullWidth>Sign In</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email"><Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" placeholder="you@amazon.com" /></FormField>
                    <FormField label="Password"><Input value={password} onChange={({ detail }) => setPassword(detail.value)} type="password" placeholder="Enter your password"
                      onKeyDown={({ detail }) => { if (detail.key === "Enter") handleSignIn(); }} /></FormField>
                  </SpaceBetween>
                </Form>
              )},
              { id: "confirm", label: "Verify Email", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleConfirm} fullWidth>Verify</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email"><Input value={pendingEmail || email} onChange={({ detail }) => setPendingEmail(detail.value)} type="email" /></FormField>
                    <FormField label="Verification Code"><Input value={code} onChange={({ detail }) => setCode(detail.value)} placeholder="123456" /></FormField>
                  </SpaceBetween>
                </Form>
              )},
            ]} />
          </Container>
        </ColumnLayout>
      </SpaceBetween>
    </ContentLayout>
  );
}
