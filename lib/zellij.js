const { execSync, exec } = require('child_process');

/**
 * Zellij helper functions for tab and pane management
 */

/**
 * Check if running inside a Zellij session
 * More robust check that verifies actual connectivity
 */
function isInZellijSession() {
  // First check env var
  if (!process.env.ZELLIJ) {
    return false;
  }

  // Verify we can actually communicate with Zellij
  try {
    // Quick test - list tabs (very fast operation)
    execSync('zellij action query-tab-names', {
      stdio: 'ignore',
      timeout: 500
    });
    return true;
  } catch (e) {
    // If this fails, we're not really in a session
    return false;
  }
}

/**
 * Get all tabs in the current Zellij session
 * Returns array of {index, name, active, panes}
 */
function getTabs() {
  if (!isInZellijSession()) {
    throw new Error('Not in a Zellij session');
  }

  try {
    // Use zellij action to get tab info
    // This is a workaround - ideally we'd parse `zellij action query-tab-names`
    // but that's not available, so we'll use environment introspection
    const result = execSync('zellij action dump-layout', {
      encoding: 'utf-8',
      timeout: 2000
    });

    // Parse KDL layout format to extract tabs
    // This is a simplified parser for tab names
    const tabs = [];
    const tabMatches = result.matchAll(/tab\s+(?:name="([^"]+)"\s+)?(?:focus=(\w+)\s+)?{/g);

    let index = 0;
    for (const match of tabMatches) {
      tabs.push({
        index: index + 1,  // 1-based indexing for user-facing CLI
        name: match[1] || `Tab ${index + 1}`,
        active: match[2] === 'true',
        panes: []  // We don't parse panes for now
      });
      index++;
    }

    return tabs;
  } catch (error) {
    // Fallback: return empty array if parsing fails
    return [];
  }
}

/**
 * Resolve tab identifier to tab index
 * @param {string|number} identifier - Tab name or 1-based index
 * @returns {number} - Tab index (1-based)
 */
function resolveTab(identifier) {
  if (typeof identifier === 'number') {
    return identifier;
  }

  const tabs = getTabs();

  // Try to find by name
  const tab = tabs.find(t => t.name === identifier);
  if (tab) {
    return tab.index;
  }

  // Try to parse as number
  const numId = parseInt(identifier, 10);
  if (!isNaN(numId)) {
    return numId;
  }

  throw new Error(`Tab not found: ${identifier}`);
}

/**
 * Send notification to Zellij plugin with retry logic
 * @param {Object} notification - Notification payload
 * @param {string} notification.type - Notification type (success, error, warning, info, attention, progress)
 * @param {string} notification.message - Notification message
 * @param {string} [notification.title] - Notification title
 * @param {string} [notification.source] - Notification source
 * @param {string} [notification.priority] - Priority (low, normal, high, critical)
 * @param {number} [notification.ttl] - Time to live in milliseconds
 * @param {number} [notification.tabIndex] - Target tab (1-based index), omit for current tab
 * @param {string} [pluginName] - Plugin name (default: zellij_visual_notifications)
 * @param {Object} [options] - Additional options
 * @param {number} [options.maxRetries] - Maximum retry attempts (default: 2)
 * @param {number} [options.retryDelay] - Delay between retries in ms (default: 100)
 */
function sendNotification(notification, pluginName = 'zellij_visual_notifications', options = {}) {
  if (!isInZellijSession()) {
    throw new Error('Not in a Zellij session');
  }

  const maxRetries = options.maxRetries ?? 2;
  const retryDelay = options.retryDelay ?? 100;

  // Construct full payload
  const payload = {
    type: notification.type || 'info',
    message: notification.message,
    title: notification.title || 'Notification',
    source: notification.source || 'zellij-notify',
    priority: notification.priority || 'normal',
    timestamp: Date.now(),
    ...notification
  };

  // Add TTL if specified
  if (notification.ttl !== undefined) {
    payload.ttl = notification.ttl;
  }

  const jsonPayload = JSON.stringify(payload);

  // Retry logic
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If tabIndex is specified, switch to that tab first
      if (notification.tabIndex !== undefined) {
        try {
          execSync(`zellij action go-to-tab ${notification.tabIndex}`, {
            stdio: 'ignore',
            timeout: 3000
          });
        } catch (e) {
          // Tab switch failed, continue anyway
          if (attempt === 0) {
            console.warn(`Warning: Could not switch to tab ${notification.tabIndex}`);
          }
        }
      }

      // Send notification via pipe with better error handling
      try {
        execSync(`zellij pipe -p ${pluginName} -- '${jsonPayload}'`, {
          stdio: 'pipe',  // Capture output for better errors
          timeout: 5000,  // 5 second timeout
          encoding: 'utf-8'
        });

        // Success!
        return true;
      } catch (pipeError) {
        // Check if it's a permanent error (don't retry)
        if (pipeError.stderr && pipeError.stderr.includes('no pipe')) {
          throw new Error(
            `Plugin '${pluginName}' not found. ` +
            `Make sure the plugin is loaded in your Zellij layout.`
          );
        }

        // For timeouts or other errors, save and retry
        lastError = pipeError;

        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          execSync(`sleep ${delay / 1000}`, { stdio: 'ignore' });
        }
      }
    } catch (error) {
      // Fatal error (like plugin not found)
      throw error;
    }
  }

  // All retries exhausted
  if (lastError) {
    if (lastError.code === 'ETIMEDOUT') {
      throw new Error(
        `Timeout sending to plugin '${pluginName}' after ${maxRetries + 1} attempts. ` +
        `Plugin may not be loaded or is overloaded. ` +
        `Try restarting Zellij or reducing notification frequency.`
      );
    }
    throw new Error(`Failed to send notification after ${maxRetries + 1} attempts: ${lastError.message}`);
  }

  return false;
}

/**
 * Send notification to all tabs
 */
function sendNotificationToAllTabs(notification, pluginName = 'zellij_visual_notifications') {
  const tabs = getTabs();

  if (tabs.length === 0) {
    // Fallback: just send to current tab
    return sendNotification(notification, pluginName);
  }

  let successCount = 0;
  const errors = [];

  for (const tab of tabs) {
    try {
      sendNotification({
        ...notification,
        tabIndex: tab.index
      }, pluginName);
      successCount++;
    } catch (error) {
      errors.push({ tab: tab.name, error: error.message });
    }
  }

  return {
    total: tabs.length,
    success: successCount,
    errors
  };
}

module.exports = {
  isInZellijSession,
  getTabs,
  resolveTab,
  sendNotification,
  sendNotificationToAllTabs
};
