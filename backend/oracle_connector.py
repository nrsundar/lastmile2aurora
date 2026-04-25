"""Oracle database connector — real RDS Oracle with V$SQL stats, or CSV mock fallback."""

import time
import os

try:
    import oracledb
    HAS_ORACLE = True
except ImportError:
    HAS_ORACLE = False


class OracleExecutor:
    def __init__(self, host=None, port=1521, service="LASTMILE", user="oracleadmin", password=""):
        self.host = host or os.environ.get("ORACLE_HOST", "")
        self.port = port
        self.service = service
        self.user = user
        self.password = password or os.environ.get("ORACLE_PASSWORD", "")
        self._conn = None

    @property
    def is_real(self) -> bool:
        return HAS_ORACLE and bool(self.host)

    def _get_conn(self):
        if self._conn is None and self.is_real:
            self._conn = oracledb.connect(
                user=self.user, password=self.password,
                dsn=f"{self.host}:{self.port}/{self.service}"
            )
        return self._conn

    def execute(self, sql: str) -> dict:
        if not self.is_real:
            from oracle_mock import execute_oracle_mock
            return execute_oracle_mock(sql)

        conn = self._get_conn()
        cur = conn.cursor()
        start = None
        try:
            start = time.monotonic()
            cur.execute(sql)
            if cur.description:
                columns = [d[0].lower() for d in cur.description]
                rows = [dict(zip(columns, r)) for r in cur.fetchall()]
            else:
                columns, rows = [], []
            wall_ms = (time.monotonic() - start) * 1000

            # CRITICAL: capture V$SQL stats IMMEDIATELY, before any other query runs.
            # prev_sql_id in V$SESSION is updated after every statement, so the very next
            # query in this session would overwrite it. Pull elapsed_time + disk_reads +
            # buffer_gets + rows_processed in one shot tied to our sql_id.
            engine_stats = self._get_engine_stats(conn)

            engine_ms = engine_stats.get("elapsed_ms")
            reported_ms = engine_ms if engine_ms is not None else wall_ms

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "execution_time_ms": round(reported_ms, 2),
                "source": "oracle_rds",
                "stats": {
                    "disk_reads": engine_stats.get("disk_reads", 0),
                    "buffer_gets": engine_stats.get("buffer_gets", 0),
                    "rows_processed": engine_stats.get("rows_processed", len(rows)),
                    "wall_ms": round(wall_ms, 2),
                    "engine_ms": round(engine_ms, 2) if engine_ms is not None else None,
                },
            }
        except Exception as e:
            elapsed = (time.monotonic() - start) if start is not None else 0
            return {
                "columns": [], "rows": [], "row_count": 0,
                "execution_time_ms": round(elapsed * 1000, 2),
                "source": "oracle_rds", "error": str(e),
                "stats": {"disk_reads": 0, "buffer_gets": 0, "rows_processed": 0},
            }
        finally:
            cur.close()

    def _get_engine_stats(self, conn) -> dict:
        """Pull elapsed_time (µs), disk_reads, buffer_gets, rows_processed from V$SQL for the
        statement we just ran. Must be called IMMEDIATELY after the user query — any other SQL
        would advance V$SESSION.prev_sql_id and make us read the wrong row.
        Returns {} on failure."""
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT elapsed_time, disk_reads, buffer_gets, rows_processed
                FROM V$SQL
                WHERE sql_id = (
                    SELECT prev_sql_id FROM V$SESSION
                    WHERE sid = SYS_CONTEXT('USERENV', 'SID')
                )
                AND ROWNUM = 1
            """)
            row = cur.fetchone()
            cur.close()
            if row is None:
                return {}
            elapsed_us, disk_reads, buffer_gets, rows_processed = row
            return {
                "elapsed_ms": (float(elapsed_us) / 1000.0) if elapsed_us is not None else None,
                "disk_reads": int(disk_reads) if disk_reads is not None else 0,
                "buffer_gets": int(buffer_gets) if buffer_gets is not None else 0,
                "rows_processed": int(rows_processed) if rows_processed is not None else 0,
            }
        except Exception:
            return {}

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None


_executor = None

def get_oracle_executor() -> OracleExecutor:
    global _executor
    if _executor is None:
        _executor = OracleExecutor()
    return _executor
