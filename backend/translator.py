"""SQL translation engine — wraps sql-migration-optimizer for Oracle→PostgreSQL conversion."""

import sys
import os
import json
import hashlib
import boto3
from config import settings

# Add sql-migration-optimizer to path
_OPTIMIZER_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'sql-migration-optimizer', 'src')
if os.path.exists(_OPTIMIZER_PATH):
    sys.path.insert(0, _OPTIMIZER_PATH)

try:
    from sql_analyzer import analyze_sql
    from sql_optimizer import optimize_sql
    from explain_analyzer import analyze_explain_output
    from performance_estimator import estimate_query_performance
    HAS_OPTIMIZER = True
except ImportError:
    HAS_OPTIMIZER = False


def query_hash(sql: str) -> str:
    """Deterministic hash for a SQL query (normalized)."""
    normalized = " ".join(sql.strip().split()).lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def translate_sql(sql: str, source: str = "oracle", target_version: str = "16") -> dict:
    """Convert Oracle/SQL Server SQL to PostgreSQL using the local optimizer engine."""
    if HAS_OPTIMIZER:
        analysis = analyze_sql(sql, source, target_version, True)
        optimized, details = optimize_sql(sql, source, analysis, target_version, True)
        perf = estimate_query_performance(sql, optimized, {"analysis": analysis, "optimization_details": details}, source)
        return {
            "original": sql,
            "translated": optimized,
            "source_dialect": source,
            "changes": details,
            "issues": analysis.get("issues", []),
            "performance_estimate": perf,
        }
    # Fallback: use Bedrock for translation
    return _translate_via_bedrock(sql, source)


def analyze_explain(query: str, explain_output: str) -> dict:
    """Analyze EXPLAIN output for performance issues."""
    if HAS_OPTIMIZER:
        return analyze_explain_output(query, explain_output, "postgresql")
    return {"score": 0, "issues": ["Optimizer engine not available"]}


def _translate_via_bedrock(sql: str, source: str) -> dict:
    """Fallback: use Claude on Bedrock for SQL translation."""
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    prompt = f"""Convert this {source} SQL to PostgreSQL. Return ONLY a JSON object:
{{"translated": "<postgresql sql>", "changes": ["<change1>", ...], "issues": ["<issue1>", ...]}}

SQL:
{sql}"""

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}],
    })
    resp = client.invoke_model(modelId=settings.bedrock_model, contentType="application/json", accept="application/json", body=body)
    text = json.loads(resp["body"].read())["content"][0]["text"]
    # Strip markdown fences
    if text.strip().startswith("```"):
        text = text.strip().split("\n", 1)[1].rsplit("```", 1)[0]
    result = json.loads(text)
    result["original"] = sql
    result["source_dialect"] = source
    return result


def rewrite_slow_query(sql: str, explain_json: dict, source: str = "oracle") -> dict:
    """Use LLM to rewrite a slow query based on EXPLAIN analysis."""
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    prompt = f"""You are a PostgreSQL performance expert. This query was migrated from {source} and is running slow.

Original SQL:
{sql}

EXPLAIN ANALYZE output:
{json.dumps(explain_json, indent=2)}

Rewrite the query for better PostgreSQL performance. Return ONLY a JSON object:
{{"rewritten_sql": "<optimized sql>", "rationale": "<why this is faster>", "changes": ["<change1>", ...]}}"""

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}],
    })
    resp = client.invoke_model(modelId=settings.bedrock_model, contentType="application/json", accept="application/json", body=body)
    text = json.loads(resp["body"].read())["content"][0]["text"]
    if text.strip().startswith("```"):
        text = text.strip().split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
