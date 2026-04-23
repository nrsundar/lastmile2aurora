"""Cognito Pre-Sign-Up Lambda trigger — only allows @amazon.com emails."""

def handler(event, context):
    email = event.get("request", {}).get("userAttributes", {}).get("email", "")
    if not email.lower().endswith("@amazon.com"):
        raise Exception("Only @amazon.com email addresses are allowed to register.")
    # Auto-confirm and auto-verify for Amazon employees
    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True
    return event
