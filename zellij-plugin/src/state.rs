//! State management module for Zellij Visual Notifications
//!
//! Manages visual states for panes and the overall plugin state machine.

use serde::{Deserialize, Serialize};
use crate::config::AnimationStyle;
use crate::notification::NotificationType;

/// Plugin lifecycle state
#[derive(Debug, Clone, PartialEq, Default)]
pub enum PluginState {
    /// Plugin is initializing
    #[default]
    Initializing,
    /// Plugin is initialized and waiting for permissions
    Initialized,
    /// Plugin is running normally
    Running,
    /// Plugin is in fallback mode (limited functionality)
    FallbackMode,
    /// Plugin encountered an error
    Error(String),
    /// Plugin is shutting down
    ShuttingDown,
}

/// Visual state for a single pane
#[derive(Debug, Clone, Default)]
pub struct VisualState {
    /// Current state of visual notification
    pub state: VisualNotificationState,
    /// Border color (hex string)
    pub border_color: Option<String>,
    /// Badge icon (Unicode character)
    pub badge_icon: Option<String>,
    /// Whether animation is currently active
    pub is_animating: bool,
    /// Animation start tick
    pub animation_start_tick: u64,
    /// Current animation phase (0.0 - 1.0)
    pub animation_phase: f32,
    /// Animation style for this notification
    pub animation_style: AnimationStyle,
    /// Notification message
    pub notification_message: Option<String>,
    /// Notification type
    pub notification_type: Option<NotificationType>,
    /// Timestamp when notification was received
    pub notification_timestamp: u64,
    /// Whether the notification has been acknowledged
    pub acknowledged: bool,
    /// Brightness multiplier for animation (0.0 - 1.0)
    pub brightness: f32,
}

impl VisualState {
    /// Create a new visual state
    pub fn new() -> Self {
        Self {
            state: VisualNotificationState::Idle,
            border_color: None,
            badge_icon: None,
            is_animating: false,
            animation_start_tick: 0,
            animation_phase: 0.0,
            animation_style: AnimationStyle::Pulse,
            notification_message: None,
            notification_type: None,
            notification_timestamp: 0,
            acknowledged: false,
            brightness: 1.0,
        }
    }

    /// Clear the visual state
    pub fn clear(&mut self) {
        self.state = VisualNotificationState::Idle;
        self.border_color = None;
        self.badge_icon = None;
        self.is_animating = false;
        self.animation_phase = 0.0;
        self.notification_message = None;
        self.notification_type = None;
        self.acknowledged = false;
        self.brightness = 1.0;
    }

    /// Check if this state has an active notification
    pub fn has_notification(&self) -> bool {
        self.notification_type.is_some() && !self.acknowledged
    }

    /// Set the notification state
    pub fn set_notification(
        &mut self,
        notification_type: NotificationType,
        message: String,
        border_color: String,
        badge_icon: String,
    ) {
        self.state = VisualNotificationState::Active;
        self.notification_type = Some(notification_type);
        self.notification_message = Some(message);
        self.border_color = Some(border_color);
        self.badge_icon = Some(badge_icon);
        self.acknowledged = false;
        self.brightness = 1.0;
    }

    /// Start fading animation
    pub fn start_fade(&mut self, tick: u64) {
        self.state = VisualNotificationState::Fading;
        self.is_animating = true;
        self.animation_start_tick = tick;
        self.animation_phase = 0.0;
    }

    /// Acknowledge the notification
    pub fn acknowledge(&mut self) {
        self.acknowledged = true;
        self.state = VisualNotificationState::Fading;
    }
}

/// Visual notification state machine states
#[derive(Debug, Clone, PartialEq, Default)]
pub enum VisualNotificationState {
    /// No active notification
    #[default]
    Idle,
    /// Notification is pending (queued)
    Pending,
    /// Notification is active and displayed
    Active,
    /// Notification is fading out
    Fading,
    /// Error state
    Error,
}

impl VisualNotificationState {
    /// Check if state allows transitions
    pub fn can_transition_to(&self, target: &VisualNotificationState) -> bool {
        match (self, target) {
            // From Idle
            (VisualNotificationState::Idle, VisualNotificationState::Pending) => true,
            (VisualNotificationState::Idle, VisualNotificationState::Active) => true,
            // From Pending
            (VisualNotificationState::Pending, VisualNotificationState::Active) => true,
            (VisualNotificationState::Pending, VisualNotificationState::Idle) => true, // Cancel
            // From Active
            (VisualNotificationState::Active, VisualNotificationState::Fading) => true,
            (VisualNotificationState::Active, VisualNotificationState::Idle) => true, // Instant clear
            // From Fading
            (VisualNotificationState::Fading, VisualNotificationState::Idle) => true,
            (VisualNotificationState::Fading, VisualNotificationState::Active) => true, // New notification
            // From Error
            (VisualNotificationState::Error, VisualNotificationState::Idle) => true,
            (VisualNotificationState::Error, VisualNotificationState::Active) => true,
            // Same state (no-op)
            (a, b) if a == b => true,
            // All other transitions are invalid
            _ => false,
        }
    }

    /// Get the display name for this state
    pub fn display_name(&self) -> &'static str {
        match self {
            VisualNotificationState::Idle => "Idle",
            VisualNotificationState::Pending => "Pending",
            VisualNotificationState::Active => "Active",
            VisualNotificationState::Fading => "Fading",
            VisualNotificationState::Error => "Error",
        }
    }
}

/// State transition event
#[derive(Debug, Clone)]
pub struct StateTransition {
    /// Source state
    pub from: VisualNotificationState,
    /// Target state
    pub to: VisualNotificationState,
    /// Timestamp of transition
    pub timestamp: u64,
    /// Reason for transition
    pub reason: String,
}

impl StateTransition {
    /// Create a new state transition
    pub fn new(from: VisualNotificationState, to: VisualNotificationState, reason: &str) -> Self {
        Self {
            from,
            to,
            timestamp: 0, // Will be set by the caller
            reason: reason.to_string(),
        }
    }
}

/// State manager for tracking multiple pane states
#[derive(Debug, Default)]
pub struct StateManager {
    /// History of state transitions (for debugging)
    transition_history: Vec<StateTransition>,
    /// Maximum history size
    max_history_size: usize,
}

impl StateManager {
    /// Create a new state manager
    pub fn new() -> Self {
        Self {
            transition_history: Vec::new(),
            max_history_size: 100,
        }
    }

    /// Record a state transition
    pub fn record_transition(&mut self, transition: StateTransition) {
        self.transition_history.push(transition);

        // Keep history bounded
        while self.transition_history.len() > self.max_history_size {
            self.transition_history.remove(0);
        }
    }

    /// Get recent transitions
    pub fn recent_transitions(&self, count: usize) -> &[StateTransition] {
        let start = if self.transition_history.len() > count {
            self.transition_history.len() - count
        } else {
            0
        };
        &self.transition_history[start..]
    }

    /// Clear transition history
    pub fn clear_history(&mut self) {
        self.transition_history.clear();
    }
}

/// Pane-specific notification state for synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneNotificationState {
    /// Pane ID
    pub pane_id: u32,
    /// Current visual state name
    pub state: String,
    /// Active notification type (if any)
    pub notification_type: Option<String>,
    /// Active notification message (if any)
    pub notification_message: Option<String>,
    /// Whether notification is acknowledged
    pub acknowledged: bool,
    /// Timestamp of last update
    pub last_update: u64,
}

impl From<&VisualState> for PaneNotificationState {
    fn from(state: &VisualState) -> Self {
        Self {
            pane_id: 0, // Will be set by caller
            state: state.state.display_name().to_string(),
            notification_type: state.notification_type.as_ref().map(|t| t.name().to_string()),
            notification_message: state.notification_message.clone(),
            acknowledged: state.acknowledged,
            last_update: state.notification_timestamp,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visual_state_default() {
        let state = VisualState::default();
        assert_eq!(state.state, VisualNotificationState::Idle);
        assert!(!state.has_notification());
    }

    #[test]
    fn test_visual_state_clear() {
        let mut state = VisualState::new();
        state.border_color = Some("#ff0000".to_string());
        state.badge_icon = Some("!".to_string());
        state.is_animating = true;

        state.clear();

        assert_eq!(state.state, VisualNotificationState::Idle);
        assert!(state.border_color.is_none());
        assert!(state.badge_icon.is_none());
        assert!(!state.is_animating);
    }

    #[test]
    fn test_state_transitions() {
        let idle = VisualNotificationState::Idle;
        let pending = VisualNotificationState::Pending;
        let active = VisualNotificationState::Active;
        let fading = VisualNotificationState::Fading;

        assert!(idle.can_transition_to(&pending));
        assert!(idle.can_transition_to(&active));
        assert!(pending.can_transition_to(&active));
        assert!(active.can_transition_to(&fading));
        assert!(fading.can_transition_to(&idle));

        // Invalid transitions
        assert!(!pending.can_transition_to(&fading));
        assert!(!idle.can_transition_to(&fading));
    }

    #[test]
    fn test_state_manager_history() {
        let mut manager = StateManager::new();

        for i in 0..10 {
            let transition = StateTransition::new(
                VisualNotificationState::Idle,
                VisualNotificationState::Active,
                &format!("Test {}", i),
            );
            manager.record_transition(transition);
        }

        let recent = manager.recent_transitions(5);
        assert_eq!(recent.len(), 5);
    }
}
