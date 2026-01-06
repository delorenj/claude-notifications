# Configuration Reference

Complete reference for all configuration options in Zellij Visual Notifications.

## Configuration Location

The plugin is configured within your Zellij configuration file:

- `~/.config/zellij/config.kdl`

## Options Reference

### General Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the plugin |
| `debug` | boolean | `false` | Enable debug logging |

### Theme Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | string | `"default"` | Theme preset name |
| `success_color` | string | Theme-dependent | Color for success notifications (hex) |
| `error_color` | string | Theme-dependent | Color for error notifications (hex) |
| `warning_color` | string | Theme-dependent | Color for warning notifications (hex) |
| `info_color` | string | Theme-dependent | Color for info notifications (hex) |

#### Available Themes

- `default` - Default color scheme
- `dracula` - Dracula theme colors
- `nord` - Nord theme colors
- `catppuccin` or `catppuccin-mocha` - Catppuccin Mocha (dark)
- `catppuccin-latte` - Catppuccin Latte (light)
- `gruvbox` or `gruvbox-dark` - Gruvbox Dark
- `gruvbox-light` - Gruvbox Light
- `tokyo-night` - Tokyo Night colors
- `one-dark` - One Dark colors
- `solarized` or `solarized-dark` - Solarized Dark
- `solarized-light` - Solarized Light

### Animation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `animation_enabled` | boolean | `true` | Enable/disable animations |
| `animation_style` | string | `"pulse"` | Animation style |
| `animation_speed` | integer | `50` | Animation speed (1-100) |
| `animation_cycles` | integer | `3` | Number of animation cycles |

#### Animation Styles

- `pulse` - Smooth fade in/out using sine wave
- `flash` - Quick on/off blink
- `fade` - Gradual fade out over animation duration
- `breathe` - Smooth breathing effect
- `none` - No animation (static color)

### Display Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show_status_bar` | boolean | `true` | Show status bar widget |
| `show_border_colors` | boolean | `true` | Show border colors on panes |
| `show_tab_badges` | boolean | `true` | Show badges on pane tabs |

### Notification Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `notification_timeout_ms` | integer | `300000` | Notification TTL in milliseconds (5 min) |
| `queue_max_size` | integer | `100` | Maximum notifications in queue |

### Accessibility Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `high_contrast` | boolean | `false` | Enable high contrast mode |
| `reduced_motion` | boolean | `false` | Disable all animations |

## Examples

### Basic Configuration

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        enabled true
        theme "dracula"
    }
}
```

### Custom Colors

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        enabled true
        theme "default"

        // Override specific colors
        success_color "#50fa7b"
        error_color "#ff5555"
        warning_color "#f1fa8c"
        info_color "#8be9fd"
    }
}
```

### Animation Configuration

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        enabled true

        // Fast, attention-grabbing animation
        animation_enabled true
        animation_style "flash"
        animation_speed 80
        animation_cycles 5
    }
}
```

### Minimal Distraction

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        enabled true

        // Only border colors, no animation
        animation_enabled false
        show_status_bar false
        show_tab_badges false
        show_border_colors true

        // Quick timeout
        notification_timeout_ms 30000
    }
}
```

### Accessibility Configuration

```kdl
plugins {
    visual-notifications location="file:~/.config/zellij/plugins/zellij-visual-notifications.wasm" {
        enabled true

        // Accessibility features
        high_contrast true
        reduced_motion true

        // Longer timeout
        notification_timeout_ms 600000
    }
}
```

## Environment Variables

The plugin respects these environment variables (when detectable):

| Variable | Effect |
|----------|--------|
| `COLORTERM` | Detects true color support |
| `TERM` | Detects terminal color capabilities |

## Hot Reload

Configuration changes require reloading the plugin:

1. Save your config file
2. Restart Zellij, or
3. Reload the plugin via keybinding

## Validation

The plugin validates configuration on load:

- Invalid color values fall back to theme defaults
- Invalid animation speeds are clamped to 1-100
- Invalid animation cycles are clamped to 1-10
- Unknown themes fall back to default

Validation errors are logged to Zellij's log file.
