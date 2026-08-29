"""Telegram mini-bot for LeadGen Control Plane.

Commands:
  /start     — Welcome message
  /qualify   — Classify a message (inline keyboard workflow)
  /status    — Show subscription, usage, active campaigns
  /leads     — List recent leads (last 5)
  /help      — Show all commands

Environment:
  BOT_TOKEN        — Telegram Bot API token
  API_URL          — FastAPI backend URL (default: http://fastapi:8000)
  BOT_WEBHOOK_URL  — Optional webhook URL (empty = polling mode)
"""
import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, ContextTypes, filters,
)
import httpx

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
API_URL = os.getenv("API_URL", "http://fastapi:8000")
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "0"))

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bot")

# ── Helpers ──────────────────────────────────────────────────────────────

async def api_get(path: str) -> dict | list | None:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{API_URL}{path}")
        if r.status_code == 200:
            return r.json()
    return None

async def api_post(path: str, data: dict) -> dict | None:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{API_URL}{path}", json=data)
        if r.status_code == 200:
            return r.json()
    return None

# ── /start ───────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🎯 *LeadGen Bot*\n\n"
        "Управление системой генерации лидов прямо из Telegram.\n\n"
        "Команды:\n"
        "/qualify — Классифицировать сообщение\n"
        "/status — Статус подписки и использования\n"
        "/leads — Последние лиды\n"
        "/help — Все команды"
    )
    await update.message.reply_text(text, parse_mode="Markdown")

# ── /help ────────────────────────────────────────────────────────────────

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await cmd_start(update, ctx)

# ── /status ──────────────────────────────────────────────────────────────

async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    sub = await api_get("/api/v1/billing/subscription")
    usage = await api_get("/api/v1/billing/usage")
    if not sub:
        await update.message.reply_text("⚠️ API недоступен. Попробуйте позже.")
        return

    plan = sub.get("plan", "unknown")
    status = sub.get("status", "unknown")
    tokens = usage.get("total_tokens", 0) if usage else 0
    cost = usage.get("total_cost_usd", 0) if usage else 0

    text = (
        f"📊 *Статус системы*\n\n"
        f"План: `{plan}`\n"
        f"Статус: `{status}`\n"
        f"Токены: `{tokens:,}`\n"
        f"Стоимость: `${cost:.4f}`"
    )
    await update.message.reply_text(text, parse_mode="Markdown")

# ── /leads ───────────────────────────────────────────────────────────────

async def cmd_leads(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    data = await api_get("/api/v1/leads/?limit=5&offset=0")
    if not data:
        await update.message.reply_text("⚠️ Нет лидов или API недоступен.")
        return

    # Handle paginated response {items: [...], total} or flat list
    items = data.get("items", data) if isinstance(data, dict) else data
    if isinstance(items, dict) and "detail" in items:
        await update.message.reply_text(f"⚠️ {items['detail']}")
        return

    recent = (items or [])[:5]
    if not recent:
        await update.message.reply_text("📭 Пока нет лидов.")
        return

    intent_emoji = {"HOT": "🔥", "WARM": "🟡", "COLD": "❄️", "SPAM": "🗑"}
    lines = ["*Последние лиды:*\n"]
    for lead in recent:
        intent = lead.get("intent_score", "?")
        emoji = intent_emoji.get(intent, "❓")
        handle = lead.get("user_handle", "?")
        msg = (lead.get("message_text", "") or "")[:60]
        lines.append(f"{emoji} `{handle}` — {msg}...")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")

# ── /qualify ─────────────────────────────────────────────────────────────

QUALIFY_HANDLE, QUALIFY_MESSAGE = range(2)

async def cmd_qualify(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "🤖 *Классификатор лидов*\n\n"
        "Введите handle пользователя (например `@ivan Petrov`):",
        parse_mode="Markdown",
    )
    return QUALIFY_HANDLE

async def receive_handle(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["qualify_handle"] = update.message.text.strip()
    await update.message.reply_text(
        "Теперь введите сообщение для классификации:"
    )
    return QUALIFY_MESSAGE

async def receive_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    handle = ctx.user_data.get("qualify_handle", "@unknown")
    message = update.message.text.strip()

    await update.message.reply_text("⏳ Классифицирую...")

    result = await api_post("/api/v1/leads/qualify", {
        "user_handle": handle,
        "message_text": message,
    })

    if not result:
        await update.message.reply_text("⚠️ API недоступен.")
        return ConversationHandler.END

    intent = result.get("intent_score", "?")
    confidence = result.get("confidence", 0)
    summary = result.get("summary", "")

    intent_emoji = {"HOT": "🔥", "WARM": "🟡", "COLD": "❄️", "SPAM": "🗑"}
    emoji = intent_emoji.get(intent, "❓")

    text = (
        f"*Результат классификации*\n\n"
        f"Лид: `{handle}`\n"
        f"Интент: {emoji} `{intent}`\n"
        f"Уверенность: `{confidence}`\n"
        f"Резюме: {summary}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")

    # Auto-notify owner for HOT leads
    if intent == "HOT" and OWNER_CHAT_ID:
        try:
            await ctx.bot.send_message(
                chat_id=OWNER_CHAT_ID,
                text=f"🔥 *HOT LEAD*\n\n{handle}: {message[:200]}",
                parse_mode="Markdown",
            )
        except Exception:
            pass

    return ConversationHandler.END

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ Отменено.")
    return ConversationHandler.END

# ── Main ─────────────────────────────────────────────────────────────────

def main() -> None:
    if not BOT_TOKEN:
        log.error("BOT_TOKEN not set. Sleeping forever (will retry on restart).")
        import time
        while True:
            time.sleep(3600)  # stay alive for docker restart backoff

    app = Application.builder().token(BOT_TOKEN).build()

    # /qualify conversation
    qualify_conv = ConversationHandler(
        entry_points=[CommandHandler("qualify", cmd_qualify)],
        states={
            QUALIFY_HANDLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_handle)],
            QUALIFY_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_message)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("leads", cmd_leads))
    app.add_handler(qualify_conv)

    log.info("Bot starting in polling mode...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
