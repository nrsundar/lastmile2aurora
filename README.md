# LastMile2Aurora — Live Migration Watchdog

> **AWS SCT migrates your schema. LastMile2Aurora migrates your code.**

Real-time performance monitoring and auto-remediation for Oracle → Aurora PostgreSQL migrations. Watches queries running against both databases during cutover, detects regressions, and fixes them — either with human approval or autonomously via LLM.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Amplify (React + Cloudscape)                  │
│                    Cognito Auth (MFA optional)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + WebSocket
                  ┌────────▼────────┐
                  │       ALB       │  ← JWT verification
                  └────────┬────────┘
                           │
              ┌────────────▼────────────┐
              │    ECS Fargate (Python)  │
              │  ┌──────────────────┐   │
              │  │ FastAPI Backend   │   │
              │  │ • Query Monitor   │   │
              │  │ • SQL Translator  │   │
              │  │ • Deep Validator  │   │
              │  │ • LLM Remediator  │   │
              │  └──────────────────┘   │
              └──────┬──────────┬───────┘
                     │          │
          ┌──────────▼──┐  ┌───▼──────────┐
          │ Oracle Mock  │  │ Aurora PG    │
          │ (CSV-backed) │  │ (private,    │
          │              │  │  encrypted)  │
          └──────────────┘  └──────────────┘
                     │
              ┌──────▼──────┐
              │   Bedrock    │
              │ Claude Sonnet│
              └─────────────┘
```

## Epoxy/Orthanc Compliance

| Control | Implementation |
|---------|---------------|
| RDS not public | `PubliclyAccessible: false`, private subnets |
| Storage encryption | KMS CMK for Aurora, S3, ECR |
| Backups | 7-day retention on Aurora |
| Fargate over EC2 | ECS Fargate, no EC2 instances |
| SG chaining | ALB → ECS → Aurora (no shortcuts) |
| Cognito MFA | Optional TOTP MFA enabled |
| JWT verification | All API routes verify Cognito tokens |
| S3 hardened | Versioning, block public, deny non-SSL |
| CloudWatch logs | 14-day retention |
| ECR scanning | Scan on push enabled |
| No hardcoded secrets | All via env vars / CloudFormation NoEcho |

## Quick Start

### Prerequisites
- AWS CLI v2
- Docker
- Node.js 18+
- Python 3.11+

### Deploy Infrastructure
```bash
aws cloudformation create-stack \
  --stack-name rgs-lastmile-v1 \
  --template-body file://infra/cloudformation-v1.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=DBPassword,ParameterValue=<your-password> \
  --tags Key=Owner,Value=raghasun
```

### Build & Push Backend
```bash
# Login to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t rgs-lastmile-v1 .
docker tag rgs-lastmile-v1:latest <account>.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1:latest
```

### Deploy Frontend to Amplify
```bash
cd frontend
VITE_API_URL=<alb-url> \
VITE_COGNITO_USER_POOL_ID=<pool-id> \
VITE_COGNITO_CLIENT_ID=<client-id> \
  npm run build
```

### Cleanup
```bash
aws cloudformation delete-stack --stack-name rgs-lastmile-v1
```

## Demo Flow (2 minutes)

1. **Sign in** → Cognito auth (shared with cloud-demo-generator-v2 users)
2. **Live Dashboard** → Click "Run Demo Workload" → 16 Oracle queries stream in
3. **Watch** → Green checks for passing queries, red alerts for regressions
4. **Translate** → Paste any Oracle SQL → instant PostgreSQL translation
5. **Validate** → Side-by-side execution comparison with deep diff
6. **Auto-Fix** → Click "Remediate" → LLM rewrites the slow query
7. **Report** → Full audit trail of all queries, alerts, and remediations

## Project Structure

```
lastmile2aurora/
├── infra/                    # CloudFormation (Epoxy compliant)
│   └── cloudformation-v1.yaml
├── backend/                  # Python FastAPI
│   ├── main.py              # API routes + WebSocket
│   ├── auth.py              # Cognito JWT verification
│   ├── db.py                # Aurora PG connection pool
│   ├── translator.py        # SQL translation (wraps sql-migration-optimizer)
│   ├── oracle_mock.py       # CSV-backed Oracle simulator
│   ├── validator.py         # Deep diff comparator
│   └── config.py            # Pydantic settings
├── frontend/                 # React + Cloudscape
│   └── src/
│       ├── pages/           # Dashboard, Translate, Report, Auth
│       ├── hooks/           # useAuth, useWebSocket
│       ├── lib/             # auth.ts, api.ts
│       └── components/      # AppLayout
├── mock-workload/           # Demo data + sample queries
│   ├── data/                # CSV files (employees, departments, orders)
│   └── demo_queries.json    # 16 Oracle queries with PG translations
├── Dockerfile               # Backend container
└── README.md
```

## License

MIT-0
