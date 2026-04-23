"""LastMile2Aurora — FastAPI backend.

Live migration watchdog: monitors queries against Oracle and Aurora PG,
detects performance regressions, and auto-remediates via LLM rewriting.
"""

import time
import json
import hashlib
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from config import settings
from auth import get_current_user
from db import get_pool, execute_query, init_schema
from translator import translate_sql, analyze_explain, rewrite_slow_query, query_hash
from oracle_connector import get_oracle_executor
from validator import deep_diff


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_schema()
    except Exception as e:
        print(f"Schema init skipped (DB may not be ready): {e}")
    yield


app = FastAPI(title="LastMile2Aurora", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d34mk9xz6qdqt7.cloudfront.net",
        "https://main.ddlli4hw6ltbn.amplifyapp.com",
        "http://localhost:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── WebSocket connections for real-time dashboard ──
_ws_clients: list[WebSocket] = []


async def _broadcast(event: dict):
    for ws in _ws_clients[:]:
        try:
            await ws.send_json(event)
        except Exception:
            _ws_clients.remove(ws)


# ═══════════════════════════════════════════════════════════════════
# Health
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/health")
async def health():
    oracle = get_oracle_executor()
    return {
        "status": "ok",
        "service": "lastmile2aurora",
        "oracle_mode": "rds" if oracle.is_real else "mock",
        "oracle_host": oracle.host or "csv_mock",
    }


# ═══════════════════════════════════════════════════════════════════
# WebSocket — real-time query stream
# ═══════════════════════════════════════════════════════════════════
@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket):
    await ws.accept()
    _ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # Keep alive
    except WebSocketDisconnect:
        _ws_clients.remove(ws)


# ═══════════════════════════════════════════════════════════════════
# Translate — Oracle SQL → PostgreSQL
# ═══════════════════════════════════════════════════════════════════
class TranslateRequest(BaseModel):
    sql: str
    source_dialect: str = "oracle"


@app.post("/api/translate")
async def api_translate(req: TranslateRequest, user: dict = Depends(get_current_user)):
    result = translate_sql(req.sql, req.source_dialect)
    return result


# ═══════════════════════════════════════════════════════════════════
# Execute & Compare — run on both Oracle mock + Aurora PG, diff results
# ═══════════════════════════════════════════════════════════════════
class ExecuteRequest(BaseModel):
    oracle_sql: str
    pg_sql: str
    source_dialect: str = "oracle"
    run_id: Optional[str] = None


@app.post("/api/execute-compare")
async def api_execute_compare(req: ExecuteRequest, user: dict = Depends(get_current_user)):
    # Run on Oracle mock
    oracle_result = get_oracle_executor().execute(req.oracle_sql)

    # Run on Aurora PG
    start = time.monotonic()
    try:
        pg_result = execute_query(req.pg_sql)
        pg_result["execution_time_ms"] = round((time.monotonic() - start) * 1000, 2)
    except Exception as e:
        pg_result = {"columns": [], "rows": [], "row_count": 0, "execution_time_ms": 0, "error": str(e)}

    # Deep diff
    diff = deep_diff(oracle_result, pg_result)

    # Store snapshot
    qh = query_hash(req.oracle_sql)
    _store_snapshot(qh, req.oracle_sql, req.pg_sql, oracle_result, pg_result, diff, user.get("sub", ""), req.run_id)

    # Broadcast to WebSocket clients
    event = {
        "type": "query_compared",
        "query_hash": qh,
        "oracle_ms": oracle_result.get("execution_time_ms", 0),
        "pg_ms": pg_result.get("execution_time_ms", 0),
        "passed": diff["passed"],
        "regression": diff["checks"].get("performance", {}).get("regression", False),
    }
    await _broadcast(event)

    return {"oracle": oracle_result, "postgres": pg_result, "diff": diff, "query_hash": qh}


# ═══════════════════════════════════════════════════════════════════
# Auto-remediate — LLM rewrites a slow query
# ═══════════════════════════════════════════════════════════════════
class RemediateRequest(BaseModel):
    sql: str
    explain_json: Optional[dict] = None
    source_dialect: str = "oracle"
    auto_apply: bool = False


@app.post("/api/remediate")
async def api_remediate(req: RemediateRequest, user: dict = Depends(get_current_user)):
    # Get EXPLAIN if not provided
    explain = req.explain_json
    if not explain:
        try:
            result = execute_query(req.sql)
            explain = result.get("explain", {})
        except Exception:
            explain = {}

    # LLM rewrite
    rewrite = rewrite_slow_query(req.sql, explain, req.source_dialect)

    # Store remediation
    qh = query_hash(req.sql)
    _store_remediation(qh, req.sql, rewrite)

    # Broadcast
    await _broadcast({
        "type": "remediation_created",
        "query_hash": qh,
        "status": "applied" if req.auto_apply else "pending",
    })

    return {
        "original": req.sql,
        "rewritten": rewrite.get("rewritten_sql", ""),
        "rationale": rewrite.get("rationale", ""),
        "changes": rewrite.get("changes", []),
        "status": "applied" if req.auto_apply else "pending",
    }


# ═══════════════════════════════════════════════════════════════════
# Dashboard data — monitored queries, snapshots, alerts
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/queries")
async def api_list_queries(run_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            if run_id:
                cur.execute("""
                    SELECT q.id, q.query_hash, q.original_sql, q.translated_sql, q.status,
                           q.execution_count, q.last_seen,
                           s.source_ms, s.target_ms, s.delta_pct, s.alert_level, s.run_id
                    FROM lm_monitored_queries q
                    JOIN lm_performance_snapshots s ON s.query_id = q.id AND s.run_id = %s
                    ORDER BY s.captured_at DESC LIMIT 100
                """, (run_id,))
            else:
                cur.execute("""
                    SELECT q.id, q.query_hash, q.original_sql, q.translated_sql, q.status,
                           q.execution_count, q.last_seen,
                           s.source_ms, s.target_ms, s.delta_pct, s.alert_level, s.run_id
                    FROM lm_monitored_queries q
                    LEFT JOIN LATERAL (
                        SELECT source_ms, target_ms, delta_pct, alert_level, run_id
                        FROM lm_performance_snapshots WHERE query_id = q.id ORDER BY captured_at DESC LIMIT 1
                    ) s ON true
                    ORDER BY q.last_seen DESC LIMIT 100
                """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        get_pool().putconn(conn)


@app.get("/api/alerts")
async def api_list_alerts(run_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            if run_id:
                cur.execute("""
                    SELECT a.*, q.original_sql, q.query_hash
                    FROM lm_alerts a JOIN lm_monitored_queries q ON q.id = a.query_id
                    WHERE a.run_id = %s ORDER BY a.created_at DESC LIMIT 50
                """, (run_id,))
            else:
                cur.execute("""
                    SELECT a.*, q.original_sql, q.query_hash
                    FROM lm_alerts a JOIN lm_monitored_queries q ON q.id = a.query_id
                    WHERE a.acknowledged = FALSE ORDER BY a.created_at DESC LIMIT 50
                """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        get_pool().putconn(conn)


@app.get("/api/remediations")
async def api_list_remediations(user: dict = Depends(get_current_user)):
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.*, q.query_hash
                FROM lm_remediations r
                JOIN lm_monitored_queries q ON q.id = r.query_id
                ORDER BY r.created_at DESC LIMIT 50
            """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        get_pool().putconn(conn)


# ═══════════════════════════════════════════════════════════════════
# Simulate — inject a batch of Oracle queries for demo
# ═══════════════════════════════════════════════════════════════════
class SimulateRequest(BaseModel):
    queries: list[dict]  # [{oracle_sql, pg_sql}]
    run_id: Optional[str] = None


@app.post("/api/simulate")
async def api_simulate(req: SimulateRequest, user: dict = Depends(get_current_user)):
    run_id = req.run_id or f"run_{int(time.time())}_{user.get('sub', 'anon')[:8]}"
    results = []
    for q in req.queries:
        oracle_sql = q.get("oracle_sql", "")
        pg_sql = q.get("pg_sql", "")
        if not pg_sql:
            translation = translate_sql(oracle_sql)
            pg_sql = translation.get("translated", oracle_sql)

        oracle_result = get_oracle_executor().execute(oracle_sql)
        start = time.monotonic()
        try:
            pg_result = execute_query(pg_sql)
            pg_result["execution_time_ms"] = round((time.monotonic() - start) * 1000, 2)
        except Exception as e:
            pg_result = {"columns": [], "rows": [], "row_count": 0, "execution_time_ms": 0, "error": str(e)}

        diff = deep_diff(oracle_result, pg_result)
        qh = query_hash(oracle_sql)
        _store_snapshot(qh, oracle_sql, pg_sql, oracle_result, pg_result, diff, user.get("sub", ""), run_id)

        await _broadcast({
            "type": "query_compared",
            "query_hash": qh,
            "run_id": run_id,
            "oracle_ms": oracle_result.get("execution_time_ms", 0),
            "pg_ms": pg_result.get("execution_time_ms", 0),
            "passed": diff["passed"],
            "regression": diff["checks"].get("performance", {}).get("regression", False),
        })

        results.append({"query_hash": qh, "passed": diff["passed"], "diff_summary": diff["checks"]})
    return {"count": len(results), "results": results, "run_id": run_id}


# ═══════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════
def _store_snapshot(qh, oracle_sql, pg_sql, oracle_result, pg_result, diff, user_sub="", run_id=""):
    try:
        conn = get_pool().getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO lm_monitored_queries (query_hash, original_sql, translated_sql, execution_count, last_seen)
                    VALUES (%s, %s, %s, 1, NOW())
                    ON CONFLICT (query_hash) DO UPDATE SET
                        execution_count = lm_monitored_queries.execution_count + 1,
                        last_seen = NOW(),
                        translated_sql = COALESCE(EXCLUDED.translated_sql, lm_monitored_queries.translated_sql)
                    RETURNING id
                """, (qh, oracle_sql, pg_sql))
                query_id = cur.fetchone()[0]

                src_ms = oracle_result.get("execution_time_ms", 0)
                tgt_ms = pg_result.get("execution_time_ms", 0)
                delta = tgt_ms - src_ms
                delta_pct = ((delta / src_ms) * 100) if src_ms > 0 else 0
                perf = diff.get("checks", {}).get("performance", {})
                alert_level = "critical" if perf.get("regression") else ("warn" if delta_pct > 10 else "ok")

                cur.execute("""
                    INSERT INTO lm_performance_snapshots
                    (query_id, source_ms, target_ms, delta_ms, delta_pct, row_count_match, data_match, alert_level, run_id, user_sub)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (query_id, src_ms, tgt_ms, delta, delta_pct,
                      diff["checks"].get("row_count", {}).get("passed", False),
                      diff["checks"].get("cell_comparison", {}).get("passed", False),
                      alert_level, run_id, user_sub))

                if alert_level != "ok":
                    cur.execute("""
                        INSERT INTO lm_alerts (query_id, alert_type, severity, message, run_id, user_sub)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (query_id, "performance_regression", alert_level,
                          f"Query {qh} is {abs(delta_pct):.0f}% {'slower' if delta_pct > 0 else 'faster'} on Aurora PG",
                          run_id, user_sub))

            conn.commit()
        finally:
            get_pool().putconn(conn)
    except Exception as e:
        print(f"Snapshot storage failed: {e}")


def _store_remediation(qh, original_sql, rewrite):
    try:
        conn = get_pool().getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM lm_monitored_queries WHERE query_hash = %s", (qh,))
                row = cur.fetchone()
                if row:
                    cur.execute("""
                        INSERT INTO lm_remediations (query_id, original_sql, rewritten_sql, rationale, changes)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (row[0], original_sql, rewrite.get("rewritten_sql", ""),
                          rewrite.get("rationale", ""), json.dumps(rewrite.get("changes", []))))
            conn.commit()
        finally:
            get_pool().putconn(conn)
    except Exception as e:
        print(f"Remediation storage failed: {e}")


# ═══════════════════════════════════════════════════════════════════
# Serve frontend static files (SPA fallback)
# ═══════════════════════════════════════════════════════════════════
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(_STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for all non-API routes."""
        file_path = os.path.join(_STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_STATIC_DIR, "index.html"))
