# Claude Notifications + Zellij Visual Integration

## 🎉 Integration Complete!

The visual notification system has been successfully integrated with your existing aural claude-notifications package. Now when Claude Code stops and triggers a notification, you'll get BOTH sound AND visual feedback in Zellij!

## What's Been Integrated

### 1. Core Notification System (`bin/claude-notify.js`)

Added `triggerZellijVisualization()` function that:
- ✅ Detects if running inside a Zellij session (via `ZELLIJ` env var)
- ✅ Reads configuration from `~/.config/claude-notifications/settings.json`
- ✅ Constructs JSON notification payload with type, title, message, priority
- ✅ Sends notification via `zellij pipe` command
- ✅ Gracefully fails if plugin isn't installed (doesn't interrupt sound notification)
- ✅ Runs automatically on every `claude-notify` invocation

### 2. Configuration System (`lib/config.js`)

Extended default config with `zellijVisualization` section:
```json
{
  "zellijVisualization": {
    "enabled": true,
    "pluginName": "zellij_visual_notifications",
    "notificationType": "attention",
    "title": "Claude Code",
    "message": "Waiting for you...",
    "priority": "high"
  }
}
```

### 3. Example Configurations

Created two example config files:

**`examples/settings-with-zellij.json`**
- Sound enabled (bell)
- Zellij visualization enabled
- Best of both worlds!

**`examples/settings-zellij-only.json`**
- Sound disabled
- Zellij visualization only (silent mode)
- Perfect for shared workspaces

### 4. Documentation (`README.md`)

Added comprehensive Zellij section covering:
- ✅ Setup instructions
- ✅ Visual features list
- ✅ Notification type descriptions
- ✅ Configuration options
- ✅ KDL layout example

### 5. Test Script (`test-integration.sh`)

Created automated test script that:
- ✅ Validates environment (Zellij session, plugin installed)
- ✅ Tests direct pipe communication
- ✅ Tests via `claude-notify` command
- ✅ Demonstrates all 5 notification types
- ✅ Provides clear visual feedback expectations

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Claude Code                                             │
│ (Stop Hook triggers)                                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ claude-notify                                           │
│ ├─ triggerZellijVisualization() ─────────────┐         │
│ ├─ playSound()                                │         │
│ ├─ triggerWebhook() (optional)               │         │
│ └─ showNotification() (optional)             │         │
└──────────────────────────────────────────────┼─────────┘
                                                │
                    ┌───────────────────────────┘
                    │
                    ▼ zellij pipe -p zellij_visual_notifications
┌─────────────────────────────────────────────────────────┐
│ Zellij Visual Notifications Plugin                      │
│ ├─ event_bridge.rs (receives JSON via pipe)            │
│ ├─ queue.rs (priority queue management)                │
│ ├─ renderer.rs (pane borders, status bar, tabs)        │
│ └─ animation.rs (pulse, fade, breathe effects)         │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ Your Terminal                                           │
│ - Pulsing colored borders                              │
│ - Status bar notifications                             │
│ - Tab badges                                           │
└─────────────────────────────────────────────────────────┘
```

## Notification Flow

1. **Claude Code** finishes task or needs input
2. **Stop Hook** triggers `claude-notify` command
3. **claude-notify** checks if `zellijVisualization.enabled` is true
4. If in Zellij (checks `$ZELLIJ` env var):
   - Constructs notification JSON payload
   - Executes `zellij pipe -p zellij_visual_notifications -- '{...}'`
5. **Zellij Plugin** receives message via IPC:
   - Parses JSON notification
   - Adds to priority queue
   - Updates pane border color
   - Shows status bar widget
   - Adds tab badge
   - Starts animation loop
6. **Visual Feedback** appears instantly:
   - Border pulses with color based on type
   - Status bar shows notification with icon
   - Tab gets badge indicator
7. Sound plays simultaneously (if enabled)
8. User can clear notifications with `Ctrl+N`

## Notification Types Mapping

| Claude State | Type | Color | Use Case |
|--------------|------|-------|----------|
| Waiting for input | `attention` | Purple | Default - Claude needs your response |
| Task completed | `success` | Green | Build passed, tests succeeded |
| Error occurred | `error` | Red | Build failed, errors found |
| Warning issued | `warning` | Yellow | Deprecated APIs, non-critical issues |
| Info message | `info` | Blue | General updates, progress |
| Long task | `progress` | Cyan | Ongoing operations |

## Configuration Deep Dive

### Full Settings Structure

```json
{
  "sound": true,
  "soundType": "claude-notification-bell",
  "desktopNotification": false,
  "zellijVisualization": {
    "enabled": true,
    "pluginName": "zellij_visual_notifications",
    "notificationType": "attention",
    "title": "Claude Code",
    "message": "Waiting for you...",
    "priority": "high"
  },
  "webhook": {
    "enabled": false,
    "url": null,
    "replaceSound": false
  }
}
```

### Priority Levels

- `low` - Subtle notification, no interruption
- `normal` - Standard notification
- `high` - Demands attention (default for Claude waiting)
- `critical` - Urgent, highest priority in queue

### Plugin Configuration (in Zellij layout)

```kdl
plugin location="file:~/.config/zellij/plugins/zellij_visual_notifications.wasm" {
    enabled true
    theme "catppuccin"  // dracula, nord, tokyo-night, gruvbox, etc.
    show_status_bar true
    show_border_colors true
    show_tab_badges true
    animation_enabled true
    animation_style "pulse"  // pulse, flash, fade, breathe
    animation_speed 50  // 1-100
    animation_cycles 3
    notification_timeout_ms 300000  // 5 minutes
    queue_max_size 50
}
```

## Testing

### Quick Test

```bash
# Inside a Zellij session with the plugin loaded:
claude-notify
```

You should see:
1. **Hear**: Bell chime sound
2. **See**: Purple pulsing border around current pane
3. **See**: Status bar notification with "👁️ Claude Code: Waiting for you..."
4. **See**: Tab badge indicator

### Comprehensive Test

```bash
./test-integration.sh
```

This will:
1. Validate environment
2. Test direct plugin communication
3. Test via claude-notify
4. Demonstrate all 5 notification types
5. Show expected visual feedback

### Manual Testing

```bash
# Test each notification type manually:

# Success (green)
zellij pipe -p zellij_visual_notifications -- '{"type":"success","message":"Build passed!","title":"Claude Code","source":"test","priority":"normal"}'

# Error (red)
zellij pipe -p zellij_visual_notifications -- '{"type":"error","message":"Build failed!","title":"Claude Code","source":"test","priority":"high"}'

# Warning (yellow)
zellij pipe -p zellij_visual_notifications -- '{"type":"warning","message":"Deprecated API","title":"Claude Code","source":"test","priority":"normal"}'

# Info (blue)
zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"Starting build","title":"Claude Code","source":"test","priority":"low"}'

# Attention (purple) - default for Claude waiting
zellij pipe -p zellij_visual_notifications -- '{"type":"attention","message":"Waiting for input","title":"Claude Code","source":"test","priority":"high"}'
```

## Usage

### Daily Workflow

1. **Start Zellij** with the plugin:
   ```bash
   zellij --layout ~/.config/zellij/layouts/claude-code.kdl
   ```

2. **Work with Claude Code** normally:
   ```bash
   claude "Build the project"
   # Alt+Tab to browser...
   # Get notification when Claude finishes!
   ```

3. **Clear notifications** when done:
   - Press `Ctrl+N` to clear all
   - Or let them expire after 5 minutes

### Configuration Modes

**Mode 1: Full Sensory Experience** (default)
```json
{
  "sound": true,
  "zellijVisualization": { "enabled": true }
}
```
Best for: Solo work, need maximum awareness

**Mode 2: Visual Only** (silent mode)
```json
{
  "sound": false,
  "zellijVisualization": { "enabled": true }
}
```
Best for: Shared offices, late night coding

**Mode 3: Audio Only** (traditional)
```json
{
  "sound": true,
  "zellijVisualization": { "enabled": false }
}
```
Best for: Not using Zellij, prefer simpler setup

**Mode 4: Everything** (notification overload!)
```json
{
  "sound": true,
  "desktopNotification": true,
  "zellijVisualization": { "enabled": true },
  "webhook": { "enabled": true, "url": "..." }
}
```
Best for: Maximum redundancy, ADHD on steroids

## Customization

### Change Default Notification Type

Edit `~/.config/claude-notifications/settings.json`:
```json
{
  "zellijVisualization": {
    "notificationType": "success",  // Show green instead of purple
    "priority": "critical"  // Make it urgent
  }
}
```

### Custom Messages Based on Context

You can extend `bin/claude-notify.js` to:
- Parse command line args for notification type
- Read from environment variables
- Detect context (build script vs interactive session)

Example extension:
```javascript
// In bin/claude-notify.js
const notificationType = process.env.CLAUDE_NOTIFICATION_TYPE || 'attention';
const customMessage = process.env.CLAUDE_NOTIFICATION_MESSAGE || 'Waiting for you...';
```

Then use:
```bash
CLAUDE_NOTIFICATION_TYPE=success CLAUDE_NOTIFICATION_MESSAGE="Tests passed!" claude-notify
```

## Troubleshooting

### No Visual Notification

1. **Check Zellij session**:
   ```bash
   echo $ZELLIJ
   # Should output a number (session ID), not empty
   ```

2. **Check plugin is loaded**:
   ```bash
   ls -lh ~/.config/zellij/plugins/zellij_visual_notifications.wasm
   # Should exist and be ~1.1MB
   ```

3. **Check plugin in layout**:
   Make sure your Zellij layout includes the plugin pane

4. **Test plugin directly**:
   ```bash
   zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"test"}'
   ```

5. **Check settings**:
   ```bash
   cat ~/.config/claude-notifications/settings.json | grep -A 7 zellijVisualization
   ```

### Sound But No Visual

- Plugin might not be in current layout
- Plugin name mismatch (check `pluginName` setting)
- Zellij version incompatibility

### Visual But No Sound

- Sound is disabled in settings (`"sound": false`)
- Audio system issue (test with `paplay` or `aplay`)
- Sound file missing (run `claude-notifications install`)

### Both Working But Notifications Don't Clear

- Restart Zellij session
- Check plugin logs (if available)
- TTL might be set very high

## Next Steps

### Enhance notification intelligence:
- Context-aware notification types
- Parse Claude Code output for errors/warnings
- Different sounds for different notification types

### Add more notification channels:
- Slack/Discord webhooks for remote sessions
- Email for long-running tasks
- Mobile push notifications via Pushover/Pushbullet

### Advanced Zellij features:
- Per-pane notification preferences
- Notification history viewer
- Custom animation patterns
- Theme switching based on time of day

## Version

**Package Version**: 2.1.0

**Changes from 2.0.0**:
- Added Zellij visual notification integration
- New `zellijVisualization` config section
- Automatic detection of Zellij sessions
- Graceful fallback when plugin not available
- Updated documentation
- New example configurations
- Integration test script

## Files Modified

1. ✅ `bin/claude-notify.js` - Added `triggerZellijVisualization()`
2. ✅ `lib/config.js` - Added `zellijVisualization` defaults
3. ✅ `README.md` - Comprehensive Zellij documentation
4. ✅ `package.json` - Version bump to 2.1.0

## Files Created

1. ✅ `examples/settings-with-zellij.json` - Dual mode example
2. ✅ `examples/settings-zellij-only.json` - Silent mode example
3. ✅ `test-integration.sh` - Automated test script
4. ✅ `INTEGRATION.md` - This comprehensive guide

## Publishing

When ready to publish to npm:

```bash
# Test locally first
npm link
./test-integration.sh

# Run tests
npm test

# Publish
npm publish
```

## Support

Issues? Questions? Feature requests?
- GitHub: https://github.com/delorenj/claude-notifications/issues
- NPM: https://www.npmjs.com/package/@delorenj/claude-notifications

---

Built with ❤️ for developers who value both audio AND visual feedback!
