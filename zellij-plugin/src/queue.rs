//! Notification queue module for Zellij Visual Notifications
//!
//! Manages queued notifications with priority and TTL support.

use std::collections::VecDeque;
use crate::notification::{Notification, Priority};

/// Notification queue with priority and TTL support
#[derive(Debug)]
pub struct NotificationQueue {
    /// Queue for critical priority notifications
    critical_queue: VecDeque<Notification>,
    /// Queue for high priority notifications
    high_queue: VecDeque<Notification>,
    /// Queue for normal priority notifications
    normal_queue: VecDeque<Notification>,
    /// Queue for low priority notifications
    low_queue: VecDeque<Notification>,
    /// Maximum queue size (per priority level)
    max_size: usize,
    /// Default TTL for notifications in milliseconds
    default_ttl_ms: u64,
    /// Current timestamp (updated externally)
    current_timestamp: u64,
    /// Total notifications processed
    total_processed: u64,
    /// Total notifications expired
    total_expired: u64,
}

impl Default for NotificationQueue {
    fn default() -> Self {
        Self::new(100, 300_000)
    }
}

impl NotificationQueue {
    /// Create a new notification queue
    pub fn new(max_size: usize, default_ttl_ms: u64) -> Self {
        Self {
            critical_queue: VecDeque::with_capacity(max_size),
            high_queue: VecDeque::with_capacity(max_size),
            normal_queue: VecDeque::with_capacity(max_size),
            low_queue: VecDeque::with_capacity(max_size),
            max_size,
            default_ttl_ms,
            current_timestamp: 0,
            total_processed: 0,
            total_expired: 0,
        }
    }

    /// Set the current timestamp
    pub fn update_timestamp(&mut self, timestamp: u64) {
        self.current_timestamp = timestamp;
    }

    /// Enqueue a notification
    pub fn enqueue(&mut self, mut notification: Notification) {
        // Set default TTL if not specified
        if notification.ttl_ms == 0 {
            notification.ttl_ms = self.default_ttl_ms;
        }

        // Set timestamp if not specified
        if notification.timestamp == 0 {
            notification.timestamp = self.current_timestamp;
        }

        // Copy max_size before mutable borrow
        let max_size = self.max_size;
        let queue = self.get_queue_mut(&notification.priority);

        // If queue is full, remove oldest
        if queue.len() >= max_size {
            queue.pop_front();
        }

        queue.push_back(notification);
    }

    /// Dequeue the highest priority ready notification
    pub fn dequeue_ready(&mut self) -> Option<Notification> {
        // Try queues in priority order
        for priority in [Priority::Critical, Priority::High, Priority::Normal, Priority::Low] {
            let queue = self.get_queue_mut(&priority);
            if let Some(notification) = queue.pop_front() {
                self.total_processed += 1;
                return Some(notification);
            }
        }
        None
    }

    /// Peek at the highest priority notification without removing
    pub fn peek(&self) -> Option<&Notification> {
        for priority in [Priority::Critical, Priority::High, Priority::Normal, Priority::Low] {
            let queue = self.get_queue(&priority);
            if let Some(notification) = queue.front() {
                return Some(notification);
            }
        }
        None
    }

    /// Get the total number of notifications in queue
    pub fn len(&self) -> usize {
        self.critical_queue.len()
            + self.high_queue.len()
            + self.normal_queue.len()
            + self.low_queue.len()
    }

    /// Check if the queue is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get count for a specific priority
    pub fn count_by_priority(&self, priority: &Priority) -> usize {
        self.get_queue(priority).len()
    }

    /// Clear all notifications
    pub fn clear(&mut self) {
        self.critical_queue.clear();
        self.high_queue.clear();
        self.normal_queue.clear();
        self.low_queue.clear();
    }

    /// Clear notifications for a specific pane
    pub fn remove_for_pane(&mut self, pane_id: u32) {
        self.critical_queue.retain(|n| n.pane_id != Some(pane_id));
        self.high_queue.retain(|n| n.pane_id != Some(pane_id));
        self.normal_queue.retain(|n| n.pane_id != Some(pane_id));
        self.low_queue.retain(|n| n.pane_id != Some(pane_id));
    }

    /// Clear notifications for a specific tab
    pub fn remove_for_tab(&mut self, tab_index: usize) {
        self.critical_queue.retain(|n| n.tab_index != Some(tab_index));
        self.high_queue.retain(|n| n.tab_index != Some(tab_index));
        self.normal_queue.retain(|n| n.tab_index != Some(tab_index));
        self.low_queue.retain(|n| n.tab_index != Some(tab_index));
    }

    /// Remove expired notifications
    pub fn cleanup_expired(&mut self) {
        let current = self.current_timestamp;
        let mut expired_count = 0u64;

        for queue in [
            &mut self.critical_queue,
            &mut self.high_queue,
            &mut self.normal_queue,
            &mut self.low_queue,
        ] {
            let before_len = queue.len();
            queue.retain(|n| !n.is_expired(current));
            expired_count += (before_len - queue.len()) as u64;
        }

        self.total_expired += expired_count;
    }

    /// Get queue statistics
    pub fn stats(&self) -> QueueStats {
        QueueStats {
            total_queued: self.len(),
            critical_count: self.critical_queue.len(),
            high_count: self.high_queue.len(),
            normal_count: self.normal_queue.len(),
            low_count: self.low_queue.len(),
            total_processed: self.total_processed,
            total_expired: self.total_expired,
            max_size: self.max_size,
        }
    }

    /// Get all notifications for a pane
    pub fn get_for_pane(&self, pane_id: u32) -> Vec<&Notification> {
        let mut result = Vec::new();

        for queue in [
            &self.critical_queue,
            &self.high_queue,
            &self.normal_queue,
            &self.low_queue,
        ] {
            for notification in queue.iter() {
                if notification.pane_id == Some(pane_id) {
                    result.push(notification);
                }
            }
        }

        result
    }

    /// Get all notifications
    pub fn all(&self) -> Vec<&Notification> {
        let mut result = Vec::new();

        for queue in [
            &self.critical_queue,
            &self.high_queue,
            &self.normal_queue,
            &self.low_queue,
        ] {
            result.extend(queue.iter());
        }

        result
    }

    /// Check if there are any notifications for a pane
    pub fn has_notifications_for_pane(&self, pane_id: u32) -> bool {
        for queue in [
            &self.critical_queue,
            &self.high_queue,
            &self.normal_queue,
            &self.low_queue,
        ] {
            if queue.iter().any(|n| n.pane_id == Some(pane_id)) {
                return true;
            }
        }
        false
    }

    /// Get the highest priority notification for a pane
    pub fn get_highest_priority_for_pane(&self, pane_id: u32) -> Option<&Notification> {
        for queue in [
            &self.critical_queue,
            &self.high_queue,
            &self.normal_queue,
            &self.low_queue,
        ] {
            for notification in queue.iter() {
                if notification.pane_id == Some(pane_id) {
                    return Some(notification);
                }
            }
        }
        None
    }

    /// Helper: Get queue reference for priority
    fn get_queue(&self, priority: &Priority) -> &VecDeque<Notification> {
        match priority {
            Priority::Critical => &self.critical_queue,
            Priority::High => &self.high_queue,
            Priority::Normal => &self.normal_queue,
            Priority::Low => &self.low_queue,
        }
    }

    /// Helper: Get mutable queue reference for priority
    fn get_queue_mut(&mut self, priority: &Priority) -> &mut VecDeque<Notification> {
        match priority {
            Priority::Critical => &mut self.critical_queue,
            Priority::High => &mut self.high_queue,
            Priority::Normal => &mut self.normal_queue,
            Priority::Low => &mut self.low_queue,
        }
    }
}

/// Queue statistics
#[derive(Debug, Clone, Default)]
pub struct QueueStats {
    /// Total notifications currently queued
    pub total_queued: usize,
    /// Critical priority count
    pub critical_count: usize,
    /// High priority count
    pub high_count: usize,
    /// Normal priority count
    pub normal_count: usize,
    /// Low priority count
    pub low_count: usize,
    /// Total notifications processed
    pub total_processed: u64,
    /// Total notifications expired
    pub total_expired: u64,
    /// Maximum queue size
    pub max_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notification::NotificationType;

    #[test]
    fn test_queue_creation() {
        let queue = NotificationQueue::new(100, 300_000);
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_enqueue_dequeue() {
        let mut queue = NotificationQueue::new(100, 300_000);

        let notif = Notification::success("Test message");
        queue.enqueue(notif);

        assert_eq!(queue.len(), 1);
        assert!(!queue.is_empty());

        let dequeued = queue.dequeue_ready();
        assert!(dequeued.is_some());
        assert_eq!(dequeued.unwrap().message, "Test message");
        assert!(queue.is_empty());
    }

    #[test]
    fn test_priority_ordering() {
        let mut queue = NotificationQueue::new(100, 300_000);

        // Enqueue in reverse priority order
        queue.enqueue(Notification::info("Low").with_priority(Priority::Low));
        queue.enqueue(Notification::info("Normal").with_priority(Priority::Normal));
        queue.enqueue(Notification::info("High").with_priority(Priority::High));
        queue.enqueue(Notification::info("Critical").with_priority(Priority::Critical));

        // Should dequeue in priority order
        assert_eq!(queue.dequeue_ready().unwrap().message, "Critical");
        assert_eq!(queue.dequeue_ready().unwrap().message, "High");
        assert_eq!(queue.dequeue_ready().unwrap().message, "Normal");
        assert_eq!(queue.dequeue_ready().unwrap().message, "Low");
    }

    #[test]
    fn test_expiry_cleanup() {
        let mut queue = NotificationQueue::new(100, 5000);
        queue.update_timestamp(1000);

        let mut notif = Notification::info("Test");
        notif.timestamp = 1000;
        notif.ttl_ms = 5000;
        queue.enqueue(notif);

        // Not expired yet
        queue.update_timestamp(5000);
        queue.cleanup_expired();
        assert_eq!(queue.len(), 1);

        // Now expired
        queue.update_timestamp(7000);
        queue.cleanup_expired();
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_remove_for_pane() {
        let mut queue = NotificationQueue::new(100, 300_000);

        queue.enqueue(Notification::info("Pane 1").for_pane(1));
        queue.enqueue(Notification::info("Pane 2").for_pane(2));
        queue.enqueue(Notification::info("Pane 1 again").for_pane(1));

        assert_eq!(queue.len(), 3);

        queue.remove_for_pane(1);
        assert_eq!(queue.len(), 1);
        assert!(queue.peek().unwrap().message.contains("Pane 2"));
    }

    #[test]
    fn test_max_size_enforcement() {
        let mut queue = NotificationQueue::new(3, 300_000);

        for i in 0..5 {
            queue.enqueue(Notification::info(&format!("Message {}", i)));
        }

        // Should only keep last 3 (per priority level)
        // Note: Notification::info() creates Priority::Low notifications
        assert_eq!(queue.count_by_priority(&Priority::Low), 3);
    }

    #[test]
    fn test_stats() {
        let mut queue = NotificationQueue::new(100, 300_000);

        queue.enqueue(Notification::error("Error"));
        queue.enqueue(Notification::warning("Warning"));
        queue.enqueue(Notification::info("Info"));

        let stats = queue.stats();
        assert_eq!(stats.total_queued, 3);
        assert_eq!(stats.critical_count, 1);
        assert_eq!(stats.high_count, 1);
        assert_eq!(stats.low_count, 1);
    }
}
