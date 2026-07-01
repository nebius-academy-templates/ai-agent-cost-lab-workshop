#!/usr/bin/env bash
# Pre-flight setup — register MCP servers for Codex and Cursor Agent.
# Run once before the workshop. Safe to re-run (skips existing).
set -euo pipefail

MCP_SERVERS=(
  "jira:9001"
  "github:9002"
  "confluence:9003"
  "sentry:9004"
  "testrail:9005"
)

echo "=== Codex ==="
if command -v codex &>/dev/null; then
  for entry in "${MCP_SERVERS[@]}"; do
    name="${entry%:*}"
    port="${entry#*:}"
    url="http://localhost:${port}/mcp"
    if codex mcp list 2>/dev/null | grep -q "^${name}[[:space:]]"; then
      echo "  ${name}: already configured"
    else
      codex mcp add "${name}" --url "${url}"
      echo "  ${name}: added → ${url}"
    fi
  done
else
  echo "  codex not found — skip"
fi

echo ""
echo "=== Cursor Agent ==="
CURSOR_MCP="${HOME}/.cursor/mcp.json"
if command -v cursor-agent &>/dev/null; then
  mkdir -p "$(dirname "${CURSOR_MCP}")"
  if [ -f "${CURSOR_MCP}" ]; then
    # Merge our servers into existing config
    python3 -c "
import json, sys
with open('${CURSOR_MCP}') as f:
    cfg = json.load(f)
servers = cfg.setdefault('mcpServers', {})
for name, port in [e.split(':') for e in '${MCP_SERVERS[*]}'.split()]:
    if name not in servers:
        servers[name] = {'type': 'http', 'url': f'http://localhost:{port}/mcp'}
with open('${CURSOR_MCP}', 'w') as f:
    json.dump(cfg, f, indent=2)
print('  Updated ${CURSOR_MCP}')
"
  else
    python3 -c "
import json
servers = {n: {'type': 'http', 'url': f'http://localhost:{p}/mcp'} for n, p in [e.split(':') for e in '${MCP_SERVERS[*]}'.split()]}
with open('${CURSOR_MCP}', 'w') as f:
    json.dump({'mcpServers': servers}, f, indent=2)
print('  Created ${CURSOR_MCP}')
"
  fi
  echo "  Cursor MCP config ready"

  # Project-level MCP for the workshop app (cli.json + permissions.json live in git)
  PROJECT_MCP="$(cd "$(dirname "$0")/../.." && pwd)/apps/angular-demo/.cursor/mcp.json"
  mkdir -p "$(dirname "${PROJECT_MCP}")"
  cp "$(cd "$(dirname "$0")/.." && pwd)/proxy/cursor.direct.mcp.json" "${PROJECT_MCP}"
  echo "  Project MCP → ${PROJECT_MCP}"
else
  echo "  cursor-agent not found — skip"
fi

echo ""
echo "✅ Pre-flight complete. Run 'npm run setup:mcp-cleanup' to remove."
