#!/usr/bin/env tclsh
# HammerDB — Run TPC-C load on Aurora PostgreSQL
# Duration and VU count set by environment: HAMMERDB_DURATION, HAMMERDB_VU

source /opt/hammerdb/scripts/env.sh

set duration [expr {[info exists env(HAMMERDB_DURATION)] ? $env(HAMMERDB_DURATION) : 6}]
set vu_count [expr {[info exists env(HAMMERDB_VU)] ? $env(HAMMERDB_VU) : 2}]

dbset db pg
dbset bm TPC-C

diset connection pg_host $env(PG_HOST)
diset connection pg_port $env(PG_PORT)
diset connection pg_sslmode require

diset tpcc pg_superuser $env(PG_USER)
diset tpcc pg_superuserpass $env(PG_PASSWORD)
diset tpcc pg_defaultdbase $env(PG_DATABASE)
diset tpcc pg_user $env(PG_USER)
diset tpcc pg_pass $env(PG_PASSWORD)
diset tpcc pg_dbase $env(PG_DATABASE)
diset tpcc pg_driver timed
diset tpcc pg_rampup 1
diset tpcc pg_duration $duration
diset tpcc pg_allwarehouse true
diset tpcc pg_timeprofile true

loadscript
vuset vu $vu_count
vucreate
vurun
runtimer [expr {($duration + 2) * 60}]
waittocomplete
puts "Aurora PG TPC-C load complete — ${duration} min, ${vu_count} VUs"
exit
