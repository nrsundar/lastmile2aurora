#!/bin/bash
# LastMile2Aurora — HammerDB Load Runner
# Usage: ./start_load.sh [small|medium|large]
#   small  = 6 min,  2 virtual users
#   medium = 30 min, 4 virtual users
#   large  = 60 min, 8 virtual users

set -euo pipefail

PROFILE="${1:-small}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HAMMERDB="/opt/hammerdb/hammerdbcli"

source /opt/hammerdb/scripts/env.sh

case "$PROFILE" in
  small)
    export HAMMERDB_DURATION=6
    export HAMMERDB_VU=2
    ;;
  medium)
    export HAMMERDB_DURATION=30
    export HAMMERDB_VU=4
    ;;
  large)
    export HAMMERDB_DURATION=60
    export HAMMERDB_VU=8
    ;;
  *)
    echo "Usage: $0 [small|medium|large]"
    echo "  small  = 6 min,  2 virtual users"
    echo "  medium = 30 min, 4 virtual users"
    echo "  large  = 60 min, 8 virtual users"
    exit 1
    ;;
esac

echo "============================================"
echo "LastMile2Aurora — HammerDB Load Generator"
echo "============================================"
echo "Profile:        $PROFILE"
echo "Duration:       ${HAMMERDB_DURATION} minutes"
echo "Virtual Users:  ${HAMMERDB_VU}"
echo "Oracle Host:    $ORACLE_HOST"
echo "Aurora PG Host: $PG_HOST"
echo "============================================"
echo ""

echo "[$(date)] Starting Oracle EE TPC-C load..."
$HAMMERDB auto "$SCRIPT_DIR/hammerdb_oracle_run.tcl" > /tmp/hammerdb_oracle.log 2>&1 &
ORACLE_PID=$!

echo "[$(date)] Starting Aurora PG TPC-C load..."
$HAMMERDB auto "$SCRIPT_DIR/hammerdb_pg_run.tcl" > /tmp/hammerdb_pg.log 2>&1 &
PG_PID=$!

echo "[$(date)] Both loads running in parallel (PIDs: Oracle=$ORACLE_PID, PG=$PG_PID)"
echo "[$(date)] Logs: /tmp/hammerdb_oracle.log, /tmp/hammerdb_pg.log"
echo ""
echo "Waiting for completion (~${HAMMERDB_DURATION} minutes)..."

wait $ORACLE_PID
ORACLE_EXIT=$?
echo "[$(date)] Oracle load finished (exit=$ORACLE_EXIT)"

wait $PG_PID
PG_EXIT=$?
echo "[$(date)] Aurora PG load finished (exit=$PG_EXIT)"

echo ""
echo "============================================"
echo "Load test complete!"
echo "Oracle exit: $ORACLE_EXIT"
echo "Aurora PG exit: $PG_EXIT"
echo "============================================"
