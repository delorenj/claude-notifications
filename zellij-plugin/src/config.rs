//! Configuration module for Zellij Visual Notifications
//!
//! Handles KDL configuration parsing, validation, and hot-reload functionality.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Main plugin configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Enable/disable the plugin
    pub enabled: bool,
    /// Theme configuration
    pub theme: ThemeConfig,
    /// Animation configuration
    pub animation: AnimationConfig,
    /// Accessibility configuration
    pub accessibility: AccessibilityConfig,
    /// Notification timeout in milliseconds
    pub notification_timeout_ms: u64,
    /// Maximum queue size
    pub queue_max_size: usize,
    /// Enable status bar widget
    pub show_status_bar: bool,
    /// Enable pane border colors
    pub show_border_colors: bool,
    /// Enable tab badges
    pub show_tab_badges: bool,
    /// IPC socket path (for external communication)
    pub ipc_socket_path: Option<String>,
    /// Debug mode
    pub debug: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: true,
            theme: ThemeConfig::default(),
            animation: AnimationConfig::default(),
            accessibility: AccessibilityConfig::default(),
            notification_timeout_ms: 300_000, // 5 minutes
            queue_max_size: 100,
            show_status_bar: true,
            show_border_colors: true,
            show_tab_badges: true,
            ipc_socket_path: None,
            debug: false,
        }
    }
}

impl Config {
    /// Create configuration from Zellij plugin configuration map
    pub fn from_plugin_config(config_map: &BTreeMap<String, String>) -> Self {
        let mut config = Config::default();

        // Parse boolean options
        if let Some(enabled) = config_map.get("enabled") {
            config.enabled = enabled.parse().unwrap_or(true);
        }
        if let Some(debug) = config_map.get("debug") {
            config.debug = debug.parse().unwrap_or(false);
        }
        if let Some(show_status_bar) = config_map.get("show_status_bar") {
            config.show_status_bar = show_status_bar.parse().unwrap_or(true);
        }
        if let Some(show_border_colors) = config_map.get("show_border_colors") {
            config.show_border_colors = show_border_colors.parse().unwrap_or(true);
        }
        if let Some(show_tab_badges) = config_map.get("show_tab_badges") {
            config.show_tab_badges = show_tab_badges.parse().unwrap_or(true);
        }

        // Parse numeric options
        if let Some(timeout) = config_map.get("notification_timeout_ms") {
            config.notification_timeout_ms = timeout.parse().unwrap_or(300_000);
        }
        if let Some(max_size) = config_map.get("queue_max_size") {
            config.queue_max_size = max_size.parse().unwrap_or(100);
        }

        // Parse theme
        if let Some(theme_name) = config_map.get("theme") {
            config.theme = ThemeConfig::from_preset(theme_name);
        }

        // Parse individual colors
        if let Some(success_color) = config_map.get("success_color") {
            config.theme.success_color = success_color.clone();
        }
        if let Some(error_color) = config_map.get("error_color") {
            config.theme.error_color = error_color.clone();
        }
        if let Some(warning_color) = config_map.get("warning_color") {
            config.theme.warning_color = warning_color.clone();
        }
        if let Some(info_color) = config_map.get("info_color") {
            config.theme.info_color = info_color.clone();
        }

        // Parse animation settings
        if let Some(animation_enabled) = config_map.get("animation_enabled") {
            config.animation.enabled = animation_enabled.parse().unwrap_or(true);
        }
        if let Some(animation_style) = config_map.get("animation_style") {
            config.animation.style = AnimationStyle::from_str(animation_style);
        }
        if let Some(animation_speed) = config_map.get("animation_speed") {
            config.animation.speed = animation_speed.parse().unwrap_or(50);
        }
        if let Some(animation_cycles) = config_map.get("animation_cycles") {
            config.animation.cycles = animation_cycles.parse().unwrap_or(3);
        }

        // Parse accessibility settings
        if let Some(high_contrast) = config_map.get("high_contrast") {
            config.accessibility.high_contrast = high_contrast.parse().unwrap_or(false);
        }
        if let Some(reduced_motion) = config_map.get("reduced_motion") {
            config.accessibility.reduced_motion = reduced_motion.parse().unwrap_or(false);
            if config.accessibility.reduced_motion {
                config.animation.enabled = false;
            }
        }

        // Parse IPC socket path
        if let Some(ipc_path) = config_map.get("ipc_socket_path") {
            config.ipc_socket_path = Some(ipc_path.clone());
        }

        config
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.notification_timeout_ms < 1000 {
            return Err("notification_timeout_ms must be at least 1000ms".to_string());
        }
        if self.queue_max_size < 1 {
            return Err("queue_max_size must be at least 1".to_string());
        }
        if self.animation.speed < 1 || self.animation.speed > 100 {
            return Err("animation_speed must be between 1 and 100".to_string());
        }
        if self.animation.cycles < 1 || self.animation.cycles > 10 {
            return Err("animation_cycles must be between 1 and 10".to_string());
        }
        Ok(())
    }
}

/// Theme configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    /// Theme name/preset
    pub name: String,
    /// Success notification color (green by default)
    pub success_color: String,
    /// Error notification color (red by default)
    pub error_color: String,
    /// Warning notification color (yellow by default)
    pub warning_color: String,
    /// Info notification color (blue by default)
    pub info_color: String,
    /// Background color for status bar
    pub background_color: String,
    /// Foreground/text color
    pub foreground_color: String,
    /// Border highlight color
    pub highlight_color: String,
    /// Dimmed/muted color
    pub dimmed_color: String,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            success_color: "#22c55e".to_string(), // Green
            error_color: "#ef4444".to_string(),   // Red
            warning_color: "#eab308".to_string(), // Yellow
            info_color: "#3b82f6".to_string(),    // Blue
            background_color: "#1e1e2e".to_string(),
            foreground_color: "#cdd6f4".to_string(),
            highlight_color: "#89b4fa".to_string(),
            dimmed_color: "#6c7086".to_string(),
        }
    }
}

impl ThemeConfig {
    /// Create a theme from a preset name
    pub fn from_preset(name: &str) -> Self {
        match name.to_lowercase().as_str() {
            "dracula" => Self::dracula(),
            "nord" => Self::nord(),
            "solarized" | "solarized-dark" => Self::solarized_dark(),
            "solarized-light" => Self::solarized_light(),
            "catppuccin" | "catppuccin-mocha" => Self::catppuccin_mocha(),
            "catppuccin-latte" => Self::catppuccin_latte(),
            "gruvbox" | "gruvbox-dark" => Self::gruvbox_dark(),
            "gruvbox-light" => Self::gruvbox_light(),
            "tokyo-night" => Self::tokyo_night(),
            "one-dark" => Self::one_dark(),
            _ => Self::default(),
        }
    }

    /// Dracula theme
    fn dracula() -> Self {
        Self {
            name: "dracula".to_string(),
            success_color: "#50fa7b".to_string(),
            error_color: "#ff5555".to_string(),
            warning_color: "#f1fa8c".to_string(),
            info_color: "#8be9fd".to_string(),
            background_color: "#282a36".to_string(),
            foreground_color: "#f8f8f2".to_string(),
            highlight_color: "#bd93f9".to_string(),
            dimmed_color: "#6272a4".to_string(),
        }
    }

    /// Nord theme
    fn nord() -> Self {
        Self {
            name: "nord".to_string(),
            success_color: "#a3be8c".to_string(),
            error_color: "#bf616a".to_string(),
            warning_color: "#ebcb8b".to_string(),
            info_color: "#81a1c1".to_string(),
            background_color: "#2e3440".to_string(),
            foreground_color: "#eceff4".to_string(),
            highlight_color: "#88c0d0".to_string(),
            dimmed_color: "#4c566a".to_string(),
        }
    }

    /// Solarized Dark theme
    fn solarized_dark() -> Self {
        Self {
            name: "solarized-dark".to_string(),
            success_color: "#859900".to_string(),
            error_color: "#dc322f".to_string(),
            warning_color: "#b58900".to_string(),
            info_color: "#268bd2".to_string(),
            background_color: "#002b36".to_string(),
            foreground_color: "#839496".to_string(),
            highlight_color: "#2aa198".to_string(),
            dimmed_color: "#586e75".to_string(),
        }
    }

    /// Solarized Light theme
    fn solarized_light() -> Self {
        Self {
            name: "solarized-light".to_string(),
            success_color: "#859900".to_string(),
            error_color: "#dc322f".to_string(),
            warning_color: "#b58900".to_string(),
            info_color: "#268bd2".to_string(),
            background_color: "#fdf6e3".to_string(),
            foreground_color: "#657b83".to_string(),
            highlight_color: "#2aa198".to_string(),
            dimmed_color: "#93a1a1".to_string(),
        }
    }

    /// Catppuccin Mocha theme
    fn catppuccin_mocha() -> Self {
        Self {
            name: "catppuccin-mocha".to_string(),
            success_color: "#a6e3a1".to_string(),
            error_color: "#f38ba8".to_string(),
            warning_color: "#f9e2af".to_string(),
            info_color: "#89b4fa".to_string(),
            background_color: "#1e1e2e".to_string(),
            foreground_color: "#cdd6f4".to_string(),
            highlight_color: "#cba6f7".to_string(),
            dimmed_color: "#6c7086".to_string(),
        }
    }

    /// Catppuccin Latte theme (light)
    fn catppuccin_latte() -> Self {
        Self {
            name: "catppuccin-latte".to_string(),
            success_color: "#40a02b".to_string(),
            error_color: "#d20f39".to_string(),
            warning_color: "#df8e1d".to_string(),
            info_color: "#1e66f5".to_string(),
            background_color: "#eff1f5".to_string(),
            foreground_color: "#4c4f69".to_string(),
            highlight_color: "#8839ef".to_string(),
            dimmed_color: "#9ca0b0".to_string(),
        }
    }

    /// Gruvbox Dark theme
    fn gruvbox_dark() -> Self {
        Self {
            name: "gruvbox-dark".to_string(),
            success_color: "#b8bb26".to_string(),
            error_color: "#fb4934".to_string(),
            warning_color: "#fabd2f".to_string(),
            info_color: "#83a598".to_string(),
            background_color: "#282828".to_string(),
            foreground_color: "#ebdbb2".to_string(),
            highlight_color: "#d3869b".to_string(),
            dimmed_color: "#928374".to_string(),
        }
    }

    /// Gruvbox Light theme
    fn gruvbox_light() -> Self {
        Self {
            name: "gruvbox-light".to_string(),
            success_color: "#79740e".to_string(),
            error_color: "#9d0006".to_string(),
            warning_color: "#b57614".to_string(),
            info_color: "#076678".to_string(),
            background_color: "#fbf1c7".to_string(),
            foreground_color: "#3c3836".to_string(),
            highlight_color: "#8f3f71".to_string(),
            dimmed_color: "#928374".to_string(),
        }
    }

    /// Tokyo Night theme
    fn tokyo_night() -> Self {
        Self {
            name: "tokyo-night".to_string(),
            success_color: "#9ece6a".to_string(),
            error_color: "#f7768e".to_string(),
            warning_color: "#e0af68".to_string(),
            info_color: "#7aa2f7".to_string(),
            background_color: "#1a1b26".to_string(),
            foreground_color: "#c0caf5".to_string(),
            highlight_color: "#bb9af7".to_string(),
            dimmed_color: "#565f89".to_string(),
        }
    }

    /// One Dark theme
    fn one_dark() -> Self {
        Self {
            name: "one-dark".to_string(),
            success_color: "#98c379".to_string(),
            error_color: "#e06c75".to_string(),
            warning_color: "#e5c07b".to_string(),
            info_color: "#61afef".to_string(),
            background_color: "#282c34".to_string(),
            foreground_color: "#abb2bf".to_string(),
            highlight_color: "#c678dd".to_string(),
            dimmed_color: "#5c6370".to_string(),
        }
    }
}

/// Animation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationConfig {
    /// Enable/disable animations
    pub enabled: bool,
    /// Animation style
    pub style: AnimationStyle,
    /// Animation speed (1-100, higher = faster)
    pub speed: u8,
    /// Number of animation cycles
    pub cycles: u8,
    /// Duration in milliseconds
    pub duration_ms: u64,
}

impl Default for AnimationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            style: AnimationStyle::Pulse,
            speed: 50,
            cycles: 3,
            duration_ms: 2000,
        }
    }
}

/// Animation styles
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AnimationStyle {
    /// Pulse animation (gentle fade in/out)
    Pulse,
    /// Flash animation (quick blink)
    Flash,
    /// Fade animation (slow fade out)
    Fade,
    /// Breathe animation (smooth sine wave)
    Breathe,
    /// None (static, no animation)
    None,
}

impl Default for AnimationStyle {
    fn default() -> Self {
        Self::Pulse
    }
}

impl AnimationStyle {
    /// Parse animation style from string
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "pulse" => Self::Pulse,
            "flash" => Self::Flash,
            "fade" => Self::Fade,
            "breathe" => Self::Breathe,
            "none" | "disabled" => Self::None,
            _ => Self::Pulse,
        }
    }
}

/// Accessibility configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityConfig {
    /// Enable high contrast mode
    pub high_contrast: bool,
    /// Enable reduced motion mode (disables animations)
    pub reduced_motion: bool,
    /// Enable screen reader announcements
    pub screen_reader: bool,
    /// Use patterns in addition to colors
    pub use_patterns: bool,
}

impl Default for AccessibilityConfig {
    fn default() -> Self {
        Self {
            high_contrast: false,
            reduced_motion: false,
            screen_reader: false,
            use_patterns: true,
        }
    }
}

/// Configuration manager for hot-reload
#[derive(Default)]
pub struct ConfigManager {
    /// Last known configuration
    last_config: Option<Config>,
    /// Configuration file path
    config_path: Option<String>,
}

impl ConfigManager {
    /// Create a new configuration manager
    pub fn new() -> Self {
        Self {
            last_config: None,
            config_path: None,
        }
    }

    /// Set the configuration file path
    pub fn set_path(&mut self, path: &str) {
        self.config_path = Some(path.to_string());
    }

    /// Reload configuration from file
    pub fn reload(&mut self) -> Option<Config> {
        // In WASM environment, we can't directly read files
        // This would need to be triggered by a custom message from the host
        // For now, return None to indicate no change
        None
    }

    /// Parse KDL configuration string
    pub fn parse_kdl(&self, content: &str) -> Result<Config, String> {
        // Parse KDL content (kdl 4.x uses str::parse)
        let doc: kdl::KdlDocument = content.parse()
            .map_err(|e: kdl::KdlError| format!("KDL parse error: {}", e))?;

        let mut config = Config::default();

        // Parse the document
        for node in doc.nodes() {
            match node.name().value() {
                "enabled" => {
                    if let Some(val) = node.get(0) {
                        config.enabled = val.value().as_bool().unwrap_or(true);
                    }
                }
                "theme" => {
                    if let Some(val) = node.get(0) {
                        if let Some(name) = val.value().as_string() {
                            config.theme = ThemeConfig::from_preset(name);
                        }
                    }
                    // Parse nested theme properties
                    if let Some(children) = node.children() {
                        for child in children.nodes() {
                            match child.name().value() {
                                "success_color" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(color) = val.value().as_string() {
                                            config.theme.success_color = color.to_string();
                                        }
                                    }
                                }
                                "error_color" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(color) = val.value().as_string() {
                                            config.theme.error_color = color.to_string();
                                        }
                                    }
                                }
                                "warning_color" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(color) = val.value().as_string() {
                                            config.theme.warning_color = color.to_string();
                                        }
                                    }
                                }
                                "info_color" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(color) = val.value().as_string() {
                                            config.theme.info_color = color.to_string();
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
                "animation" => {
                    if let Some(children) = node.children() {
                        for child in children.nodes() {
                            match child.name().value() {
                                "enabled" => {
                                    if let Some(val) = child.get(0) {
                                        config.animation.enabled = val.value().as_bool().unwrap_or(true);
                                    }
                                }
                                "style" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(style) = val.value().as_string() {
                                            config.animation.style = AnimationStyle::from_str(style);
                                        }
                                    }
                                }
                                "speed" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(speed) = val.value().as_i64() {
                                            config.animation.speed = speed.clamp(1, 100) as u8;
                                        }
                                    }
                                }
                                "cycles" => {
                                    if let Some(val) = child.get(0) {
                                        if let Some(cycles) = val.value().as_i64() {
                                            config.animation.cycles = cycles.clamp(1, 10) as u8;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
                "accessibility" => {
                    if let Some(children) = node.children() {
                        for child in children.nodes() {
                            match child.name().value() {
                                "high_contrast" => {
                                    if let Some(val) = child.get(0) {
                                        config.accessibility.high_contrast = val.value().as_bool().unwrap_or(false);
                                    }
                                }
                                "reduced_motion" => {
                                    if let Some(val) = child.get(0) {
                                        config.accessibility.reduced_motion = val.value().as_bool().unwrap_or(false);
                                        if config.accessibility.reduced_motion {
                                            config.animation.enabled = false;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
                "notification_timeout_ms" => {
                    if let Some(val) = node.get(0) {
                        if let Some(timeout) = val.value().as_i64() {
                            config.notification_timeout_ms = timeout.max(1000) as u64;
                        }
                    }
                }
                "queue_max_size" => {
                    if let Some(val) = node.get(0) {
                        if let Some(size) = val.value().as_i64() {
                            config.queue_max_size = size.max(1) as usize;
                        }
                    }
                }
                _ => {}
            }
        }

        config.validate()?;
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.enabled);
        assert!(config.animation.enabled);
        assert_eq!(config.animation.style, AnimationStyle::Pulse);
    }

    #[test]
    fn test_theme_presets() {
        let themes = vec![
            "dracula", "nord", "solarized", "catppuccin", "gruvbox", "tokyo-night", "one-dark"
        ];

        for theme_name in themes {
            let theme = ThemeConfig::from_preset(theme_name);
            assert!(!theme.success_color.is_empty());
            assert!(!theme.error_color.is_empty());
        }
    }

    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        assert!(config.validate().is_ok());

        config.notification_timeout_ms = 100;
        assert!(config.validate().is_err());

        config.notification_timeout_ms = 5000;
        config.queue_max_size = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_animation_style_parsing() {
        assert_eq!(AnimationStyle::from_str("pulse"), AnimationStyle::Pulse);
        assert_eq!(AnimationStyle::from_str("FLASH"), AnimationStyle::Flash);
        assert_eq!(AnimationStyle::from_str("fade"), AnimationStyle::Fade);
        assert_eq!(AnimationStyle::from_str("breathe"), AnimationStyle::Breathe);
        assert_eq!(AnimationStyle::from_str("none"), AnimationStyle::None);
        assert_eq!(AnimationStyle::from_str("invalid"), AnimationStyle::Pulse);
    }
}
