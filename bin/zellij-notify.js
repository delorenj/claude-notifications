#!/usr/bin/env node

/**
 * zellij-notify - Send visual notifications to Zellij tabs and panes
 *
 * A powerful CLI for triggering visual notifications in Zellij with support for:
 * - Tab targeting (by name or index)
 * - Custom TTL (time-to-live)
 * - Different notification types and priorities
 * - Broadcast to all tabs
 */

const {
  isInZellijSession,
  getTabs,
  resolveTab,
  sendNotification,
  sendNotificationToAllTabs
} = require('../lib/zellij');

const NOTIFICATION_TYPES = ['success', 'error', 'warning', 'info', 'attention', 'progress'];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];

function printHelp() {
  console.log(`
zellij-notify - Send visual notifications to Zellij tabs and panes

USAGE:
    zellij-notify [OPTIONS] <MESSAGE>

ARGUMENTS:
    <MESSAGE>          The notification message to display

OPTIONS:
    -n, --tab-name <NAME>       Target tab by name
    -i, --tab-index <INDEX>     Target tab by 1-based index
    -a, --all                   Send to all tabs

    -t, --type <TYPE>           Notification type
                                [success, error, warning, info, attention, progress]
                                (default: info)

    -p, --priority <PRIORITY>   Notification priority
                                [low, normal, high, critical]
                                (default: normal)

    --title <TITLE>             Notification title (default: "Notification")

    --ttl <SECONDS>             Auto-dismiss after N seconds
                                (default: 300 seconds / 5 minutes)

    -d, --dismissable           Require manual dismissal (Ctrl+N)
                                Overrides --ttl with effectively infinite duration

    -q, --quick                 Quick notification (5 seconds)
                                Equivalent to --ttl 5

    --plugin <NAME>             Plugin name (default: zellij_visual_notifications)

    -l, --list-tabs             List all tabs and exit
    -h, --help                  Show this help message

NOTIFICATION TYPES:
    success     ✅ Green - Task completed, tests passed
    error       ❌ Red - Build failed, errors occurred
    warning     ⚠️  Yellow - Warnings, deprecated APIs
    info        ℹ️  Blue - General information
    attention   👁️  Purple - Needs your attention (default for Claude)
    progress    🔄 Cyan - Long-running task in progress

PRIORITIES:
    low         Background notification, subtle
    normal      Standard notification (default)
    high        Demands attention
    critical    Urgent, highest priority in queue

EXAMPLES:
    # Basic notification to current tab
    zellij-notify "Build complete!"

    # Success notification with custom title
    zellij-notify -t success --title "Tests Passed" "All 42 tests passed"

    # Error to specific tab by name
    zellij-notify -n "Backend" -t error "Server crashed"

    # Quick 5-second notification
    zellij-notify -q "Starting deployment..."

    # Critical dismissable alert to all tabs
    zellij-notify -a -d -t error -p critical "PRODUCTION DOWN"

    # Notification to tab 2 with 30-second TTL
    zellij-notify -i 2 --ttl 30 "Task started"

    # List all tabs
    zellij-notify --list-tabs

ADVANCED:
    # Chained notifications (fire and forget)
    zellij-notify -t info "Step 1: Build" && \\
      sleep 5 && \\
      zellij-notify -t success "Step 2: Deploy"

    # Notification with extremely long TTL (effectively permanent)
    zellij-notify -d -t attention "Manual review required"

    # Send to multiple specific tabs
    for tab in 1 2 3; do
      zellij-notify -i $tab "Broadcasting to tab $tab"
    done
`);
}

function printTabs() {
  if (!isInZellijSession()) {
    console.error('Error: Not in a Zellij session');
    process.exit(1);
  }

  const tabs = getTabs();

  if (tabs.length === 0) {
    console.log('No tabs found (or unable to parse tabs)');
    return;
  }

  console.log('\nZellij Tabs:\n');
  console.log('Index  Active  Name');
  console.log('-----  ------  ----');

  for (const tab of tabs) {
    const activeMarker = tab.active ? '  *   ' : '      ';
    console.log(`  ${tab.index}    ${activeMarker}  ${tab.name}`);
  }

  console.log('');
}

function parseArgs(args) {
  const options = {
    message: null,
    tabName: null,
    tabIndex: null,
    all: false,
    type: 'info',
    priority: 'normal',
    title: 'Notification',
    ttl: 300,  // 5 minutes default
    dismissable: false,
    pluginName: 'zellij_visual_notifications',
    listTabs: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        return options;

      case '-l':
      case '--list-tabs':
        options.listTabs = true;
        return options;

      case '-n':
      case '--tab-name':
        options.tabName = args[++i];
        break;

      case '-i':
      case '--tab-index':
        options.tabIndex = parseInt(args[++i], 10);
        if (isNaN(options.tabIndex)) {
          throw new Error('Tab index must be a number');
        }
        break;

      case '-a':
      case '--all':
        options.all = true;
        break;

      case '-t':
      case '--type':
        options.type = args[++i];
        if (!NOTIFICATION_TYPES.includes(options.type)) {
          throw new Error(`Invalid type: ${options.type}. Must be one of: ${NOTIFICATION_TYPES.join(', ')}`);
        }
        break;

      case '-p':
      case '--priority':
        options.priority = args[++i];
        if (!PRIORITIES.includes(options.priority)) {
          throw new Error(`Invalid priority: ${options.priority}. Must be one of: ${PRIORITIES.join(', ')}`);
        }
        break;

      case '--title':
        options.title = args[++i];
        break;

      case '--ttl':
        options.ttl = parseFloat(args[++i]);
        if (isNaN(options.ttl) || options.ttl < 0) {
          throw new Error('TTL must be a positive number');
        }
        break;

      case '-d':
      case '--dismissable':
        options.dismissable = true;
        break;

      case '-q':
      case '--quick':
        options.ttl = 5;
        break;

      case '--plugin':
        options.pluginName = args[++i];
        break;

      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        // Treat as message
        options.message = arg;
        break;
    }

    i++;
  }

  return options;
}

function main() {
  const args = process.argv.slice(2);

  // Handle no arguments
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  try {
    const options = parseArgs(args);

    // Handle special actions
    if (options.help) {
      printHelp();
      process.exit(0);
    }

    if (options.listTabs) {
      printTabs();
      process.exit(0);
    }

    // Validate we're in Zellij
    if (!isInZellijSession()) {
      console.error('Error: Not in a Zellij session');
      console.error('Launch Zellij first, then run this command inside the session.');
      process.exit(1);
    }

    // Validate message
    if (!options.message) {
      console.error('Error: Message is required');
      console.error('Usage: zellij-notify [OPTIONS] <MESSAGE>');
      console.error('Try: zellij-notify --help');
      process.exit(1);
    }

    // Build notification payload
    const notification = {
      type: options.type,
      message: options.message,
      title: options.title,
      priority: options.priority,
      source: 'zellij-notify'
    };

    // Handle TTL
    if (options.dismissable) {
      // Set to null for manual dismissal only
      notification.ttl = null;
    } else {
      // Convert seconds to milliseconds
      notification.ttl = options.ttl * 1000;
    }

    // Handle tab targeting
    if (options.all) {
      // Send to all tabs
      const result = sendNotificationToAllTabs(notification, options.pluginName);

      if (result.errors && result.errors.length > 0) {
        console.error(`Warning: ${result.errors.length} tabs failed:`);
        result.errors.forEach(err => {
          console.error(`  - ${err.tab}: ${err.error}`);
        });
      }

      console.log(`✅ Notification sent to ${result.success}/${result.total} tabs`);
    } else if (options.tabName || options.tabIndex) {
      // Send to specific tab
      const tabId = options.tabName || options.tabIndex;

      try {
        const tabIndex = resolveTab(tabId);
        notification.tabIndex = tabIndex;

        sendNotification(notification, options.pluginName);
        console.log(`✅ Notification sent to tab ${tabIndex}`);
      } catch (error) {
        console.error(`Error: ${error.message}`);
        console.error('\nAvailable tabs:');
        printTabs();
        process.exit(1);
      }
    } else {
      // Send to current tab
      sendNotification(notification, options.pluginName);
      console.log('✅ Notification sent to current tab');
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
