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
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import { translateOracleToPostgres } from "../lib/sql-translator";

const EXAMPLES = [
  { label: "NVL + ROWNUM + SYSDATE", sql: "SELECT e.first_name, NVL(e.commission_pct, 0) AS commission,\n       SYSDATE AS today\nFROM employees e\nWHERE ROWNUM <= 10\nORDER BY e.salary DESC" },
  { label: "DECODE", sql: "SELECT first_name, DECODE(department_id, 10, 'Engineering', 20, 'Marketing', 'Other') AS dept\nFROM employees" },
  { label: "Oracle (+) outer join", sql: "SELECT e.first_name, d.department_name\nFROM employees e, departments d\nWHERE e.department_id = d.department_id(+)" },
  { label: "DUAL + TRUNC", sql: "SELECT TRUNC(SYSDATE) FROM DUAL" },
  { label: "Sequence", sql: "SELECT emp_seq.NEXTVAL FROM DUAL" },
  { label: "Hints + SUBSTR", sql: "SELECT /*+ INDEX(e emp_salary_idx) */ SUBSTR(email, 1, 5) AS prefix\nFROM employees e\nWHERE salary > 90000" },
];

export default function TranslatePage() {
  const [oracleSQL, setOracleSQL] = useState(EXAMPLES[0].sql);
  const [result, setResult] = useState<any>(null);

  const handleTranslate = () => {
    const r = translateOracleToPostgres(oracleSQL);
    setResult(r);
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Paste Oracle SQL and instantly see the PostgreSQL equivalent. All 15 Oracle quirks are handled client-side — no backend needed.">
          Translate Oracle → PostgreSQL
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* Example buttons */}
        <Container header={<Header variant="h3">Quick Examples</Header>}>
          <SpaceBetween size="xs" direction="horizontal">
            {EXAMPLES.map((ex, i) => (
              <Button key={i} variant="inline-link" onClick={() => { setOracleSQL(ex.sql); setResult(null); }}>{ex.label}</Button>
            ))}
          </SpaceBetween>
        </Container>

        {/* Input */}
        <Container header={<Header variant="h2">Oracle SQL Input</Header>}>
          <SpaceBetween size="m">
            <Textarea value={oracleSQL} onChange={({ detail }) => setOracleSQL(detail.value)} rows={6} placeholder="Paste your Oracle SQL here..." />
            <Button variant="primary" onClick={handleTranslate} iconName="gen-ai">Translate to PostgreSQL</Button>
          </SpaceBetween>
        </Container>

        {/* Result */}
        {result && (
          <SpaceBetween size="l">
            <ColumnLayout columns={2}>
              <Container header={<Header variant="h3">Original (Oracle)</Header>}>
                <div style={{ fontFamily: "monospace", fontSize: "14px", whiteSpace: "pre-wrap", background: "#1e293b", color: "#e2e8f0", padding: "16px", borderRadius: "8px", lineHeight: "1.6" }}>
                  {result.original}
                </div>
              </Container>
              <Container header={<Header variant="h3">Translated (PostgreSQL)</Header>}>
                <div style={{ fontFamily: "monospace", fontSize: "14px", whiteSpace: "pre-wrap", background: "#0f2e1a", color: "#86efac", padding: "16px", borderRadius: "8px", lineHeight: "1.6" }}>
                  {result.translated}
                </div>
              </Container>
            </ColumnLayout>

            {/* Changes */}
            {result.changes.length > 0 && (
              <Container header={<Header variant="h3">Transformations Applied <Badge color="blue">{result.changes.length}</Badge></Header>}>
                <SpaceBetween size="xs">
                  {result.changes.map((c: string, i: number) => (
                    <div key={i}>
                      <StatusIndicator type="success">{c}</StatusIndicator>
                    </div>
                  ))}
                </SpaceBetween>
              </Container>
            )}

            {/* Issues */}
            {result.issues.length > 0 && (
              <Alert type="warning" header={`${result.issues.length} issue(s) need manual review`}>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {result.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                </ul>
              </Alert>
            )}

            {/* Summary */}
            <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: "12px", padding: "20px", color: "white" }}>
              <ColumnLayout columns={3}>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase" }}>Transformations</div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4ade80" }}>{result.changes.length}</div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase" }}>Issues</div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: result.issues.length > 0 ? "#fbbf24" : "#4ade80" }}>{result.issues.length}</div>
                </Box>
                <Box textAlign="center">
                  <div style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase" }}>Status</div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: result.issues.length === 0 ? "#4ade80" : "#fbbf24" }}>
                    {result.issues.length === 0 ? "✓ Ready" : "⚠ Review"}
                  </div>
                </Box>
              </ColumnLayout>
            </div>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
