"""Database connection pool for Aurora PostgreSQL."""

import psycopg2
from psycopg2 import pool
from config import settings

_pool = None


def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            host=settings.pg_host,
            port=settings.pg_port,
            database=settings.pg_database,
            user=settings.pg_user,
            password=settings.pg_password,
            sslmode="require",
        )
    return _pool


def execute_query(sql: str, params=None) -> dict:
    """Execute a query against Aurora PG and return results + metadata."""
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '30s'")
            cur.execute(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {sql}", params)
            explain = cur.fetchone()[0]

        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description:
                columns = [d[0] for d in cur.description]
                rows = cur.fetchall()
                return {
                    "columns": columns,
                    "rows": [dict(zip(columns, r)) for r in rows],
                    "row_count": len(rows),
                    "explain": explain,
                }
            return {"columns": [], "rows": [], "row_count": 0, "explain": explain}
    finally:
        get_pool().putconn(conn)


def init_schema():
    """Create application tables if they don't exist."""
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS lm_monitored_queries (
                    id SERIAL PRIMARY KEY,
                    query_hash VARCHAR(64) NOT NULL,
                    original_sql TEXT NOT NULL,
                    source_dialect VARCHAR(20) DEFAULT 'oracle',
                    translated_sql TEXT,
                    status VARCHAR(20) DEFAULT 'active',
                    first_seen TIMESTAMPTZ DEFAULT NOW(),
                    last_seen TIMESTAMPTZ DEFAULT NOW(),
                    execution_count INT DEFAULT 0,
                    UNIQUE(query_hash)
                );

                CREATE TABLE IF NOT EXISTS lm_performance_snapshots (
                    id SERIAL PRIMARY KEY,
                    query_id INT REFERENCES lm_monitored_queries(id),
                    captured_at TIMESTAMPTZ DEFAULT NOW(),
                    source_ms FLOAT,
                    target_ms FLOAT,
                    delta_ms FLOAT,
                    delta_pct FLOAT,
                    row_count_match BOOLEAN,
                    data_match BOOLEAN,
                    explain_plan JSONB,
                    alert_level VARCHAR(10) DEFAULT 'ok',
                    run_id VARCHAR(100) DEFAULT '',
                    user_sub VARCHAR(100) DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS lm_remediations (
                    id SERIAL PRIMARY KEY,
                    query_id INT REFERENCES lm_monitored_queries(id),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    original_sql TEXT NOT NULL,
                    rewritten_sql TEXT NOT NULL,
                    rationale TEXT,
                    changes JSONB,
                    status VARCHAR(20) DEFAULT 'pending',
                    applied_at TIMESTAMPTZ,
                    applied_by VARCHAR(100)
                );

                CREATE TABLE IF NOT EXISTS lm_alerts (
                    id SERIAL PRIMARY KEY,
                    query_id INT REFERENCES lm_monitored_queries(id),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    alert_type VARCHAR(30) NOT NULL,
                    severity VARCHAR(10) NOT NULL,
                    message TEXT NOT NULL,
                    acknowledged BOOLEAN DEFAULT FALSE,
                    acknowledged_by VARCHAR(100),
                    run_id VARCHAR(100) DEFAULT '',
                    user_sub VARCHAR(100) DEFAULT ''
                );
            """)
        conn.commit()

        # Add columns if missing (for existing tables)
        with conn.cursor() as cur:
            for stmt in [
                "ALTER TABLE lm_performance_snapshots ADD COLUMN IF NOT EXISTS run_id VARCHAR(100) DEFAULT ''",
                "ALTER TABLE lm_performance_snapshots ADD COLUMN IF NOT EXISTS user_sub VARCHAR(100) DEFAULT ''",
                "ALTER TABLE lm_alerts ADD COLUMN IF NOT EXISTS run_id VARCHAR(100) DEFAULT ''",
                "ALTER TABLE lm_alerts ADD COLUMN IF NOT EXISTS user_sub VARCHAR(100) DEFAULT ''",
            ]:
                try:
                    cur.execute(stmt)
                except Exception:
                    pass
        conn.commit()
    finally:
        get_pool().putconn(conn)
