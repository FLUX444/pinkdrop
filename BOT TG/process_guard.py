import logging
import os
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger("pinkdrop-bot")


def kill_other_bot_instances() -> None:
    if sys.platform != "win32":
        return

    script = Path(__file__).resolve().parent.parent / "scripts" / "kill-bot.ps1"
    if not script.exists():
        return

    current_pid = os.getpid()
    try:
        completed = subprocess.run(
            [
                "powershell",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(script),
                "-ExceptPid",
                str(current_pid),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        output = (completed.stdout or "").strip()
        if output:
            for line in output.splitlines():
                logger.info(line)
    except Exception as error:
        logger.warning("Could not stop duplicate bot processes: %s", error)
