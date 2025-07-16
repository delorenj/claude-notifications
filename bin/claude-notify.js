#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { getConfig } = require('../lib/config');

const config = getConfig();

function playSound() {
  if (!config.sound) {
    return;
  }

  const soundFile = path.join(os.homedir(), '.local', 'share', 'sounds', 'claude-notification.wav');
  
  if (!fs.existsSync(soundFile)) {
    process.stdout.write('\x07');
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
          } catch (e3) {
            process.stdout.write('\x07');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        execSync(`afplay "${soundFile}"`, { stdio: 'ignore' });
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

function showNotification() {
  const notifier = require('node-notifier');
  
  notifier.notify({
    title: 'Claude Code',
    message: 'Waiting for you...',
    icon: path.join(os.homedir(), 'Pictures', 'claude.png'),
    sound: false,
    urgency: 'critical'
  });
}

function main() {
  if (config.webhook.enabled) {
    triggerWebhook();
    if (!config.webhook.replaceSound) {
      playSound();
    }
  } else {
    playSound();
    showNotification();
  }
}

if (require.main === module) {
  main();
}
