#!/usr/bin/env bash
# Stop all Docker containers after the workshop.
set -euo pipefail
echo "Stopping Docker containers…"
docker compose down 2>&1
echo "✅ All services stopped."
