import json
from pathlib import Path

from yaml_config import yaml_get, yaml_has

SETTINGS_FILE = Path(__file__).resolve().parent / "proxy_settings.json"
DEFAULT = {"enabled": False, "host": "127.0.0.1", "port": 2080, "type": "http"}


def is_proxy_configured_in_yaml() -> bool:
    return yaml_has(["bot", "proxy"])


def _from_yaml() -> dict | None:
    if not is_proxy_configured_in_yaml():
        return None
    enabled = yaml_get(["bot", "proxy", "enabled"], False)
    return {
        "enabled": bool(enabled),
        "host": str(yaml_get(["bot", "proxy", "host"], DEFAULT["host"])),
        "port": int(yaml_get(["bot", "proxy", "port"], DEFAULT["port"])),
        "type": str(yaml_get(["bot", "proxy", "type"], DEFAULT["type"])),
    }


def load_proxy_settings() -> dict:
    yaml_settings = _from_yaml()
    if yaml_settings is not None:
        return yaml_settings

    if SETTINGS_FILE.exists():
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return {**DEFAULT, **data}
    return DEFAULT.copy()


def save_proxy_settings(settings: dict) -> None:
    SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


def toggle_proxy_enabled() -> dict:
    if is_proxy_configured_in_yaml():
        return load_proxy_settings()
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
