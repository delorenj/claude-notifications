#!/bin/bash

# Test script for Claude Code Notifications

echo "🧪 Testing Claude Code Notifications..."

# Check if claude-notify exists
if command -v claude-notify &> /dev/null; then
    echo "✅ claude-notify command found"
    
    # Test the notification
    echo "🔊 Playing test notification..."
    claude-notify
    
    echo "✅ Test complete! Did you hear the Final Fantasy fanfare?"
else
    echo "❌ claude-notify command not found"
    echo "💡 Try running ./install.sh first"
    exit 1
fi
