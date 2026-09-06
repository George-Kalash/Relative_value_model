"""Run API and frontend together; stop both when either exits or on Ctrl+C."""

import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path
from time import sleep

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    npm = shutil.which("npm")
    if not npm or not (ROOT / "frontend/node_modules").is_dir():
        raise SystemExit(
            "Install frontend dependencies first: npm --prefix frontend ci"
        )
    processes = []
    try:
        processes.append(
            subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--app-dir",
                    "backend",
                    "--reload",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ],
                cwd=ROOT,
                start_new_session=True,
            )
        )
        processes.append(
            subprocess.Popen(
                [npm, "--prefix", "frontend", "run", "dev"],
                cwd=ROOT,
                start_new_session=True,
            )
        )
        print(
            "G10 Monitor: http://127.0.0.1:5173 — Ctrl+C stops both servers.",
            flush=True,
        )
        while all(p.poll() is None for p in processes):
            sleep(0.5)
        failed = next((p.returncode for p in processes if p.returncode), 0)
        if failed:
            raise SystemExit(failed)
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    main()
