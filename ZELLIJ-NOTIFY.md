# zellij-notify CLI

A powerful command-line tool for sending visual notifications to Zellij tabs and panes.

## Quick Start

```bash
# Basic notification
zellij-notify "Build complete!"

# Success notification with title
zellij-notify -t success --title "Tests" "All tests passed"

# Error to specific tab
zellij-notify -n "Backend" -t error "Server crashed"

# Quick disappearing message (5 seconds)
zellij-notify -q "Starting deployment..."

# Dismissable alert (stays until Ctrl+N)
zellij-notify -d -t error -p critical "PRODUCTION DOWN"
```

## Installation

The CLI is installed automatically with `@delorenj/claude-notifications`:

```bash
npm install -g @delorenj/claude-notifications
```

This provides three commands:
- `claude-notify` - Trigger Claude Code notifications
- `zellij-notify` - Send notifications to Zellij (this tool)
- `claude-notifications` - Package management

## Usage

```
zellij-notify [OPTIONS] <MESSAGE>
```

### Arguments

- `<MESSAGE>` - The notification message to display (required)

### Options

#### Tab Targeting

| Option | Description |
|--------|-------------|
| `-n, --tab-name <NAME>` | Target tab by name |
| `-i, --tab-index <INDEX>` | Target tab by 1-based index (1, 2, 3, ...) |
| `-a, --all` | Send to all tabs |

#### Notification Appearance

| Option | Description |
|--------|-------------|
| `-t, --type <TYPE>` | Notification type: `success`, `error`, `warning`, `info`, `attention`, `progress` (default: `info`) |
| `-p, --priority <PRIORITY>` | Priority: `low`, `normal`, `high`, `critical` (default: `normal`) |
| `--title <TITLE>` | Notification title (default: "Notification") |

#### Duration & Dismissal

| Option | Description |
|--------|-------------|
| `--ttl <SECONDS>` | Auto-dismiss after N seconds (default: 300 / 5 minutes) |
| `-d, --dismissable` | Require manual dismissal with Ctrl+N (overrides TTL) |
| `-q, --quick` | Quick notification (5 seconds, equivalent to `--ttl 5`) |

#### Other

| Option | Description |
|--------|-------------|
| `--plugin <NAME>` | Plugin name (default: `zellij_visual_notifications`) |
| `-l, --list-tabs` | List all tabs and exit |
| `-h, --help` | Show help message |

## Notification Types

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `success` | Green | ✅ | Task completed, tests passed, deployment succeeded |
| `error` | Red | ❌ | Build failed, errors occurred, operation failed |
| `warning` | Yellow | ⚠️ | Warnings, deprecated APIs, non-critical issues |
| `info` | Blue | ℹ️ | General information, status updates |
| `attention` | Purple | 👁️ | Needs your attention (default for Claude waiting) |
| `progress` | Cyan | 🔄 | Long-running task in progress |

## Priority Levels

| Priority | Behavior |
|----------|----------|
| `low` | Background notification, subtle |
| `normal` | Standard notification (default) |
| `high` | Demands attention, shown prominently |
| `critical` | Urgent, highest priority in queue |

## Examples

### Basic Usage

```bash
# Simple notification to current tab
zellij-notify "Hello from zellij-notify!"

# With notification type
zellij-notify -t success "Build completed successfully"

# With type and priority
zellij-notify -t error -p high "Critical error in production"
```

### Tab Targeting

```bash
# List all tabs first
zellij-notify --list-tabs

# Send to specific tab by index (1-based)
zellij-notify -i 1 "Message for first tab"
zellij-notify -i 2 "Message for second tab"

# Send to tab by name
zellij-notify -n "Backend" "Server restarted"
zellij-notify -n "Frontend" "Hot reload complete"

# Broadcast to all tabs
zellij-notify -a "System maintenance in 5 minutes"
```

### Duration Control

```bash
# Quick 5-second notification
zellij-notify -q "Starting task..."

# Custom 30-second TTL
zellij-notify --ttl 30 "Deployment in progress"

# 1-minute notification
zellij-notify --ttl 60 -t info "Build running..."

# Dismissable (stays until Ctrl+N)
zellij-notify -d -t attention "Please review pull request"

# Critical dismissable alert
zellij-notify -d -t error -p critical "DATABASE CONNECTION LOST"
```

### Real-World Scenarios

#### Build Notifications

```bash
# Starting
zellij-notify -t progress -q "Building project..."

# Success
zellij-notify -t success --title "Build" "Build completed in 42s"

# Failure
zellij-notify -t error --title "Build Failed" "Syntax error on line 123"
```

#### Test Results

```bash
# Running tests
zellij-notify -t progress --title "Tests" "Running test suite..."

# Success
zellij-notify -t success --title "Tests" "All 157 tests passed ✅"

# Failure
zellij-notify -t error --title "Tests" "3 tests failed ❌"
```

#### Deployment Pipeline

```bash
# Start
zellij-notify -t info "Deployment started"

# Progress updates (to all tabs)
zellij-notify -a -t progress "Building Docker image..."
sleep 30
zellij-notify -a -t progress "Pushing to registry..."
sleep 20
zellij-notify -a -t progress "Deploying to production..."
sleep 15

# Complete
zellij-notify -a -t success -p high "🚀 Deployed to production!"
```

#### Long-Running Tasks

```bash
# Start task
zellij-notify -t progress "Analyzing 10,000 files..."

# Completion notification (dismissable, requires acknowledgment)
zellij-notify -d -t success --title "Analysis Complete" \
  "Found 42 issues. Review required."
```

#### Multi-Tab Workflow

```bash
# Terminal 1 (tab 1): Backend development
zellij-notify -i 1 -t info "Backend: Hot reload ready"

# Terminal 2 (tab 2): Frontend development
zellij-notify -i 2 -t info "Frontend: Dev server running on :3000"

# Terminal 3 (tab 3): Database
zellij-notify -i 3 -t warning "Database: Migration pending"

# Broadcast to all when done
zellij-notify -a -t success "All services ready 🎉"
```

#### Error Alerts

```bash
# Low priority (logged, not urgent)
zellij-notify -t warning -p low "Cache miss rate high"

# Normal priority
zellij-notify -t warning "API rate limit: 80% used"

# High priority (demands attention)
zellij-notify -t error -p high "Database slow query detected"

# Critical (requires immediate action)
zellij-notify -d -t error -p critical "DISK SPACE: 95% FULL"
```

## Scripting & Automation

### Build Script Integration

```bash
#!/bin/bash
# build.sh

zellij-notify -t info "Build started..."

if npm run build; then
  zellij-notify -t success --title "Build" "Build completed successfully"
else
  zellij-notify -d -t error --title "Build Failed" "Check logs for details"
  exit 1
fi
```

### Test Runner Integration

```bash
#!/bin/bash
# test.sh

zellij-notify -t progress "Running tests..."

TEST_OUTPUT=$(npm test 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
  PASSED=$(echo "$TEST_OUTPUT" | grep -o '[0-9]* passed' | grep -o '[0-9]*')
  zellij-notify -t success --title "Tests" "$PASSED tests passed"
else
  FAILED=$(echo "$TEST_OUTPUT" | grep -o '[0-9]* failed' | grep -o '[0-9]*')
  zellij-notify -d -t error --title "Tests Failed" "$FAILED tests failed"
  exit 1
fi
```

### Git Hook Integration

```bash
# .git/hooks/pre-push

#!/bin/bash
# Run tests before push

zellij-notify -q "Running pre-push tests..."

if npm test; then
  zellij-notify -t success -q "Tests passed, pushing..."
  exit 0
else
  zellij-notify -d -t error -p critical "Tests failed! Push blocked."
  exit 1
fi
```

### Watch Script

```bash
#!/bin/bash
# watch-and-notify.sh

while inotifywait -r -e modify,create,delete ./src; do
  zellij-notify -q "Files changed, rebuilding..."

  if make build; then
    zellij-notify -t success -q "Build complete"
  else
    zellij-notify -t error --ttl 10 "Build failed"
  fi
done
```

### Cron Job Notifications

```bash
# In your cron job
0 2 * * * /path/to/backup.sh && \
  ZELLIJ=0 zellij-notify -t success "Backup completed" || \
  ZELLIJ=0 zellij-notify -d -t error "Backup failed"
```

## Integration with Other Tools

### Make Integration

```makefile
# Makefile

.PHONY: build test deploy

build:
	@zellij-notify -t info "Building..."
	@npm run build && \
		zellij-notify -t success "Build complete" || \
		zellij-notify -t error "Build failed"

test:
	@zellij-notify -t progress "Running tests..."
	@npm test && \
		zellij-notify -t success "Tests passed" || \
		zellij-notify -d -t error "Tests failed"

deploy:
	@zellij-notify -a -t info "Starting deployment..."
	@./deploy.sh && \
		zellij-notify -a -t success -p high "Deployed!" || \
		zellij-notify -a -d -t error -p critical "Deploy failed!"
```

### Docker Compose

```bash
# After docker-compose up
docker-compose up -d && \
  zellij-notify -t success "Containers started" || \
  zellij-notify -t error "Container startup failed"
```

### CI/CD Integration

```bash
# In your CI/CD pipeline
if [ "$CI" = "true" ]; then
  # Use webhook instead
  curl -X POST https://your-webhook.com/notify
else
  # Local development - use zellij-notify
  zellij-notify -t success "Pipeline passed"
fi
```

## Tips & Best Practices

### 1. Use Appropriate Types

Match notification types to the situation:
- `info` for status updates
- `progress` for long-running tasks
- `success` for completed operations
- `warning` for non-critical issues
- `error` for failures
- `attention` for items requiring user action

### 2. Set Appropriate TTLs

- Quick operations: `-q` (5 seconds)
- Progress updates: `--ttl 10-30`
- Completed tasks: Default (300 seconds)
- Requires action: `-d` (dismissable)

### 3. Use Priorities Wisely

- `low` - Logged events, debug info
- `normal` - Standard notifications (default)
- `high` - Important events, errors
- `critical` - System failures, requires immediate action

### 4. Tab Targeting Strategy

- Current tab: Default, most operations
- Specific tab: When operation affects specific service
- All tabs: System-wide events, shutdowns, critical alerts

### 5. Chain Notifications

```bash
zellij-notify -q "Starting..." && \
  long_task && \
  zellij-notify -t success "Done!" || \
  zellij-notify -t error "Failed!"
```

## Troubleshooting

### "Not in a Zellij session"

You must run `zellij-notify` from inside a Zellij session:

```bash
# Start Zellij first
zellij

# Then use zellij-notify
zellij-notify "Test"
```

### "Tab not found"

List available tabs:

```bash
zellij-notify --list-tabs
```

Then use the correct index or name.

### "Failed to send notification"

1. Check plugin is loaded:
   ```bash
   ls -lh ~/.config/zellij/plugins/zellij_visual_notifications.wasm
   ```

2. Verify plugin is in your layout

3. Test direct pipe:
   ```bash
   zellij pipe -p zellij_visual_notifications -- '{"type":"info","message":"test"}'
   ```

### Notifications not appearing

1. Check plugin configuration in layout
2. Ensure `enabled true` in plugin config
3. Restart Zellij session
4. Check plugin logs (if available)

## Advanced Usage

### Custom Plugin Name

If you've renamed the plugin:

```bash
zellij-notify --plugin my_custom_plugin "Message"
```

### Programmatic Usage

```javascript
const { sendNotification } = require('@delorenj/claude-notifications/lib/zellij');

sendNotification({
  type: 'success',
  message: 'Task complete',
  priority: 'high',
  ttl: 30000  // milliseconds
});
```

### Environment Variables

You can set defaults via environment:

```bash
export ZELLIJ_NOTIFY_TYPE=success
export ZELLIJ_NOTIFY_PRIORITY=high

zellij-notify "Will use env defaults"
```

## Comparison with Other Notification Methods

| Method | Pros | Cons |
|--------|------|------|
| `zellij-notify` | Visual, in-context, non-disruptive | Requires Zellij, visual only |
| `claude-notify` | Audio + Visual, works everywhere | May be disruptive |
| `notify-send` | System-level, standard | Requires desktop environment |
| Desktop apps | Rich UI, persistent | Not terminal-integrated |
| Webhooks | Remote notifications | Requires network, setup |

## See Also

- [claude-notify](README.md) - Audio + visual notifications for Claude Code
- [Zellij documentation](https://zellij.dev/)
- [Visual notifications plugin](./zellij-plugin/)

## License

MIT License - Same as @delorenj/claude-notifications

---

**Ready to supercharge your Zellij workflow?**

```bash
npm install -g @delorenj/claude-notifications
zellij-notify "Let's go! 🚀"
```
