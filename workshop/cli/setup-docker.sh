#!/usr/bin/env bash
# Start all Docker containers for the workshop.
set -euo pipefail
echo "Starting Docker containers…"
docker compose up -d --wait 2>&1
echo ""
echo "Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "✅ All services up. Run 'npm run setup:docker-cleanup' to stop."
