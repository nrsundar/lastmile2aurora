# LastMile2Aurora — Live Migration Performance Watchdog

> **AWS SCT migrates your schema. LastMile2Aurora validates that your migrated queries perform the same on Aurora PostgreSQL — and if they don't, fixes them with AI.**

## The Problem

When customers migrate from Oracle to Aurora PostgreSQL, AWS Schema Conversion Tool (SCT) handles DDL (tables, indexes, constraints). But the **application-layer SQL** — queries embedded in code — is left as manual work. Engineering teams discover broken or slow queries **in production after cutover**. By then it's too late.

**Common issues at cutover:**
- Oracle-specific syntax (`NVL`, `ROWNUM`, `DECODE`, `(+)` joins) fails on PostgreSQL
- Queries that were fast on Oracle are slow on Aurora PG due to plan changes
- Data volume differences between test and production mask real regressions
- No way to prove semantic parity before committing to cutover

## What LastMile2Aurora Does

LastMile2Aurora is a **real-time performance watchdog** that sits between your Oracle source and Aurora PostgreSQL target during migration. It:

1. **Tracks tagged queries** across both databases using SQL comment tags (`/* tag:order_lookup */`)
2. **Compares performance** — Oracle data blocks read vs PostgreSQL pages read, execution times, row counts
3. **Detects regressions** — flags queries that are >20% slower on Aurora PG
4. **Fixes with AI** — Amazon Bedrock (Claude) analyzes the execution plan and rewrites the query for PostgreSQL
5. **Generates reports** — exportable cutover readiness proof for your team

## Architecture

![Architecture](frontend/public/architecture.svg)

```
┌──────────────────┐
│ Customer App     │  Tagged SQL queries: /* tag:order_lookup */
│ or HammerDB      │
└──┬───────────┬───┘
   │           │
   ▼           ▼
┌──────────┐ ┌──────────────┐
│ Oracle   │ │ Aurora PG 16 │
│ EE 19c   │ │ (target)     │
└──┬───────┘ └──────┬───────┘
   │                │
   └──────┬─────────┘
          ▼
┌─────────────────────┐
│ LastMile2Aurora      │
│ ECS Fargate          │
│ • Tag Matcher        │
│ • Deep Diff          │
│ • Perf Compare       │  ──→  CloudFront (HTTPS)  ──→  Dashboard
│ • LLM Rewrite        │
│ • Alert Engine       │
└─────────────────────┘
```

## Live Demo

**URL:** https://main.ddlli4hw6ltbn.amplifyapp.com

**Login:** Contact raghasun@ for credentials

### Demo Flow (2 minutes)

1. **Sign in** → Cognito authentication
2. **Choose mode** → "Demo Mode" (preconfigured) or "Connect Your Databases" (custom)
3. **Select workload** → Small (16 queries, 30s) / Medium (48 queries, 2min) / Large (160 queries, 5min)
4. **Watch live** → Progress bar, streaming results, real-time counters
5. **Review** → Green = passed, Red = regression, Yellow = mismatch
6. **Translate** → Paste any Oracle SQL → instant PostgreSQL translation with 15 Oracle quirks handled
7. **Auto-fix** → Click remediate on any regression → LLM rewrites the query

## How Query Tagging Works

Oracle and PostgreSQL generate **different SQL hashes** for the same logical query (different syntax, different execution plans). The only reliable way to match the same business query across both databases is **tagging**.

### Step 1: Tag your Oracle queries
```sql
-- In your application code (Oracle)
SELECT /* tag:order_lookup */ o.order_id, o.amount, c.name
FROM orders o, customers c
WHERE o.customer_id = c.customer_id(+)
AND o.order_date > SYSDATE - 30
```

### Step 2: Tag the PostgreSQL equivalent
```sql
-- In your migrated code (PostgreSQL)
SELECT /* tag:order_lookup */ o.order_id, o.amount, c.name
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date > CURRENT_TIMESTAMP - INTERVAL '30 days'
```

### Step 3: LastMile2Aurora matches by tag
The tool reads `V$SQL` (Oracle) and `pg_stat_statements` (PostgreSQL), extracts the tag from each query, and compares performance metrics for matching tags.

## Performance Metrics Compared

| Metric | Oracle Source | Aurora PG Target |
|--------|-------------|-----------------|
| **I/O** | Data Blocks Read (`V$SQL.disk_reads`) | Pages Read (`pg_stat.shared_blks_read`) |
| **Execution Time** | `V$SQL.elapsed_time` | `pg_stat.total_exec_time` |
| **Rows Processed** | `V$SQL.rows_processed` | `pg_stat.rows` |
| **Executions** | `V$SQL.executions` | `pg_stat.calls` |
| **Data Volume** | ⚠️ Mismatch = likely different test data, not a real regression |

### Why Data Volume Matters

A common false positive: customers test with a subset of production data, then complain about performance differences. If Oracle has 10M rows and Aurora PG has 100K rows, the execution plans will be completely different. LastMile2Aurora flags data volume mismatches so you know when a "regression" is actually a test data issue.

## Oracle Quirks Handled (15)

| Quirk | Oracle | PostgreSQL |
|-------|--------|------------|
| SYSDATE | `SYSDATE` | `CURRENT_TIMESTAMP` |
| DUAL | `FROM DUAL` | *(removed)* |
| NVL | `NVL(x, 0)` | `COALESCE(x, 0)` |
| DECODE | `DECODE(x, 1, 'a', 'b')` | `CASE x WHEN 1 THEN 'a' ELSE 'b' END` |
| ROWNUM | `WHERE ROWNUM <= 10` | `LIMIT 10` |
| (+) outer join | `WHERE a.id = b.id(+)` | `LEFT JOIN b ON a.id = b.id` |
| Sequences | `seq.NEXTVAL` | `nextval('seq')` |
| SUBSTR | `SUBSTR(x, 1, 5)` | `SUBSTRING(x FROM 1 FOR 5)` |
| TRUNC date | `TRUNC(SYSDATE)` | `DATE_TRUNC('day', CURRENT_TIMESTAMP)` |
| TO_DATE | `TO_DATE('2024-01-01', 'YYYY-MM-DD')` | `'2024-01-01'::date` |
| Hints | `/*+ INDEX(e idx) */` | *(removed)* |
| CONNECT BY | Detected, flagged for `WITH RECURSIVE` | Manual review |
| MERGE | Detected, flagged for `INSERT ... ON CONFLICT` | Manual review |
| String concat | `\|\|` | `\|\|` *(compatible)* |
| CLOB/BLOB | Detected | `TEXT` / `BYTEA` |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18 + Cloudscape Design System + Vite |
| **Backend** | Python 3.11 + FastAPI + Uvicorn |
| **Auth** | Amazon Cognito (MFA optional, self-registration disabled) |
| **Source DB** | Oracle EE 19c on RDS (private subnet, encrypted) |
| **Target DB** | Aurora PostgreSQL 16 (private subnet, KMS CMK) |
| **AI** | Amazon Bedrock (Claude) for query rewriting |
| **SQL Engine** | [sql-migration-optimizer](https://gitlab.aws.dev/raghasun/sql-migration-optimizer) |
| **Load Generator** | HammerDB 4.x (TPC-C) on EC2 |
| **Hosting** | ECS Fargate + ALB + CloudFront (HTTPS) + Amplify |
| **IaC** | CloudFormation |

## Project Structure

```
lastmile2aurora/
├── infra/                          # CloudFormation templates
│   ├── cloudformation-v1.yaml      # Main stack: VPC, Aurora PG, ECS, ALB, Cognito, KMS, S3
│   ├── oracle-source-v1.yaml       # Oracle EE RDS instance
│   └── hammerdb-ec2-v1.yaml        # HammerDB EC2 load generator
├── backend/                        # Python FastAPI
│   ├── main.py                     # API routes, WebSocket, simulate endpoint
│   ├── auth.py                     # Cognito JWT verification
│   ├── db.py                       # Aurora PG connection pool + schema
│   ├── translator.py               # SQL translation (local engine + Bedrock fallback)
│   ├── oracle_connector.py         # Real Oracle RDS or CSV mock
│   ├── oracle_mock.py              # CSV-backed Oracle simulator
│   ├── validator.py                # Deep diff comparator
│   └── config.py                   # Pydantic settings
├── frontend/                       # React + Cloudscape
│   └── src/
│       ├── pages/                  # auth, dashboard, translate, report
│       ├── hooks/                  # useAuth, useWebSocket
│       ├── lib/                    # auth.ts, api.ts, sql-translator.ts
│       └── components/             # AppLayout
├── hammerdb/                       # HammerDB TPC-C scripts
│   ├── hammerdb_oracle_build.tcl   # Build TPC-C schema on Oracle
│   ├── hammerdb_pg_build.tcl       # Build TPC-C schema on Aurora PG
│   ├── hammerdb_oracle_run.tcl     # Run load on Oracle (parameterized)
│   ├── hammerdb_pg_run.tcl         # Run load on Aurora PG (parameterized)
│   └── start_load.sh              # Wrapper: small/medium/large profiles
├── mock-workload/                  # Demo data
│   ├── data/                       # CSV: employees, departments, orders
│   ├── demo_queries.json           # 16 tagged Oracle queries with PG translations
│   ├── seed.py                     # Seed both databases
│   └── traffic_generator.py        # Continuous load generator
├── sql-migration-optimizer/        # SQL conversion engine (from gitlab.aws.dev/raghasun/)
├── workshop/                       # Deployment logs for Workshop Studio
├── Dockerfile                      # Backend + frontend container
└── README.md                       # This file
```

## Deployment

### Prerequisites
- AWS account with Bedrock access (Claude models)
- AWS CLI v2 configured
- Docker

### Deploy Infrastructure
```bash
# Main stack (VPC, Aurora PG, ECS, ALB, Cognito, KMS, S3)
aws cloudformation create-stack \
  --stack-name rgs-lastmile-v1 \
  --template-body file://infra/cloudformation-v1.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=DBPassword,ParameterValue=<password>

# Oracle EE
aws rds create-db-instance \
  --db-instance-identifier rgs-lastmile-oracle-ee-v1 \
  --engine oracle-ee --license-model bring-your-own-license \
  --db-instance-class db.r5.large --allocated-storage 50 \
  --master-username oracleadmin --master-user-password <password> \
  --db-name LASTMILE --no-publicly-accessible --storage-encrypted \
  --vpc-security-group-ids <oracle-sg-id> --db-subnet-group-name <subnet-group>

# HammerDB EC2
aws cloudformation create-stack \
  --stack-name rgs-lastmile-hammerdb-v1 \
  --template-body file://infra/hammerdb-ec2-v1.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=VpcId,ParameterValue=<vpc-id> ...
```

### Build & Deploy Backend
```bash
# Login to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t rgs-lastmile-v1 .
docker tag rgs-lastmile-v1:latest <account>.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1:latest

# Force ECS redeploy
aws ecs update-service --cluster rgs-lastmile-cluster-v1 --service rgs-lastmile-svc-v1 --force-new-deployment
```

### Seed Databases
```bash
# Via ECS one-off task
aws ecs run-task --cluster rgs-lastmile-cluster-v1 --task-definition rgs-lastmile-task-v1 \
  --launch-type FARGATE --network-configuration '...' \
  --overrides '{"containerOverrides":[{"name":"lastmile-api","command":["python3","/app/mock-workload/seed.py","both"]}]}'
```

### Run HammerDB Load
```bash
# SSM into EC2
aws ssm start-session --target <instance-id>

# Build TPC-C schema
/opt/hammerdb/hammerdbcli auto /opt/hammerdb/scripts/hammerdb_oracle_build.tcl
/opt/hammerdb/hammerdbcli auto /opt/hammerdb/scripts/hammerdb_pg_build.tcl

# Run load
cd /opt/hammerdb/scripts
./start_load.sh small    # 6 min, 2 virtual users
./start_load.sh medium   # 30 min, 4 virtual users
./start_load.sh large    # 60 min, 8 virtual users
```

### Create Admin User
```bash
aws cognito-idp admin-create-user --user-pool-id <pool-id> \
  --username admin@example.com --temporary-password TempPass1! \
  --message-action SUPPRESS \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true

aws cognito-idp admin-set-user-password --user-pool-id <pool-id> \
  --username admin@example.com --password <permanent-password> --permanent

aws cognito-idp admin-add-user-to-group --user-pool-id <pool-id> \
  --username admin@example.com --group-name admin
```

## Security & Compliance (Epoxy/Orthanc)

| Control | Status | Implementation |
|---------|--------|---------------|
| RDS not publicly accessible | ✅ | `PubliclyAccessible: false` on both Oracle and Aurora |
| Private subnets for compute + DB | ✅ | ECS Fargate + RDS in private subnets with NAT Gateway |
| Storage encryption (KMS CMK) | ✅ | Aurora, S3, ECR all use KMS CMK with key rotation |
| Backup retention ≥7 days | ✅ | Aurora: 7 days, Oracle: 7 days |
| Fargate over EC2 | ✅ | ECS Fargate for backend (EC2 only for HammerDB) |
| SG chaining | ✅ | CloudFront → ALB → ECS → Aurora/Oracle (no shortcuts) |
| ALB not open to 0.0.0.0/0 | ✅ | Restricted to CloudFront managed prefix list (`pl-3b927c52`) |
| Cognito MFA | ✅ | Optional TOTP MFA enabled |
| Cognito self-registration disabled | ✅ | `AllowAdminCreateUserOnly: true` |
| JWT verification on all API routes | ✅ | Every `/api/*` endpoint verifies Cognito JWT |
| S3 hardened | ✅ | Block public access, versioning, KMS SSE, deny non-SSL policy |
| CloudWatch logs | ✅ | 14-day retention |
| ECR scan on push | ✅ | Enabled |
| No hardcoded secrets | ✅ | All via env vars, CloudFormation `NoEcho`, or Cognito |
| HTTPS everywhere | ✅ | CloudFront with default certificate, redirect HTTP→HTTPS |
| Multi-user isolation | ✅ | Each workload run gets unique `run_id`, results scoped per user |

## Multi-User Support

Multiple users can run workloads simultaneously. Each execution gets a unique `run_id` that scopes all performance snapshots, alerts, and reports to that session. No data mixing between users.

## Cleanup

```bash
# Delete in reverse order
aws cloudformation delete-stack --stack-name rgs-lastmile-hammerdb-v1
aws rds delete-db-instance --db-instance-identifier rgs-lastmile-oracle-ee-v1 --skip-final-snapshot
aws cloudformation delete-stack --stack-name rgs-lastmile-v1
aws amplify delete-app --app-id ddlli4hw6ltbn
aws cloudfront delete-distribution --id EN5DGHAHCX85H --if-match <etag>
```

## Related Projects

- [sql-migration-optimizer](https://gitlab.aws.dev/raghasun/sql-migration-optimizer) — Core SQL conversion engine
- [mcp-sql-optimizer](https://gitlab.aws.dev/raghasun/mcp-sql-optimizer) — MCP server for AI-assisted SQL optimization
- [cloud-demo-generator-v2](https://gitlab.aws.dev/raghasun/cloud-demo-generator-v2) — Cognito auth pattern reference

## License

MIT-0

---

*Built with [Kiro](https://kiro.dev) in AgentSpaces — powered by Claude*
