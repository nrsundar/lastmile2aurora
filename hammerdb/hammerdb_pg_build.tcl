#!/usr/bin/env tclsh
# HammerDB — Build TPC-C schema on Aurora PostgreSQL
# Usage: /opt/hammerdb/hammerdbcli auto /opt/hammerdb/scripts/hammerdb_pg_build.tcl

source /opt/hammerdb/scripts/env.sh

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
diset tpcc pg_count_ware 10
diset tpcc pg_num_vu 4

buildschema
waittocomplete
puts "Aurora PG TPC-C schema build complete"
exit
