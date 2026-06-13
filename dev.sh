#!/usr/bin/env bash
#
# dev.sh — launch the whole not-spotify dev stack in three separate terminals:
#   1. ASP.NET Core backend   (https://localhost:7045)
#   2. Stripe webhook listener (forwards to /stripe/webhook)
#   3. Vite frontend           (http://localhost:5173)
#
# Usage (from Git Bash / MSYS on Windows):
#   ./dev.sh
#
# Requirements:
#   - .NET SDK, Node/npm, and the Stripe CLI all on PATH
#   - Stripe CLI authenticated once with:  stripe login
#
# Each service opens in its own console window and stays open (cmd /k) so you
# can read logs and Ctrl-C / close them independently.

set -euo pipefail

# Repo root = directory this script lives in.
ROOT_UNIX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Convert to a Windows path (C:\...) for cmd.exe; fall back to the unix path.
to_win() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    echo "$1"
  fi
}

BACKEND_DIR="$(to_win "$ROOT_UNIX/backend/src/NotSpotify.Api")"
FRONTEND_DIR="$(to_win "$ROOT_UNIX/frontend")"
WEBHOOK_URL="https://localhost:7045/stripe/webhook"

# Open a new console window: title, working dir (Windows path), command line.
open_terminal() {
  local title="$1"; local workdir="$2"; local cmdline="$3"
  cmd.exe /c start "$title" cmd /k "cd /d \"$workdir\" && $cmdline"
}

echo "Starting not-spotify dev stack..."

echo "  -> Backend   (dotnet run)"
open_terminal "not-spotify: backend" "$BACKEND_DIR" "dotnet run"

# Give the API a head start so Stripe forwards to a live endpoint.
sleep 3

echo "  -> Stripe    (stripe listen)"
open_terminal "not-spotify: stripe" "$BACKEND_DIR" "stripe listen --forward-to $WEBHOOK_URL"

echo "  -> Frontend  (npm run dev)"
open_terminal "not-spotify: frontend" "$FRONTEND_DIR" "npm run dev"

echo "All three terminals launched."
echo "  Frontend: http://localhost:5173   Backend: https://localhost:7045"
echo "(If the frontend opens on 5174+, that's fine — CORS now allows 5173-5176.)"
