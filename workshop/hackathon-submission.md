## Hackathon Submission: LastMile2Aurora

**Title:** LastMile2Aurora — Live Migration Performance Watchdog

**Problem:** AWS SCT migrates Oracle schemas to Aurora PostgreSQL, but application SQL (DML in code) remains manual. Teams discover broken or slow queries in production after cutover. No tool validates query performance parity before cutover.

**Solution:** Real-time watchdog that runs queries against both Oracle and Aurora PG simultaneously, compares performance (execution time, Oracle data blocks vs PG pages, row counts), detects regressions, and auto-fixes them using Amazon Bedrock (Claude). Customers tag critical queries with SQL comments (/* tag:name */); the tool matches across both databases by tag, not SQL hash.

**Built entirely with Kiro in AgentSpaces:**
- React/Cloudscape frontend on Amplify + CloudFront (HTTPS)
- Python FastAPI backend on ECS Fargate
- Oracle EE 19c + Aurora PG 16 (private subnets, KMS encrypted)
- HammerDB TPC-C load generator (Small/Medium/Large profiles)
- Client-side SQL translator: 15 Oracle quirks (SYSDATE, NVL, ROWNUM, DECODE, etc.)
- Deep diff validator: row count, schema, cell-by-cell comparison
- LLM query rewriting via Bedrock when regressions detected
- Cognito auth (@amazon.com only, optional MFA)
- Multi-user isolation (run_id per session)
- Admin dashboard with cross-user usage stats
- Full Epoxy/Orthanc compliance: SG chaining, CloudFront prefix list, KMS CMK, no public RDS
- CloudFormation for all infrastructure

**Demo:** https://main.ddlli4hw6ltbn.amplifyapp.com
**Code:** https://gitlab.aws.dev/raghasun/lastmile2aurora
**Slides:** workshop/presentation.html in repo

**Impact:** Every Oracle→Aurora migration customer faces this. SAs can demo during migration workshops to prove cutover readiness. Roadmap: SQL Server support, production workload replay, CI/CD gate, auto-generated migration playbooks.

**Stats:** ~3,000 LOC, 15+ CloudFormation resources, 7 API endpoints, 48 hours, built with Kiro.
