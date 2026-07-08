@echo off
cd /d "%~dp0"
echo Starting CountQuest at http://127.0.0.1:8765/index.html
start "" "http://127.0.0.1:8765/index.html"
python -m http.server 8765