=== LastMile2Aurora Deployment Log ===
Date: Wed Apr 22 17:42:30 UTC 2026

## AWS Account
```
{
    "UserId": "AROA5PCGHWL2BUXGZTIRS:raghasun-Isengard",
    "Account": "925712757492",
    "Arn": "arn:aws:sts::925712757492:assumed-role/SA-Admin-Role/raghasun-Isengard"
}
```

## CloudFormation Stack Resources
```
----------------------------------------------------------------------------------------------
|                                   DescribeStackResources                                   |
+------------------------+---------------------------------------------+---------------------+
|  ALB                   |  AWS::ElasticLoadBalancingV2::LoadBalancer  |  CREATE_COMPLETE    |
|  ALBListener           |  AWS::ElasticLoadBalancingV2::Listener      |  CREATE_COMPLETE    |
|  ALBSecurityGroup      |  AWS::EC2::SecurityGroup                    |  CREATE_COMPLETE    |
|  AuroraCluster         |  AWS::RDS::DBCluster                        |  CREATE_COMPLETE    |
|  AuroraInstance        |  AWS::RDS::DBInstance                       |  CREATE_COMPLETE    |
|  CognitoAdminGroup     |  AWS::Cognito::UserPoolGroup                |  CREATE_COMPLETE    |
|  CognitoUserPool       |  AWS::Cognito::UserPool                     |  CREATE_COMPLETE    |
|  CognitoUserPoolClient |  AWS::Cognito::UserPoolClient               |  CREATE_COMPLETE    |
|  DBSecurityGroup       |  AWS::EC2::SecurityGroup                    |  CREATE_COMPLETE    |
|  DBSubnetGroup         |  AWS::RDS::DBSubnetGroup                    |  CREATE_COMPLETE    |
|  DataBucket            |  AWS::S3::Bucket                            |  CREATE_COMPLETE    |
|  DataBucketPolicy      |  AWS::S3::BucketPolicy                      |  CREATE_COMPLETE    |
|  ECRRepository         |  AWS::ECR::Repository                       |  CREATE_COMPLETE    |
|  ECSCluster            |  AWS::ECS::Cluster                          |  CREATE_COMPLETE    |
|  ECSLogGroup           |  AWS::Logs::LogGroup                        |  CREATE_COMPLETE    |
|  ECSSecurityGroup      |  AWS::EC2::SecurityGroup                    |  CREATE_COMPLETE    |
|  ECSService            |  AWS::ECS::Service                          |  CREATE_IN_PROGRESS |
|  EncryptionKey         |  AWS::KMS::Key                              |  CREATE_COMPLETE    |
|  EncryptionKeyAlias    |  AWS::KMS::Alias                            |  CREATE_COMPLETE    |
|  IGWAttachment         |  AWS::EC2::VPCGatewayAttachment             |  CREATE_COMPLETE    |
|  InternetGateway       |  AWS::EC2::InternetGateway                  |  CREATE_COMPLETE    |
|  NatEIP                |  AWS::EC2::EIP                              |  CREATE_COMPLETE    |
|  NatGateway            |  AWS::EC2::NatGateway                       |  CREATE_COMPLETE    |
|  PrivateRoute          |  AWS::EC2::Route                            |  CREATE_COMPLETE    |
|  PrivateRouteTable     |  AWS::EC2::RouteTable                       |  CREATE_COMPLETE    |
|  PrivateSubnetA        |  AWS::EC2::Subnet                           |  CREATE_COMPLETE    |
|  PrivateSubnetAAssoc   |  AWS::EC2::SubnetRouteTableAssociation      |  CREATE_COMPLETE    |
|  PrivateSubnetB        |  AWS::EC2::Subnet                           |  CREATE_COMPLETE    |
|  PrivateSubnetBAssoc   |  AWS::EC2::SubnetRouteTableAssociation      |  CREATE_COMPLETE    |
|  PublicRoute           |  AWS::EC2::Route                            |  CREATE_COMPLETE    |
|  PublicRouteTable      |  AWS::EC2::RouteTable                       |  CREATE_COMPLETE    |
|  PublicSubnetA         |  AWS::EC2::Subnet                           |  CREATE_COMPLETE    |
|  PublicSubnetAAssoc    |  AWS::EC2::SubnetRouteTableAssociation      |  CREATE_COMPLETE    |
|  PublicSubnetB         |  AWS::EC2::Subnet                           |  CREATE_COMPLETE    |
|  PublicSubnetBAssoc    |  AWS::EC2::SubnetRouteTableAssociation      |  CREATE_COMPLETE    |
|  TargetGroup           |  AWS::ElasticLoadBalancingV2::TargetGroup   |  CREATE_COMPLETE    |
|  TaskDefinition        |  AWS::ECS::TaskDefinition                   |  CREATE_COMPLETE    |
|  TaskExecutionRole     |  AWS::IAM::Role                             |  CREATE_COMPLETE    |
|  TaskRole              |  AWS::IAM::Role                             |  CREATE_COMPLETE    |
|  VPC                   |  AWS::EC2::VPC                              |  CREATE_COMPLETE    |
+------------------------+---------------------------------------------+---------------------+
```

## Resource Endpoints
```
Cognito User Pool: us-east-1_TwSUGZ9Ar
Cognito Client ID: 166an03mbe42p7pcoiov6fh6a3
Aurora PG Endpoint: rgs-lastmile-aurora-v1.cluster-csnme3bsej9t.us-east-1.rds.amazonaws.com
ALB DNS: rgs-lastmile-alb-v1-1831853084.us-east-1.elb.amazonaws.com
ECR: 925712757492.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1
S3: rgs-lastmile-data-925712757492-v1
```

## Frontend Build
```
vite v5.4.21 building for production...
✓ 1236 modules transformed.
dist/index.html                     0.43 kB
dist/assets/index-DkJhuWLU.css  1,000.70 kB
dist/assets/index-xpfOhhhO.js     993.09 kB
✓ built in 3.59s
```

## Backend Validation
```
main.py OK
auth.py OK
db.py OK
translator.py OK
oracle_mock.py OK
validator.py OK
config.py OK
```

## Epoxy Compliance Checklist
| Control | Status | Evidence |
|---------|--------|----------|
| RDS not publicly accessible | ✅ | `PubliclyAccessible: false` in CFN |
| RDS in private subnets | ✅ | DBSubnetGroup uses PrivateSubnetA/B |
| Storage encryption (KMS CMK) | ✅ | `StorageEncrypted: true`, `KmsKeyId: !Ref EncryptionKey` |
| Backup retention ≥7 days | ✅ | `BackupRetentionPeriod: 7` |
| Fargate over EC2 | ✅ | ECS Fargate, no EC2 instances |
| SG chaining (ALB→ECS→DB) | ✅ | Three separate SGs with source references |
| No 0.0.0.0/0 except ALB HTTP/S | ✅ | Only ALB SG allows 0.0.0.0/0 on 80/443 |
| Cognito with MFA | ✅ | `MfaConfiguration: OPTIONAL`, SOFTWARE_TOKEN_MFA |
| JWT verification on API routes | ✅ | `auth.py` verifies Cognito JWTs |
| No hardcoded passwords | ✅ | `NoEcho: true` on DBPassword parameter |
| S3 block public access | ✅ | All four block settings enabled |
| S3 SSE with KMS CMK | ✅ | `SSEAlgorithm: aws:kms` with CMK |
| S3 versioning | ✅ | `Status: Enabled` |
| S3 deny non-SSL | ✅ | Explicit bucket policy |
| CloudWatch logs | ✅ | 14-day retention |
| ECR scan on push | ✅ | `ScanOnPush: true` |
| KMS key rotation | ✅ | `EnableKeyRotation: true` |
| Fine-grained IAM | ✅ | Task role scoped to Bedrock + S3 + KMS |

## SQL Translation Engine Test
```
======================================================================
SQL TRANSLATION ENGINE TEST
======================================================================

Oracle:     SELECT SYSDATE FROM DUAL
PostgreSQL: SELECT CURRENT_TIMESTAMP
Changes:    2 transformation(s) [SYSDATE→CURRENT_TIMESTAMP, DUAL removed]

Oracle:     SELECT e.first_name, NVL(e.commission_pct, 0) AS commission FROM employees e WHERE ROWNUM <= 5
PostgreSQL: SELECT e.first_name, COALESCE(e.commission_pct, 0) AS commission FROM employees e LIMIT 5
Changes:    2 transformation(s) [NVL→COALESCE, ROWNUM→LIMIT]

Oracle:     SELECT TRUNC(SYSDATE) FROM DUAL
PostgreSQL: SELECT TRUNC(CURRENT_TIMESTAMP)
Changes:    2 transformation(s) [SYSDATE→CURRENT_TIMESTAMP, DUAL removed]
```

## Deep Diff Validator Test
```
TEST 1: Matching results (PG faster) → PASSED
  Row count: 20 == 20 ✅
  Schema: 9 columns match ✅
  Cell comparison: 180 cells, 0 mismatches ✅
  Performance: Oracle 58ms → PG 46ms (-20%) ✅

TEST 2: Mismatched results (PG slower + missing rows) → FAILED
  Row count: 20 != 10 ❌
  Performance regression: +200% ❌
```

## CloudFormation Stack — CREATE_COMPLETE ✅
```
+-------------------+----------------------------------------------------------------------------+
|  APIURL           |  http://rgs-lastmile-alb-v1-1831853084.us-east-1.elb.amazonaws.com         |
|  CognitoUserPoolId|  us-east-1_TwSUGZ9Ar                                                       |
|  CognitoClientId  |  166an03mbe42p7pcoiov6fh6a3                                                |
|  S3Bucket         |  rgs-lastmile-data-925712757492-v1                                         |
|  ECRRepository    |  925712757492.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1              |
|  AuroraEndpoint   |  rgs-lastmile-aurora-v1.cluster-csnme3bsej9t.us-east-1.rds.amazonaws.com   |
|  StackVersion     |  v1                                                                        |
+-------------------+----------------------------------------------------------------------------+
```

## ECS Service — Running ✅
```
Uvicorn running on http://0.0.0.0:8000
Health checks: 200 OK (ALB → ECS → /api/health)
Running tasks: 1
Deployment state: COMPLETED
```

## Docker Image — Pushed to ECR ✅
```
925712757492.dkr.ecr.us-east-1.amazonaws.com/rgs-lastmile-v1:latest
Digest: sha256:84be7da8a9ea0aab67c55dfd19899f034c4dd3bc07bb8ace289d775366e30633
```
