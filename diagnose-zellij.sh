#!/usr/bin/env bash
# Diagnostic script for Zellij notification issues

echo "🔍 Zellij Notification Diagnostics"
echo "===================================="
echo ""

# Check 1: Environment variable
echo "1. Checking ZELLIJ environment variable..."
if [ -n "$ZELLIJ" ]; then
  echo "   ✅ ZELLIJ=$ZELLIJ"
else
  echo "   ❌ ZELLIJ not set"
  echo "   → You're not in a Zellij session"
  echo ""
  echo "   To fix: Launch Zellij first"
  echo "   zellij --layout test-notification-plugin.kdl"
  exit 1
fi
echo ""

# Check 2: Active session
echo "2. Checking for active Zellij session..."
if zellij action query-tab-names 2>&1 | grep -q "no active session\|not found"; then
  echo "   ❌ No active session (env var is stale)"
  echo "   → ZELLIJ env var is set but you're not actually in a Zellij pane"
  echo ""
  echo "   To fix:"
  echo "   1. Unset the stale env var: unset ZELLIJ"
  echo "   2. Launch Zellij: zellij --layout test-notification-plugin.kdl"
  exit 1
elif zellij action query-tab-names > /dev/null 2>&1; then
  echo "   ✅ Active session detected"
else
  echo "   ⚠️  Cannot query tabs (this is okay, continuing...)"
fi
echo ""

# Check 3: Plugin file
echo "3. Checking plugin installation..."
PLUGIN_PATH="$HOME/.config/zellij/plugins/zellij_visual_notifications.wasm"
if [ -f "$PLUGIN_PATH" ]; then
  SIZE=$(du -h "$PLUGIN_PATH" | cut -f1)
  echo "   ✅ Plugin found: $SIZE"
else
  echo "   ❌ Plugin not found at:"
  echo "      $PLUGIN_PATH"
  echo ""
  echo "   To fix: Build and install the plugin"
  echo "   cd zellij-plugin && ./build.sh"
  exit 1
fi
echo ""

# Check 4: Test pipe command
echo "4. Testing zellij pipe command..."
TEST_PAYLOAD='{"type":"info","message":"diagnostic test","source":"diagnostic"}'
if timeout 3s zellij pipe -p zellij_visual_notifications -- "$TEST_PAYLOAD" 2>&1 | tee /tmp/zellij-pipe-test.log | grep -q "no pipe"; then
  echo "   ❌ Plugin not loaded in current layout"
  echo ""
  echo "   To fix: Use a layout that includes the plugin"
  echo "   zellij --layout test-notification-plugin.kdl"
  exit 1
elif timeout 3s zellij pipe -p zellij_visual_notifications -- "$TEST_PAYLOAD" > /dev/null 2>&1; then
  echo "   ✅ Pipe command works!"
  echo "   → You should see a notification in your Zellij session"
else
  echo "   ⚠️  Pipe command had issues (check /tmp/zellij-pipe-test.log)"
  echo ""
  cat /tmp/zellij-pipe-test.log
fi
echo ""

# Check 5: Test CLI
echo "5. Testing zellij-notify CLI..."
if command -v zellij-notify > /dev/null 2>&1; then
  echo "   ✅ zellij-notify command found"

  echo "   Testing basic notification..."
  if zellij-notify "Diagnostic test from CLI" 2>&1 | grep -q "✅"; then
    echo "   ✅ CLI test passed!"
  else
    echo "   ❌ CLI test failed"
    zellij-notify "Test" 2>&1 || true
  fi
else
  echo "   ❌ zellij-notify command not found"
  echo ""
  echo "   To fix: Run npm link"
  echo "   cd /home/delorenj/code/utils/claude-notifications && npm link"
  exit 1
fi
echo ""

# Summary
echo "✨ Diagnostics Complete"
echo ""
echo "If all checks passed, try:"
echo "  zellij-notify \"Hello from Zellij!\""
echo ""
echo "If you're still having issues:"
echo "  1. Restart your Zellij session"
echo "  2. Use the test layout: zellij --layout test-notification-plugin.kdl"
echo "  3. Check plugin logs (if available)"
echo ""
