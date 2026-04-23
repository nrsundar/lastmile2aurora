#!/usr/bin/env tclsh
# HammerDB — Run TPC-C load on Oracle EE
# Duration and VU count set by environment: HAMMERDB_DURATION, HAMMERDB_VU

source /opt/hammerdb/scripts/env.sh

set duration [expr {[info exists env(HAMMERDB_DURATION)] ? $env(HAMMERDB_DURATION) : 6}]
set vu_count [expr {[info exists env(HAMMERDB_VU)] ? $env(HAMMERDB_VU) : 2}]

dbset db ora
dbset bm TPC-C

diset connection ora_host $env(ORACLE_HOST)
diset connection ora_port $env(ORACLE_PORT)
diset connection ora_servicename $env(ORACLE_SERVICE)

diset tpcc ora_user $env(ORACLE_USER)
diset tpcc ora_pass $env(ORACLE_PASSWORD)
diset tpcc ora_driver timed
diset tpcc ora_rampup 1
diset tpcc ora_duration $duration
diset tpcc ora_allwarehouse true
diset tpcc ora_timeprofile true

loadscript
vuset vu $vu_count
vucreate
vurun
runtimer [expr {($duration + 2) * 60}]
waittocomplete
puts "Oracle TPC-C load complete — ${duration} min, ${vu_count} VUs"
exit
