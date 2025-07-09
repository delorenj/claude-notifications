#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🗑️  Cleaning up Claude Notifications...');

// Run the uninstaller
const uninstaller = spawn('node', [path.join(__dirname, 'bin', 'claude-notifications.js'), 'uninstall'], {
  stdio: 'inherit'
});

uninstaller.on('close', (code) => {
  console.log('👋 Thanks for using Claude Notifications!');
});
