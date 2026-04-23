const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("id_token") ?? "";
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  translate: (sql: string, dialect = "oracle") => request("/api/translate", { method: "POST", body: JSON.stringify({ sql, source_dialect: dialect }) }),
  executeCompare: (oracle_sql: string, pg_sql: string, runId?: string) => request("/api/execute-compare", { method: "POST", body: JSON.stringify({ oracle_sql, pg_sql, run_id: runId }) }),
  remediate: (sql: string, auto_apply = false) => request("/api/remediate", { method: "POST", body: JSON.stringify({ sql, auto_apply }) }),
  simulate: (queries: { oracle_sql: string; pg_sql: string }[], runId?: string) => request("/api/simulate", { method: "POST", body: JSON.stringify({ queries, run_id: runId }) }),
  queries: (runId?: string) => request(`/api/queries${runId ? `?run_id=${runId}` : ""}`),
  alerts: (runId?: string) => request(`/api/alerts${runId ? `?run_id=${runId}` : ""}`),
  remediations: (runId?: string) => request(`/api/remediations${runId ? `?run_id=${runId}` : ""}`),
};
