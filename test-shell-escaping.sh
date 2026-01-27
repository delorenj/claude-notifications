#!/usr/bin/env bash
# Test that shell escaping works correctly

echo "Testing fixed shell escaping..."
echo ""

if [ -z "$ZELLIJ" ]; then
  echo "❌ Not in Zellij session"
  echo "Run this from INSIDE a Zellij pane"
  exit 1
fi

echo "✓ In Zellij session"
echo ""

# Test with the CLI
echo "Testing: zellij-notify 'build complete'"
zellij-notify "build complete"
RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo "✓ Notification sent successfully"
else
  echo "✗ Failed with exit code: $RESULT"
fi

echo ""
echo "Check the status line at top of Zellij for the notification"
echo "It should appear with proper colors (not timeout)"
