#!/usr/bin/env node

// Main entry point for @delorenj/claude-notifications
// This allows the package to be used programmatically as well

const { spawn } = require('child_process');
const path = require('path');

function notify() {
  return new Promise((resolve, reject) => {
    const notifyProcess = spawn('node', [path.join(__dirname, 'bin', 'claude-notify.js')], {
      stdio: 'inherit'
    });
    
    notifyProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Notification failed with code ${code}`));
      }
    });
  });
}

function install() {
  return new Promise((resolve, reject) => {
    const installProcess = spawn('node', [path.join(__dirname, 'bin', 'claude-notifications.js'), 'install'], {
      stdio: 'inherit'
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Installation failed with code ${code}`));
      }
    });
  });
}

module.exports = {
  notify,
  install
};

// If called directly, run the CLI
if (require.main === module) {
  const command = process.argv[2] || 'install';
  
  if (command === 'notify') {
    notify().catch(console.error);
  } else {
    install().catch(console.error);
  }
}
