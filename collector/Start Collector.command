#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "/Applications/Google Chrome.app" ]; then
  echo "Install Google Chrome, then double-click this file again."
  read -r -p "Press return to close."
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Install Python 3, then double-click this file again."
  read -r -p "Press return to close."
  exit 1
fi
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
echo "Pricebench Collector is ready. Leave this window open."
.venv/bin/python collector.py
