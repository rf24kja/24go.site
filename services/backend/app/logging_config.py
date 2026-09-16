"""Structured JSON logging for production."""
import logging
import json
import os
import sys
import time
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log["exc"] = self.formatException(record.exc_info)
        if hasattr(record, "request_id"):
            log["request_id"] = record.request_id
        if hasattr(record, "tenant_id"):
            log["tenant_id"] = record.tenant_id
        return json.dumps(log, default=str)


def setup_logging():
    level = logging.DEBUG if os.getenv("DEBUG") else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # Quiet noisy libraries
    for name in ("httpx", "httpcore", "uvicorn.access", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)
