#!/usr/bin/env bash
# Cleanup — remove MCP servers registered by setup-mcp.sh.
set -euo pipefail

MCP_SERVERS=("jira" "github" "confluence" "sentry" "testrail")

echo "=== Codex ==="
if command -v codex &>/dev/null; then
  for name in "${MCP_SERVERS[@]}"; do
    if codex mcp list 2>/dev/null | grep -q "^${name}[[:space:]]"; then
      codex mcp remove "${name}" 2>/dev/null && echo "  ${name}: removed" || echo "  ${name}: remove failed"
    else
      echo "  ${name}: not configured"
    fi
  done
else
  echo "  codex not found — skip"
fi

echo ""
echo "=== Cursor Agent ==="
CURSOR_MCP="${HOME}/.cursor/mcp.json"
if [ -f "${CURSOR_MCP}" ]; then
  python3 -c "
import json
with open('${CURSOR_MCP}') as f:
    cfg = json.load(f)
servers = cfg.get('mcpServers', {})
removed = [n for n in '${MCP_SERVERS[*]}'.split() if servers.pop(n, None)]
if removed:
    with open('${CURSOR_MCP}', 'w') as f:
        json.dump(cfg, f, indent=2)
    print(f'  Removed: {\", \".join(removed)}')
else:
    print('  No workshop servers found')
"
else
  echo "  ${CURSOR_MCP} not found — skip"
fi

echo ""
echo "✅ Cleanup complete."
