#!/usr/bin/env bash
# Test script for updated agent-orchestrator layout with gruvbox theme

echo "🎨 Testing Visual Notifications with Gruvbox Theme"
echo "=================================================="
echo ""

# Check if in Zellij
if [ -z "$ZELLIJ" ]; then
  echo "❌ Not in a Zellij session"
  echo ""
  echo "Launch Zellij with your updated layout:"
  echo "  zellij --layout ~/.config/zellij/layouts/agent-orchestrator.kdl"
  echo ""
  echo "Or if you're using this as your default:"
  echo "  zellij"
  exit 1
fi

# Verify active session
if ! zellij action query-tab-names > /dev/null 2>&1; then
  echo "❌ ZELLIJ env var is set but no active session detected"
  echo "Your environment has a stale ZELLIJ variable."
  echo ""
  echo "Fix:"
  echo "  1. Exit this shell"
  echo "  2. Start fresh Zellij: zellij --layout ~/.config/zellij/layouts/agent-orchestrator.kdl"
  exit 1
fi

echo "✅ Inside active Zellij session"
echo ""
echo "Testing color differentiation..."
echo ""

# Test each notification type with clear labels
echo "📗 Sending SUCCESS notification (should be BRIGHT GREEN)"
zellij-notify -t success --title "Success Test" "This should appear in bright green (#b8bb26)"
sleep 2

echo ""
echo "📕 Sending ERROR notification (should be BRIGHT RED)"
zellij-notify -t error --title "Error Test" "This should appear in bright red (#fb4934)"
sleep 2

echo ""
echo "📙 Sending WARNING notification (should be BRIGHT YELLOW)"
zellij-notify -t warning --title "Warning Test" "This should appear in bright yellow (#fabd2f)"
sleep 2

echo ""
echo "📘 Sending INFO notification (should be BLUE)"
zellij-notify -t info --title "Info Test" "This should appear in blue (#83a598)"
sleep 2

echo ""
echo "📓 Sending PROGRESS notification (should be PINK/MAGENTA)"
zellij-notify -t progress --title "Progress Test" "This should appear in pink/magenta (#d3869b)"
sleep 2

echo ""
echo "🔔 Sending ATTENTION notification (should be YELLOW)"
zellij-notify -t attention --title "Attention Test" "This should appear in yellow (same as warning)"
sleep 2

echo ""
echo "✨ Color test complete!"
echo ""
echo "Results:"
echo "  - If all colors are the same (green), the theme isn't being applied"
echo "  - If colors are distinct, the integration is working correctly!"
echo ""
echo "💡 To restart Zellij with the updated layout:"
echo "  1. Exit Zellij (Ctrl+Q or type 'exit' in all panes)"
echo "  2. Run: zellij --layout ~/.config/zellij/layouts/agent-orchestrator.kdl"
