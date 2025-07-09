#!/bin/bash

# Claude Code Notifications Uninstaller

set -e

echo "🗑️  Uninstalling Claude Code Notifications..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Remove the script
if [[ -f ~/.local/bin/claude-notify ]]; then
    rm ~/.local/bin/claude-notify
    echo -e "${GREEN}✅ Removed claude-notify script${NC}"
else
    echo -e "${YELLOW}⚠️  claude-notify script not found${NC}"
fi

# Remove the sound file
if [[ -f ~/.local/share/sounds/claude-notification.wav ]]; then
    rm ~/.local/share/sounds/claude-notification.wav
    echo -e "${GREEN}✅ Removed notification sound${NC}"
else
    echo -e "${YELLOW}⚠️  Notification sound not found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Uninstallation complete!${NC}"
echo ""
echo -e "${BLUE}Note:${NC} You may want to:"
echo "• Remove the Claude Code stop hook from your settings"
echo "• Remove PATH modification from your shell config (if added)"
echo ""
echo -e "${BLUE}Thanks for using Claude Code Notifications! 🎵${NC}"
