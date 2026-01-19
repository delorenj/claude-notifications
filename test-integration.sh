#!/usr/bin/env bash
# Test script for claude-notifications + Zellij visual notifications integration

set -e

echo "🧪 Claude Notifications + Zellij Integration Test"
echo "=================================================="
echo ""

# Check if we're in Zellij
if [ -z "$ZELLIJ" ]; then
  echo "❌ Not inside a Zellij session"
  echo ""
  echo "To test the integration:"
  echo "1. Launch Zellij with the test layout:"
  echo "   zellij --layout $(pwd)/test-notification-plugin.kdl"
  echo ""
  echo "2. Inside the Zellij session, run this script again:"
  echo "   ./test-integration.sh"
  exit 1
fi

echo "✅ Inside Zellij session (ZELLIJ=$ZELLIJ)"
echo ""

# Check if plugin is installed
PLUGIN_PATH="$HOME/.config/zellij/plugins/zellij_visual_notifications.wasm"
if [ ! -f "$PLUGIN_PATH" ]; then
  echo "❌ Plugin not found at: $PLUGIN_PATH"
  echo "Please install the plugin first:"
  echo "   cd zellij-plugin && ./build.sh"
  exit 1
fi
echo "✅ Plugin found: $PLUGIN_PATH"
echo ""

# Check claude-notify is available
if ! command -v claude-notify &> /dev/null; then
  echo "❌ claude-notify command not found"
  echo "Please link the package:"
  echo "   npm link"
  exit 1
fi
echo "✅ claude-notify command available"
echo ""

# Check settings
SETTINGS_FILE="$HOME/.config/claude-notifications/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "⚠️  No settings file found, will use defaults"
else
  echo "✅ Settings file found: $SETTINGS_FILE"
  echo ""
  echo "Current Zellij visualization settings:"
  cat "$SETTINGS_FILE" | grep -A 7 "zellijVisualization" || echo "  (using defaults)"
fi
echo ""

# Test 1: Direct pipe to plugin
echo "🧪 Test 1: Direct pipe to Zellij plugin"
echo "Sending test notification..."
if zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"Direct pipe test","title":"Test","source":"test-script","priority":"normal","timestamp":'$(date +%s)'000}' 2>&1; then
  echo "✅ Direct pipe successful"
else
  echo "❌ Direct pipe failed - plugin might not be loaded in current layout"
  echo "   Make sure your layout includes the plugin"
fi
echo ""
sleep 2

# Test 2: Via claude-notify command
echo "🧪 Test 2: Via claude-notify command"
echo "Triggering notification via claude-notify..."
claude-notify
echo "✅ claude-notify executed"
echo ""
echo "Expected behavior:"
echo "  - Sound: Bell chime plays"
echo "  - Visual: Pulsing purple border on current pane"
echo "  - Status: Notification appears in status bar"
echo ""
sleep 2

# Test 3: Different notification types
echo "🧪 Test 3: Different notification types"
echo ""

echo "Sending SUCCESS notification (green)..."
zellij pipe -p zellij_visual_notifications -- '{"type":"success","message":"Tests passed!","title":"Claude Code","source":"test","priority":"normal","timestamp":'$(date +%s)'000}' 2>/dev/null || true
sleep 2

echo "Sending ERROR notification (red)..."
zellij pipe -p zellij_visual_notifications -- '{"type":"error","message":"Build failed!","title":"Claude Code","source":"test","priority":"high","timestamp":'$(date +%s)'000}' 2>/dev/null || true
sleep 2

echo "Sending WARNING notification (yellow)..."
zellij pipe -p zellij_visual_notifications -- '{"type":"warning","message":"Deprecated API","title":"Claude Code","source":"test","priority":"normal","timestamp":'$(date +%s)'000}' 2>/dev/null || true
sleep 2

echo "Sending ATTENTION notification (purple)..."
zellij pipe -p zellij_visual_notifications -- '{"type":"attention","message":"Waiting for input","title":"Claude Code","source":"test","priority":"high","timestamp":'$(date +%s)'000}' 2>/dev/null || true

echo ""
echo "✅ Test complete!"
echo ""
echo "🎨 What you should see:"
echo "  - 4 different colored pane borders (green, red, yellow, purple)"
echo "  - Pulsing animations on each border"
echo "  - Notifications in the status bar"
echo "  - Tab badges indicating active notifications"
echo ""
echo "⌨️  Press Ctrl+N to clear all notifications"
echo ""
