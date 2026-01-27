//! Renderer module for Zellij Visual Notifications
//!
//! Handles rendering of status bar widgets, pane borders, and badges.

use std::collections::BTreeMap;
use crate::animation::AnimationEngine;
use crate::colors::ColorManager;
use crate::config::Config;
use crate::notification::NotificationType;
use crate::queue::NotificationQueue;
use crate::state::VisualState;

/// Renderer for visual elements
#[derive(Debug, Clone)]
pub struct Renderer {
    /// Show status bar widget
    show_status_bar: bool,
    /// Show border colors
    show_border_colors: bool,
    /// Show tab badges
    show_tab_badges: bool,
    /// Use unicode icons
    use_unicode: bool,
    /// Accessibility mode (patterns instead of colors only)
    use_patterns: bool,
}

impl Default for Renderer {
    fn default() -> Self {
        Self {
            show_status_bar: true,
            show_border_colors: true,
            show_tab_badges: true,
            use_unicode: true,
            use_patterns: true,
        }
    }
}

impl Renderer {
    /// Create a new renderer with configuration
    pub fn new(config: &Config) -> Self {
        Self {
            show_status_bar: config.show_status_bar,
            show_border_colors: config.show_border_colors,
            show_tab_badges: config.show_tab_badges,
            use_unicode: true,
            use_patterns: config.accessibility.use_patterns,
        }
    }

    /// Render the status bar widget
    pub fn render_status_bar(
        &self,
        rows: usize,
        cols: usize,
        pane_states: &BTreeMap<u32, VisualState>,
        queue: &NotificationQueue,
        color_manager: &ColorManager,
        animation_engine: &AnimationEngine,
        tick: u64,
    ) {
        if !self.show_status_bar || cols < 10 {
            return;
        }

        // Count active notifications
        let active_count = pane_states.values().filter(|s| s.has_notification()).count();
        let queue_count = queue.len();

        // Build status bar content
        let content = self.build_status_content(
            active_count,
            queue_count,
            pane_states,
            color_manager,
            animation_engine,
            tick,
        );

        eprintln!("[DEBUG] Rendering status bar: active={}, queue={}, content_len={}",
            active_count, queue_count, content.len());
        eprintln!("[DEBUG] Content: {:?}", content);

        // Print the status bar (Zellij will capture this)
        print!("{}", content);
    }

    /// Build the status bar content string
    fn build_status_content(
        &self,
        active_count: usize,
        queue_count: usize,
        pane_states: &BTreeMap<u32, VisualState>,
        color_manager: &ColorManager,
        animation_engine: &AnimationEngine,
        tick: u64,
    ) -> String {
        let mut output = String::new();

        // Plugin name/icon
        let icon = if self.use_unicode { "\u{1F514}" } else { "[N]" };  // Bell icon
        output.push_str(&format!("{} ", icon));

        // Show notification counts
        if active_count == 0 && queue_count == 0 {
            output.push_str(&format!("{}No notifications{}",
                color_manager.fg_escape(&color_manager.get_dimmed_color()),
                color_manager.reset_escape()
            ));
        } else {
            // Show active notification indicators
            for (pane_id, state) in pane_states.iter() {
                if let Some(ref notif_type) = state.notification_type {
                    if !state.acknowledged {
                        let color = color_manager.get_notification_color(notif_type)
                            .unwrap_or_else(|| color_manager.get_foreground_color());

                        let brightness = animation_engine.get_brightness(state, tick);
                        let adjusted_color = color_manager.apply_brightness(&color, brightness);

                        let icon = self.get_notification_icon(notif_type);
                        let pattern = if self.use_patterns {
                            self.get_pattern_suffix(notif_type)
                        } else {
                            ""
                        };

                        output.push_str(&format!("{}[{}{}:{}{}]{} ",
                            color_manager.fg_escape(&adjusted_color),
                            icon,
                            pattern,
                            pane_id,
                            if state.is_animating { "*" } else { "" },
                            color_manager.reset_escape()
                        ));
                    }
                }
            }

            // Show queue count if any
            if queue_count > 0 {
                output.push_str(&format!("(+{} queued)", queue_count));
            }
        }

        output
    }

    /// Get the icon for a notification type
    fn get_notification_icon(&self, notification_type: &NotificationType) -> &'static str {
        if self.use_unicode {
            match notification_type {
                NotificationType::Success => "\u{2714}",   // Check mark
                NotificationType::Error => "\u{2718}",     // X mark
                NotificationType::Warning => "\u{26A0}",   // Warning triangle
                NotificationType::Info => "\u{2139}",      // Info symbol
                NotificationType::Progress => "\u{21BB}",  // Rotating arrow
                NotificationType::Attention => "\u{2757}", // Exclamation mark
            }
        } else {
            match notification_type {
                NotificationType::Success => "+",
                NotificationType::Error => "X",
                NotificationType::Warning => "!",
                NotificationType::Info => "i",
                NotificationType::Progress => "~",
                NotificationType::Attention => "!",
            }
        }
    }

    /// Get pattern suffix for accessibility (distinguishes by shape, not just color)
    fn get_pattern_suffix(&self, notification_type: &NotificationType) -> &'static str {
        match notification_type {
            NotificationType::Success => "=",    // Double line
            NotificationType::Error => "##",     // Hash/blocked
            NotificationType::Warning => "~~",   // Wavy
            NotificationType::Info => "..",      // Dots
            NotificationType::Progress => "->",  // Arrow
            NotificationType::Attention => "!!",  // Double exclaim
        }
    }

    /// Render a pane badge (for tab bar)
    pub fn render_pane_badge(
        &self,
        state: &VisualState,
        color_manager: &ColorManager,
    ) -> Option<String> {
        if !self.show_tab_badges {
            return None;
        }

        if let Some(ref notif_type) = state.notification_type {
            if !state.acknowledged {
                let icon = self.get_notification_icon(notif_type);
                let color = color_manager.get_notification_color(notif_type)?;

                return Some(format!("{}{}{}",
                    color_manager.fg_escape(&color),
                    icon,
                    color_manager.reset_escape()
                ));
            }
        }

        None
    }

    /// Get border style for a pane
    pub fn get_border_style(
        &self,
        state: &VisualState,
        color_manager: &ColorManager,
        animation_engine: &AnimationEngine,
        tick: u64,
    ) -> Option<BorderStyle> {
        if !self.show_border_colors {
            return None;
        }

        if let Some(ref notif_type) = state.notification_type {
            if !state.acknowledged {
                let base_color = color_manager.get_notification_color(notif_type)?;

                // Apply animation brightness
                let brightness = animation_engine.get_brightness(state, tick);
                let color = color_manager.apply_brightness(&base_color, brightness);

                return Some(BorderStyle {
                    color,
                    style: if state.is_animating {
                        BorderLineStyle::Double
                    } else {
                        BorderLineStyle::Single
                    },
                });
            }
        }

        None
    }

    /// Format notification for tooltip/popup
    pub fn format_notification_tooltip(
        &self,
        state: &VisualState,
        _color_manager: &ColorManager,
    ) -> Option<String> {
        if let Some(ref message) = state.notification_message {
            let icon = state.notification_type.as_ref()
                .map(|t| self.get_notification_icon(t))
                .unwrap_or("");

            Some(format!("{} {}", icon, message))
        } else {
            None
        }
    }

    /// Create a summary line for multiple notifications
    pub fn render_summary(
        &self,
        pane_states: &BTreeMap<u32, VisualState>,
        color_manager: &ColorManager,
    ) -> String {
        let mut success = 0;
        let mut error = 0;
        let mut warning = 0;
        let mut info = 0;
        let mut attention = 0;

        for state in pane_states.values() {
            if let Some(ref notif_type) = state.notification_type {
                if !state.acknowledged {
                    match notif_type {
                        NotificationType::Success => success += 1,
                        NotificationType::Error => error += 1,
                        NotificationType::Warning => warning += 1,
                        NotificationType::Info => info += 1,
                        NotificationType::Attention => attention += 1,
                        NotificationType::Progress => {}
                    }
                }
            }
        }

        let mut parts = Vec::new();

        if success > 0 {
            let color = color_manager.get_notification_color(&NotificationType::Success)
                .unwrap_or_default();
            parts.push(format!("{}{}{}{}",
                color_manager.fg_escape(&color),
                self.get_notification_icon(&NotificationType::Success),
                success,
                color_manager.reset_escape()
            ));
        }
        if error > 0 {
            let color = color_manager.get_notification_color(&NotificationType::Error)
                .unwrap_or_default();
            parts.push(format!("{}{}{}{}",
                color_manager.fg_escape(&color),
                self.get_notification_icon(&NotificationType::Error),
                error,
                color_manager.reset_escape()
            ));
        }
        if warning > 0 {
            let color = color_manager.get_notification_color(&NotificationType::Warning)
                .unwrap_or_default();
            parts.push(format!("{}{}{}{}",
                color_manager.fg_escape(&color),
                self.get_notification_icon(&NotificationType::Warning),
                warning,
                color_manager.reset_escape()
            ));
        }
        if attention > 0 {
            let color = color_manager.get_notification_color(&NotificationType::Attention)
                .unwrap_or_default();
            parts.push(format!("{}{}{}{}",
                color_manager.fg_escape(&color),
                self.get_notification_icon(&NotificationType::Attention),
                attention,
                color_manager.reset_escape()
            ));
        }
        if info > 0 {
            let color = color_manager.get_notification_color(&NotificationType::Info)
                .unwrap_or_default();
            parts.push(format!("{}{}{}{}",
                color_manager.fg_escape(&color),
                self.get_notification_icon(&NotificationType::Info),
                info,
                color_manager.reset_escape()
            ));
        }

        if parts.is_empty() {
            "No notifications".to_string()
        } else {
            parts.join(" ")
        }
    }
}

/// Border style for pane borders
#[derive(Debug, Clone)]
pub struct BorderStyle {
    /// Border color (hex)
    pub color: String,
    /// Line style
    pub style: BorderLineStyle,
}

/// Border line styles
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BorderLineStyle {
    /// Single line border
    Single,
    /// Double line border
    Double,
    /// Dashed border
    Dashed,
    /// Dotted border
    Dotted,
    /// Bold/thick border
    Bold,
}

impl BorderLineStyle {
    /// Get the box-drawing characters for this style
    pub fn chars(&self) -> BorderChars {
        match self {
            BorderLineStyle::Single => BorderChars {
                horizontal: '\u{2500}',
                vertical: '\u{2502}',
                top_left: '\u{250C}',
                top_right: '\u{2510}',
                bottom_left: '\u{2514}',
                bottom_right: '\u{2518}',
            },
            BorderLineStyle::Double => BorderChars {
                horizontal: '\u{2550}',
                vertical: '\u{2551}',
                top_left: '\u{2554}',
                top_right: '\u{2557}',
                bottom_left: '\u{255A}',
                bottom_right: '\u{255D}',
            },
            BorderLineStyle::Dashed => BorderChars {
                horizontal: '\u{2504}',
                vertical: '\u{2506}',
                top_left: '\u{250C}',
                top_right: '\u{2510}',
                bottom_left: '\u{2514}',
                bottom_right: '\u{2518}',
            },
            BorderLineStyle::Dotted => BorderChars {
                horizontal: '\u{2508}',
                vertical: '\u{250A}',
                top_left: '\u{250C}',
                top_right: '\u{2510}',
                bottom_left: '\u{2514}',
                bottom_right: '\u{2518}',
            },
            BorderLineStyle::Bold => BorderChars {
                horizontal: '\u{2501}',
                vertical: '\u{2503}',
                top_left: '\u{250F}',
                top_right: '\u{2513}',
                bottom_left: '\u{2517}',
                bottom_right: '\u{251B}',
            },
        }
    }
}

/// Box-drawing characters for borders
#[derive(Debug, Clone, Copy)]
pub struct BorderChars {
    pub horizontal: char,
    pub vertical: char,
    pub top_left: char,
    pub top_right: char,
    pub bottom_left: char,
    pub bottom_right: char,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_renderer_creation() {
        let config = Config::default();
        let renderer = Renderer::new(&config);
        assert!(renderer.show_status_bar);
        assert!(renderer.show_border_colors);
        assert!(renderer.show_tab_badges);
    }

    #[test]
    fn test_notification_icons() {
        let renderer = Renderer::default();

        let success_icon = renderer.get_notification_icon(&NotificationType::Success);
        let error_icon = renderer.get_notification_icon(&NotificationType::Error);

        assert!(!success_icon.is_empty());
        assert!(!error_icon.is_empty());
        assert_ne!(success_icon, error_icon);
    }

    #[test]
    fn test_border_line_styles() {
        let single = BorderLineStyle::Single;
        let double = BorderLineStyle::Double;

        let single_chars = single.chars();
        let double_chars = double.chars();

        assert_ne!(single_chars.horizontal, double_chars.horizontal);
        assert_ne!(single_chars.vertical, double_chars.vertical);
    }

    #[test]
    fn test_pattern_suffix() {
        let renderer = Renderer::default();

        let success_pattern = renderer.get_pattern_suffix(&NotificationType::Success);
        let error_pattern = renderer.get_pattern_suffix(&NotificationType::Error);

        assert!(!success_pattern.is_empty());
        assert!(!error_pattern.is_empty());
        assert_ne!(success_pattern, error_pattern);
    }
}
