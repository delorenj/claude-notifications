#!/usr/bin/env bash
# zellij-notify CLI Examples

echo "🎨 zellij-notify CLI Examples"
echo "=============================="
echo ""
echo "Make sure you're inside a Zellij session with the visual notifications plugin loaded!"
echo ""

# Check if in Zellij
if [ -z "$ZELLIJ" ]; then
  echo "❌ Not inside a Zellij session"
  echo "Launch Zellij first:"
  echo "  zellij --layout /home/delorenj/code/utils/claude-notifications/test-notification-plugin.kdl"
  exit 1
fi

# Verify it's an actual active session, not just stale env var
if ! zellij action query-tab-names > /dev/null 2>&1; then
  echo "❌ ZELLIJ env var is set but no active session detected"
  echo ""
  echo "Your environment has a stale ZELLIJ variable."
  echo ""
  echo "Fix:"
  echo "  1. Unset the variable: unset ZELLIJ"
  echo "  2. Launch Zellij: zellij --layout /home/delorenj/code/utils/claude-notifications/test-notification-plugin.kdl"
  echo "  3. Run this script again inside the Zellij session"
  exit 1
fi

echo "✅ Inside active Zellij session"
echo ""

# Verify plugin is loaded
echo "Checking if plugin is loaded..."
if timeout 2s zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"plugin check"}' 2>&1 | grep -q "no pipe"; then
  echo "❌ Plugin not loaded in current layout"
  echo ""
  echo "Launch Zellij with the plugin layout:"
  echo "  zellij --layout /home/delorenj/code/utils/claude-notifications/test-notification-plugin.kdl"
  exit 1
elif timeout 2s zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"plugin check"}' > /dev/null 2>&1; then
  echo "✅ Plugin is loaded and responding"
else
  echo "⚠️  Plugin status unclear, continuing anyway..."
fi
echo ""

read -p "Press Enter to start examples..."

# Example 1: Basic notification
echo ""
echo "📌 Example 1: Basic notification to current tab"
echo "Command: zellij-notify \"Build complete!\""
zellij-notify "Build complete!"
sleep 3

# Example 2: Success notification
echo ""
echo "📌 Example 2: Success notification with title"
echo "Command: zellij-notify -t success --title \"Tests\" \"All 42 tests passed ✅\""
zellij-notify -t success --title "Tests" "All 42 tests passed ✅"
sleep 3

# Example 3: Error notification
echo ""
echo "📌 Example 3: Error notification (high priority)"
echo "Command: zellij-notify -t error -p high \"Build failed: syntax error on line 42\""
zellij-notify -t error -p high "Build failed: syntax error on line 42"
sleep 3

# Example 4: Quick notification
echo ""
echo "📌 Example 4: Quick 5-second notification"
echo "Command: zellij-notify -q \"Starting deployment...\""
zellij-notify -q "Starting deployment..."
sleep 6

# Example 5: List tabs
echo ""
echo "📌 Example 5: List all tabs"
echo "Command: zellij-notify --list-tabs"
zellij-notify --list-tabs
sleep 2

# Example 6: Notification to specific tab
echo ""
echo "📌 Example 6: Send to tab 1"
echo "Command: zellij-notify -i 1 \"Message for tab 1\""
zellij-notify -i 1 "Message for tab 1"
sleep 3

# Example 7: Warning with custom TTL
echo ""
echo "📌 Example 7: Warning with 10-second TTL"
echo "Command: zellij-notify -t warning --ttl 10 \"Deprecated API in use\""
zellij-notify -t warning --ttl 10 "Deprecated API in use"
echo "(Watch it disappear in 10 seconds...)"
sleep 11

# Example 8: Dismissable critical alert
echo ""
echo "📌 Example 8: Dismissable critical alert (requires Ctrl+N to clear)"
echo "Command: zellij-notify -d -t error -p critical \"PRODUCTION ALERT: Database connection lost\""
zellij-notify -d -t error -p critical "PRODUCTION ALERT: Database connection lost"
sleep 3
echo ""
echo "⚠️  This notification will stay until you press Ctrl+N"
echo ""
read -p "Press Enter after you've cleared the notification..."

# Example 9: Broadcast to all tabs
echo ""
echo "📌 Example 9: Broadcast to all tabs"
echo "Command: zellij-notify -a -t info \"System maintenance in 5 minutes\""
zellij-notify -a -t info "System maintenance in 5 minutes"
sleep 3

# Example 10: Progress notification
echo ""
echo "📌 Example 10: Progress notification"
echo "Command: zellij-notify -t progress --title \"Docker Build\" \"Building image layer 3/8...\""
zellij-notify -t progress --title "Docker Build" "Building image layer 3/8..."
sleep 3

# Example 11: Attention notification
echo ""
echo "📌 Example 11: Attention notification (like Claude waiting)"
echo "Command: zellij-notify -t attention -p high \"Review required: Pull request #123\""
zellij-notify -t attention -p high "Review required: Pull request #123"
sleep 3

echo ""
echo "✨ Examples complete!"
echo ""
echo "💡 Tips:"
echo "  - Use -q for quick notifications (5s)"
echo "  - Use -d for dismissable (permanent until Ctrl+N)"
echo "  - Use -a to broadcast to all tabs"
echo "  - Use -i <NUM> to target specific tab"
echo "  - Use -n <NAME> to target tab by name"
echo ""
echo "📚 Full help: zellij-notify --help"
