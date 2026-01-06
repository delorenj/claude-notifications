# Zellij Visual Notifications

A Zellij plugin that provides visual notifications for Claude Code, displaying border colors, tab badges, and pulse animations when commands complete or require attention.

## Features

- **Pane Border Colors**: Green for success, red for errors, yellow for warnings
- **Tab Badges**: Unicode icons (check, X, warning) on pane tabs
- **Pulse Animations**: Configurable animations to draw attention
- **Theme Support**: 10+ built-in themes (Dracula, Nord, Catppuccin, etc.)
- **Accessibility**: High contrast mode, reduced motion, pattern indicators
- **Integration**: Seamless integration with claude-notifications

## Installation

### Prerequisites

- Zellij v0.40 or later
- Rust toolchain with `wasm32-wasi` target
- claude-notifications npm package (optional, for audio)

### Build from Source

```bash
# Install WASM target
rustup target add wasm32-wasi

# Build the plugin
cd zellij-plugin
cargo build --release --target wasm32-wasi

# Copy to Zellij plugins directory
mkdir -p ~/.config/zellij/plugins
cp target/wasm32-wasi/release/zellij_visual_notifications.wasm ~/.config/zellij/plugins/
```

### Pre-built Binary

Download the latest release from GitHub:

```bash
wget https://github.com/delorenj/claude-notifications/releases/latest/download/zellij-visual-notifications.wasm
mv zellij-visual-notifications.wasm ~/.config/zellij/plugins/
```

## Configuration

Add the plugin to your Zellij configuration (`~/.config/zellij/config.kdl`):

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        // Enable/disable the plugin
        enabled true

        // Theme (default, dracula, nord, catppuccin, gruvbox, tokyo-night, one-dark, solarized)
        theme "catppuccin"

        // Custom colors (override theme)
        // success_color "#22c55e"
        // error_color "#ef4444"
        // warning_color "#eab308"
        // info_color "#3b82f6"

        // Animation settings
        animation_enabled true
        animation_style "pulse"  // pulse, flash, fade, breathe, none
        animation_speed 50       // 1-100, higher = faster
        animation_cycles 3       // Number of animation cycles

        // Display options
        show_status_bar true
        show_border_colors true
        show_tab_badges true

        // Notification settings
        notification_timeout_ms 300000  // 5 minutes
        queue_max_size 100

        // Accessibility
        high_contrast false
        reduced_motion false
    }
}
```

### Load the Plugin

Add to your layout or keybindings:

```kdl
// In your layout file
pane {
    plugin location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm"
}

// Or load via keybinding
keybinds {
    normal {
        bind "Alt n" {
            LaunchOrFocusPlugin "file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
                floating true
            }
        }
    }
}
```

## Usage

### With claude-notifications

The plugin automatically integrates with the claude-notifications npm package. When Claude Code triggers a notification, you'll see:

1. **Border Color Change**: The pane border changes to indicate status
2. **Tab Badge**: An icon appears on the pane tab
3. **Animation**: A pulse animation draws your attention

### Manual Triggering

Send notifications via Zellij pipe:

```bash
# Success notification
echo '{"type":"success","message":"Build completed"}' | zellij pipe -p visual-notifications

# Error notification
echo '{"type":"error","message":"Tests failed","pane_id":2}' | zellij pipe -p visual-notifications

# Attention notification (Claude waiting)
echo '{"type":"attention","message":"Claude is waiting for you..."}' | zellij pipe -p visual-notifications
```

### Clearing Notifications

- **Focus the pane**: Notification clears when you switch to that pane
- **Clear all**: Press `Ctrl+N` in the plugin to clear all notifications

## Themes

Built-in themes:

| Theme | Description |
|-------|-------------|
| `default` | Default color scheme |
| `dracula` | Dracula theme |
| `nord` | Nord theme |
| `catppuccin` | Catppuccin Mocha |
| `catppuccin-latte` | Catppuccin Latte (light) |
| `gruvbox` | Gruvbox Dark |
| `gruvbox-light` | Gruvbox Light |
| `tokyo-night` | Tokyo Night |
| `one-dark` | One Dark |
| `solarized` | Solarized Dark |
| `solarized-light` | Solarized Light |

## Notification Types

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `success` | Green | Check mark | Command completed successfully |
| `error` | Red | X mark | Command failed |
| `warning` | Yellow | Triangle | Warning condition |
| `info` | Blue | Info symbol | Informational message |
| `attention` | Yellow | Exclamation | Claude Code waiting for input |
| `progress` | Blue | Arrow | Long-running operation |

## Animation Styles

| Style | Description |
|-------|-------------|
| `pulse` | Smooth fade in/out (default) |
| `flash` | Quick on/off blink |
| `fade` | Gradual fade out |
| `breathe` | Smooth sine wave animation |
| `none` | No animation |

## Accessibility

The plugin includes several accessibility features:

- **High Contrast Mode**: Increases color contrast for better visibility
- **Reduced Motion**: Disables all animations
- **Pattern Indicators**: Uses text patterns in addition to colors to distinguish notification types

Enable via configuration:

```kdl
plugins {
    visual-notifications {
        high_contrast true
        reduced_motion true
    }
}
```

## Message Protocol

The plugin accepts JSON messages with the following structure:

```json
{
    "version": "1.0",
    "type": "success|error|warning|info|attention|progress",
    "message": "Notification message",
    "title": "Optional title",
    "pane_id": 1,
    "tab_index": 0,
    "priority": "low|normal|high|critical",
    "timestamp": 1234567890,
    "ttl_ms": 300000,
    "source": "claude-notifications",
    "command": "npm test",
    "exit_code": 0,
    "duration_ms": 5000
}
```

All fields except `message` are optional.

## Performance

- **Binary Size**: ~300-400KB (WASM)
- **Memory Usage**: ~5-10MB
- **CPU Usage**: <1% (with animations)
- **Animation FPS**: 20 (50ms timer)

## Troubleshooting

### Plugin not loading

1. Verify the WASM file exists: `ls ~/.config/zellij/plugins/`
2. Check Zellij logs: `~/.cache/zellij/zellij-log-*.log`
3. Ensure Zellij version is 0.40 or later

### No visual changes

1. Verify plugin is running: Check the status bar for the bell icon
2. Send a test notification: See "Manual Triggering" above
3. Check configuration: Ensure `enabled true` is set

### Animations not working

1. Check `animation_enabled true` in config
2. Verify `reduced_motion false`
3. Try a different animation style

## Development

### Building

```bash
# Debug build
cargo build --target wasm32-wasi

# Release build with optimizations
cargo build --release --target wasm32-wasi

# Run tests
cargo test
```

### Project Structure

```
zellij-plugin/
├── src/
│   ├── lib.rs           # Plugin entry point
│   ├── config.rs        # Configuration management
│   ├── state.rs         # State machine
│   ├── colors.rs        # Color management
│   ├── animation.rs     # Animation engine
│   ├── notification.rs  # Notification types
│   ├── event_bridge.rs  # IPC handling
│   ├── queue.rs         # Priority queue
│   └── renderer.rs      # Visual rendering
├── configs/
│   └── examples/        # Example configurations
├── docs/                # Additional documentation
└── Cargo.toml           # Rust dependencies
```

## License

MIT License - see the main project LICENSE file.

## Credits

- Part of the [claude-notifications](https://github.com/delorenj/claude-notifications) project
- Built for the [Zellij](https://zellij.dev) terminal multiplexer
