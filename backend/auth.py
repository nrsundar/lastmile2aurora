"""Cognito JWT verification middleware."""

from functools import lru_cache
from fastapi import Request, HTTPException
from jose import jwt, JWTError
import httpx
from config import settings


@lru_cache()
def _get_jwks():
    url = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}/.well-known/jwks.json"
    return httpx.get(url, timeout=10).json()


def _get_public_key(token: str):
    jwks = _get_jwks()
    headers = jwt.get_unverified_headers(token)
    kid = headers.get("kid")
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return key
    raise HTTPException(status_code=401, detail="Key not found")


def verify_token(token: str) -> dict:
    """Verify a Cognito JWT and return the payload."""
    key = _get_public_key(token)
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}",
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(request: Request) -> dict:
    """Extract and verify the user from the Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    payload = verify_token(auth[7:])
    return {
        "sub": payload.get("sub"),
        "email": payload.get("email"),
        "groups": payload.get("cognito:groups", []),
    }
