"""Oracle database connector — real RDS Oracle or CSV mock fallback."""

import time
import os

# Try real Oracle driver first
try:
    import oracledb
    HAS_ORACLE = True
except ImportError:
    HAS_ORACLE = False


class OracleExecutor:
    """Execute queries against a real Oracle RDS instance or fall back to CSV mock."""

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

        start = time.monotonic()
        conn = self._get_conn()
        cur = conn.cursor()
        try:
            cur.execute(sql)
            if cur.description:
                columns = [d[0].lower() for d in cur.description]
                rows = [dict(zip(columns, r)) for r in cur.fetchall()]
            else:
                columns, rows = [], []
            elapsed = (time.monotonic() - start) * 1000
            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "execution_time_ms": round(elapsed, 2),
                "source": "oracle_rds",
            }
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            return {
                "columns": [], "rows": [], "row_count": 0,
                "execution_time_ms": round(elapsed, 2),
                "source": "oracle_rds", "error": str(e),
            }
        finally:
            cur.close()

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None


# Singleton
_executor = None

def get_oracle_executor() -> OracleExecutor:
    global _executor
    if _executor is None:
        _executor = OracleExecutor()
    return _executor
