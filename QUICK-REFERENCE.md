# zellij-notify Quick Reference Card

## Common Commands

```bash
# Basic notification
zellij-notify "Message"

# With type and priority
zellij-notify -t TYPE -p PRIORITY "Message"

# Quick 5-second notification
zellij-notify -q "Message"

# Dismissable (stays until Ctrl+N)
zellij-notify -d "Message"

# Custom TTL (seconds)
zellij-notify --ttl 30 "Message"

# To specific tab
zellij-notify -i 2 "Message"           # By index (1-based)
zellij-notify -n "Backend" "Message"   # By name

# To all tabs
zellij-notify -a "Message"

# List tabs
zellij-notify --list-tabs
```

## Notification Types

| Flag | Type | Color | Use For |
|------|------|-------|---------|
| `-t success` | Success | 🟢 Green | Completed tasks, tests passed |
| `-t error` | Error | 🔴 Red | Failures, errors |
| `-t warning` | Warning | 🟡 Yellow | Warnings, deprecations |
| `-t info` | Info | 🔵 Blue | General updates (default) |
| `-t attention` | Attention | 🟣 Purple | Needs your attention |
| `-t progress` | Progress | 🔷 Cyan | Long-running tasks |

## Priority Levels

| Flag | Priority | Effect |
|------|----------|--------|
| `-p low` | Low | Subtle, background |
| `-p normal` | Normal | Standard (default) |
| `-p high` | High | Prominent, demands attention |
| `-p critical` | Critical | Urgent, highest priority |

## Duration Options

| Flag | Duration | Use Case |
|------|----------|----------|
| `--ttl 5` | 5 seconds | Quick updates |
| `--ttl 30` | 30 seconds | Progress updates |
| `-q` | 5 seconds | Shorthand for quick |
| (default) | 300 seconds | Standard notifications |
| `-d` | Until Ctrl+N | Requires acknowledgment |

## Common Patterns

### Build Notifications
```bash
# Start
zellij-notify -t progress -q "Building..."

# Success
zellij-notify -t success "Build complete"

# Failure
zellij-notify -d -t error "Build failed"
```

### Test Results
```bash
# Running
zellij-notify -t progress "Running tests..."

# Passed
zellij-notify -t success "Tests passed ✅"

# Failed
zellij-notify -d -t error "Tests failed ❌"
```

### Deployment
```bash
# Starting
zellij-notify -a -t info "Deployment started"

# Complete
zellij-notify -a -t success -p high "Deployed! 🚀"

# Failure
zellij-notify -a -d -t error -p critical "Deployment failed!"
```

### Long Tasks
```bash
# Start
zellij-notify -t progress "Processing..."

# Complete (requires review)
zellij-notify -d -t attention "Review required"
```

## Script Integration

```bash
#!/bin/bash
# build.sh

zellij-notify -t info "Building..."

if make build; then
  zellij-notify -t success "Build complete"
else
  zellij-notify -d -t error "Build failed"
  exit 1
fi
```

## Chaining

```bash
# Success chain
zellij-notify -q "Starting..." && \
  long_task && \
  zellij-notify -t success "Done!"

# With failure handling
zellij-notify -q "Starting..." && \
  risky_task && \
  zellij-notify -t success "Success" || \
  zellij-notify -t error "Failed"
```

## Tab Management

```bash
# List tabs first
zellij-notify --list-tabs

# Target specific tabs
zellij-notify -i 1 "For tab 1"
zellij-notify -i 2 "For tab 2"
zellij-notify -n "Backend" "For backend tab"

# Broadcast
zellij-notify -a "For everyone"
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+N` | Clear all notifications in current tab |

## Full Help

```bash
zellij-notify --help
```

## Documentation

- [Full CLI Documentation](./ZELLIJ-NOTIFY.md)
- [Integration Guide](./INTEGRATION.md)
- [Examples](./examples/zellij-notify-examples.sh)

---

**Quick Copy-Paste Templates:**

```bash
# Success
zellij-notify -t success "Task complete"

# Error (dismissable)
zellij-notify -d -t error "Critical error"

# Warning with 30s TTL
zellij-notify -t warning --ttl 30 "Warning message"

# Info to all tabs
zellij-notify -a -t info "System update"

# Attention to specific tab
zellij-notify -i 2 -t attention "Review needed"

# Quick progress update
zellij-notify -q -t progress "Processing..."
```
