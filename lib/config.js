const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.config', 'claude-notifications', 'settings.json');

function getConfig() {
  const defaultConfig = {
    sound: true,
    webhook: {
      enabled: false,
      url: null,
      replaceSound: false
    }
  };

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    console.error('Error reading or parsing config file:', error);
    return defaultConfig;
  }
}

module.exports = { getConfig };
