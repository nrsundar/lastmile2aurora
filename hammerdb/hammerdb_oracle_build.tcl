#!/usr/bin/env tclsh
# HammerDB — Build TPC-C schema on Oracle EE
# Usage: /opt/hammerdb/hammerdbcli auto /opt/hammerdb/scripts/hammerdb_oracle_build.tcl

source /opt/hammerdb/scripts/env.sh

dbset db ora
dbset bm TPC-C

diset connection ora_host $env(ORACLE_HOST)
diset connection ora_port $env(ORACLE_PORT)
diset connection ora_servicename $env(ORACLE_SERVICE)

diset tpcc ora_user $env(ORACLE_USER)
diset tpcc ora_pass $env(ORACLE_PASSWORD)
diset tpcc ora_count_ware 10
diset tpcc ora_num_vu 4
diset tpcc ora_partition false

buildschema
waittocomplete
puts "Oracle TPC-C schema build complete"
exit
