"""Deep diff validator — compares Oracle mock results vs Aurora PG results."""

import math
from config import settings

# Oracle → PostgreSQL type equivalence map
TYPE_MAP = {
    "NUMBER": ["integer", "bigint", "numeric", "double precision", "real"],
    "VARCHAR2": ["character varying", "text"],
    "CLOB": ["text"],
    "BLOB": ["bytea"],
    "DATE": ["timestamp without time zone", "timestamp with time zone", "date"],
    "TIMESTAMP": ["timestamp without time zone", "timestamp with time zone"],
}


def deep_diff(source_result: dict, target_result: dict) -> dict:
    """Compare source (Oracle mock) and target (Aurora PG) query results.

    Returns a structured diff report with pass/fail per check.
    """
    report = {"passed": True, "checks": {}, "deltas": []}

    # 1. Row count
    src_count = source_result.get("row_count", 0)
    tgt_count = target_result.get("row_count", 0)
    count_match = src_count == tgt_count
    report["checks"]["row_count"] = {
        "passed": count_match,
        "source": src_count,
        "target": tgt_count,
    }
    if not count_match:
        report["passed"] = False

    # 2. Schema (column names)
    src_cols = [c.lower() for c in source_result.get("columns", [])]
    tgt_cols = [c.lower() for c in target_result.get("columns", [])]
    schema_match = src_cols == tgt_cols
    report["checks"]["schema"] = {
        "passed": schema_match,
        "source_columns": src_cols,
        "target_columns": tgt_cols,
        "missing_in_target": [c for c in src_cols if c not in tgt_cols],
        "extra_in_target": [c for c in tgt_cols if c not in src_cols],
    }
    if not schema_match:
        report["passed"] = False

    # 3. Cell-by-cell comparison
    src_rows = source_result.get("rows", [])
    tgt_rows = target_result.get("rows", [])
    min_rows = min(len(src_rows), len(tgt_rows))

    cell_mismatches = 0
    for i in range(min_rows):
        src_row = src_rows[i]
        tgt_row = tgt_rows[i]
        for col in src_cols:
            if col not in tgt_row:
                continue
            src_val = src_row.get(col)
            tgt_val = tgt_row.get(col)
            if not _values_equal(src_val, tgt_val):
                cell_mismatches += 1
                if len(report["deltas"]) < 50:  # Cap deltas
                    report["deltas"].append({
                        "row": i,
                        "column": col,
                        "source_value": str(src_val),
                        "target_value": str(tgt_val),
                    })

    total_cells = min_rows * len(src_cols) if src_cols else 0
    report["checks"]["cell_comparison"] = {
        "passed": cell_mismatches == 0,
        "total_cells": total_cells,
        "mismatches": cell_mismatches,
    }
    if cell_mismatches > 0:
        report["passed"] = False

    # 4. Performance comparison
    src_ms = source_result.get("execution_time_ms", 0)
    tgt_ms = target_result.get("execution_time_ms", 0)
    if src_ms > 0:
        delta_pct = ((tgt_ms - src_ms) / src_ms) * 100
    else:
        delta_pct = 0
    report["checks"]["performance"] = {
        "source_ms": round(src_ms, 2),
        "target_ms": round(tgt_ms, 2),
        "delta_ms": round(tgt_ms - src_ms, 2),
        "delta_pct": round(delta_pct, 1),
        "regression": delta_pct > 20,  # >20% slower = regression
    }

    return report


def _values_equal(src, tgt) -> bool:
    """Compare two values with type-aware tolerance."""
    # NULL handling: NULL == NULL
    if src is None and tgt is None:
        return True
    if src is None or tgt is None:
        return False

    # Float tolerance
    try:
        sf = float(src)
        tf = float(tgt)
        if math.isnan(sf) and math.isnan(tf):
            return True
        return abs(sf - tf) <= settings.float_tolerance
    except (ValueError, TypeError):
        pass

    # String comparison (case-insensitive, trimmed)
    return str(src).strip().lower() == str(tgt).strip().lower()
