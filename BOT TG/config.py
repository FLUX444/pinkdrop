import os
from pathlib import Path

from dotenv import load_dotenv

from yaml_config import yaml_get

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


class Config:
    bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    bot_username: str = str(yaml_get(["telegram", "bot_username"]) or os.getenv("TELEGRAM_BOT_USERNAME", "")).strip()
    store_channel_id: str = str(
        yaml_get(["telegram", "store_channel", "id"]) or os.getenv("TELEGRAM_STORE_CHANNEL_ID", "")
    ).strip()
    store_channel_link: str = str(yaml_get(["telegram", "store_channel", "link"]) or os.getenv("TELEGRAM_STORE_CHANNEL_LINK", "")).strip()
    store_channel_username: str = str(
        yaml_get(["telegram", "store_channel", "username"]) or os.getenv("TELEGRAM_STORE_CHANNEL_USERNAME", "")
    ).strip().lstrip("@")
    support_contact_user_id: str = str(
        yaml_get(["telegram", "support", "contact_user_id"]) or os.getenv("TELEGRAM_SUPPORT_USER_ID", "")
    ).strip()
    support_contact_username: str = str(
        yaml_get(["telegram", "support", "contact_username"]) or os.getenv("TELEGRAM_SUPPORT_USERNAME", "")
    ).strip().lstrip("@")
    support_new_button: str = str(yaml_get(["telegram", "support", "new_request_button"], "✉️ Новое обращение")).strip()
    support_intro: str = str(
        yaml_get(
            ["telegram", "support", "intro"],
            "<b>💬 Поддержка PINKDROP</b>\n\nНажмите «Новое обращение» — откроется чат с оператором.",
        )
    ).strip()
    frontend_url: str = str(yaml_get(["site", "frontend_url"]) or os.getenv("FRONTEND_URL", "http://localhost:5173")).rstrip("/")
    public_frontend_url: str = str(yaml_get(["site", "public_url"]) or os.getenv("PUBLIC_FRONTEND_URL", "")).strip().rstrip("/")
    api_url: str = os.getenv("API_URL", "http://localhost:3001").rstrip("/")
    bot_api_secret: str = os.getenv("BOT_API_SECRET", "").strip()


config = Config()


def assert_config() -> None:
    if not config.bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не задан в .env")
    if not config.bot_api_secret:
        raise RuntimeError("BOT_API_SECRET не задан в .env (смотрите лог сервера при старте)")
