import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import StatusIndicator from "@cloudscape-design/components/status-indicator";

export interface VerifyResult {
  verification_id?: number;
  verdict?: "improved" | "worse" | "neutral" | "invalid";
  status?: "pending" | "accepted" | "rejected";
  before?: { ms: number; rows: number; blks_read: number; blks_hit: number; error?: string | null };
  after?: { ms: number; rows: number; blks_read: number; blks_hit: number; error?: string | null };
  delta_ms?: number;
  delta_pct?: number;
  error?: string;
  decideError?: string;
}

export function VerifyPanel({ verifyResult, deciding, onDecide }: { verifyResult: VerifyResult; deciding: boolean; onDecide: (action: "accept" | "reject") => void }) {
  if (verifyResult.error) {
    return <Alert type="error">{verifyResult.error}</Alert>;
  }
  const { before, after, delta_pct = 0, verdict, status } = verifyResult;
  const verdictClass =
    verdict === "improved" ? "lm-verdict lm-verdict--improved" :
    verdict === "worse" ? "lm-verdict lm-verdict--worse" :
    verdict === "invalid" ? "lm-verdict lm-verdict--invalid" :
    "lm-verdict lm-verdict--neutral";
  const verdictLabel =
    verdict === "improved" ? `Improved · ${delta_pct.toFixed(0)}%` :
    verdict === "worse" ? `Worse · ${delta_pct > 0 ? "+" : ""}${delta_pct.toFixed(0)}%` :
    verdict === "invalid" ? "Invalid · row counts differ or execution failed" :
    `Neutral · ${delta_pct > 0 ? "+" : ""}${delta_pct.toFixed(1)}%`;
  const decided = status === "accepted" || status === "rejected";
  return (
    <Container header={<Header variant="h3" actions={<span className={verdictClass}>{verdictLabel}</span>}>Verification — ran both against Aurora PG</Header>}>
      <SpaceBetween size="m">
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Exec time (before)</Box>
            <Box fontSize="heading-m">{before?.ms?.toFixed(2) ?? "—"} ms</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Exec time (after)</Box>
            <Box fontSize="heading-m">{after?.ms?.toFixed(2) ?? "—"} ms</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Rows (before → after)</Box>
            <Box fontSize="heading-m">{before?.rows ?? "—"} → {after?.rows ?? "—"}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Pages read (before → after)</Box>
            <Box fontSize="heading-m">{before?.blks_read ?? "—"} → {after?.blks_read ?? "—"}</Box>
          </div>
        </ColumnLayout>
        {(before?.error || after?.error) && (
          <Alert type="error" header="Execution error">{before?.error || after?.error}</Alert>
        )}
        {verifyResult.decideError && <Alert type="error">{verifyResult.decideError}</Alert>}
        <SpaceBetween direction="horizontal" size="xs">
          {decided ? (
            <StatusIndicator type={status === "accepted" ? "success" : "stopped"}>
              {status === "accepted" ? "Accepted" : "Rejected"}
            </StatusIndicator>
          ) : (
            <>
              <Button variant="primary" loading={deciding} onClick={() => onDecide("accept")} disabled={verdict === "invalid"}>
                Accept
              </Button>
              <Button loading={deciding} onClick={() => onDecide("reject")}>
                Reject
              </Button>
              <Box color="text-body-secondary" fontSize="body-s">
                Accept records the fix as verified. No workload files are modified.
              </Box>
            </>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  );
}
