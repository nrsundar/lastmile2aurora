import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useLocation } from "wouter";

export default function TranslatePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [oracleSQL, setOracleSQL] = useState("SELECT e.first_name, NVL(e.commission_pct, 0) AS commission,\n       SYSDATE AS today\nFROM employees e\nWHERE ROWNUM <= 10\nORDER BY e.salary DESC");
  const [result, setResult] = useState<any>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [remediateResult, setRemediateResult] = useState<any>(null);
  const [loading, setLoading] = useState("");

  if (!user) { navigate("/auth"); return null; }

  const handleTranslate = async () => {
    setLoading("translate");
    try { setResult(await api.translate(oracleSQL)); } catch (e) { console.error(e); }
    setLoading("");
  };

  const handleCompare = async () => {
    if (!result?.translated) return;
    setLoading("compare");
    try { setCompareResult(await api.executeCompare(oracleSQL, result.translated)); } catch (e) { console.error(e); }
    setLoading("");
  };

  const handleRemediate = async () => {
    if (!result?.translated) return;
    setLoading("remediate");
    try { setRemediateResult(await api.remediate(result.translated)); } catch (e) { console.error(e); }
    setLoading("");
  };

  return (
    <ContentLayout header={<Header variant="h1">Translate & Validate</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Oracle SQL Input</Header>}>
          <SpaceBetween size="m">
            <Textarea value={oracleSQL} onChange={({ detail }) => setOracleSQL(detail.value)} rows={6} />
            <Button variant="primary" loading={loading === "translate"} onClick={handleTranslate}>Translate to PostgreSQL</Button>
          </SpaceBetween>
        </Container>

        {result && (
          <Container header={<Header variant="h2">Translation Result</Header>}>
            <ColumnLayout columns={2}>
              <SpaceBetween size="s">
                <Box variant="h4">Original (Oracle)</Box>
                <Box variant="code">{result.original}</Box>
              </SpaceBetween>
              <SpaceBetween size="s">
                <Box variant="h4">Translated (PostgreSQL)</Box>
                <Box variant="code">{result.translated}</Box>
              </SpaceBetween>
            </ColumnLayout>
            {result.changes?.length > 0 && (
              <ExpandableSection headerText={`Changes (${result.changes.length})`}>
                <ul>{result.changes.map((c: any, i: number) => <li key={i}>{typeof c === "string" ? c : JSON.stringify(c)}</li>)}</ul>
              </ExpandableSection>
            )}
            <SpaceBetween direction="horizontal" size="s">
              <Button loading={loading === "compare"} onClick={handleCompare}>Validate (Compare Results)</Button>
              <Button loading={loading === "remediate"} onClick={handleRemediate}>Auto-Remediate (LLM Rewrite)</Button>
            </SpaceBetween>
          </Container>
        )}

        {compareResult && (
          <Container header={<Header variant="h2">Validation Result</Header>}>
            <SpaceBetween size="s">
              <StatusIndicator type={compareResult.diff?.passed ? "success" : "error"}>
                {compareResult.diff?.passed ? "PASSED — Safe to cut over" : "FAILED — Needs review"}
              </StatusIndicator>
              <ColumnLayout columns={3}>
                <Box><strong>Row Count:</strong> {compareResult.diff?.checks?.row_count?.passed ? "✅ Match" : "❌ Mismatch"}</Box>
                <Box><strong>Schema:</strong> {compareResult.diff?.checks?.schema?.passed ? "✅ Match" : "❌ Mismatch"}</Box>
                <Box><strong>Data:</strong> {compareResult.diff?.checks?.cell_comparison?.passed ? "✅ Match" : `❌ ${compareResult.diff?.checks?.cell_comparison?.mismatches} mismatches`}</Box>
              </ColumnLayout>
              <Box>
                <strong>Performance:</strong> Oracle {compareResult.diff?.checks?.performance?.source_ms}ms → Aurora PG {compareResult.diff?.checks?.performance?.target_ms}ms
                ({compareResult.diff?.checks?.performance?.delta_pct > 0 ? "+" : ""}{compareResult.diff?.checks?.performance?.delta_pct}%)
              </Box>
            </SpaceBetween>
          </Container>
        )}

        {remediateResult && (
          <Container header={<Header variant="h2">LLM Remediation</Header>}>
            <SpaceBetween size="s">
              <Box variant="h4">Rewritten SQL</Box>
              <Box variant="code">{remediateResult.rewritten}</Box>
              <Box variant="h4">Rationale</Box>
              <Box>{remediateResult.rationale}</Box>
              {remediateResult.changes?.length > 0 && (
                <ExpandableSection headerText="Changes">
                  <ul>{remediateResult.changes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </ExpandableSection>
              )}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
