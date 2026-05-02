"""Live traffic generator — continuously runs Oracle queries and compares against Aurora PG.

This simulates a real application workload hitting Oracle, with LastMile2Aurora
intercepting and comparing results against Aurora PostgreSQL in real-time.

Usage:
  python traffic_generator.py                    # Run with defaults
  python traffic_generator.py --rate 2 --duration 300  # 2 queries/sec for 5 min
"""

import json
import time
import random
import argparse
import os
import sys
import oracledb
import psycopg2
import requests

# Add parent for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from validator import deep_diff


def get_oracle_conn(host, port, service, user, password):
    return oracledb.connect(user=user, password=password, dsn=f"{host}:{port}/{service}")


def get_pg_conn(host, port, database, user, password):
    return psycopg2.connect(host=host, port=port, database=database, user=user, password=password, sslmode="require")


def execute_oracle(conn, sql):
    """Execute query on Oracle and return results."""
    start = time.monotonic()
    cur = conn.cursor()
    cur.execute(sql)
    if cur.description:
        columns = [d[0].lower() for d in cur.description]
        rows = [dict(zip(columns, r)) for r in cur.fetchall()]
    else:
        columns, rows = [], []
    elapsed = (time.monotonic() - start) * 1000
    cur.close()
    return {"columns": columns, "rows": rows, "row_count": len(rows), "execution_time_ms": round(elapsed, 2), "source": "oracle"}


def execute_pg(conn, sql):
    """Execute query on Aurora PG and return results."""
    start = time.monotonic()
    cur = conn.cursor()
    cur.execute(sql)
    if cur.description:
        columns = [d[0] for d in cur.description]
        rows = [dict(zip(columns, r)) for r in cur.fetchall()]
    else:
        columns, rows = [], []
    elapsed = (time.monotonic() - start) * 1000
    cur.close()
    return {"columns": columns, "rows": rows, "row_count": len(rows), "execution_time_ms": round(elapsed, 2), "source": "aurora_pg"}


def load_queries():
    path = os.path.join(os.path.dirname(__file__), "demo_queries.json")
    with open(path) as f:
        return json.load(f)


def run(args):
    queries = load_queries()
    # Filter to queries that are safe to run (SELECT only)
    safe_queries = [q for q in queries if q["oracle_sql"].strip().upper().startswith("SELECT")]

    oracle_conn = get_oracle_conn(args.oracle_host, args.oracle_port, args.oracle_service, args.oracle_user, args.oracle_password)
    pg_conn = get_pg_conn(args.pg_host, args.pg_port, args.pg_database, args.pg_user, args.pg_password)

    api_url = args.api_url.rstrip("/")
    start_time = time.monotonic()
    count = 0
    passed = 0
    regressions = 0

    print(f"Starting traffic generator: {args.rate} queries/sec, duration {args.duration}s")
    print(f"Oracle: {args.oracle_host}:{args.oracle_port}/{args.oracle_service}")
    print(f"Aurora PG: {args.pg_host}:{args.pg_port}/{args.pg_database}")
    print(f"API: {api_url}")
    print("-" * 60)

    try:
        while time.monotonic() - start_time < args.duration:
            q = random.choice(safe_queries)
            count += 1

            try:
                oracle_result = execute_oracle(oracle_conn, q["oracle_sql"])
                pg_result = execute_pg(pg_conn, q["pg_sql"])
                diff = deep_diff(oracle_result, pg_result)

                status = "✅ PASS" if diff["passed"] else "❌ FAIL"
                if diff["checks"].get("performance", {}).get("regression"):
                    status = "🔴 REGRESSION"
                    regressions += 1
                elif diff["passed"]:
                    passed += 1

                oracle_ms = oracle_result["execution_time_ms"]
                pg_ms = pg_result["execution_time_ms"]
                delta = pg_ms - oracle_ms

                print(f"[{count:4d}] {status} | {q['name'][:30]:30s} | Oracle:{oracle_ms:6.1f}ms PG:{pg_ms:6.1f}ms Δ:{delta:+.1f}ms")

                # Post to API if available
                if api_url:
                    try:
                        requests.post(f"{api_url}/api/execute-compare", json={
                            "oracle_sql": q["oracle_sql"],
                            "pg_sql": q["pg_sql"],
                        }, headers={"Authorization": f"Bearer {args.token}"}, timeout=5)
                    except Exception:
                        pass  # API posting is best-effort

            except Exception as e:
                print(f"[{count:4d}] ⚠️  ERROR | {q['name'][:30]:30s} | {str(e)[:50]}")

            time.sleep(1.0 / args.rate)

    except KeyboardInterrupt:
        print("\nStopped by user")
    finally:
        oracle_conn.close()
        pg_conn.close()

    elapsed = time.monotonic() - start_time
    print("-" * 60)
    print(f"Done: {count} queries in {elapsed:.0f}s | {passed} passed | {regressions} regressions | {count - passed - regressions} errors")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="LastMile2Aurora traffic generator")
    p.add_argument("--rate", type=float, default=1.0, help="Queries per second")
    p.add_argument("--duration", type=int, default=120, help="Duration in seconds")
    p.add_argument("--api-url", default=os.environ.get("API_URL", "http://localhost:8000"))
    p.add_argument("--token", default=os.environ.get("AUTH_TOKEN", ""), help="Cognito JWT token")
    # Oracle
    p.add_argument("--oracle-host", default=os.environ.get("ORACLE_HOST", ""))
    p.add_argument("--oracle-port", type=int, default=int(os.environ.get("ORACLE_PORT", "1521")))
    p.add_argument("--oracle-service", default=os.environ.get("ORACLE_SERVICE", "LASTMILE"))
    p.add_argument("--oracle-user", default=os.environ.get("ORACLE_USER", "oracleadmin"))
    p.add_argument("--oracle-password", default=os.environ.get("ORACLE_PASSWORD", "<YOUR_PASSWORD>"))
    # Aurora PG
    p.add_argument("--pg-host", default=os.environ.get("PG_HOST", ""))
    p.add_argument("--pg-port", type=int, default=int(os.environ.get("PG_PORT", "5432")))
    p.add_argument("--pg-database", default=os.environ.get("PG_DATABASE", "lastmile"))
    p.add_argument("--pg-user", default=os.environ.get("PG_USER", "lastmileadmin"))
    p.add_argument("--pg-password", default=os.environ.get("PG_PASSWORD", "<YOUR_PASSWORD>"))

    run(p.parse_args())
