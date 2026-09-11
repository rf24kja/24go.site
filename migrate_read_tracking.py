"""Add read tracking columns to mailings and mailing_recipients."""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE mailings ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE mailing_recipients ADD COLUMN IF NOT EXISTS message_id VARCHAR(64)"
        ))
        # Add 'read' to mailing_recipient_status enum
        await conn.execute(text(
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'read' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mailing_recipient_status')) THEN ALTER TYPE mailing_recipient_status ADD VALUE 'read'; END IF; END $$"
        ))
    print("Migration done: read_count + message_id + read status")


if __name__ == "__main__":
    asyncio.run(migrate())
