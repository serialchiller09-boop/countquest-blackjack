#!/usr/bin/env python3
"""Start local server and open CountQuest in the default browser."""

from __future__ import annotations

import http.server
import socketserver
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
URL = f"http://127.0.0.1:{PORT}/index.html"


def main() -> int:
    import os

    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler

    class QuietHandler(handler):
        def log_message(self, fmt, *args):
            pass

    try:
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), QuietHandler)
    except OSError as exc:
        print(f"Port {PORT} in use — opening browser anyway: {URL}")
        print(f"  ({exc})")
        webbrowser.open(URL)
        return 0

    def serve():
        httpd.serve_forever()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    print(f"CountQuest: {URL}")
    print(f"Project:  {ROOT}")
    webbrowser.open(URL)
    print("Press Ctrl+C to stop the server.")
    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nStopped.")
    httpd.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())