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
    
    // Handle migration from old configurations
    let migrated = false;
    
    // Migration 1: old 'secondSound' config to 'soundType'
    if (userConfig.secondSound === true && !userConfig.soundType) {
      userConfig.soundType = SOUND_TYPES.BELL;
      delete userConfig.secondSound;
      migrated = true;
    }
    
    // Migration 2: ensure soundType is valid
    if (userConfig.soundType && !Object.values(SOUND_TYPES).includes(userConfig.soundType)) {
      console.warn(`Invalid soundType '${userConfig.soundType}', resetting to default`);
      userConfig.soundType = SOUND_TYPES.HARP;
      migrated = true;
    }
    
    // Save migrated config back to file
    if (migrated) {
      try {
        ensureConfigDirectory();
        fs.writeFileSync(configPath, JSON.stringify({ ...defaultConfig, ...userConfig }, null, 2));
        console.log('Configuration migrated successfully');
      } catch (writeError) {
        console.error('Failed to save migrated config:', writeError);
      }
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

function ensureConfigDirectory() {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function ensureSoundsDirectory() {
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
  }
}

function cleanupLegacySoundFiles() {
  // Clean up old sound files from legacy locations
  const legacyPaths = [
    // Legacy location 1: ~/.local/share/sounds/
    {
      dir: path.join(os.homedir(), '.local', 'share', 'sounds'),
      files: ['claude-notification.wav', 'claude-notification-bell.wav']
    },
    // Add more legacy paths here if needed in future migrations
  ];
  
  let cleanedCount = 0;
  
  legacyPaths.forEach(({ dir, files }) => {
    if (fs.existsSync(dir)) {
      files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`✅ Removed legacy sound file: ${filePath}`);
            cleanedCount++;
          } catch (error) {
            console.error(`❌ Failed to remove legacy sound file ${filePath}:`, error);
          }
        }
      });
      
      // Try to remove empty directory if it only contained our files
      try {
        const remainingFiles = fs.readdirSync(dir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(dir);
          console.log(`✅ Removed empty legacy directory: ${dir}`);
        }
      } catch (error) {
        // Directory not empty or can't be removed, that's fine
      }
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`✅ Cleaned up ${cleanedCount} legacy sound file(s)`);
  }
  
  return cleanedCount;
}

module.exports = { 
  getConfig, 
  getSoundPath, 
  ensureConfigDirectory,
  ensureSoundsDirectory,
  cleanupLegacySoundFiles,
  SOUND_TYPES,
  soundsDir,
  configPath
};
