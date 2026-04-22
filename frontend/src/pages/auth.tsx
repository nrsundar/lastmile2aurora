import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Flashbar, { FlashbarProps } from "@cloudscape-design/components/flashbar";
import Tabs from "@cloudscape-design/components/tabs";
import Box from "@cloudscape-design/components/box";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { login, register, confirm } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<FlashbarProps.MessageDefinition[]>([]);

  const showError = (msg: string) => setFlash([{ type: "error", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);
  const showSuccess = (msg: string) => setFlash([{ type: "success", content: msg, dismissible: true, onDismiss: () => setFlash([]) }]);

  const handleSignIn = async () => {
    if (!email || !password) return showError("Email and password required.");
    setLoading(true);
    try { await login(email, password); navigate("/"); } catch (e: any) { showError(e.message); } finally { setLoading(false); }
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
    <ContentLayout header={<Header variant="h1">LastMile2Aurora</Header>}>
      <SpaceBetween size="l">
        <Flashbar items={flash} />
        <Box margin={{ left: "xxxl", right: "xxxl" }} padding={{ left: "xxxl", right: "xxxl" }}>
          <Container header={<Header variant="h2">Authentication</Header>}>
            <Tabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
              { id: "signin", label: "Sign In", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignIn}>Sign In</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email"><Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" /></FormField>
                    <FormField label="Password"><Input value={password} onChange={({ detail }) => setPassword(detail.value)} type="password" /></FormField>
                  </SpaceBetween>
                </Form>
              )},
              { id: "signup", label: "Create Account", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleSignUp}>Create Account</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Full Name"><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
                    <FormField label="Email"><Input value={email} onChange={({ detail }) => setEmail(detail.value)} type="email" /></FormField>
                    <FormField label="Password" description="Min 8 chars, uppercase, lowercase, number"><Input value={password} onChange={({ detail }) => setPassword(detail.value)} type="password" /></FormField>
                  </SpaceBetween>
                </Form>
              )},
              { id: "confirm", label: "Verify Email", content: (
                <Form actions={<Button variant="primary" loading={loading} onClick={handleConfirm}>Verify</Button>}>
                  <SpaceBetween size="l">
                    <FormField label="Email"><Input value={pendingEmail || email} onChange={({ detail }) => setPendingEmail(detail.value)} type="email" /></FormField>
                    <FormField label="Verification Code"><Input value={code} onChange={({ detail }) => setCode(detail.value)} /></FormField>
                  </SpaceBetween>
                </Form>
              )},
            ]} />
          </Container>
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
}
