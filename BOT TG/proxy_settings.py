import json
from pathlib import Path

SETTINGS_FILE = Path(__file__).resolve().parent / "proxy_settings.json"
DEFAULT = {"enabled": False, "host": "127.0.0.1", "port": 2080}


def load_proxy_settings() -> dict:
    if SETTINGS_FILE.exists():
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return {**DEFAULT, **data}
    return DEFAULT.copy()


def save_proxy_settings(settings: dict) -> None:
    SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


def toggle_proxy_enabled() -> dict:
    settings = load_proxy_settings()
    settings["enabled"] = not bool(settings.get("enabled"))
    save_proxy_settings(settings)
    return settings


def proxy_label(settings: dict | None = None) -> str:
    settings = settings or load_proxy_settings()
    status = "✅ ВКЛ" if settings.get("enabled") else "❌ ВЫКЛ"
    return f"{settings.get('host', '127.0.0.1')}:{settings.get('port', 2080)} — {status}"


def build_proxy_url(settings: dict | None = None) -> str | None:
    settings = settings or load_proxy_settings()
    if not settings.get("enabled"):
        return None
    host = settings.get("host", "127.0.0.1")
    port = settings.get("port", 2080)
    proxy_type = settings.get("type", "http")
    return f"{proxy_type}://{host}:{port}"
