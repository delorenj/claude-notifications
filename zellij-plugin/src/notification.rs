//! Notification module for Zellij Visual Notifications
//!
//! Defines notification types, structures, and processing logic.

use serde::{Deserialize, Serialize};

/// Notification type enumeration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum NotificationType {
    /// Command completed successfully (exit code 0)
    Success,
    /// Command failed (non-zero exit code)
    Error,
    /// Warning notification
    Warning,
    /// Informational notification
    Info,
    /// Progress update
    Progress,
    /// Attention needed (Claude Code waiting)
    Attention,
}

impl Default for NotificationType {
    fn default() -> Self {
        Self::Info
    }
}

impl NotificationType {
    /// Get the icon for this notification type
    pub fn icon(&self) -> Option<String> {
        Some(match self {
            NotificationType::Success => "\u{2714}".to_string(), // Check mark
            NotificationType::Error => "\u{2718}".to_string(),   // X mark
            NotificationType::Warning => "\u{26A0}".to_string(), // Warning triangle
            NotificationType::Info => "\u{2139}".to_string(),    // Info symbol
            NotificationType::Progress => "\u{21BB}".to_string(), // Rotating arrow
            NotificationType::Attention => "\u{2757}".to_string(), // Exclamation mark
        })
    }

    /// Get the display name for this notification type
    pub fn name(&self) -> &'static str {
        match self {
            NotificationType::Success => "success",
            NotificationType::Error => "error",
            NotificationType::Warning => "warning",
            NotificationType::Info => "info",
            NotificationType::Progress => "progress",
            NotificationType::Attention => "attention",
        }
    }

    /// Get urgency level (0 = low, 1 = normal, 2 = high, 3 = critical)
    pub fn urgency(&self) -> u8 {
        match self {
            NotificationType::Info => 0,
            NotificationType::Progress => 0,
            NotificationType::Success => 1,
            NotificationType::Warning => 2,
            NotificationType::Error => 3,
            NotificationType::Attention => 3,
        }
    }

    /// Parse notification type from string
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "success" | "ok" | "done" | "complete" | "completed" => NotificationType::Success,
            "error" | "fail" | "failed" | "failure" => NotificationType::Error,
            "warning" | "warn" => NotificationType::Warning,
            "info" | "information" => NotificationType::Info,
            "progress" | "running" | "working" => NotificationType::Progress,
            "attention" | "waiting" | "input" | "input_needed" => NotificationType::Attention,
            _ => NotificationType::Info,
        }
    }

    /// Check if this notification type should use urgent animation
    pub fn is_urgent(&self) -> bool {
        matches!(self, NotificationType::Error | NotificationType::Attention)
    }
}

/// Priority level for notifications
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Priority {
    /// Low priority (queued, can be delayed)
    Low = 0,
    /// Normal priority (standard processing)
    Normal = 1,
    /// High priority (processed before normal)
    High = 2,
    /// Critical priority (processed immediately)
    Critical = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Normal
    }
}

impl From<&NotificationType> for Priority {
    fn from(notification_type: &NotificationType) -> Self {
        match notification_type {
            NotificationType::Info => Priority::Low,
            NotificationType::Progress => Priority::Low,
            NotificationType::Success => Priority::Normal,
            NotificationType::Warning => Priority::High,
            NotificationType::Error => Priority::Critical,
            NotificationType::Attention => Priority::Critical,
        }
    }
}

/// Notification structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    /// Unique notification ID
    pub id: String,
    /// Notification type
    pub notification_type: NotificationType,
    /// Notification message
    pub message: String,
    /// Title (optional)
    pub title: Option<String>,
    /// Target pane ID (if specific to a pane)
    pub pane_id: Option<u32>,
    /// Target tab index (if specific to a tab)
    pub tab_index: Option<usize>,
    /// Priority level
    pub priority: Priority,
    /// Timestamp when notification was created (Unix timestamp ms)
    pub timestamp: u64,
    /// Time-to-live in milliseconds (0 = no expiry)
    pub ttl_ms: u64,
    /// Source of the notification
    pub source: String,
    /// Additional metadata
    pub metadata: NotificationMetadata,
}

impl Default for Notification {
    fn default() -> Self {
        Self {
            id: generate_id(),
            notification_type: NotificationType::Info,
            message: String::new(),
            title: None,
            pane_id: None,
            tab_index: None,
            priority: Priority::Normal,
            timestamp: 0,
            ttl_ms: 300_000, // 5 minutes default
            source: "unknown".to_string(),
            metadata: NotificationMetadata::default(),
        }
    }
}

impl Notification {
    /// Create a new notification
    pub fn new(notification_type: NotificationType, message: &str) -> Self {
        let priority = Priority::from(&notification_type);
        Self {
            id: generate_id(),
            notification_type,
            message: message.to_string(),
            priority,
            ..Default::default()
        }
    }

    /// Create a success notification
    pub fn success(message: &str) -> Self {
        Self::new(NotificationType::Success, message)
    }

    /// Create an error notification
    pub fn error(message: &str) -> Self {
        Self::new(NotificationType::Error, message)
    }

    /// Create a warning notification
    pub fn warning(message: &str) -> Self {
        Self::new(NotificationType::Warning, message)
    }

    /// Create an info notification
    pub fn info(message: &str) -> Self {
        Self::new(NotificationType::Info, message)
    }

    /// Create an attention notification (Claude Code waiting)
    pub fn attention(message: &str) -> Self {
        Self::new(NotificationType::Attention, message)
    }

    /// Create a progress notification
    pub fn progress(message: &str) -> Self {
        Self::new(NotificationType::Progress, message)
    }

    /// Set the title
    pub fn with_title(mut self, title: &str) -> Self {
        self.title = Some(title.to_string());
        self
    }

    /// Set the target pane
    pub fn for_pane(mut self, pane_id: u32) -> Self {
        self.pane_id = Some(pane_id);
        self
    }

    /// Set the target tab
    pub fn for_tab(mut self, tab_index: usize) -> Self {
        self.tab_index = Some(tab_index);
        self
    }

    /// Set the source
    pub fn from_source(mut self, source: &str) -> Self {
        self.source = source.to_string();
        self
    }

    /// Set the TTL
    pub fn with_ttl(mut self, ttl_ms: u64) -> Self {
        self.ttl_ms = ttl_ms;
        self
    }

    /// Set the timestamp
    pub fn at_time(mut self, timestamp: u64) -> Self {
        self.timestamp = timestamp;
        self
    }

    /// Set the priority
    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    /// Check if the notification has expired
    pub fn is_expired(&self, current_time: u64) -> bool {
        if self.ttl_ms == 0 {
            return false;
        }
        current_time > self.timestamp + self.ttl_ms
    }

    /// Get the notification icon
    pub fn icon(&self) -> Option<String> {
        self.notification_type.icon()
    }

    /// Get display text (title + message or just message)
    pub fn display_text(&self) -> String {
        if let Some(ref title) = self.title {
            format!("{}: {}", title, self.message)
        } else {
            self.message.clone()
        }
    }
}

/// Additional metadata for notifications
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NotificationMetadata {
    /// Command that triggered the notification
    pub command: Option<String>,
    /// Exit code (for command completion)
    pub exit_code: Option<i32>,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Additional custom data
    pub custom: Option<serde_json::Value>,
}

/// Generate a unique notification ID
fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    format!("notif-{}-{}", duration.as_millis(), rand_u32())
}

/// Simple pseudo-random number generator (WASM compatible)
fn rand_u32() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};

    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    // Simple LCG-based PRNG
    let seed = time.as_nanos() as u32;
    seed.wrapping_mul(1103515245).wrapping_add(12345)
}

/// Builder for creating notifications
pub struct NotificationBuilder {
    notification: Notification,
}

impl NotificationBuilder {
    /// Create a new notification builder
    pub fn new() -> Self {
        Self {
            notification: Notification::default(),
        }
    }

    /// Set the notification type
    pub fn notification_type(mut self, t: NotificationType) -> Self {
        self.notification.notification_type = t.clone();
        self.notification.priority = Priority::from(&t);
        self
    }

    /// Set the message
    pub fn message(mut self, msg: &str) -> Self {
        self.notification.message = msg.to_string();
        self
    }

    /// Set the title
    pub fn title(mut self, title: &str) -> Self {
        self.notification.title = Some(title.to_string());
        self
    }

    /// Set the pane ID
    pub fn pane_id(mut self, id: u32) -> Self {
        self.notification.pane_id = Some(id);
        self
    }

    /// Set the tab index
    pub fn tab_index(mut self, index: usize) -> Self {
        self.notification.tab_index = Some(index);
        self
    }

    /// Set the source
    pub fn source(mut self, source: &str) -> Self {
        self.notification.source = source.to_string();
        self
    }

    /// Set the TTL
    pub fn ttl(mut self, ttl_ms: u64) -> Self {
        self.notification.ttl_ms = ttl_ms;
        self
    }

    /// Set the timestamp
    pub fn timestamp(mut self, ts: u64) -> Self {
        self.notification.timestamp = ts;
        self
    }

    /// Set the priority
    pub fn priority(mut self, p: Priority) -> Self {
        self.notification.priority = p;
        self
    }

    /// Set command metadata
    pub fn command(mut self, cmd: &str) -> Self {
        self.notification.metadata.command = Some(cmd.to_string());
        self
    }

    /// Set exit code metadata
    pub fn exit_code(mut self, code: i32) -> Self {
        self.notification.metadata.exit_code = Some(code);
        self
    }

    /// Set duration metadata
    pub fn duration(mut self, duration_ms: u64) -> Self {
        self.notification.metadata.duration_ms = Some(duration_ms);
        self
    }

    /// Build the notification
    pub fn build(self) -> Notification {
        self.notification
    }
}

impl Default for NotificationBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_creation() {
        let notif = Notification::success("Build completed");
        assert_eq!(notif.notification_type, NotificationType::Success);
        assert_eq!(notif.message, "Build completed");
    }

    #[test]
    fn test_notification_builder() {
        let notif = NotificationBuilder::new()
            .notification_type(NotificationType::Error)
            .message("Test failed")
            .pane_id(42)
            .command("npm test")
            .exit_code(1)
            .build();

        assert_eq!(notif.notification_type, NotificationType::Error);
        assert_eq!(notif.pane_id, Some(42));
        assert_eq!(notif.metadata.command, Some("npm test".to_string()));
        assert_eq!(notif.metadata.exit_code, Some(1));
    }

    #[test]
    fn test_notification_type_icons() {
        assert!(NotificationType::Success.icon().is_some());
        assert!(NotificationType::Error.icon().is_some());
        assert!(NotificationType::Warning.icon().is_some());
    }

    #[test]
    fn test_notification_type_parsing() {
        assert_eq!(NotificationType::from_str("success"), NotificationType::Success);
        assert_eq!(NotificationType::from_str("ERROR"), NotificationType::Error);
        assert_eq!(NotificationType::from_str("warn"), NotificationType::Warning);
        assert_eq!(NotificationType::from_str("attention"), NotificationType::Attention);
        assert_eq!(NotificationType::from_str("unknown"), NotificationType::Info);
    }

    #[test]
    fn test_notification_expiry() {
        let notif = Notification::new(NotificationType::Info, "Test")
            .at_time(1000)
            .with_ttl(5000);

        assert!(!notif.is_expired(5000));
        assert!(notif.is_expired(7000));
    }

    #[test]
    fn test_priority_from_type() {
        assert_eq!(Priority::from(&NotificationType::Info), Priority::Low);
        assert_eq!(Priority::from(&NotificationType::Success), Priority::Normal);
        assert_eq!(Priority::from(&NotificationType::Warning), Priority::High);
        assert_eq!(Priority::from(&NotificationType::Error), Priority::Critical);
    }
}
