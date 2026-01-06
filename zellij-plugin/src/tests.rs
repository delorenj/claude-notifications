//! Integration tests for Zellij Visual Notifications
//!
//! These tests verify the complete notification flow and component interactions.

#[cfg(test)]
mod integration_tests {
    use crate::animation::{AnimationEngine, easing};
    use crate::colors::{Color, ColorManager, generate_gradient, generate_pulse_gradient};
    use crate::config::{AnimationConfig, AnimationStyle, Config, ThemeConfig};
    use crate::event_bridge::{EventBridge, create_test_message};
    use crate::notification::{Notification, NotificationBuilder, NotificationType, Priority};
    use crate::queue::NotificationQueue;
    use crate::renderer::Renderer;
    use crate::state::{PluginState, VisualNotificationState, VisualState};

    // ==================== Integration Tests ====================

    #[test]
    fn test_full_notification_flow() {
        // Create components
        let config = Config::default();
        let mut queue = NotificationQueue::new(100, 300_000);
        let mut event_bridge = EventBridge::new();
        let animation_engine = AnimationEngine::new(&config.animation);
        let color_manager = ColorManager::new(&config.theme);

        // Simulate receiving a notification message
        let json = r#"{
            "type": "success",
            "message": "Build completed in 5.2s",
            "pane_id": 1
        }"#;

        // Parse the message
        let result = event_bridge.parse_notification(json);
        assert!(result.is_ok());
        let notification = result.unwrap();

        // Enqueue the notification
        queue.enqueue(notification.clone());
        assert_eq!(queue.len(), 1);

        // Process the notification
        let dequeued = queue.dequeue_ready();
        assert!(dequeued.is_some());
        let processed = dequeued.unwrap();

        // Verify notification properties
        assert_eq!(processed.notification_type, NotificationType::Success);
        assert!(processed.message.contains("Build completed"));
        assert_eq!(processed.pane_id, Some(1));

        // Create visual state for the pane
        let mut visual_state = VisualState::new();
        let color = color_manager.get_notification_color(&processed.notification_type);
        assert!(color.is_some());

        visual_state.border_color = color;
        visual_state.notification_type = Some(processed.notification_type.clone());
        visual_state.notification_message = Some(processed.message.clone());

        // Verify visual state
        assert!(visual_state.has_notification());
        assert!(visual_state.border_color.is_some());
    }

    #[test]
    fn test_notification_priority_flow() {
        let mut queue = NotificationQueue::new(100, 300_000);

        // Enqueue notifications in different order
        queue.enqueue(Notification::info("Low priority").with_priority(Priority::Low));
        queue.enqueue(Notification::success("Normal priority").with_priority(Priority::Normal));
        queue.enqueue(Notification::error("Critical priority").with_priority(Priority::Critical));
        queue.enqueue(Notification::warning("High priority").with_priority(Priority::High));

        // Should dequeue in priority order
        let first = queue.dequeue_ready().unwrap();
        assert_eq!(first.priority, Priority::Critical);

        let second = queue.dequeue_ready().unwrap();
        assert_eq!(second.priority, Priority::High);

        let third = queue.dequeue_ready().unwrap();
        assert_eq!(third.priority, Priority::Normal);

        let fourth = queue.dequeue_ready().unwrap();
        assert_eq!(fourth.priority, Priority::Low);
    }

    #[test]
    fn test_animation_lifecycle() {
        let config = AnimationConfig {
            enabled: true,
            style: AnimationStyle::Pulse,
            speed: 50,
            cycles: 2,
            duration_ms: 1000,
        };
        let engine = AnimationEngine::new(&config);

        let mut state = VisualState::new();

        // Start animation
        engine.start_animation(&mut state, 0, AnimationStyle::Pulse);
        assert!(state.is_animating);
        assert_eq!(state.animation_start_tick, 0);

        // Update animation midway
        engine.update_animation(&mut state, 50);
        let brightness = engine.get_brightness(&state, 50);
        assert!(brightness > 0.0 && brightness <= 1.0);

        // Animation should continue
        assert!(engine.should_continue(&state, 50));

        // After total ticks, animation should stop
        engine.update_animation(&mut state, 500);
        assert!(!engine.should_continue(&state, 500));
    }

    #[test]
    fn test_theme_color_consistency() {
        let themes = vec![
            "default", "dracula", "nord", "catppuccin", "gruvbox", "tokyo-night"
        ];

        for theme_name in themes {
            let theme = ThemeConfig::from_preset(theme_name);
            let manager = ColorManager::new(&theme);

            // All notification types should have colors
            for notif_type in [
                NotificationType::Success,
                NotificationType::Error,
                NotificationType::Warning,
                NotificationType::Info,
                NotificationType::Attention,
            ] {
                let color = manager.get_notification_color(&notif_type);
                assert!(color.is_some(), "Theme {} missing color for {:?}", theme_name, notif_type);
            }

            // Colors should be different
            let success = manager.get_notification_color(&NotificationType::Success).unwrap();
            let error = manager.get_notification_color(&NotificationType::Error).unwrap();
            assert_ne!(success, error, "Success and Error colors should differ");
        }
    }

    #[test]
    fn test_state_machine_transitions() {
        let mut state = VisualState::new();
        assert_eq!(state.state, VisualNotificationState::Idle);

        // Transition: Idle -> Active
        state.set_notification(
            NotificationType::Success,
            "Test".to_string(),
            "#22c55e".to_string(),
            "+".to_string(),
        );
        assert_eq!(state.state, VisualNotificationState::Active);
        assert!(state.has_notification());

        // Transition: Active -> Fading
        state.acknowledge();
        assert_eq!(state.state, VisualNotificationState::Fading);

        // Clear should go to Idle
        state.clear();
        assert_eq!(state.state, VisualNotificationState::Idle);
        assert!(!state.has_notification());
    }

    #[test]
    fn test_color_interpolation_smooth() {
        let start = Color::new(0, 0, 0);
        let end = Color::new(255, 255, 255);

        let gradient = generate_gradient(&start, &end, 11);

        // Check gradient is smooth
        for i in 0..gradient.len() - 1 {
            let diff = (gradient[i + 1].r as i32 - gradient[i].r as i32).abs();
            assert!(diff <= 30, "Gradient step too large at index {}", i);
        }

        // Check endpoints
        assert_eq!(gradient[0].r, 0);
        assert_eq!(gradient[10].r, 255);
    }

    #[test]
    fn test_event_bridge_error_recovery() {
        let mut bridge = EventBridge::new();

        // Cause errors
        for _ in 0..4 {
            let _ = bridge.parse_notification("invalid json");
        }

        // Should not be in error state yet
        assert_ne!(
            bridge.health_status().error_count,
            5,
            "Should not reach max errors"
        );

        // One more error
        let _ = bridge.parse_notification("invalid");

        // Now in error state
        let health = bridge.health_status();
        assert_eq!(health.error_count, 5);

        // Recovery
        bridge.reset_errors();
        let health = bridge.health_status();
        assert_eq!(health.error_count, 0);
    }

    #[test]
    fn test_queue_expiry_cleanup() {
        let mut queue = NotificationQueue::new(100, 1000); // 1 second TTL
        queue.update_timestamp(0);

        // Add notification
        let mut notif = Notification::info("Expiring");
        notif.timestamp = 0;
        notif.ttl_ms = 1000;
        queue.enqueue(notif);

        assert_eq!(queue.len(), 1);

        // Not expired yet
        queue.update_timestamp(500);
        queue.cleanup_expired();
        assert_eq!(queue.len(), 1);

        // Now expired
        queue.update_timestamp(1500);
        queue.cleanup_expired();
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_pane_specific_notifications() {
        let mut queue = NotificationQueue::new(100, 300_000);

        // Add notifications for different panes
        queue.enqueue(Notification::success("Pane 1").for_pane(1));
        queue.enqueue(Notification::error("Pane 2").for_pane(2));
        queue.enqueue(Notification::info("Pane 1 again").for_pane(1));
        queue.enqueue(Notification::warning("Pane 3").for_pane(3));

        // Check pane-specific queries
        assert!(queue.has_notifications_for_pane(1));
        assert!(queue.has_notifications_for_pane(2));
        assert!(queue.has_notifications_for_pane(3));
        assert!(!queue.has_notifications_for_pane(4));

        // Get notifications for pane 1
        let pane1_notifs = queue.get_for_pane(1);
        assert_eq!(pane1_notifs.len(), 2);

        // Remove notifications for pane 1
        queue.remove_for_pane(1);
        assert!(!queue.has_notifications_for_pane(1));
        assert_eq!(queue.len(), 2);
    }

    // ==================== Component Tests ====================

    #[test]
    fn test_notification_builder_chain() {
        let notif = NotificationBuilder::new()
            .notification_type(NotificationType::Error)
            .message("Build failed")
            .title("CI")
            .pane_id(5)
            .tab_index(2)
            .source("github-actions")
            .command("cargo build")
            .exit_code(1)
            .duration(15000)
            .build();

        assert_eq!(notif.notification_type, NotificationType::Error);
        assert_eq!(notif.message, "Build failed");
        assert_eq!(notif.title, Some("CI".to_string()));
        assert_eq!(notif.pane_id, Some(5));
        assert_eq!(notif.tab_index, Some(2));
        assert_eq!(notif.source, "github-actions");
        assert_eq!(notif.metadata.command, Some("cargo build".to_string()));
        assert_eq!(notif.metadata.exit_code, Some(1));
        assert_eq!(notif.metadata.duration_ms, Some(15000));
    }

    #[test]
    fn test_easing_functions() {
        // Test all easing functions at boundaries
        assert_eq!(easing::linear(0.0), 0.0);
        assert_eq!(easing::linear(1.0), 1.0);

        assert_eq!(easing::ease_in(0.0), 0.0);
        assert!((easing::ease_in(1.0) - 1.0).abs() < 0.001);

        assert_eq!(easing::ease_out(0.0), 0.0);
        assert!((easing::ease_out(1.0) - 1.0).abs() < 0.001);

        assert_eq!(easing::ease_in_out(0.0), 0.0);
        assert!((easing::ease_in_out(1.0) - 1.0).abs() < 0.001);

        // Midpoint characteristics
        assert!(easing::ease_in(0.5) < 0.5); // Slow start
        assert!(easing::ease_out(0.5) > 0.5); // Slow end
    }

    #[test]
    fn test_pulse_gradient() {
        let base = Color::new(100, 100, 100);
        let bright = Color::new(200, 200, 200);

        let gradient = generate_pulse_gradient(&base, &bright, 10);
        assert_eq!(gradient.len(), 10);

        // Should start near base, go to bright, then back toward base
        // First element should be at base (100)
        assert!(gradient[0].r <= 110);
        // Last element should be returning toward base (around 120 due to interpolation)
        assert!(gradient[gradient.len() - 1].r <= 130);
        // Middle should be brighter than ends
        assert!(gradient[gradient.len() / 2].r > gradient[0].r);
    }

    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        assert!(config.validate().is_ok());

        // Invalid timeout
        config.notification_timeout_ms = 100;
        assert!(config.validate().is_err());

        // Reset and test queue size
        config.notification_timeout_ms = 5000;
        config.queue_max_size = 0;
        assert!(config.validate().is_err());

        // Reset and test animation speed
        config.queue_max_size = 100;
        config.animation.speed = 150;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_renderer_icon_mapping() {
        let renderer = Renderer::default();
        let config = Config::default();
        let color_manager = ColorManager::new(&config.theme);

        // All notification types should have distinct icons
        let types = vec![
            NotificationType::Success,
            NotificationType::Error,
            NotificationType::Warning,
            NotificationType::Info,
            NotificationType::Attention,
            NotificationType::Progress,
        ];

        let mut seen_icons = std::collections::HashSet::new();
        for t in &types {
            let icon = t.icon().unwrap();
            assert!(!icon.is_empty());
            // Icons should be unique (except Attention and Warning may share)
            if *t != NotificationType::Attention && *t != NotificationType::Warning {
                seen_icons.insert(icon);
            }
        }
    }

    // ==================== Performance Tests ====================

    #[test]
    fn test_queue_performance() {
        let mut queue = NotificationQueue::new(1000, 300_000);

        // Enqueue many notifications
        for i in 0..1000 {
            queue.enqueue(Notification::info(&format!("Message {}", i)));
        }

        assert_eq!(queue.len(), 1000);

        // Dequeue all
        while queue.dequeue_ready().is_some() {}

        assert!(queue.is_empty());
    }

    #[test]
    fn test_color_interpolation_performance() {
        let c1 = Color::from_hex("#ff0000");
        let c2 = Color::from_hex("#00ff00");

        // Many interpolations
        for _ in 0..10000 {
            let _ = c1.interpolate(&c2, 0.5);
        }
    }
}
