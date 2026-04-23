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
              AWS SCT migrates your schema. <b>This tool migrates your code.</b>
            </Box>
            <Box variant="p" color="text-body-secondary">
              Real-time migration watchdog for Oracle → Aurora PostgreSQL
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
              <Box variant="h3">Live Monitor</Box>
              <Box color="text-body-secondary">Queries execute against both Oracle and Aurora PostgreSQL simultaneously. Every result compared cell-by-cell in real-time.</Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #fff8f0 0%, #fff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #f0d9b5" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #d97706, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="status-warning" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Detect Regressions</Box>
              <Box color="text-body-secondary">Catches row count mismatches, schema drift, data differences, and performance regressions (&gt;20% slower) instantly.</Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #fff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #bbf7d0" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #16a34a, #4ade80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="gen-ai" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Auto-Remediate</Box>
              <Box color="text-body-secondary">LLM-powered query rewriting via Amazon Bedrock. Human-in-the-loop approval or fully autonomous mode.</Box>
            </SpaceBetween>
          </div>
        </ColumnLayout>

        {/* Oracle quirks banner */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: "12px", padding: "20px 32px", color: "white" }}>
          <ColumnLayout columns={2}>
            <Box>
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Oracle Quirks Handled</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>
                SYSDATE • (+) joins • ROWNUM • DUAL • NVL • DECODE • .NEXTVAL • CONNECT BY • MERGE • TO_CHAR/TO_DATE • TRUNC • SUBSTR • || concat • CLOB/BLOB • Hints
              </div>
            </Box>
            <Box textAlign="right">
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Powered By</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>Amazon Bedrock (Claude) • Aurora PostgreSQL 16 • Oracle EE 19c • HammerDB TPC-C</div>
            </Box>
          </ColumnLayout>
        </div>

        {/* How It Works in Production */}
        <ExpandableSection headerText="How It Works in Production — For SAs" variant="container" defaultExpanded>
          <SpaceBetween size="l">
            <Box variant="p" color="text-body-secondary">
              LastMile2Aurora is designed for Solutions Architects running real Oracle → Aurora PostgreSQL migrations. Here's the production workflow:
            </Box>

            <ColumnLayout columns={2}>
              <SpaceBetween size="m">
                <Box variant="h4">SA Workflow</Box>
                <div style={{ fontFamily: "monospace", fontSize: "13px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", lineHeight: "2" }}>
                  <b>1.</b> Connect to customer's Oracle RDS + Aurora PG target<br/>
                  <b>2.</b> Run HammerDB TPC-C workload (Small / Medium / Large)<br/>
                  <b>3.</b> Dashboard shows live query comparison in real-time<br/>
                  <b>4.</b> Identify regressions — queries slower on Aurora PG<br/>
                  <b>5.</b> Click Auto-Remediate — LLM rewrites the slow query<br/>
                  <b>6.</b> Export report — send to customer as cutover readiness proof
                </div>

                <Box variant="h4">Workload Profiles</Box>
                <div style={{ fontFamily: "monospace", fontSize: "13px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Profile</th>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Duration</th>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Virtual Users</th>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Use Case</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={{ padding: "4px 8px" }}>🟢 Small</td><td style={{ padding: "4px 8px" }}>6 min</td><td style={{ padding: "4px 8px" }}>2</td><td style={{ padding: "4px 8px" }}>Quick demo</td></tr>
                      <tr><td style={{ padding: "4px 8px" }}>🟡 Medium</td><td style={{ padding: "4px 8px" }}>30 min</td><td style={{ padding: "4px 8px" }}>4</td><td style={{ padding: "4px 8px" }}>Workshop / POC</td></tr>
                      <tr><td style={{ padding: "4px 8px" }}>🔴 Large</td><td style={{ padding: "4px 8px" }}>60 min</td><td style={{ padding: "4px 8px" }}>8</td><td style={{ padding: "4px 8px" }}>Production simulation</td></tr>
                    </tbody>
                  </table>
                </div>
              </SpaceBetween>

              <SpaceBetween size="m">
                <Box variant="h4">Architecture</Box>
                <div style={{ fontFamily: "monospace", fontSize: "12px", background: "#0f172a", color: "#94a3b8", padding: "16px", borderRadius: "8px", lineHeight: "1.6", whiteSpace: "pre" }}>
{`┌──────────────┐
│  HammerDB    │ TPC-C OLTP workload
│  (EC2)       │ Small / Medium / Large
└──┬───────┬───┘
   │       │
   ▼       ▼
┌──────┐ ┌──────────┐
│Oracle│ │Aurora PG  │
│EE 19c│ │16 (target)│
└──┬───┘ └────┬─────┘
   │          │
   └────┬─────┘
        ▼
┌───────────────┐
│LastMile2Aurora │
│• Compare      │→ Dashboard
│• Detect       │→ Alerts
│• Auto-fix     │→ LLM Rewrite
└───────────────┘`}
                </div>

                <Box variant="h4">Real-World Value</Box>
                <SpaceBetween size="xxs">
                  <Box>✓ <b>Before cutover:</b> Prove every query works on Aurora PG</Box>
                  <Box>✓ <b>During parallel run:</b> Monitor live traffic on both databases</Box>
                  <Box>✓ <b>Performance proof:</b> Side-by-side latency comparison</Box>
                  <Box>✓ <b>Auto-remediation:</b> LLM fixes Oracle-specific SQL patterns</Box>
                  <Box>✓ <b>Customer confidence:</b> Exportable report for cutover approval</Box>
                </SpaceBetween>

                <Box variant="h4">Supported Sources</Box>
                <SpaceBetween size="xxs">
                  <Box>✓ Oracle EE 19c (RDS or on-premises)</Box>
                  <Box>✓ SQL Server (coming soon)</Box>
                  <Box>→ Target: Aurora PostgreSQL 14/15/16</Box>
                </SpaceBetween>
              </SpaceBetween>
            </ColumnLayout>
          </SpaceBetween>
        </ExpandableSection>

        {/* Auth form */}
        <Flashbar items={flash} />
        <ColumnLayout columns={2}>
          <SpaceBetween size="l">
            <Box variant="h2">Get Started</Box>
            <Box color="text-body-secondary" fontSize="heading-s">
              Sign in to access the live migration dashboard. Run demo workloads, translate Oracle SQL, and validate results.
            </Box>
            <SpaceBetween size="xxs">
              <Box>✓ 16 pre-built Oracle demo queries</Box>
              <Box>✓ Real Oracle EE 19c + Aurora PostgreSQL 16</Box>
              <Box>✓ HammerDB TPC-C load generator</Box>
              <Box>✓ Deep diff: row count, schema, cell-by-cell</Box>
              <Box>✓ LLM auto-remediation via Amazon Bedrock</Box>
            </SpaceBetween>
          </SpaceBetween>
          <Container>
            <Tabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
              { id: "signin", label: "Sign In", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignIn} fullWidth>Sign In</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email"><Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" placeholder="you@example.com" /></FormField>
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
