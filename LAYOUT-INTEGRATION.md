# Layout Integration Fix

## Issues Addressed

### 1. Plugin Not Integrated Into Custom Layout
**Problem**: The visual notifications plugin was only available in the test layout (`test-notification-plugin.kdl`), not in your actual agent-orchestrator layout.

**Solution**: Integrated the plugin into `~/.config/zellij/layouts/agent-orchestrator.kdl` by adding it as a 1-line borderless pane in the `default_tab_template`. This means the plugin will be available on all tabs.

### 2. All Notifications Showing Green
**Problem**: All notification types (success, error, warning, info) were appearing in the same green color.

**Root Cause**: The test layout was using the "catppuccin" theme for the plugin, but your Zellij config uses "gruvbox material dark". The theme mismatch was causing the plugin to fall back to default foreground colors.

**Solution**: Updated the plugin configuration to use `theme "gruvbox-dark"` which provides proper color mappings:
- Success: Bright green (#b8bb26)
- Error: Bright red (#fb4934)
- Warning: Bright yellow (#fabd2f)
- Info: Blue (#83a598)
- Progress: Pink/magenta (#d3869b)
- Attention: Yellow (#fabd2f)

## How to Use

### Step 1: Restart Zellij with Updated Layout

If you're currently in a Zellij session, you need to restart it to load the updated layout:

```bash
# Exit current Zellij session
# Press Ctrl+Q or type 'exit' in all panes

# Start Zellij with your updated layout
zellij --layout ~/.config/zellij/layouts/agent-orchestrator.kdl

# Or if agent-orchestrator is your default layout in config:
zellij
```

### Step 2: Test Color Differentiation

Run the test script to verify colors are working:

```bash
cd ~/code/utils/claude-notifications
./test-updated-layout.sh
```

This will send one notification of each type, clearly labeled with the expected color. You should see:
- Green notification
- Red notification
- Yellow notification
- Blue notification
- Pink/magenta notification

### Step 3: Use Normally

Once verified, use `zellij-notify` as normal:

```bash
# Success notification (green)
zellij-notify -t success "Tests passed!"

# Error notification (red)
zellij-notify -t error "Build failed!"

# Warning notification (yellow)
zellij-notify -t warning "Deprecated API in use"

# Info notification (blue)
zellij-notify -t info "Deployment started"
```

## Layout Structure

The updated layout now has this structure for each tab:

```
┌─────────────────────────────────┐
│      Tab Bar (zellij)           │  ← Line 1
├─────────────────────────────────┤
│   Visual Notifications Plugin   │  ← Line 2 (NEW!)
├─────────────────────────────────┤
│                                 │
│      Your Tab Content           │
│      (terminals, etc.)          │
│                                 │
├─────────────────────────────────┤
│     Status Bar (zellij)         │  ← Bottom 2 lines
└─────────────────────────────────┘
```

The visual notifications plugin takes up 1 line at the top (below the tab bar), displaying active notifications with proper colors and animations.

## Troubleshooting

### Still Seeing All Green?

1. **Make sure you restarted Zellij** - The layout needs to be reloaded
2. **Check the plugin is loaded**:
   ```bash
   zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"test"}'
   ```
   If you get "no pipe found", the plugin isn't loaded

3. **Verify the plugin file exists**:
   ```bash
   ls -lh ~/.config/zellij/plugins/zellij_visual_notifications.wasm
   ```

4. **Check Zellij logs**:
   ```bash
   tail -f /tmp/zellij-$(id -u)/zellij-log/zellij.log
   ```

### Timeout Errors

If you're still seeing timeout errors on some notifications:

1. **Check if it's tab-switching related**: Timeout errors often occur when trying to send to a tab that doesn't exist or when switching tabs rapidly
2. **Try increasing timeout** in `lib/zellij.js` (currently 5 seconds)
3. **Send to current tab only**: Omit `-i` and `-n` flags to avoid tab switching

### Plugin Not Loading

If the plugin doesn't load at all:

1. **Rebuild the plugin**:
   ```bash
   cd ~/code/utils/claude-notifications/zellij-plugin
   ./build.sh
   ```

2. **Verify plugin permissions**:
   ```bash
   chmod 644 ~/.config/zellij/plugins/zellij_visual_notifications.wasm
   ```

## Theme Customization

If you want to use a different theme or customize colors, you can edit the plugin configuration in your layout file (`~/.config/zellij/layouts/agent-orchestrator.kdl`):

### Available Themes:
- `gruvbox-dark` (your current theme)
- `gruvbox-light`
- `catppuccin` / `catppuccin-mocha`
- `catppuccin-latte`
- `dracula`
- `nord`
- `solarized-dark`
- `solarized-light`
- `tokyo-night`
- `one-dark`

### Custom Colors:

You can also override individual colors:

```kdl
plugin location="file:/home/delorenj/.config/zellij/plugins/zellij_visual_notifications.wasm" {
    enabled "true"
    theme "gruvbox-dark"
    // Override individual colors:
    success_color "#00ff00"
    error_color "#ff0000"
    warning_color "#ffaa00"
    info_color "#0099ff"
}
```

## Integration with Claude Notifications

The `claude-notifications` system will automatically use visual notifications when:
1. You're in a Zellij session
2. The plugin is loaded
3. `zellijVisualization.enabled` is `true` in your config

Both audio and visual notifications will fire by default. To disable audio and only use visual:

```json
{
  "sound": {
    "enabled": false
  },
  "zellijVisualization": {
    "enabled": true
  }
}
```

Save this to `~/.config/claude-code/settings.json`.
