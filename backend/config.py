"""LastMile2Aurora backend configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Aurora PostgreSQL (target)
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_database: str = "lastmile"
    pg_user: str = "lastmileadmin"
    pg_password: str = ""

    # Oracle (source)
    oracle_host: str = ""
    oracle_port: int = 1521
    oracle_service: str = "LASTMILE"
    oracle_user: str = "oracleadmin"
    oracle_password: str = ""

    # AWS
    aws_region: str = "us-east-1"
    bedrock_model: str = "us.anthropic.claude-sonnet-4-20250514"

    # Cognito
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""

    # S3
    s3_bucket: str = ""

    # Validation
    float_tolerance: float = 1e-6
    timestamp_tolerance_seconds: int = 1

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
