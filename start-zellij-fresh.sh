#!/usr/bin/env bash
# Start fresh Zellij session with updated layout

echo "🔄 Starting fresh Zellij session with visual notifications..."
echo ""

# Clear stale ZELLIJ variable
unset ZELLIJ

# Start Zellij with your updated layout
exec zellij --layout ~/.config/zellij/layouts/agent-orchestrator.kdl
