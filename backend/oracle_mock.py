"""Oracle mock — CSV-backed query executor that simulates Oracle responses."""

import csv
import io
import time
import random
from pathlib import Path

# Pre-loaded mock datasets keyed by table name
_MOCK_DIR = Path(__file__).parent.parent / "mock-workload" / "data"
_CACHE: dict[str, list[dict]] = {}


def _load_csv(table: str) -> list[dict]:
    if table not in _CACHE:
        path = _MOCK_DIR / f"{table}.csv"
        if path.exists():
            with open(path) as f:
                _CACHE[table] = list(csv.DictReader(f))
        else:
            _CACHE[table] = []
    return _CACHE[table]


def execute_oracle_mock(sql: str) -> dict:
    """Simulate Oracle query execution against CSV data.

    Returns a result dict compatible with the validator's comparison format.
    Adds artificial latency to simulate Oracle response times.
    """
    start = time.monotonic()
    # Simulate Oracle latency (50-200ms)
    time.sleep(random.uniform(0.05, 0.2))

    sql_upper = sql.upper().strip()

    # Simple table extraction for SELECT queries
    if "FROM" in sql_upper:
        parts = sql_upper.split("FROM")[1].strip().split()
        table = parts[0].strip().rstrip(";").lower()
        rows = _load_csv(table)

        # Handle ROWNUM / WHERE clauses approximately
        if "ROWNUM" in sql_upper or "FETCH FIRST" in sql_upper:
            rows = rows[:10]

        elapsed = (time.monotonic() - start) * 1000
        columns = list(rows[0].keys()) if rows else []
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "execution_time_ms": round(elapsed, 2),
            "source": "oracle_mock",
        }

    elapsed = (time.monotonic() - start) * 1000
    return {"columns": [], "rows": [], "row_count": 0, "execution_time_ms": round(elapsed, 2), "source": "oracle_mock"}
