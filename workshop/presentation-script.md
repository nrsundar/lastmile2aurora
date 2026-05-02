# LastMile2Aurora — Presentation Script (15 minutes)

---

## Slide 1: Title (30 sec)

**LastMile2Aurora — Live Migration Performance Watchdog**

*Validate that your migrated queries perform the same on Aurora PostgreSQL as they did on Oracle — and if they don't, fix them with AI.*

Built during 48-hour hackathon | raghasun@

---

## Slide 2: The Problem (1.5 min)

**The Last Mile of Database Migration**

- AWS SCT handles schema migration well — DDL, tables, indexes, constraints ✅
- But **application-layer SQL** (DML embedded in code) is left as manual work ❌
- Engineering teams discover broken or slow queries **in production after cutover**
- Common issues:
  - Oracle-specific syntax fails on PostgreSQL (NVL, ROWNUM, DECODE, (+) joins)
  - Queries fast on Oracle are slow on Aurora PG due to execution plan changes
  - Test data doesn't match production volume → false performance comparisons
- **No existing tool** validates query performance parity before cutover

*"We've seen customers delay cutover by weeks because they can't prove their queries will work."*

---

## Slide 3: What LastMile2Aurora Does (1.5 min)

**Three capabilities:**

1. **Tag & Track** — Tag business-critical queries with SQL comments (`/* tag:order_lookup */`). Tool matches the same query across Oracle and PostgreSQL by tag, not by SQL hash.

2. **Compare Performance** — Side-by-side: Oracle data blocks read vs PG pages read, execution times, row counts. Flags regressions (>20% slower) and data volume mismatches.

3. **AI-Powered Fix** — When a query regresses, Amazon Bedrock (Claude) analyzes the execution plan and rewrites the query for PostgreSQL. Human-in-the-loop or autonomous.

---

## Slide 4: Architecture (1 min)

**Show architecture diagram from the app landing page**

- Customer app (or HammerDB for demo) sends tagged queries to both databases
- Oracle EE 19c (source) + Aurora PostgreSQL 16 (target) — both in private subnets
- LastMile2Aurora engine on ECS Fargate: tag matcher, deep diff, perf compare, LLM rewrite
- CloudFront (HTTPS) → ALB → ECS → databases
- Cognito auth with MFA, self-registration restricted to @amazon.com
- All Epoxy/Orthanc compliant

---

## Slide 5: Why Tags? (1 min)

**The matching problem:**

Oracle SQL:
```sql
SELECT /* tag:order_lookup */ o.order_id, NVL(o.amount, 0)
FROM orders o WHERE ROWNUM <= 100
```

PostgreSQL SQL:
```sql
SELECT /* tag:order_lookup */ o.order_id, COALESCE(o.amount, 0)
FROM orders o LIMIT 100
```

- Different syntax → different SQL hash
- Same tag → same business query
- Customers tag their top 50-100 critical queries
- Tool tracks only tagged queries — focused on what matters

---

## Slide 6: Live Demo — Landing Page (30 sec)

**Open https://<YOUR_AMPLIFY_URL>**

- Show the landing page: tagline, feature cards, architecture diagram
- Show "How It Works" section with tagging workflow
- Show performance metrics table (Oracle blocks vs PG pages)
- Point out the @amazon.com registration restriction

---

## Slide 7: Live Demo — Sign In & Mode Selection (30 sec)

- Sign in with demo credentials
- Show two modes: **Demo Mode** (preconfigured) vs **Connect Your Databases** (custom)
- Click Demo Mode
- Show workload size options: Small / Medium / Large

---

## Slide 8: Live Demo — Run Workload (2 min)

- Select **Small** workload
- Click **Run Small Workload**
- **Watch the live progress:**
  - Dark status panel: ⚡ Running, elapsed timer, live counters
  - Progress bar showing current query name
  - Results streaming in one by one
  - Green ✅ for passed, Red 🔴 for regression, Yellow ⚠️ for mismatch
- Point out:
  - "These are real queries running against real Oracle EE and Aurora PG"
  - "7 passed, 9 mismatches — the mismatches are expected (ROWNUM vs LIMIT, outer join syntax)"
  - "The Delta column shows percentage difference"

---

## Slide 9: Live Demo — SQL Translation (1 min)

- Click **Translate SQL** in sidebar
- Show the pre-loaded Oracle query with NVL, SYSDATE, ROWNUM
- Click **Translate to PostgreSQL**
- Show the instant result:
  - Dark code blocks: Oracle (left) vs PostgreSQL (right)
  - Transformations applied: NVL→COALESCE, SYSDATE→CURRENT_TIMESTAMP, ROWNUM→LIMIT
  - Status summary: transformations count, issues count
- Click a **Quick Example** (DECODE, outer join, sequence)
- Show how each Oracle quirk is handled

---

## Slide 10: Live Demo — Reports (30 sec)

- Click **Reports** in sidebar
- Show the run selector dropdown — each run is isolated
- Show queries tab with Oracle ms vs Aurora PG ms
- Show alerts tab with regression details
- "If another judge runs a workload simultaneously, they see only their own results"

---

## Slide 11: Performance Metrics Deep Dive (1 min)

**What we compare:**

| Metric | Oracle | Aurora PG |
|--------|--------|-----------|
| I/O | Data Blocks Read | shared_blks_read (Pages) |
| Time | V$SQL elapsed_time | pg_stat total_exec_time |
| Rows | rows_processed | rows returned |
| Executions | executions | calls |

**Data volume mismatch detection:**
- Common false positive: customer tests with 100K rows, production has 10M
- Different data volume = different execution plans = meaningless comparison
- LastMile2Aurora flags this so you don't chase phantom regressions

---

## Slide 12: 15 Oracle Quirks Handled (1 min)

Quick scroll through the quirks table:
- SYSDATE → CURRENT_TIMESTAMP
- NVL → COALESCE
- ROWNUM → LIMIT
- DECODE → CASE
- (+) outer join → LEFT JOIN
- .NEXTVAL → nextval()
- TRUNC(date) → DATE_TRUNC
- FROM DUAL → removed
- Hints → removed
- SUBSTR → SUBSTRING
- TO_DATE → ::date cast
- CONNECT BY → flagged for WITH RECURSIVE
- MERGE → flagged for INSERT ON CONFLICT

*"These are the top 15 quirks we see in every Oracle migration. The tool handles them automatically."*

---

## Slide 13: Real-World Usage (1 min)

**For customers:**
1. Tag top 50-100 business-critical queries in application code
2. Connect Oracle source + Aurora PG target
3. Run real application workload (or HammerDB for POC)
4. Dashboard shows live comparison
5. Fix regressions with AI
6. Export report as cutover readiness proof

**For SAs:**
- Demo mode with HammerDB (Small/Medium/Large profiles)
- Show customers the tool during migration workshops
- Prove performance parity before cutover day

**Future:**
- SQL Server → Aurora PG support
- AWR report import (no direct DB access needed)
- Live V$SQL / pg_stat_statements capture
- Custom connection UI (currently preconfigured for demo)

---

## Slide 14: Security & Compliance (30 sec)

**Fully Epoxy/Orthanc compliant:**
- All databases in private subnets, encrypted with KMS CMK
- ALB restricted to CloudFront prefix list (not 0.0.0.0/0)
- Cognito with optional MFA, self-registration gated to @amazon.com
- JWT verification on every API route
- S3: versioned, encrypted, block public access, deny non-SSL
- Multi-user isolation via run_id
- No hardcoded secrets

---

## Slide 15: Tech Stack & What I Built (1 min)

**Built in 48 hours:**
- React + Cloudscape frontend (Amplify + CloudFront)
- Python FastAPI backend (ECS Fargate)
- Oracle EE 19c + Aurora PostgreSQL 16 (RDS)
- HammerDB on EC2 (TPC-C load generator)
- Amazon Bedrock (Claude) for query rewriting
- sql-migration-optimizer engine for Oracle→PG conversion
- CloudFormation for all infrastructure
- Cognito auth with Lambda pre-sign-up trigger

**Lines of code:** ~3,000 (backend + frontend + infra + scripts)

**Built with:** Kiro in AgentSpaces

---

## Slide 16: Q&A

**Try it yourself:** https://<YOUR_AMPLIFY_URL>

**Code:** https://github.com/<YOUR_GITHUB_USER>/lastmile2aurora

**Questions?**

---

## Timing Guide

| Section | Duration | Cumulative |
|---------|----------|------------|
| Title | 0:30 | 0:30 |
| Problem | 1:30 | 2:00 |
| What it does | 1:30 | 3:30 |
| Architecture | 1:00 | 4:30 |
| Why tags | 1:00 | 5:30 |
| Demo: landing | 0:30 | 6:00 |
| Demo: sign in | 0:30 | 6:30 |
| Demo: run workload | 2:00 | 8:30 |
| Demo: translate | 1:00 | 9:30 |
| Demo: reports | 0:30 | 10:00 |
| Metrics deep dive | 1:00 | 11:00 |
| Oracle quirks | 1:00 | 12:00 |
| Real-world usage | 1:00 | 13:00 |
| Security | 0:30 | 13:30 |
| Tech stack | 1:00 | 14:30 |
| Q&A | 0:30 | 15:00 |
