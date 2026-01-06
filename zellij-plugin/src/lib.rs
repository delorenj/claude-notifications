//! Zellij Visual Notifications Plugin
//!
//! This plugin provides visual notifications for Claude Code within Zellij terminal multiplexer.
//! It displays border colors, tab badges, and pulse animations when commands complete or
//! require attention.
//!
//! # Features
//! - Pane border color changes (green=success, red=error, yellow=warning)
//! - Tab badge indicators with Unicode icons
//! - Configurable pulse animations
//! - Integration with claude-notifications via IPC
//! - KDL-based configuration with hot-reload
//! - Accessibility features (high contrast, reduced motion)

mod config;
mod state;
mod animation;
mod colors;
mod notification;
mod event_bridge;
mod queue;
mod renderer;

#[cfg(test)]
mod tests;

use std::collections::BTreeMap;
use zellij_tile::prelude::*;

use crate::config::{Config, ConfigManager};
use crate::state::{PluginState, VisualState};
use crate::animation::AnimationEngine;
use crate::colors::ColorManager;
use crate::notification::Notification;
use crate::event_bridge::EventBridge;
use crate::queue::NotificationQueue;
use crate::renderer::Renderer;

/// Main plugin state structure
#[derive(Default)]
pub struct State {
    /// Plugin configuration
    config: Config,
    /// Configuration manager for hot-reload
    config_manager: ConfigManager,
    /// Current visual state per pane
    pane_states: BTreeMap<u32, VisualState>,
    /// Animation engine for visual effects
    animation_engine: AnimationEngine,
    /// Color management system
    color_manager: ColorManager,
    /// Event bridge for claude-notifications IPC
    event_bridge: EventBridge,
    /// Notification queue with priority and TTL
    notification_queue: NotificationQueue,
    /// Renderer for visual output
    renderer: Renderer,
    /// Plugin lifecycle state
    plugin_state: PluginState,
    /// Current tick count for animations
    tick_count: u64,
    /// Last update timestamp
    last_update_ms: u64,
    /// Error state for fallback mode
    error_state: Option<String>,
    /// Current pane info
    own_pane_id: Option<u32>,
    /// Mode info
    mode_info: ModeInfo,
    /// Tab info for status bar
    tab_info: Option<LocalTabInfo>,
    /// All pane manifests
    pane_manifest: BTreeMap<u32, LocalPaneInfo>,
}

/// Local tab information for status bar rendering (distinct from zellij_tile::TabInfo)
#[derive(Default, Clone)]
struct LocalTabInfo {
    position: usize,
    name: String,
    active: bool,
    panes_count: usize,
}

/// Local pane information (distinct from zellij_tile types)
#[derive(Default, Clone)]
struct LocalPaneInfo {
    id: u32,
    is_focused: bool,
    title: String,
    is_plugin: bool,
}

register_plugin!(State);

impl ZellijPlugin for State {
    fn load(&mut self, configuration: BTreeMap<String, String>) {
        // Request necessary permissions
        request_permission(&[
            PermissionType::ReadApplicationState,
            PermissionType::ChangeApplicationState,
            PermissionType::RunCommands,
        ]);

        // Subscribe to events
        subscribe(&[
            EventType::ModeUpdate,
            EventType::TabUpdate,
            EventType::PaneUpdate,
            EventType::Timer,
            EventType::Key,
            EventType::PermissionRequestResult,
            EventType::CustomMessage,
        ]);

        // Initialize configuration from plugin configuration map
        self.config = Config::from_plugin_config(&configuration);
        self.config_manager = ConfigManager::new();

        // Initialize color manager with theme
        self.color_manager = ColorManager::new(&self.config.theme);

        // Initialize animation engine
        self.animation_engine = AnimationEngine::new(&self.config.animation);

        // Initialize notification queue
        self.notification_queue = NotificationQueue::new(
            self.config.queue_max_size,
            self.config.notification_timeout_ms,
        );

        // Initialize renderer
        self.renderer = Renderer::new(&self.config);

        // Initialize event bridge for IPC
        self.event_bridge = EventBridge::new();

        // Set plugin state to initialized
        self.plugin_state = PluginState::Initialized;

        // Start timer for animations (60fps = ~16ms, we use 50ms for efficiency)
        set_timeout(0.05);

        // Log initialization
        log_info("Zellij Visual Notifications plugin loaded");
    }

    fn update(&mut self, event: Event) -> bool {
        let mut should_render = false;

        match event {
            Event::Timer(_elapsed) => {
                should_render = self.handle_timer();
            }
            Event::ModeUpdate(mode_info) => {
                self.mode_info = mode_info;
                should_render = true;
            }
            Event::TabUpdate(tabs) => {
                should_render = self.handle_tab_update(tabs);
            }
            Event::PaneUpdate(pane_manifest) => {
                should_render = self.handle_pane_update(pane_manifest);
            }
            Event::Key(key) => {
                should_render = self.handle_key(key);
            }
            Event::CustomMessage(message, payload) => {
                should_render = self.handle_custom_message(message, payload);
            }
            Event::PermissionRequestResult(result) => {
                self.handle_permission_result(result);
            }
            _ => {}
        }

        // Process any queued notifications
        if self.process_notification_queue() {
            should_render = true;
        }

        should_render
    }

    fn render(&mut self, rows: usize, cols: usize) {
        // Render the status bar widget
        self.renderer.render_status_bar(
            rows,
            cols,
            &self.pane_states,
            &self.notification_queue,
            &self.color_manager,
            &self.animation_engine,
            self.tick_count,
        );
    }

    fn pipe(&mut self, pipe_message: PipeMessage) -> bool {
        // Handle piped messages from claude-notifications
        self.handle_pipe_message(pipe_message)
    }
}

impl State {
    /// Handle timer events for animations
    fn handle_timer(&mut self) -> bool {
        self.tick_count = self.tick_count.wrapping_add(1);

        // Update animation states
        let mut needs_render = false;

        for (_pane_id, visual_state) in self.pane_states.iter_mut() {
            if visual_state.is_animating {
                self.animation_engine.update_animation(visual_state, self.tick_count);
                needs_render = true;
            }
        }

        // Check for expired notifications
        self.notification_queue.cleanup_expired();

        // Restart timer for next tick
        set_timeout(0.05);

        needs_render
    }

    /// Handle tab update events
    fn handle_tab_update(&mut self, tabs: Vec<zellij_tile::prelude::TabInfo>) -> bool {
        // Find active tab
        for tab in tabs {
            if tab.active {
                self.tab_info = Some(LocalTabInfo {
                    position: tab.position,
                    name: tab.name.clone(),
                    active: true,
                    panes_count: 0, // Pane count tracked separately via PaneUpdate
                });
                break;
            }
        }
        true
    }

    /// Handle pane update events
    fn handle_pane_update(&mut self, pane_manifest: PaneManifest) -> bool {
        // Update pane information
        self.pane_manifest.clear();

        for (_tab_index, pane_info_list) in pane_manifest.panes {
            for pane in pane_info_list {
                let info = LocalPaneInfo {
                    id: pane.id,
                    is_focused: pane.is_focused,
                    title: pane.title.clone(),
                    is_plugin: pane.is_plugin,
                };
                self.pane_manifest.insert(pane.id, info.clone());

                // If this pane is focused and has a notification, clear it
                if pane.is_focused {
                    self.clear_pane_notification(pane.id);
                }
            }
        }

        true
    }

    /// Handle key events
    fn handle_key(&mut self, key: Key) -> bool {
        // Handle key shortcuts for plugin actions
        match key {
            Key::Ctrl('n') => {
                // Clear all notifications
                self.clear_all_notifications();
                true
            }
            _ => false,
        }
    }

    /// Handle custom messages (from other plugins or IPC)
    fn handle_custom_message(&mut self, message: String, payload: String) -> bool {
        match message.as_str() {
            "notification" => {
                self.handle_notification_message(&payload)
            }
            "clear" => {
                self.clear_all_notifications();
                true
            }
            "config_reload" => {
                self.reload_config();
                true
            }
            _ => false,
        }
    }

    /// Handle permission request results
    fn handle_permission_result(&mut self, result: PermissionStatus) {
        match result {
            PermissionStatus::Granted => {
                self.plugin_state = PluginState::Running;
                log_info("Permissions granted, plugin fully operational");
            }
            PermissionStatus::Denied => {
                self.error_state = Some("Permissions denied, running in fallback mode".to_string());
                self.plugin_state = PluginState::FallbackMode;
                log_warn("Permissions denied, entering fallback mode");
            }
        }
    }

    /// Handle piped messages from external sources (claude-notifications)
    fn handle_pipe_message(&mut self, pipe_message: PipeMessage) -> bool {
        // Parse the pipe message
        if let Some(payload) = pipe_message.payload {
            return self.handle_notification_message(&payload);
        }
        false
    }

    /// Handle notification messages from IPC
    fn handle_notification_message(&mut self, payload: &str) -> bool {
        match self.event_bridge.parse_notification(payload) {
            Ok(notification) => {
                self.queue_notification(notification);
                true
            }
            Err(e) => {
                log_warn(&format!("Failed to parse notification: {}", e));
                false
            }
        }
    }

    /// Queue a notification for display
    fn queue_notification(&mut self, notification: Notification) {
        self.notification_queue.enqueue(notification.clone());

        // If targeting a specific pane, update its visual state
        if let Some(pane_id) = notification.pane_id {
            self.update_pane_visual_state(pane_id, &notification);
        }
    }

    /// Process queued notifications
    fn process_notification_queue(&mut self) -> bool {
        let mut needs_render = false;

        while let Some(notification) = self.notification_queue.dequeue_ready() {
            if let Some(pane_id) = notification.pane_id {
                self.update_pane_visual_state(pane_id, &notification);
                needs_render = true;
            }
        }

        needs_render
    }

    /// Update visual state for a pane based on notification
    fn update_pane_visual_state(&mut self, pane_id: u32, notification: &Notification) {
        let visual_state = self.pane_states.entry(pane_id).or_insert_with(VisualState::default);

        // Set border color based on notification type
        visual_state.border_color = self.color_manager.get_notification_color(&notification.notification_type);

        // Set badge icon
        visual_state.badge_icon = notification.notification_type.icon();

        // Start animation if enabled
        if self.config.animation.enabled {
            visual_state.is_animating = true;
            visual_state.animation_start_tick = self.tick_count;
            visual_state.animation_style = self.config.animation.style.clone();
        }

        // Set notification message for tooltip
        visual_state.notification_message = Some(notification.message.clone());
        visual_state.notification_type = Some(notification.notification_type.clone());
    }

    /// Clear notification state for a pane
    fn clear_pane_notification(&mut self, pane_id: u32) {
        if let Some(visual_state) = self.pane_states.get_mut(&pane_id) {
            visual_state.clear();
        }
        self.notification_queue.remove_for_pane(pane_id);
    }

    /// Clear all notifications
    fn clear_all_notifications(&mut self) {
        for (_pane_id, visual_state) in self.pane_states.iter_mut() {
            visual_state.clear();
        }
        self.notification_queue.clear();
    }

    /// Reload configuration
    fn reload_config(&mut self) {
        if let Some(new_config) = self.config_manager.reload() {
            self.config = new_config;
            self.color_manager = ColorManager::new(&self.config.theme);
            self.animation_engine = AnimationEngine::new(&self.config.animation);
            self.renderer = Renderer::new(&self.config);
            log_info("Configuration reloaded");
        }
    }
}

/// Log info message
fn log_info(msg: &str) {
    // Use Zellij's logging
    eprintln!("[INFO] zellij-visual-notifications: {}", msg);
}

/// Log warning message
fn log_warn(msg: &str) {
    eprintln!("[WARN] zellij-visual-notifications: {}", msg);
}
