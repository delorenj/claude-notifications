#!/bin/bash

# Claude Code Notifications Installer
# Installs a much needed notification system for Claude Code

set -e

echo "🎵 Installing Claude Code Notifications..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
  echo -e "${RED}❌ This installer is currently Linux-only. macOS support coming soon!${NC}"
  exit 1
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p ~/.local/bin
mkdir -p ~/.local/share/sounds

# Check for required tools and install if needed
echo -e "${BLUE}🔧 Checking dependencies...${NC}"

# Check for sox
if ! command -v sox &>/dev/null; then
  echo -e "${YELLOW}⚠️  sox not found. Installing...${NC}"
  if command -v apt &>/dev/null; then
    sudo apt update && sudo apt install -y sox
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y sox
  elif command -v pacman &>/dev/null; then
    sudo pacman -S sox
  else
    echo -e "${RED}❌ Could not install sox. Please install it manually.${NC}"
    exit 1
  fi
fi

# Check for notify-send
if ! command -v notify-send &>/dev/null; then
  echo -e "${YELLOW}⚠️  notify-send not found. Installing...${NC}"
  if command -v apt &>/dev/null; then
    sudo apt install -y libnotify-bin
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y libnotify
  elif command -v pacman &>/dev/null; then
    sudo pacman -S libnotify
  fi
fi

# Generate that sweet Final Fantasy scale
echo -e "${BLUE}🎼 Generating dreamy notification sound...${NC}"
sox -n ~/.local/share/sounds/claude-notification.wav \
  synth 0.12 sine 523.25 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 587.33 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 659.25 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 783.99 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 1046.50 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 1174.66 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 1318.51 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 1567.98 fade 0.01 0.12 0.01 : \
  synth 0.12 sine 2093.00 fade 0.01 0.12 0.01 :
# Uncomment for the longer, more nostalgic version
#    synth 0.12 sine 1567.98 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 1318.51 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 1174.66 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 1046.50 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 783.99 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 659.25 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 587.33 fade 0.01 0.12 0.01 : \
#    synth 0.12 sine 523.25 fade 0.01 0.12 0.01 \
vol 0.7

# Create the claude-notify script
echo -e "${BLUE}📝 Creating claude-notify script...${NC}"
cat >~/.local/bin/claude-notify <<'EOF'
#!/usr/bin/env bash

# Claude Code notification script
# Sends a desktop notification for Claude Code along with a dreamy notification sound

# Play notification sound (try multiple methods for compatibility)
play_sound() {
    local sound_file="$HOME/.local/share/sounds/claude-notification.wav"
    
    # Try paplay first (PulseAudio - most common on Ubuntu)
    if command -v paplay >/dev/null 2>&1 && [[ -f "$sound_file" ]]; then
        paplay "$sound_file" 2>/dev/null &
    # Fallback to aplay (ALSA)
    elif command -v aplay >/dev/null 2>&1 && [[ -f "$sound_file" ]]; then
        aplay "$sound_file" 2>/dev/null &
    # Fallback to system sounds
    elif command -v paplay >/dev/null 2>&1; then
        paplay /usr/share/sounds/alsa/Front_Left.wav 2>/dev/null &
    # Final fallback to system bell
    else
        printf '\a'
    fi
}

# Play sound in background
play_sound

# Send desktop notification
notify-send \
    --app-name="Claude Code" \
    --icon /home/clouedoc/Pictures/claude.png \
    --urgency critical \
    "Claude Code" \
    "Waiting for you..."
EOF

# Make the script executable
chmod +x ~/.local/bin/claude-notify

# Add ~/.local/bin to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo -e "${BLUE}🛤️  Adding ~/.local/bin to PATH...${NC}"

  # Detect shell and add to appropriate config file
  if [[ -n "$ZSH_VERSION" ]] || [[ "$SHELL" == *"zsh"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >>~/.zshrc
    echo -e "${YELLOW}⚠️  Added to ~/.zshrc - restart your terminal or run: source ~/.zshrc${NC}"
  elif [[ -n "$BASH_VERSION" ]] || [[ "$SHELL" == *"bash"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >>~/.bashrc
    echo -e "${YELLOW}⚠️  Added to ~/.bashrc - restart your terminal or run: source ~/.bashrc${NC}"
  else
    echo -e "${YELLOW}⚠️  Please add ~/.local/bin to your PATH manually${NC}"
  fi
fi

# Test the installation
echo -e "${BLUE}🧪 Testing installation...${NC}"
if command -v claude-notify &>/dev/null; then
  echo -e "${GREEN}✅ claude-notify command is available!${NC}"
  echo -e "${BLUE}🔊 Playing test notification...${NC}"
  claude-notify
else
  echo -e "${YELLOW}⚠️  claude-notify not in PATH yet. Restart your terminal or source your shell config.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the notification: ${YELLOW}claude-notify${NC}"
echo "2. Add to Claude Code settings (see README.md for JSON config)"
echo "3. Never alt-tab back to a unexpected Y/n again! 🎵"
echo ""
echo -e "${BLUE}Configuration location:${NC}"
echo "• Script: ~/.local/bin/claude-notify"
echo "• Sound: ~/.local/share/sounds/claude-notification.wav"
echo ""
echo -e "${BLUE}Need help?${NC} Check the README.md for customization options!"
