const fs = require('fs');
const path = require('path');
const os = require('os');

let whichLib;
try {
  whichLib = require('which');
} catch (_err) {
  whichLib = null;
}

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
    zellijVisualization: {
      enabled: true,  // Enable by default if in Zellij
      pluginName: 'zellij_visual_notifications',  // Default plugin name
      notificationType: 'attention',  // Default notification type
      title: 'Claude Code',  // Default title
      message: 'Waiting for you...',  // Default message
      priority: 'high'  // Default priority
    },
    webhook: {
      enabled: false,
      url: null,
      // 'json' (default, legacy) or 'ntfy'
      format: 'json',
      // Used when format === 'ntfy'. Sent as HTTP headers on the publish request.
      // ntfy accepts unprefixed Title/Priority/Tags alongside the X-* forms.
      headers: {},
      // Used when format === 'ntfy'. Plain-text message body.
      body: 'Claude is waiting for you...',
      // Keep webhook calls bounded so Claude Stop hooks cannot hang on HTTP.
      timeoutMs: 1500,
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
    
    return {
      ...defaultConfig,
      ...userConfig,
      webhook: {
        ...defaultConfig.webhook,
        ...((userConfig.webhook && typeof userConfig.webhook === 'object')
          ? userConfig.webhook
          : {})
      }
    };
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

function cleanupLegacySoundFiles(options = {}) {
  const { quiet = false } = options;
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
            if (!quiet) console.log(`✅ Removed legacy sound file: ${filePath}`);
            cleanedCount++;
          } catch (error) {
            if (!quiet) console.error(`❌ Failed to remove legacy sound file ${filePath}:`, error);
          }
        }
      });
      
      // Try to remove empty directory if it only contained our files
      try {
        const remainingFiles = fs.readdirSync(dir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(dir);
          if (!quiet) console.log(`✅ Removed empty legacy directory: ${dir}`);
        }
      } catch (error) {
        // Directory not empty or can't be removed, that's fine
      }
    }
  });
  
  if (cleanedCount > 0) {
    if (!quiet) console.log(`✅ Cleaned up ${cleanedCount} legacy sound file(s)`);
  }
  
  return cleanedCount;
}

/**
 * Resolve the `claude-notify` binary on $PATH. Returns an absolute path or null.
 * Adapters call this to validate the hook target before touching any CLI config.
 */
async function notifyBinaryPath() {
  if (!whichLib) return null;
  try {
    if (typeof whichLib === 'function') {
      return (await whichLib('claude-notify', { nothrow: true })) || null;
    }
    if (typeof whichLib.sync === 'function') {
      return whichLib.sync('claude-notify', { nothrow: true }) || null;
    }
  } catch (_err) {
    return null;
  }
  return null;
}

module.exports = {
  getConfig,
  getSoundPath,
  ensureConfigDirectory,
  ensureSoundsDirectory,
  cleanupLegacySoundFiles,
  notifyBinaryPath,
  SOUND_TYPES,
  soundsDir,
  configPath
};
