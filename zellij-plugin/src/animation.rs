//! Animation engine module for Zellij Visual Notifications
//!
//! Provides smooth animations for visual notifications including pulse, fade, flash, and breathe effects.

use crate::config::{AnimationConfig, AnimationStyle};
use crate::state::VisualState;

/// Animation engine for managing visual effects
#[derive(Debug, Clone)]
pub struct AnimationEngine {
    /// Animation configuration
    config: AnimationConfig,
    /// Ticks per animation cycle (derived from speed)
    ticks_per_cycle: u64,
    /// Total animation ticks (cycles * ticks_per_cycle)
    total_ticks: u64,
}

impl Default for AnimationEngine {
    fn default() -> Self {
        Self::new(&AnimationConfig::default())
    }
}

impl AnimationEngine {
    /// Create a new animation engine with the given configuration
    pub fn new(config: &AnimationConfig) -> Self {
        // Convert speed (1-100) to ticks per cycle
        // Higher speed = fewer ticks per cycle
        let ticks_per_cycle = ((101 - config.speed as u64) * 2).max(10);
        let total_ticks = ticks_per_cycle * config.cycles as u64;

        Self {
            config: config.clone(),
            ticks_per_cycle,
            total_ticks,
        }
    }

    /// Check if animations are enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled && self.config.style != AnimationStyle::None
    }

    /// Update animation state based on current tick
    pub fn update_animation(&self, visual_state: &mut VisualState, current_tick: u64) {
        if !self.is_enabled() || !visual_state.is_animating {
            return;
        }

        let elapsed_ticks = current_tick.saturating_sub(visual_state.animation_start_tick);

        // Check if animation is complete
        if elapsed_ticks >= self.total_ticks {
            visual_state.is_animating = false;
            visual_state.animation_phase = 0.0;
            visual_state.brightness = 1.0;
            return;
        }

        // Calculate animation phase (0.0 - 1.0)
        let phase = (elapsed_ticks as f32 / self.total_ticks as f32).clamp(0.0, 1.0);
        visual_state.animation_phase = phase;

        // Calculate brightness based on animation style
        visual_state.brightness = self.calculate_brightness(elapsed_ticks, &visual_state.animation_style);
    }

    /// Calculate brightness value based on animation style and elapsed ticks
    fn calculate_brightness(&self, elapsed_ticks: u64, style: &AnimationStyle) -> f32 {
        let cycle_phase = (elapsed_ticks % self.ticks_per_cycle) as f32 / self.ticks_per_cycle as f32;

        match style {
            AnimationStyle::Pulse => {
                // Smooth pulse: fade in and out using sine wave
                let angle = cycle_phase * std::f32::consts::PI * 2.0;
                0.5 + 0.5 * angle.sin()
            }
            AnimationStyle::Flash => {
                // Sharp flash: quick on/off
                if cycle_phase < 0.3 {
                    1.0
                } else if cycle_phase < 0.5 {
                    0.3
                } else {
                    1.0
                }
            }
            AnimationStyle::Fade => {
                // Gradual fade out over entire animation
                let total_phase = elapsed_ticks as f32 / self.total_ticks as f32;
                1.0 - total_phase
            }
            AnimationStyle::Breathe => {
                // Smooth breathing effect using sine wave
                let angle = cycle_phase * std::f32::consts::PI;
                0.4 + 0.6 * angle.sin()
            }
            AnimationStyle::None => 1.0,
        }
    }

    /// Get the current brightness for a visual state
    pub fn get_brightness(&self, visual_state: &VisualState, current_tick: u64) -> f32 {
        if !self.is_enabled() || !visual_state.is_animating {
            return 1.0;
        }

        let elapsed_ticks = current_tick.saturating_sub(visual_state.animation_start_tick);
        self.calculate_brightness(elapsed_ticks, &visual_state.animation_style)
    }

    /// Check if animation should continue
    pub fn should_continue(&self, visual_state: &VisualState, current_tick: u64) -> bool {
        if !visual_state.is_animating {
            return false;
        }

        let elapsed_ticks = current_tick.saturating_sub(visual_state.animation_start_tick);
        elapsed_ticks < self.total_ticks
    }

    /// Reset animation for a visual state
    pub fn reset_animation(&self, visual_state: &mut VisualState, current_tick: u64) {
        visual_state.animation_start_tick = current_tick;
        visual_state.animation_phase = 0.0;
        visual_state.brightness = 1.0;
    }

    /// Start a new animation for a visual state
    pub fn start_animation(&self, visual_state: &mut VisualState, current_tick: u64, style: AnimationStyle) {
        if !self.is_enabled() {
            return;
        }

        visual_state.is_animating = true;
        visual_state.animation_start_tick = current_tick;
        visual_state.animation_phase = 0.0;
        visual_state.animation_style = style;
        visual_state.brightness = 1.0;
    }

    /// Stop animation for a visual state
    pub fn stop_animation(&self, visual_state: &mut VisualState) {
        visual_state.is_animating = false;
        visual_state.animation_phase = 0.0;
        visual_state.brightness = 1.0;
    }

    /// Get animation progress as percentage (0-100)
    pub fn get_progress(&self, visual_state: &VisualState, current_tick: u64) -> u8 {
        if !visual_state.is_animating {
            return 100;
        }

        let elapsed_ticks = current_tick.saturating_sub(visual_state.animation_start_tick);
        let progress = (elapsed_ticks as f32 / self.total_ticks as f32 * 100.0).min(100.0);
        progress as u8
    }
}

/// Animation keyframe for complex animations
#[derive(Debug, Clone)]
pub struct Keyframe {
    /// Time position (0.0 - 1.0)
    pub time: f32,
    /// Brightness value at this keyframe
    pub brightness: f32,
    /// Color modifier (optional)
    pub color_modifier: Option<f32>,
}

impl Keyframe {
    /// Create a new keyframe
    pub fn new(time: f32, brightness: f32) -> Self {
        Self {
            time,
            brightness,
            color_modifier: None,
        }
    }

    /// Create a keyframe with color modifier
    pub fn with_color_modifier(time: f32, brightness: f32, color_modifier: f32) -> Self {
        Self {
            time,
            brightness,
            color_modifier: Some(color_modifier),
        }
    }
}

/// Custom animation definition
#[derive(Debug, Clone)]
pub struct CustomAnimation {
    /// Animation name
    pub name: String,
    /// Keyframes defining the animation
    pub keyframes: Vec<Keyframe>,
    /// Whether the animation loops
    pub loops: bool,
}

impl CustomAnimation {
    /// Create a new custom animation
    pub fn new(name: &str, keyframes: Vec<Keyframe>, loops: bool) -> Self {
        Self {
            name: name.to_string(),
            keyframes,
            loops,
        }
    }

    /// Interpolate brightness at a given time position
    pub fn interpolate(&self, time: f32) -> f32 {
        if self.keyframes.is_empty() {
            return 1.0;
        }

        let time = if self.loops {
            time % 1.0
        } else {
            time.clamp(0.0, 1.0)
        };

        // Find surrounding keyframes
        let mut prev = &self.keyframes[0];
        let mut next = &self.keyframes[0];

        for keyframe in &self.keyframes {
            if keyframe.time <= time {
                prev = keyframe;
            }
            if keyframe.time >= time {
                next = keyframe;
                break;
            }
        }

        // Interpolate between keyframes
        if prev.time == next.time {
            return prev.brightness;
        }

        let factor = (time - prev.time) / (next.time - prev.time);
        prev.brightness + (next.brightness - prev.brightness) * factor
    }
}

/// Predefined animations
pub mod presets {
    use super::*;

    /// Create a gentle pulse animation
    pub fn gentle_pulse() -> CustomAnimation {
        CustomAnimation::new(
            "gentle_pulse",
            vec![
                Keyframe::new(0.0, 0.7),
                Keyframe::new(0.5, 1.0),
                Keyframe::new(1.0, 0.7),
            ],
            true,
        )
    }

    /// Create an urgent flash animation
    pub fn urgent_flash() -> CustomAnimation {
        CustomAnimation::new(
            "urgent_flash",
            vec![
                Keyframe::new(0.0, 1.0),
                Keyframe::new(0.15, 0.2),
                Keyframe::new(0.3, 1.0),
                Keyframe::new(0.45, 0.2),
                Keyframe::new(0.6, 1.0),
                Keyframe::new(1.0, 1.0),
            ],
            false,
        )
    }

    /// Create a slow fade animation
    pub fn slow_fade() -> CustomAnimation {
        CustomAnimation::new(
            "slow_fade",
            vec![
                Keyframe::new(0.0, 1.0),
                Keyframe::new(0.7, 1.0),
                Keyframe::new(1.0, 0.0),
            ],
            false,
        )
    }

    /// Create a heartbeat animation
    pub fn heartbeat() -> CustomAnimation {
        CustomAnimation::new(
            "heartbeat",
            vec![
                Keyframe::new(0.0, 0.6),
                Keyframe::new(0.1, 1.0),
                Keyframe::new(0.2, 0.6),
                Keyframe::new(0.3, 0.9),
                Keyframe::new(0.4, 0.6),
                Keyframe::new(1.0, 0.6),
            ],
            true,
        )
    }
}

/// Easing functions for smooth animations
pub mod easing {
    /// Linear easing (no easing)
    pub fn linear(t: f32) -> f32 {
        t
    }

    /// Ease in (slow start)
    pub fn ease_in(t: f32) -> f32 {
        t * t
    }

    /// Ease out (slow end)
    pub fn ease_out(t: f32) -> f32 {
        1.0 - (1.0 - t) * (1.0 - t)
    }

    /// Ease in-out (slow start and end)
    pub fn ease_in_out(t: f32) -> f32 {
        if t < 0.5 {
            2.0 * t * t
        } else {
            1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
        }
    }

    /// Bounce easing
    pub fn bounce(t: f32) -> f32 {
        let n1 = 7.5625;
        let d1 = 2.75;

        if t < 1.0 / d1 {
            n1 * t * t
        } else if t < 2.0 / d1 {
            let t = t - 1.5 / d1;
            n1 * t * t + 0.75
        } else if t < 2.5 / d1 {
            let t = t - 2.25 / d1;
            n1 * t * t + 0.9375
        } else {
            let t = t - 2.625 / d1;
            n1 * t * t + 0.984375
        }
    }

    /// Elastic easing
    pub fn elastic(t: f32) -> f32 {
        if t == 0.0 || t == 1.0 {
            return t;
        }

        let c4 = (2.0 * std::f32::consts::PI) / 3.0;
        (2.0_f32).powf(-10.0 * t) * ((t * 10.0 - 0.75) * c4).sin() + 1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_animation_engine_creation() {
        let config = AnimationConfig::default();
        let engine = AnimationEngine::new(&config);
        assert!(engine.is_enabled());
    }

    #[test]
    fn test_pulse_brightness() {
        let config = AnimationConfig {
            enabled: true,
            style: AnimationStyle::Pulse,
            speed: 50,
            cycles: 3,
            duration_ms: 2000,
        };
        let engine = AnimationEngine::new(&config);

        // Test brightness at different points
        let b0 = engine.calculate_brightness(0, &AnimationStyle::Pulse);
        let b_quarter = engine.calculate_brightness(engine.ticks_per_cycle / 4, &AnimationStyle::Pulse);
        let b_half = engine.calculate_brightness(engine.ticks_per_cycle / 2, &AnimationStyle::Pulse);

        // Brightness should vary during pulse
        assert!(b0 >= 0.0 && b0 <= 1.0);
        assert!(b_quarter >= 0.0 && b_quarter <= 1.0);
        assert!(b_half >= 0.0 && b_half <= 1.0);
    }

    #[test]
    fn test_fade_brightness() {
        let config = AnimationConfig {
            enabled: true,
            style: AnimationStyle::Fade,
            speed: 50,
            cycles: 1,
            duration_ms: 2000,
        };
        let engine = AnimationEngine::new(&config);

        let b_start = engine.calculate_brightness(0, &AnimationStyle::Fade);
        let b_end = engine.calculate_brightness(engine.total_ticks, &AnimationStyle::Fade);

        assert!(b_start > b_end);
        assert!(b_start > 0.9);
        assert!(b_end < 0.1);
    }

    #[test]
    fn test_custom_animation_interpolation() {
        let anim = presets::gentle_pulse();

        let b_start = anim.interpolate(0.0);
        let b_mid = anim.interpolate(0.5);
        let b_end = anim.interpolate(1.0);

        assert!((b_start - 0.7).abs() < 0.01);
        assert!((b_mid - 1.0).abs() < 0.01);
        assert!((b_end - 0.7).abs() < 0.01);
    }

    #[test]
    fn test_easing_functions() {
        // Linear
        assert_eq!(easing::linear(0.5), 0.5);

        // Ease in should be less than linear at midpoint
        assert!(easing::ease_in(0.5) < 0.5);

        // Ease out should be greater than linear at midpoint
        assert!(easing::ease_out(0.5) > 0.5);

        // All should start at 0 and end at 1
        assert_eq!(easing::linear(0.0), 0.0);
        assert_eq!(easing::linear(1.0), 1.0);
        assert_eq!(easing::ease_in(0.0), 0.0);
        assert!((easing::ease_in(1.0) - 1.0).abs() < 0.01);
    }
}
