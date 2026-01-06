# Integration Guide

How to integrate Zellij Visual Notifications with claude-notifications and other systems.

## Integration with claude-notifications

The primary use case for this plugin is integration with the claude-notifications npm package.

### Setup

1. Install claude-notifications globally:

```bash
npm install -g @delorenj/claude-notifications
```

2. Install the Zellij plugin (see README)

3. Configure claude-notifications to send messages to the plugin

### Modifying claude-notify.js

Add Zellij integration to the notification trigger (`bin/claude-notify.js`):

```javascript
const { execSync } = require('child_process');

function notifyZellij(type, message) {
    // Check if we're in a Zellij session
    if (!process.env.ZELLIJ) {
        return;
    }

    const payload = JSON.stringify({
        type: type,
        message: message,
        source: 'claude-notifications',
        timestamp: Date.now()
    });

    try {
        // Send via Zellij pipe
        execSync(`echo '${payload}' | zellij pipe -p visual-notifications`, {
            stdio: 'ignore'
        });
    } catch (e) {
        // Zellij notification failed, continue silently
    }
}

// In the main notification function:
function main() {
    // ... existing notification logic ...

    // Add Zellij visual notification
    notifyZellij('attention', 'Claude is waiting for you...');
}
```

## Message Protocol

### Request Format

Send JSON messages to the plugin via Zellij pipe:

```bash
echo '{"type":"success","message":"Build completed"}' | zellij pipe -p visual-notifications
```

### Full Message Schema

```typescript
interface NotificationMessage {
    // Required
    message: string;

    // Optional
    version?: string;           // Protocol version (default: "1.0")
    type?: string;              // success|error|warning|info|attention|progress
    title?: string;             // Notification title
    source?: string;            // Source identifier
    pane_id?: number;           // Target pane ID
    tab_index?: number;         // Target tab index
    priority?: string;          // low|normal|high|critical
    timestamp?: number;         // Unix timestamp (ms)
    ttl_ms?: number;            // Time-to-live (ms)
    command?: string;           // Command that triggered notification
    exit_code?: number;         // Command exit code
    duration_ms?: number;       // Command duration (ms)
}
```

### Response

The plugin does not send responses. It processes messages asynchronously.

## Command Line Integration

### Manual Notifications

```bash
# Success
zellij-notify success "Build completed successfully"

# Error
zellij-notify error "Tests failed: 3 failures"

# Warning
zellij-notify warning "Memory usage high"

# Attention (Claude waiting)
zellij-notify attention "Claude is waiting for input"
```

### Shell Function

Add to your `.bashrc` or `.zshrc`:

```bash
zellij-notify() {
    local type="$1"
    local message="$2"

    if [ -z "$ZELLIJ" ]; then
        echo "Not in Zellij session"
        return 1
    fi

    echo "{\"type\":\"$type\",\"message\":\"$message\"}" | zellij pipe -p visual-notifications
}
```

### Git Hooks

Add visual notifications to Git operations:

```bash
# .git/hooks/post-commit
#!/bin/bash
if [ -n "$ZELLIJ" ]; then
    echo '{"type":"success","message":"Commit created"}' | zellij pipe -p visual-notifications
fi
```

```bash
# .git/hooks/post-merge
#!/bin/bash
if [ -n "$ZELLIJ" ]; then
    echo '{"type":"info","message":"Merge completed"}' | zellij pipe -p visual-notifications
fi
```

### Build System Integration

#### npm scripts

```json
{
    "scripts": {
        "build": "tsc && npm run notify:success",
        "notify:success": "[ -n \"$ZELLIJ\" ] && echo '{\"type\":\"success\",\"message\":\"Build completed\"}' | zellij pipe -p visual-notifications || true",
        "notify:error": "[ -n \"$ZELLIJ\" ] && echo '{\"type\":\"error\",\"message\":\"Build failed\"}' | zellij pipe -p visual-notifications || true"
    }
}
```

#### Makefile

```makefile
.PHONY: build notify-success notify-error

build:
    cargo build --release
    @$(MAKE) notify-success

notify-success:
    @if [ -n "$$ZELLIJ" ]; then \
        echo '{"type":"success","message":"Build completed"}' | zellij pipe -p visual-notifications; \
    fi

notify-error:
    @if [ -n "$$ZELLIJ" ]; then \
        echo '{"type":"error","message":"Build failed"}' | zellij pipe -p visual-notifications; \
    fi
```

## Programmatic Integration

### Node.js

```javascript
const { execSync } = require('child_process');

class ZellijNotifier {
    static isAvailable() {
        return !!process.env.ZELLIJ;
    }

    static notify(type, message, options = {}) {
        if (!this.isAvailable()) return;

        const payload = {
            type,
            message,
            timestamp: Date.now(),
            ...options
        };

        try {
            execSync(`echo '${JSON.stringify(payload)}' | zellij pipe -p visual-notifications`, {
                stdio: 'ignore'
            });
        } catch (e) {
            // Silently fail
        }
    }

    static success(message) { this.notify('success', message); }
    static error(message) { this.notify('error', message); }
    static warning(message) { this.notify('warning', message); }
    static info(message) { this.notify('info', message); }
    static attention(message) { this.notify('attention', message); }
}

module.exports = ZellijNotifier;
```

### Python

```python
import os
import json
import subprocess

class ZellijNotifier:
    @staticmethod
    def is_available():
        return 'ZELLIJ' in os.environ

    @staticmethod
    def notify(type: str, message: str, **kwargs):
        if not ZellijNotifier.is_available():
            return

        payload = {
            'type': type,
            'message': message,
            **kwargs
        }

        try:
            subprocess.run(
                f"echo '{json.dumps(payload)}' | zellij pipe -p visual-notifications",
                shell=True,
                capture_output=True
            )
        except Exception:
            pass

    @staticmethod
    def success(message): ZellijNotifier.notify('success', message)

    @staticmethod
    def error(message): ZellijNotifier.notify('error', message)

    @staticmethod
    def warning(message): ZellijNotifier.notify('warning', message)

    @staticmethod
    def info(message): ZellijNotifier.notify('info', message)

    @staticmethod
    def attention(message): ZellijNotifier.notify('attention', message)
```

### Rust

```rust
use std::process::Command;

pub struct ZellijNotifier;

impl ZellijNotifier {
    pub fn is_available() -> bool {
        std::env::var("ZELLIJ").is_ok()
    }

    pub fn notify(notification_type: &str, message: &str) {
        if !Self::is_available() {
            return;
        }

        let payload = format!(
            r#"{{"type":"{}","message":"{}"}}"#,
            notification_type, message
        );

        let _ = Command::new("sh")
            .arg("-c")
            .arg(format!(
                "echo '{}' | zellij pipe -p visual-notifications",
                payload
            ))
            .output();
    }

    pub fn success(message: &str) { Self::notify("success", message); }
    pub fn error(message: &str) { Self::notify("error", message); }
    pub fn warning(message: &str) { Self::notify("warning", message); }
    pub fn info(message: &str) { Self::notify("info", message); }
    pub fn attention(message: &str) { Self::notify("attention", message); }
}
```

## Troubleshooting Integration

### Plugin not receiving messages

1. Verify you're in a Zellij session: `echo $ZELLIJ`
2. Check plugin is loaded: Look for the status bar widget
3. Test with direct pipe: `echo '{"type":"info","message":"test"}' | zellij pipe -p visual-notifications`

### Messages not displaying

1. Check pane ID is valid (if specified)
2. Verify JSON is valid: `echo '{"type":"info","message":"test"}' | jq .`
3. Check notification timeout hasn't expired

### Performance issues

1. Reduce `queue_max_size` if memory is a concern
2. Disable animations with `animation_enabled false`
3. Use shorter TTL values
