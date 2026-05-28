#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { getConfig, getSoundPath, SOUND_TYPES } = require('../lib/config');

const config = getConfig();
const DEFAULT_WEBHOOK_TIMEOUT_MS = 1500;

// Check for command line arguments
const args = process.argv.slice(2);
const useBell = args.includes('--bell') || args.includes('-b');
const showConfig = args.includes('-c') || args.includes('--config');
const AUDIO_COMMAND_TIMEOUT_MS = 800;

function execAudioCommand(command) {
  execSync(command, {
    stdio: 'ignore',
    timeout: AUDIO_COMMAND_TIMEOUT_MS
  });
}

function playSound() {
  if (!config.sound) {
    return;
  }

  // Determine which sound to play
  let soundType = config.soundType;
  if (useBell) {
    soundType = SOUND_TYPES.BELL;
  }

  const soundFile = getSoundPath(soundType);
  
  if (!fs.existsSync(soundFile)) {
    console.warn(`Sound file not found: ${soundFile}`);
    process.stdout.write('\x07'); // Fallback to system beep
    return;
  }

  try {
    if (process.platform === 'linux') {
      try {
        // Fix for PipeWire/PulseAudio suspended audio sinks
        // Play sound twice: first play wakes up the sink, second actually produces audio
        execAudioCommand(`paplay "${soundFile}" 2>/dev/null || true`);
        execAudioCommand(`paplay "${soundFile}"`);
      } catch (e) {
        try {
          execAudioCommand(`aplay "${soundFile}"`);
        } catch (e2) {
          try {
            execAudioCommand(`play "${soundFile}"`);
          } catch (e3) {
            process.stdout.write('\x07');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        execAudioCommand(`afplay "${soundFile}"`);
      } catch (e) {
        process.stdout.write('\x07');
      }
    } else {
      process.stdout.write('\x07');
    }
  } catch (error) {
    process.stdout.write('\x07');
  }
}

function triggerWebhook() {
  if (!config.webhook || !config.webhook.enabled || !config.webhook.url) {
    return;
  }

  const { url } = config.webhook;
  const format = (config.webhook.format || 'json').toLowerCase();
  const timeoutMs = getWebhookTimeoutMs(config.webhook.timeoutMs);
  const protocol = url.startsWith('https') ? https : http;

  let data;
  let headers;

  if (format === 'ntfy') {
    // ntfy native HTTP publish: POST plain-text body to https://server/<topic>.
    // Headers are passed unprefixed (Title, Priority, Tags). ntfy accepts both
    // the unprefixed and X-* forms. See https://docs.ntfy.sh/publish/
    const body = (typeof config.webhook.body === 'string' && config.webhook.body.length > 0)
      ? config.webhook.body
      : 'Claude is waiting for you...';
    data = Buffer.from(body, 'utf8');
    headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': data.length
    };
    if (config.webhook.headers && typeof config.webhook.headers === 'object') {
      for (const [k, v] of Object.entries(config.webhook.headers)) {
        if (v === null || v === undefined) continue;
        headers[k] = String(v);
      }
    }
  } else {
    // Backwards-compatible JSON path. Unchanged behavior.
    data = JSON.stringify({ message: 'Claude is waiting for you...' });
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
  }

  const options = {
    method: 'POST',
    headers
  };

  let req;
  let timeoutHandle;
  let requestDone = false;
  let timeoutTriggered = false;

  const cleanup = () => {
    requestDone = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };

  const abortForTimeout = () => {
    if (requestDone || timeoutTriggered) {
      return;
    }
    timeoutTriggered = true;
    const timeoutError = new Error(`timed out after ${timeoutMs}ms`);
    timeoutError.code = 'ETIMEDOUT';
    req.destroy(timeoutError);
  };

  try {
    req = protocol.request(url, options, (res) => {
      // We don't really care about the response, but draining it lets Node exit.
      res.on('end', cleanup);
      res.on('close', cleanup);
      res.resume();
    });
  } catch (error) {
    console.error('Error triggering webhook:', formatWebhookError(error));
    return;
  }

  timeoutHandle = setTimeout(abortForTimeout, timeoutMs);
  if (typeof timeoutHandle.unref === 'function') {
    timeoutHandle.unref();
  }
  if (typeof req.setTimeout === 'function') {
    req.setTimeout(timeoutMs, abortForTimeout);
  }

  req.on('error', (error) => {
    cleanup();
    console.error('Error triggering webhook:', formatWebhookError(error));
  });
  req.on('close', cleanup);

  try {
    req.write(data);
    req.end();
  } catch (error) {
    cleanup();
    if (typeof req.destroy === 'function') {
      req.destroy();
    }
    console.error('Error triggering webhook:', formatWebhookError(error));
  }
}

function getWebhookTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  return DEFAULT_WEBHOOK_TIMEOUT_MS;
}

function formatWebhookError(error) {
  if (!error) {
    return 'unknown error';
  }
  if (error.code === 'ETIMEDOUT') {
    return error.message || 'timed out';
  }
  if (error.code && error.message) {
    return `${error.code}: ${error.message}`;
  }
  return error.message || String(error);
}

function triggerZellijVisualization() {
  // Check if Zellij visualization is enabled
  if (!config.zellijVisualization || !config.zellijVisualization.enabled) {
    return;
  }

  // Check if we're running inside a Zellij session
  if (!process.env.ZELLIJ) {
    return;
  }

  const {
    pluginName,
    notificationType,
    title,
    message,
    priority
  } = config.zellijVisualization;

  // Construct the notification payload
  const notification = {
    type: notificationType,
    message: message,
    title: title,
    source: 'claude-code',
    priority: priority,
    timestamp: Date.now()
  };

  const payload = JSON.stringify(notification);

  try {
    // Use zellij pipe to send notification to the plugin
    execSync(`zellij pipe -p ${pluginName} -- '${payload}'`, {
      stdio: 'ignore',
      timeout: 2000  // 2 second timeout
    });
  } catch (error) {
    // Silently fail - don't interrupt the notification flow
    // User might not have the plugin installed
  }
}

function showNotification() {
  const notifier = require('node-notifier');
  
  notifier.notify({
    title: 'Claude Code',
    message: 'Waiting for you...',
    icon: path.join(os.homedir(), 'Pictures', 'claude.png'),
    sound: false,
    urgency: 'critical',
    id: 'claude-code-notification',
    replaceId: 'claude-code-notification'
  });
}

function showConfigInfo() {
  const configPath = path.join(os.homedir(), '.config', 'claude-notifications', 'settings.json');
  const soundsDir = path.join(os.homedir(), '.config', 'claude-notifications', 'sounds');
  
  console.log('🔍 Claude Notifications Config Debug Info:');
  console.log('');
  console.log('📁 Config file location:');
  console.log(`   ${configPath}`);
  console.log(`   Exists: ${fs.existsSync(configPath) ? '✅' : '❌'}`);
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      console.log('   Content:');
      console.log(`   ${configContent.split('\n').map(line => `   ${line}`).join('\n')}`);
    } catch (error) {
      console.log(`   Error reading: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🔊 Sounds directory:');
  console.log(`   ${soundsDir}`);
  console.log(`   Exists: ${fs.existsSync(soundsDir) ? '✅' : '❌'}`);
  
  if (fs.existsSync(soundsDir)) {
    try {
      const soundFiles = fs.readdirSync(soundsDir);
      console.log('   Files:');
      soundFiles.forEach(file => {
        const filePath = path.join(soundsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } catch (error) {
      console.log(`   Error reading directory: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('⚙️  Current config values:');
  console.log(`   sound: ${config.sound}`);
  console.log(`   soundType: ${config.soundType}`);
  console.log(`   desktopNotification: ${config.desktopNotification}`);
  console.log(`   webhook.enabled: ${config.webhook.enabled}`);
  
  console.log('');
  console.log('🎵 Sound file paths:');
  const { SOUND_TYPES, getSoundPath } = require('../lib/config');
  Object.values(SOUND_TYPES).forEach(soundType => {
    const soundPath = getSoundPath(soundType);
    console.log(`   ${soundType}: ${soundPath}`);
    console.log(`   Exists: ${fs.existsSync(soundPath) ? '✅' : '❌'}`);
  });
  
  console.log('');
  console.log('🔧 Command line args:');
  console.log(`   useBell: ${useBell}`);
  console.log(`   showConfig: ${showConfig}`);
}

function main() {
  if (showConfig) {
    showConfigInfo();
    return;
  }

  // Always try to trigger Zellij visualization if enabled
  triggerZellijVisualization();

  if (config.webhook.enabled) {
    if (!config.webhook.replaceSound) {
      // Audio playback is synchronous; if it runs after opening the HTTP
      // request, it can block Node's event loop long enough for our own
      // webhook timeout to fire before the socket gets serviced.
      playSound();
    }
    triggerWebhook();
  } else {
    playSound();
    if (config.desktopNotification) {
      showNotification();
    }
  }
}

if (require.main === module) {
  main();
}
