import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

export interface NotificationItem {
  id: string;
  userId: string;
  type:
    | 'PROJECT_INVITATION'
    | 'FACULTY_SUPERVISION_REQUEST'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_DECLINED'
    | 'TASK_ASSIGNED'
    | 'DEADLINE_REMINDER'
    | 'SKILL_VERIFIED'
    | 'SKILL_REJECTED'
    | 'SYSTEM_ALERT';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) return;

    const notif = notifications.find((n) => n.id === id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (notif && !notif.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'PROJECT_INVITATION':
        return { icon: 'fa fa-envelope-open-text', color: '#3b82f6', bg: '#eff6ff' };
      case 'FACULTY_SUPERVISION_REQUEST':
        return { icon: 'fa fa-user-tie', color: '#6366f1', bg: '#eef2ff' };
      case 'INVITATION_ACCEPTED':
        return { icon: 'fa fa-check-circle', color: '#10b981', bg: '#ecfdf5' };
      case 'INVITATION_DECLINED':
        return { icon: 'fa fa-times-circle', color: '#ef4444', bg: '#fef2f2' };
      case 'TASK_ASSIGNED':
        return { icon: 'fa fa-tasks', color: '#8b5cf6', bg: '#f5f3ff' };
      case 'DEADLINE_REMINDER':
        return { icon: 'fa fa-clock', color: '#f59e0b', bg: '#fffbeb' };
      case 'SKILL_VERIFIED':
        return { icon: 'fa fa-award', color: '#10b981', bg: '#ecfdf5' };
      case 'SKILL_REJECTED':
        return { icon: 'fa fa-exclamation-triangle', color: '#ef4444', bg: '#fef2f2' };
      default:
        return { icon: 'fa fa-bell', color: '#6366f1', bg: '#eef2ff' };
    }
  };

  const displayedNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className={`notification-bell-container ${className || ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="View Notifications"
        aria-label="Notifications"
      >
        <i className="fa fa-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-drawer">
          {/* Header */}
          <div className="notification-drawer-header">
            <div className="notification-header-left">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <span className="notification-unread-pill">{unreadCount} new</span>
              )}
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all-btn"
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  title="Mark all as read"
                >
                  <i className="fa fa-check-double"></i> Mark all read
                </button>
              )}
              <button
                type="button"
                className="notification-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close notifications"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="notification-filter-tabs">
            <button
              type="button"
              className={`notification-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`notification-tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="notification-list">
            {displayedNotifications.length === 0 ? (
              <div className="notification-empty-state">
                <div className="notification-empty-icon">
                  <i className="fa fa-bell-slash"></i>
                </div>
                <p className="notification-empty-title">All caught up!</p>
                <p className="notification-empty-subtitle">
                  {filter === 'unread'
                    ? 'You have zero unread notifications.'
                    : 'No notifications at this time.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const iconInfo = getTypeIcon(notif.type);
                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${!notif.isRead ? 'unread' : 'read'}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div
                      className="notification-item-icon"
                      style={{ color: iconInfo.color, backgroundColor: iconInfo.bg }}
                    >
                      <i className={iconInfo.icon}></i>
                    </div>

                    <div className="notification-item-content">
                      <div className="notification-item-top">
                        <span className="notification-item-title">{notif.title}</span>
                        <span className="notification-item-time">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="notification-item-message">{notif.message}</p>
                      {notif.link && (
                        <span className="notification-item-link-hint">
                          Click to view details <i className="fa fa-arrow-right"></i>
                        </span>
                      )}
                    </div>

                    <div className="notification-item-actions">
                      {!notif.isRead && (
                        <button
                          type="button"
                          className="notification-item-btn read-btn"
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          title="Mark as read"
                        >
                          <i className="fa fa-check"></i>
                        </button>
                      )}
                      <button
                        type="button"
                        className="notification-item-btn dismiss-btn"
                        onClick={(e) => handleDismiss(notif.id, e)}
                        title="Dismiss"
                      >
                        <i className="fa fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

