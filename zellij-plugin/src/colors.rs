//! Color management module for Zellij Visual Notifications
//!
//! Handles terminal color capabilities, theme colors, and color interpolation for animations.

use crate::config::ThemeConfig;
use crate::notification::NotificationType;

/// Color manager for handling terminal colors
#[derive(Debug, Clone)]
pub struct ColorManager {
    /// Current theme configuration
    theme: ThemeConfig,
    /// Detected color capability
    color_capability: ColorCapability,
    /// High contrast mode enabled
    high_contrast: bool,
}

impl Default for ColorManager {
    fn default() -> Self {
        Self {
            theme: ThemeConfig::default(),
            color_capability: ColorCapability::TrueColor,
            high_contrast: false,
        }
    }
}

impl ColorManager {
    /// Create a new color manager with the given theme
    pub fn new(theme: &ThemeConfig) -> Self {
        Self {
            theme: theme.clone(),
            color_capability: Self::detect_capability(),
            high_contrast: false,
        }
    }

    /// Detect terminal color capability
    fn detect_capability() -> ColorCapability {
        // In WASM environment, we can't directly check environment variables
        // Default to TrueColor as Zellij supports it
        ColorCapability::TrueColor
    }

    /// Set high contrast mode
    pub fn set_high_contrast(&mut self, enabled: bool) {
        self.high_contrast = enabled;
    }

    /// Get the notification color based on type
    pub fn get_notification_color(&self, notification_type: &NotificationType) -> Option<String> {
        let base_color = match notification_type {
            NotificationType::Success => &self.theme.success_color,
            NotificationType::Error => &self.theme.error_color,
            NotificationType::Warning => &self.theme.warning_color,
            NotificationType::Info => &self.theme.info_color,
            NotificationType::Progress => &self.theme.highlight_color,
            NotificationType::Attention => &self.theme.warning_color,
        };

        Some(self.adjust_for_capability(base_color))
    }

    /// Get the background color
    pub fn get_background_color(&self) -> String {
        self.adjust_for_capability(&self.theme.background_color)
    }

    /// Get the foreground color
    pub fn get_foreground_color(&self) -> String {
        self.adjust_for_capability(&self.theme.foreground_color)
    }

    /// Get the dimmed color
    pub fn get_dimmed_color(&self) -> String {
        self.adjust_for_capability(&self.theme.dimmed_color)
    }

    /// Adjust color based on terminal capability and high contrast mode
    fn adjust_for_capability(&self, hex_color: &str) -> String {
        let color = Color::from_hex(hex_color);

        if self.high_contrast {
            // Increase contrast
            let adjusted = color.increase_contrast();
            return match self.color_capability {
                ColorCapability::TrueColor => adjusted.to_hex(),
                ColorCapability::Color256 => adjusted.to_ansi256().to_string(),
                ColorCapability::Color16 => adjusted.to_ansi16().to_string(),
            };
        }

        match self.color_capability {
            ColorCapability::TrueColor => hex_color.to_string(),
            ColorCapability::Color256 => color.to_ansi256().to_string(),
            ColorCapability::Color16 => color.to_ansi16().to_string(),
        }
    }

    /// Interpolate between two colors based on a factor (0.0 - 1.0)
    pub fn interpolate(&self, color1: &str, color2: &str, factor: f32) -> String {
        let c1 = Color::from_hex(color1);
        let c2 = Color::from_hex(color2);
        let result = c1.interpolate(&c2, factor);
        result.to_hex()
    }

    /// Apply brightness to a color
    pub fn apply_brightness(&self, hex_color: &str, brightness: f32) -> String {
        let color = Color::from_hex(hex_color);
        let adjusted = color.apply_brightness(brightness);
        adjusted.to_hex()
    }

    /// Get ANSI escape sequence for setting foreground color
    pub fn fg_escape(&self, hex_color: &str) -> String {
        let color = Color::from_hex(hex_color);
        match self.color_capability {
            ColorCapability::TrueColor => {
                format!("\x1b[38;2;{};{};{}m", color.r, color.g, color.b)
            }
            ColorCapability::Color256 => {
                format!("\x1b[38;5;{}m", color.to_ansi256())
            }
            ColorCapability::Color16 => {
                format!("\x1b[{}m", color.to_ansi16())
            }
        }
    }

    /// Get ANSI escape sequence for setting background color
    pub fn bg_escape(&self, hex_color: &str) -> String {
        let color = Color::from_hex(hex_color);
        match self.color_capability {
            ColorCapability::TrueColor => {
                format!("\x1b[48;2;{};{};{}m", color.r, color.g, color.b)
            }
            ColorCapability::Color256 => {
                format!("\x1b[48;5;{}m", color.to_ansi256())
            }
            ColorCapability::Color16 => {
                format!("\x1b[{}m", color.to_ansi16() + 10)
            }
        }
    }

    /// Get ANSI reset escape sequence
    pub fn reset_escape(&self) -> &'static str {
        "\x1b[0m"
    }
}

/// Terminal color capability levels
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ColorCapability {
    /// True color (24-bit RGB)
    TrueColor,
    /// 256 color mode
    Color256,
    /// 16 color mode (basic ANSI)
    Color16,
}

/// RGB Color representation
#[derive(Debug, Clone, Copy, Default)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Color {
    /// Create a new color from RGB values
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    /// Parse color from hex string (supports #RRGGBB and RRGGBB)
    pub fn from_hex(hex: &str) -> Self {
        let hex = hex.trim_start_matches('#');
        if hex.len() != 6 {
            return Self::default();
        }

        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);

        Self { r, g, b }
    }

    /// Convert to hex string
    pub fn to_hex(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }

    /// Convert to ANSI 256 color code
    pub fn to_ansi256(&self) -> u8 {
        // If it's a grayscale color
        if self.r == self.g && self.g == self.b {
            if self.r < 8 {
                return 16;
            }
            if self.r > 248 {
                return 231;
            }
            return ((self.r as f32 - 8.0) / 247.0 * 24.0) as u8 + 232;
        }

        // Convert to 6x6x6 color cube
        let r = (self.r as f32 / 255.0 * 5.0).round() as u8;
        let g = (self.g as f32 / 255.0 * 5.0).round() as u8;
        let b = (self.b as f32 / 255.0 * 5.0).round() as u8;

        16 + 36 * r + 6 * g + b
    }

    /// Convert to ANSI 16 color code
    pub fn to_ansi16(&self) -> u8 {
        let value = self.r.max(self.g).max(self.b);

        // If very dark, use black
        if value < 64 {
            return 30;
        }

        let mut code = 30;
        if self.r > 127 {
            code += 1;
        }
        if self.g > 127 {
            code += 2;
        }
        if self.b > 127 {
            code += 4;
        }

        // Use bright variants for light colors
        if value > 192 {
            code += 60;
        }

        code
    }

    /// Interpolate between two colors
    pub fn interpolate(&self, other: &Color, factor: f32) -> Color {
        let factor = factor.clamp(0.0, 1.0);
        Color {
            r: (self.r as f32 + (other.r as f32 - self.r as f32) * factor) as u8,
            g: (self.g as f32 + (other.g as f32 - self.g as f32) * factor) as u8,
            b: (self.b as f32 + (other.b as f32 - self.b as f32) * factor) as u8,
        }
    }

    /// Apply brightness multiplier (0.0 = black, 1.0 = original, >1.0 = brighter)
    pub fn apply_brightness(&self, brightness: f32) -> Color {
        Color {
            r: (self.r as f32 * brightness).min(255.0) as u8,
            g: (self.g as f32 * brightness).min(255.0) as u8,
            b: (self.b as f32 * brightness).min(255.0) as u8,
        }
    }

    /// Increase contrast (move towards white or black)
    pub fn increase_contrast(&self) -> Color {
        let luminance = 0.299 * self.r as f32 + 0.587 * self.g as f32 + 0.114 * self.b as f32;

        if luminance > 127.0 {
            // Make lighter
            Color {
                r: (self.r as f32 * 1.2).min(255.0) as u8,
                g: (self.g as f32 * 1.2).min(255.0) as u8,
                b: (self.b as f32 * 1.2).min(255.0) as u8,
            }
        } else {
            // Make darker or more saturated
            Color {
                r: (self.r as f32 * 0.9) as u8,
                g: (self.g as f32 * 0.9) as u8,
                b: (self.b as f32 * 0.9) as u8,
            }
        }
    }

    /// Calculate luminance (0.0 - 1.0)
    pub fn luminance(&self) -> f32 {
        (0.299 * self.r as f32 + 0.587 * self.g as f32 + 0.114 * self.b as f32) / 255.0
    }

    /// Check if color is considered "light"
    pub fn is_light(&self) -> bool {
        self.luminance() > 0.5
    }
}

/// Predefined colors for quick access
pub mod colors {
    use super::Color;

    pub const BLACK: Color = Color { r: 0, g: 0, b: 0 };
    pub const WHITE: Color = Color { r: 255, g: 255, b: 255 };
    pub const RED: Color = Color { r: 255, g: 0, b: 0 };
    pub const GREEN: Color = Color { r: 0, g: 255, b: 0 };
    pub const BLUE: Color = Color { r: 0, g: 0, b: 255 };
    pub const YELLOW: Color = Color { r: 255, g: 255, b: 0 };
    pub const CYAN: Color = Color { r: 0, g: 255, b: 255 };
    pub const MAGENTA: Color = Color { r: 255, g: 0, b: 255 };
}

/// Generate a color gradient for animations
pub fn generate_gradient(start: &Color, end: &Color, steps: usize) -> Vec<Color> {
    (0..steps)
        .map(|i| {
            let factor = i as f32 / (steps - 1) as f32;
            start.interpolate(end, factor)
        })
        .collect()
}

/// Generate a pulse gradient (start -> end -> start)
pub fn generate_pulse_gradient(base: &Color, bright: &Color, steps: usize) -> Vec<Color> {
    let half_steps = steps / 2;
    let mut gradient = Vec::with_capacity(steps);

    // First half: base -> bright
    for i in 0..half_steps {
        let factor = i as f32 / half_steps as f32;
        gradient.push(base.interpolate(bright, factor));
    }

    // Second half: bright -> base
    for i in 0..(steps - half_steps) {
        let factor = i as f32 / (steps - half_steps) as f32;
        gradient.push(bright.interpolate(base, factor));
    }

    gradient
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_color_from_hex() {
        let color = Color::from_hex("#ff5500");
        assert_eq!(color.r, 255);
        assert_eq!(color.g, 85);
        assert_eq!(color.b, 0);

        let color2 = Color::from_hex("00ff00");
        assert_eq!(color2.r, 0);
        assert_eq!(color2.g, 255);
        assert_eq!(color2.b, 0);
    }

    #[test]
    fn test_color_to_hex() {
        let color = Color::new(255, 128, 64);
        assert_eq!(color.to_hex(), "#ff8040");
    }

    #[test]
    fn test_color_interpolation() {
        let black = Color::new(0, 0, 0);
        let white = Color::new(255, 255, 255);

        let mid = black.interpolate(&white, 0.5);
        assert!(mid.r > 120 && mid.r < 135);
        assert!(mid.g > 120 && mid.g < 135);
        assert!(mid.b > 120 && mid.b < 135);
    }

    #[test]
    fn test_color_brightness() {
        let color = Color::new(100, 100, 100);
        let brighter = color.apply_brightness(1.5);
        assert_eq!(brighter.r, 150);

        let darker = color.apply_brightness(0.5);
        assert_eq!(darker.r, 50);
    }

    #[test]
    fn test_ansi256_conversion() {
        let red = Color::new(255, 0, 0);
        let ansi = red.to_ansi256();
        assert!(ansi >= 16 && ansi <= 231);

        let gray = Color::new(128, 128, 128);
        let ansi_gray = gray.to_ansi256();
        assert!(ansi_gray >= 232 || (ansi_gray >= 16 && ansi_gray <= 231));
    }

    #[test]
    fn test_gradient_generation() {
        let start = Color::new(0, 0, 0);
        let end = Color::new(255, 255, 255);
        let gradient = generate_gradient(&start, &end, 5);

        assert_eq!(gradient.len(), 5);
        assert_eq!(gradient[0].r, 0);
        assert_eq!(gradient[4].r, 255);
    }
}
