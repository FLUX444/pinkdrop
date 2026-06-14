import asyncio
import logging
import os
import sys
import time
import traceback
from typing import Any

import aiohttp

from api_client import site_api
from config import config

logger = logging.getLogger("pinkdrop-bot.monitor")

_started_at = time.time()
_restart_count = 0
_error_count = 0
_heartbeat_task: asyncio.Task | None = None


def mark_bot_restart() -> None:
    global _restart_count
    _restart_count += 1


def mark_bot_error() -> None:
    global _error_count
    _error_count += 1


async def _post_monitor(path: str, payload: dict[str, Any]) -> bool:
    url = f"{config.api_url}{path}"
    headers = {
        "Authorization": f"Bearer {config.bot_api_secret}",
        "Content-Type": "application/json",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as response:
                if response.status < 400:
                    return True
                body = await response.text()
                logger.warning("Monitor POST %s failed: HTTP %s %s", path, response.status, body[:200])
                return False
    except Exception as error:
        logger.warning("Monitor POST %s failed: %s", path, error)
        return False


async def send_bot_log(
    message: str,
    *,
    level: str = "info",
    details: Any = None,
    auto_fixed: bool = False,
) -> None:
    await _post_monitor(
        "/api/bot/monitor/log",
        {
            "level": level,
            "message": message,
            "details": details,
            "autoFixed": auto_fixed,
        },
    )


async def send_bot_heartbeat(*, api_ok: bool, proxy_enabled: bool, mode: str = "polling") -> None:
    ok = await _post_monitor(
        "/api/bot/monitor/heartbeat",
        {
            "pid": os.getpid(),
            "uptimeSec": int(time.time() - _started_at),
            "mode": mode,
            "apiOk": api_ok,
            "proxyEnabled": proxy_enabled,
            "restarts": _restart_count,
            "errors": _error_count,
            "version": "v2-cart",
        },
    )
    if not ok:
        logger.warning(
            "Heartbeat not delivered to %s — проверьте API_URL и BOT_API_SECRET",
            config.api_url,
        )


async def check_site_api() -> bool:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{config.api_url}/api/bot/products",
                headers={"Authorization": f"Bearer {config.bot_api_secret}"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                return response.status < 400
    except Exception:
        return False


async def heartbeat_loop(proxy_enabled: bool) -> None:
    while True:
        api_ok = await check_site_api()
        await send_bot_heartbeat(api_ok=api_ok, proxy_enabled=proxy_enabled)
        await asyncio.sleep(30)


def start_heartbeat(proxy_enabled: bool) -> None:
    global _heartbeat_task
    if _heartbeat_task and not _heartbeat_task.done():
        return
    _heartbeat_task = asyncio.create_task(heartbeat_loop(proxy_enabled))


class SiteMonitorLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if record.name == "pinkdrop-bot.monitor":
            return
        level = "error" if record.levelno >= logging.ERROR else "warn" if record.levelno >= logging.WARNING else "info"
        message = record.getMessage()
        details = None
        if record.exc_info:
            details = "".join(traceback.format_exception(*record.exc_info))
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(send_bot_log(message, level=level, details=details))
        except RuntimeError:
            pass


def install_bot_monitoring() -> None:
    handler = SiteMonitorLogHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger("pinkdrop-bot").addHandler(handler)


async def log_self_heal(message: str, *, details: Any = None) -> None:
    await send_bot_log(message, level="info", details=details, auto_fixed=True)


async def handle_runtime_failure(error: Exception, *, context: str) -> bool:
    """Пытается самовосстановиться. True = можно перезапустить polling."""
    mark_bot_error()
    details = traceback.format_exc()
    lowered = str(error).lower()

    if "conflict" in lowered or "terminated by other getupdates" in lowered:
        from process_guard import kill_other_bot_instances

        kill_other_bot_instances()
        await log_self_heal(
            "Обнаружен второй экземпляр бота — лишние процессы остановлены",
            details=details,
        )
        await asyncio.sleep(2)
        return True

    if isinstance(error, aiohttp.ClientError) or "server" in lowered or "api" in lowered:
        await send_bot_log(
            f"{context}: API сайта недоступен",
            level="warn",
            details=str(error),
        )
        await asyncio.sleep(5)
        return True

    await send_bot_log(f"{context}: {error}", level="error", details=details)
    await asyncio.sleep(3)
    return True
