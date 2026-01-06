//! Event Bridge module for Zellij Visual Notifications
//!
//! Handles communication with the claude-notifications system via IPC/pipe messages.

use serde::{Deserialize, Serialize};
use crate::notification::{Notification, NotificationBuilder, NotificationType, Priority};

/// Event bridge for receiving notifications from claude-notifications
#[derive(Debug, Default)]
pub struct EventBridge {
    /// Connection state
    connection_state: ConnectionState,
    /// Protocol version
    protocol_version: String,
    /// Last received message timestamp
    last_message_timestamp: u64,
    /// Error count for retry logic
    error_count: u32,
    /// Maximum errors before fallback
    max_errors: u32,
}

/// Connection state for the event bridge
#[derive(Debug, Clone, PartialEq, Default)]
pub enum ConnectionState {
    /// Not connected
    #[default]
    Disconnected,
    /// Connecting
    Connecting,
    /// Connected and receiving events
    Connected,
    /// Connection error
    Error(String),
}

impl EventBridge {
    /// Create a new event bridge
    pub fn new() -> Self {
        Self {
            connection_state: ConnectionState::Disconnected,
            protocol_version: "1.0".to_string(),
            last_message_timestamp: 0,
            error_count: 0,
            max_errors: 5,
        }
    }

    /// Get the current connection state
    pub fn connection_state(&self) -> &ConnectionState {
        &self.connection_state
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        matches!(self.connection_state, ConnectionState::Connected)
    }

    /// Parse a notification from a JSON payload
    pub fn parse_notification(&mut self, payload: &str) -> Result<Notification, EventBridgeError> {
        // Try to parse as NotificationMessage first
        match serde_json::from_str::<NotificationMessage>(payload) {
            Ok(msg) => {
                self.connection_state = ConnectionState::Connected;
                self.error_count = 0;
                self.last_message_timestamp = msg.timestamp.unwrap_or(0);
                Ok(self.convert_message_to_notification(msg))
            }
            Err(e) => {
                // Try legacy format
                if let Ok(legacy) = serde_json::from_str::<LegacyNotificationMessage>(payload) {
                    self.connection_state = ConnectionState::Connected;
                    self.error_count = 0;
                    return Ok(self.convert_legacy_to_notification(legacy));
                }

                self.error_count += 1;
                if self.error_count >= self.max_errors {
                    self.connection_state = ConnectionState::Error("Too many parse errors".to_string());
                }

                Err(EventBridgeError::ParseError(e.to_string()))
            }
        }
    }

    /// Convert a NotificationMessage to a Notification
    fn convert_message_to_notification(&self, msg: NotificationMessage) -> Notification {
        let notification_type = msg.notification_type
            .map(|t| NotificationType::from_str(&t))
            .unwrap_or(NotificationType::Attention);

        let priority = msg.priority
            .map(|p| match p.to_lowercase().as_str() {
                "low" => Priority::Low,
                "normal" => Priority::Normal,
                "high" => Priority::High,
                "critical" => Priority::Critical,
                _ => Priority::from(&notification_type),
            })
            .unwrap_or_else(|| Priority::from(&notification_type));

        let mut builder = NotificationBuilder::new()
            .notification_type(notification_type)
            .message(&msg.message.unwrap_or_else(|| "Claude is waiting...".to_string()))
            .title(&msg.title.unwrap_or_else(|| "Claude Code".to_string()))
            .source(&msg.source.unwrap_or_else(|| "claude-notifications".to_string()))
            .priority(priority)
            .timestamp(msg.timestamp.unwrap_or(0))
            .ttl(msg.ttl_ms.unwrap_or(300_000));

        // Add pane_id if present
        if let Some(pane_id) = msg.pane_id {
            builder = builder.pane_id(pane_id);
        }

        // Add tab_index if present
        if let Some(tab_index) = msg.tab_index {
            builder = builder.tab_index(tab_index);
        }

        builder.build()
    }

    /// Convert a legacy message format to a Notification
    fn convert_legacy_to_notification(&self, msg: LegacyNotificationMessage) -> Notification {
        Notification::attention(&msg.message)
            .from_source("claude-notifications-legacy")
    }

    /// Handle connection established
    pub fn on_connected(&mut self) {
        self.connection_state = ConnectionState::Connected;
        self.error_count = 0;
    }

    /// Handle connection error
    pub fn on_error(&mut self, error: &str) {
        self.error_count += 1;
        if self.error_count >= self.max_errors {
            self.connection_state = ConnectionState::Error(error.to_string());
        }
    }

    /// Handle connection lost
    pub fn on_disconnected(&mut self) {
        self.connection_state = ConnectionState::Disconnected;
    }

    /// Get health status
    pub fn health_status(&self) -> EventBridgeHealth {
        EventBridgeHealth {
            connected: self.is_connected(),
            error_count: self.error_count,
            last_message_timestamp: self.last_message_timestamp,
            protocol_version: self.protocol_version.clone(),
        }
    }

    /// Reset error count (for recovery)
    pub fn reset_errors(&mut self) {
        self.error_count = 0;
        if matches!(self.connection_state, ConnectionState::Error(_)) {
            self.connection_state = ConnectionState::Disconnected;
        }
    }
}

/// Notification message format from claude-notifications
#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationMessage {
    /// Protocol version
    #[serde(default)]
    pub version: Option<String>,
    /// Notification type (success, error, warning, info, attention)
    #[serde(rename = "type")]
    pub notification_type: Option<String>,
    /// Message content
    pub message: Option<String>,
    /// Title
    pub title: Option<String>,
    /// Source identifier
    pub source: Option<String>,
    /// Target pane ID
    pub pane_id: Option<u32>,
    /// Target tab index
    pub tab_index: Option<usize>,
    /// Priority (low, normal, high, critical)
    pub priority: Option<String>,
    /// Timestamp (Unix timestamp in milliseconds)
    pub timestamp: Option<u64>,
    /// TTL in milliseconds
    pub ttl_ms: Option<u64>,
    /// Command that triggered the notification
    pub command: Option<String>,
    /// Exit code
    pub exit_code: Option<i32>,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
}

/// Legacy notification message format (simple JSON)
#[derive(Debug, Serialize, Deserialize)]
struct LegacyNotificationMessage {
    /// Message content
    message: String,
}

/// Event bridge error types
#[derive(Debug, Clone)]
pub enum EventBridgeError {
    /// JSON parse error
    ParseError(String),
    /// Connection error
    ConnectionError(String),
    /// Protocol version mismatch
    VersionMismatch(String),
    /// Invalid message format
    InvalidFormat(String),
}

impl std::fmt::Display for EventBridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventBridgeError::ParseError(e) => write!(f, "Parse error: {}", e),
            EventBridgeError::ConnectionError(e) => write!(f, "Connection error: {}", e),
            EventBridgeError::VersionMismatch(e) => write!(f, "Version mismatch: {}", e),
            EventBridgeError::InvalidFormat(e) => write!(f, "Invalid format: {}", e),
        }
    }
}

/// Event bridge health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBridgeHealth {
    /// Whether connected
    pub connected: bool,
    /// Number of errors
    pub error_count: u32,
    /// Last message timestamp
    pub last_message_timestamp: u64,
    /// Protocol version
    pub protocol_version: String,
}

/// Create a test notification message (for testing)
pub fn create_test_message(notification_type: &str, message: &str) -> String {
    let msg = NotificationMessage {
        version: Some("1.0".to_string()),
        notification_type: Some(notification_type.to_string()),
        message: Some(message.to_string()),
        title: Some("Test".to_string()),
        source: Some("test".to_string()),
        pane_id: None,
        tab_index: None,
        priority: None,
        timestamp: Some(0),
        ttl_ms: Some(300_000),
        command: None,
        exit_code: None,
        duration_ms: None,
    };
    serde_json::to_string(&msg).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_bridge_creation() {
        let bridge = EventBridge::new();
        assert!(!bridge.is_connected());
        assert_eq!(bridge.error_count, 0);
    }

    #[test]
    fn test_parse_notification_message() {
        let mut bridge = EventBridge::new();

        let json = r#"{
            "version": "1.0",
            "type": "success",
            "message": "Build completed",
            "title": "Claude Code",
            "source": "claude-notifications"
        }"#;

        let result = bridge.parse_notification(json);
        assert!(result.is_ok());

        let notif = result.unwrap();
        assert_eq!(notif.notification_type, NotificationType::Success);
        assert_eq!(notif.message, "Build completed");
    }

    #[test]
    fn test_parse_legacy_message() {
        let mut bridge = EventBridge::new();

        let json = r#"{"message": "Claude is waiting for you..."}"#;

        let result = bridge.parse_notification(json);
        assert!(result.is_ok());

        let notif = result.unwrap();
        assert_eq!(notif.notification_type, NotificationType::Attention);
    }

    #[test]
    fn test_parse_error_handling() {
        let mut bridge = EventBridge::new();

        let invalid_json = "not valid json";

        for _ in 0..5 {
            let _ = bridge.parse_notification(invalid_json);
        }

        assert!(matches!(bridge.connection_state, ConnectionState::Error(_)));
    }

    #[test]
    fn test_health_status() {
        let bridge = EventBridge::new();
        let health = bridge.health_status();

        assert!(!health.connected);
        assert_eq!(health.error_count, 0);
        assert_eq!(health.protocol_version, "1.0");
    }

    #[test]
    fn test_create_test_message() {
        let msg = create_test_message("success", "Test message");
        assert!(msg.contains("success"));
        assert!(msg.contains("Test message"));
    }
}
