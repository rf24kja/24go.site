"""Notification settings: SMTP test, notification preferences."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.config import settings
from app.security import get_current_user
from app.models import User

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class SmtpTestRequest(BaseModel):
    host: str
    port: int = 587
    user: str
    password: str
    to_email: str


class SmtpTestResponse(BaseModel):
    status: str
    message: str


@router.post("/test-smtp", response_model=SmtpTestResponse)
async def test_smtp(
    body: SmtpTestRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test email to verify SMTP configuration. Only sends to the user's own email."""
    import re
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.to_email):
        return SmtpTestResponse(status="error", message="Invalid email format")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.user):
        return SmtpTestResponse(status="error", message="Invalid SMTP user email format")
    if not (1 <= body.port <= 65535):
        return SmtpTestResponse(status="error", message="Port must be between 1 and 65535")
    # ponytail: restrict to_email to current user's email to prevent SMTP relay abuse
    if body.to_email != current_user.email:
        return SmtpTestResponse(status="error", message="Test emails can only be sent to your registered email")
    try:
        msg = MIMEMultipart()
        msg["From"] = body.user
        msg["To"] = body.to_email
        msg["Subject"] = "SMTP Test — 24go.site"
        msg.attach(MIMEText(
            "This is a test email from 24GO.\n\n"
            "If you received this, SMTP is configured correctly.\n"
            f"Sent from: {body.user}\n"
            f"Via: {body.host}:{body.port}",
            "plain",
        ))

        with smtplib.SMTP(body.host, body.port, timeout=10) as server:
            server.starttls()
            server.login(body.user, body.password)
            server.sendmail(body.user, body.to_email, msg.as_string())

        return SmtpTestResponse(status="ok", message=f"Test email sent to {body.to_email}")
    except Exception as e:
        return SmtpTestResponse(status="error", message="SMTP connection failed — check host, port, and credentials")


@router.get("/status")
async def notification_status(
    current_user: User = Depends(get_current_user),
):
    """Check which notification channels are configured."""
    import os
    return {
        "smtp": {
            "configured": bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASS),
            "host": settings.SMTP_HOST or "(not set)",
            "notify_email": settings.NOTIFY_EMAIL or "(not set)",
        },
        "bot": {
            "configured": bool(settings.BOT_TOKEN),
            "owner_chat_id": settings.OWNER_CHAT_ID or "(not set)",
        },
        "telegram_api": {
            "configured": bool(int(os.getenv("TG_API_ID", "0"))),
        },
    }
