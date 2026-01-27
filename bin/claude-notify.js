#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { getConfig, getSoundPath, SOUND_TYPES } = require('../lib/config');

const config = getConfig();

// Check for command line arguments
const args = process.argv.slice(2);
const useBell = args.includes('--bell') || args.includes('-b');
const showConfig = args.includes('-c') || args.includes('--config');
const listenMode = args.includes('--listen');
const listenOnce = args.includes('--once');

function getArgValue(flag) {
  const directIndex = args.indexOf(flag);
  if (directIndex !== -1 && directIndex < args.length - 1) {
    return args[directIndex + 1];
  }

  const prefix = `${flag}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  if (match) {
    return match.slice(prefix.length);
  }

  return null;
}

function isSshSession() {
  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY);
}

function resolveSoundType({ soundTypeOverride, bellOverride } = {}) {
  if (soundTypeOverride && Object.values(SOUND_TYPES).includes(soundTypeOverride)) {
    return soundTypeOverride;
  }

  if (bellOverride || useBell) {
    return SOUND_TYPES.BELL;
  }

  return config.soundType || SOUND_TYPES.HARP;
}

function playSound({ soundTypeOverride, bellOverride } = {}) {
  if (!config.sound) {
    return;
  }

  const soundType = resolveSoundType({ soundTypeOverride, bellOverride });
  const soundFile = getSoundPath(soundType);

  if (!fs.existsSync(soundFile)) {
    console.warn(`Sound file not found: ${soundFile}`);
    return;
  }

  try {
    if (process.platform === 'linux') {
      try {
        execSync(`paplay "${soundFile}"`, { stdio: 'ignore' });
      } catch (e) {
        try {
          execSync(`aplay "${soundFile}"`, { stdio: 'ignore' });
        } catch (e2) {
          try {
            execSync(`play "${soundFile}"`, { stdio: 'ignore' });
          } catch (e3) {}
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        execSync(`afplay "${soundFile}"`, { stdio: 'ignore' });
      } catch (e) {}
    }
  } catch (error) {}
}

function resolveRemoteSoundConfig() {
  const remoteConfig = config.remoteSound || {};
  const envUrl = process.env.CLAUDE_NOTIFY_REMOTE_URL || process.env.CLAUDE_NOTIFY_REMOTE;
  const envPort = process.env.CLAUDE_NOTIFY_REMOTE_PORT;

  const enabled = Boolean(
    remoteConfig.enabled ||
    envUrl ||
    envPort ||
    remoteConfig.url ||
    remoteConfig.port
  );

  if (!enabled) {
    return null;
  }

  const port = envPort || remoteConfig.port;
  const url =
    envUrl ||
    remoteConfig.url ||
    (port ? `http://127.0.0.1:${port}/notify` : null);

  if (!url) {
    return null;
  }

  return {
    url,
    replaceSound: Boolean(remoteConfig.replaceSound),
    timeoutMs: Number(remoteConfig.timeoutMs) || 1500,
  };
}

function sendJson(url, payload, timeoutMs) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      resolve(false);
      return;
    }

    const data = JSON.stringify(payload);
    const protocol = target.protocol === 'https:' ? https : http;

    const req = protocol.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve(ok);
        });
      }
    );

    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function triggerRemoteSound(soundType) {
  const remoteConfig = resolveRemoteSoundConfig();
  if (!remoteConfig || !isSshSession()) {
    return false;
  }

  const payload = {
    soundType,
    message: 'Claude is waiting for you...',
    source: 'claude-notify',
    timestamp: Date.now(),
  };

  const delivered = await sendJson(remoteConfig.url, payload, remoteConfig.timeoutMs);
  return delivered ? remoteConfig.replaceSound : false;
}

function startRemoteListener() {
  const port =
    Number(getArgValue('--port')) ||
    Number(process.env.CLAUDE_NOTIFY_LISTEN_PORT) ||
    Number((config.remoteSound && config.remoteSound.port) || 0) ||
    17777;
  const host =
    getArgValue('--host') ||
    process.env.CLAUDE_NOTIFY_LISTEN_HOST ||
    '127.0.0.1';

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/notify') {
      res.statusCode = 404;
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        req.destroy();
      }
    });

    req.on('end', () => {
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch (error) {
        res.statusCode = 400;
        res.end();
        return;
      }

      const soundType = resolveSoundType({
        soundTypeOverride: payload.soundType,
        bellOverride: payload.bell === true,
      });
      playSound({ soundTypeOverride: soundType });

      res.statusCode = 204;
      res.end();

      if (listenOnce) {
        server.close();
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`🔊 Remote sound listener ready on ${host}:${port}`);
  });
}

function triggerWebhook() {
  if (!config.webhook || !config.webhook.enabled || !config.webhook.url) {
    return;
  }

  const { url } = config.webhook;
  const data = JSON.stringify({ message: 'Claude is waiting for you...' });

  const protocol = url.startsWith('https') ? https : http;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = protocol.request(url, options, (res) => {
    // We don't really care about the response, but it's good practice to handle it
    res.on('data', () => {});
    res.on('end', () => {});
  });

  req.on('error', (error) => {
    console.error('Error triggering webhook:', error);
  });

  req.write(data);
  req.end();
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
  // Escape single quotes in JSON for shell
  const escapedPayload = payload.replace(/'/g, "'\"'\"'");

  try {
    // Use --plugin to target the specific plugin file, --name is the pipe identifier
    const pluginPath = 'file:/home/delorenj/.config/zellij/plugins/zellij_visual_notifications.wasm';
    execSync(`zellij pipe --plugin ${pluginPath} --name notification -- '${escapedPayload}'`, {
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
  console.log(`   listenMode: ${listenMode}`);

  console.log('');
  console.log('🌐 Remote sound config:');
  const remoteConfig = resolveRemoteSoundConfig();
  if (remoteConfig) {
    console.log(`   url: ${remoteConfig.url}`);
    console.log(`   replaceSound: ${remoteConfig.replaceSound}`);
    console.log(`   timeoutMs: ${remoteConfig.timeoutMs}`);
  } else {
    console.log('   disabled');
  }
}

async function main() {
  if (showConfig) {
    showConfigInfo();
    return;
  }

  if (listenMode) {
    startRemoteListener();
    return;
  }

  // Always try to trigger Zellij visualization if enabled
  triggerZellijVisualization();

  if (config.webhook.enabled) {
    triggerWebhook();
  }

  const shouldPlaySound = config.sound && !(config.webhook.enabled && config.webhook.replaceSound);
  if (shouldPlaySound) {
    const soundType = resolveSoundType();
    const remoteReplaced = await triggerRemoteSound(soundType);
    if (!remoteReplaced) {
      playSound({ soundTypeOverride: soundType });
    }
  }

  if (!config.webhook.enabled && config.desktopNotification) {
    showNotification();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error running claude-notify:', error);
    process.exit(1);
  });
}
