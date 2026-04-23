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
import { useAuth } from "../hooks/useAuth";

export default function AuthPage() {
  const { user, login, register, confirm } = useAuth();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<FlashbarProps.MessageDefinition[]>([]);

  // Already logged in → hard redirect
  if (user) {
    window.location.href = "/dashboard";
    return <Box textAlign="center" padding="xxl"><b>Redirecting to dashboard...</b></Box>;
  }

  const showError = (msg: string) => setFlash([{ type: "error", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);
  const showSuccess = (msg: string) => setFlash([{ type: "success", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);

  const handleSignIn = async () => {
    if (!email || !password) return showError("Email and password required.");
    setLoading(true);
    try {
      await login(email, password);
      // Hard redirect — guarantees page change
      window.location.href = "/dashboard";
    } catch (e: any) {
      showError(e.message || "Sign in failed.");
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) return showError("All fields required.");
    setLoading(true);
    try { await register(email, password, name); setPendingEmail(email); setTab("confirm"); showSuccess("Check your email for a verification code."); } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!code) return showError("Verification code required.");
    setLoading(true);
    try { await confirm(pendingEmail || email, code); showSuccess("Verified! Sign in now."); setTab("signin"); } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  return (
    <ContentLayout
      header={
        <Box padding={{ top: "xxl", bottom: "l" }} textAlign="center">
          <SpaceBetween size="xs">
            <div style={{ fontSize: "42px", fontWeight: 900, background: "linear-gradient(135deg, #0972d3 0%, #44b9d6 50%, #1b9e77 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              LastMile2Aurora
            </div>
            <Box variant="p" fontSize="heading-l" color="text-body-secondary">
              AWS SCT migrates your schema. <b>We migrate your code.</b>
            </Box>
            <Box variant="p" color="text-body-secondary">
              Real-time migration watchdog for Oracle → Aurora PostgreSQL
            </Box>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="xl">
        {/* Feature cards */}
        <ColumnLayout columns={3}>
          <div style={{ background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #d1e5f0" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #0972d3, #44b9d6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="search" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Live Monitor</Box>
              <Box color="text-body-secondary">
                Queries execute against both Oracle and Aurora PostgreSQL simultaneously. Every result compared cell-by-cell in real-time.
              </Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #fff8f0 0%, #ffffff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #f0d9b5" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #d97706, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="status-warning" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Detect Regressions</Box>
              <Box color="text-body-secondary">
                Catches row count mismatches, schema drift, data differences, and performance regressions (&gt;20% slower) instantly.
              </Box>
            </SpaceBetween>
          </div>
          <div style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)", borderRadius: "12px", padding: "24px", border: "1px solid #bbf7d0" }}>
            <SpaceBetween size="s">
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #16a34a, #4ade80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="gen-ai" variant="inverted" size="medium" />
              </div>
              <Box variant="h3">Auto-Remediate</Box>
              <Box color="text-body-secondary">
                LLM-powered query rewriting via Amazon Bedrock. Human-in-the-loop approval or fully autonomous mode.
              </Box>
            </SpaceBetween>
          </div>
        </ColumnLayout>

        {/* Oracle quirks banner */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "12px", padding: "20px 32px", color: "white" }}>
          <ColumnLayout columns={2}>
            <Box>
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Oracle Quirks Handled</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>
                SYSDATE • (+) joins • ROWNUM • DUAL • NVL • DECODE • .NEXTVAL • CONNECT BY • MERGE • TO_CHAR/TO_DATE • TRUNC • SUBSTR • || concat • CLOB/BLOB • Hints
              </div>
            </Box>
            <Box textAlign="right">
              <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Powered By</div>
              <div style={{ color: "white", fontSize: "14px", marginTop: "8px" }}>
                Amazon Bedrock (Claude) • Aurora PostgreSQL 16 • Oracle SE2 19c
              </div>
            </Box>
          </ColumnLayout>
        </div>

        {/* Auth form */}
        <Flashbar items={flash} />
        <ColumnLayout columns={2}>
          <div style={{ padding: "32px 0" }}>
            <SpaceBetween size="l">
              <Box variant="h2">Get Started</Box>
              <Box color="text-body-secondary" fontSize="heading-s">
                Sign in to access the live migration dashboard. Run demo workloads, translate Oracle SQL to PostgreSQL, and validate results — all in one place.
              </Box>
              <SpaceBetween size="xs">
                <Box><b>✓</b> 16 pre-built Oracle demo queries</Box>
                <Box><b>✓</b> Real Oracle RDS + Aurora PostgreSQL</Box>
                <Box><b>✓</b> Deep diff: row count, schema, cell-by-cell</Box>
                <Box><b>✓</b> LLM auto-remediation via Bedrock</Box>
                <Box><b>✓</b> Export reports to markdown</Box>
              </SpaceBetween>
            </SpaceBetween>
          </div>
          <Container>
            <Tabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
              { id: "signin", label: "Sign In", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignIn} fullWidth>Sign In</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email">
                      <Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" placeholder="you@example.com" />
                    </FormField>
                    <FormField label="Password">
                      <Input value={password} onChange={({ detail }) => setPassword(detail.value)} type="password" placeholder="Enter your password"
                        onKeyDown={({ detail }) => { if (detail.key === "Enter") handleSignIn(); }} />
                    </FormField>
                  </SpaceBetween>
                </Form>
              )},
              { id: "signup", label: "Create Account", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignUp} fullWidth>Create Account</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Full Name"><Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="Your Name" /></FormField>
                    <FormField label="Email"><Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" placeholder="you@example.com" /></FormField>
                    <FormField label="Password" description="Min 8 chars, uppercase, lowercase, number"><Input value={password} onChange={({ detail }) => setPassword(detail.value)} type="password" /></FormField>
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
