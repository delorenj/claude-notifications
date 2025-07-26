const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.config', 'claude-notifications', 'settings.json');
const soundsDir = path.join(os.homedir(), '.config', 'claude-notifications', 'sounds');

// Available sound types (filenames without extension)
const SOUND_TYPES = {
  HARP: 'claude-notification',
  BELL: 'claude-notification-bell'
};

function getConfig() {
  const defaultConfig = {
    sound: true,
    soundType: SOUND_TYPES.HARP,  // Default to harp sound
    desktopNotification: false,
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
    
    // Handle migration from old 'secondSound' config
    if (userConfig.secondSound === true && !userConfig.soundType) {
      userConfig.soundType = SOUND_TYPES.BELL;
      delete userConfig.secondSound;
    }
    
    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    console.error('Error reading or parsing config file:', error);
    return defaultConfig;
  }
}

function getSoundPath(soundType) {
  return path.join(soundsDir, `${soundType}.wav`);
}

function ensureSoundsDirectory() {
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
  }
}

module.exports = { 
  getConfig, 
  getSoundPath, 
  ensureSoundsDirectory,
  SOUND_TYPES,
  soundsDir 
};
