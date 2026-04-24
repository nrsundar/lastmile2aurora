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
        try:
            # Capture session stats before execution
            stats_before = self._get_session_stats(conn)

            start = time.monotonic()
            cur.execute(sql)
            if cur.description:
                columns = [d[0].lower() for d in cur.description]
                rows = [dict(zip(columns, r)) for r in cur.fetchall()]
            else:
                columns, rows = [], []
            elapsed = (time.monotonic() - start) * 1000

            # Capture session stats after execution
            stats_after = self._get_session_stats(conn)

            # Calculate deltas
            blocks_read = (stats_after.get("physical reads", 0) - stats_before.get("physical reads", 0))
            buffer_gets = (stats_after.get("session logical reads", 0) - stats_before.get("session logical reads", 0))
            rows_processed = len(rows)

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "execution_time_ms": round(elapsed, 2),
                "source": "oracle_rds",
                "stats": {
                    "disk_reads": blocks_read,
                    "buffer_gets": buffer_gets,
                    "rows_processed": rows_processed,
                },
            }
        except Exception as e:
            elapsed = (time.monotonic() - start) if 'start' in dir() else 0
            return {
                "columns": [], "rows": [], "row_count": 0,
                "execution_time_ms": round(elapsed * 1000 if elapsed else 0, 2),
                "source": "oracle_rds", "error": str(e),
                "stats": {"disk_reads": 0, "buffer_gets": 0, "rows_processed": 0},
            }
        finally:
            cur.close()

    def _get_session_stats(self, conn) -> dict:
        """Read V$MYSTAT + V$STATNAME for current session I/O stats."""
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT sn.name, ms.value
                FROM V$MYSTAT ms JOIN V$STATNAME sn ON ms.statistic# = sn.statistic#
                WHERE sn.name IN ('physical reads', 'session logical reads')
            """)
            stats = {row[0]: row[1] for row in cur.fetchall()}
            cur.close()
            return stats
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
