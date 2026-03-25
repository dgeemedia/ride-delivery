// admin-web/src/components/notifications/NotificationBell.tsx
//
// Header bell icon with:
//  - Real-time unread count via Socket.IO
//  - Click-away dropdown showing the 10 most recent notifications
//  - Each item navigates to the relevant page on click
//  - Mark all as read button
//  - "See all" link to /notifications

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { getNotificationRoute, getTypeBadgeColor } from '@/utils/notificationRouter';
import { cn } from '@/utils/helpers';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id:        string;
  title:     string;
  message:   string;
  type:      string;
  data:      Record<string, unknown>;
  isRead:    boolean;
  createdAt: string;
}

const NotificationBell: React.FC = () => {
  const navigate  = useNavigate();
  const { on }    = useSocket();

  const [open,          setOpen]          = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch count + recent notifications ─────────────────────────────────────

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setUnread(res.data.data.count);
    } catch {}
  }, []);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { limit: 10 } });
      setNotifications(res.data.data.notifications ?? []);
      setUnread(res.data.data.unreadCount ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // ── Real-time new notification via socket ───────────────────────────────────

  useEffect(() => {
    const unsub = on('notification', () => {
      setUnread(n => n + 1);
      if (open) fetchRecent();
    });
    return unsub;
  }, [on, open, fetchRecent]);

  // ── Open / close ────────────────────────────────────────────────────────────

  const handleOpen = () => {
    setOpen(o => {
      if (!o) fetchRecent();
      return !o;
    });
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnread(0);
      setNotifications(n => n.map(x => ({ ...x, isRead: true })));
    } catch {}
  };

  const handleClick = async (notif: Notification) => {
    setOpen(false);
    if (!notif.isRead) {
      try {
        await api.put(`/notifications/${notif.id}/read`);
        setUnread(n => Math.max(0, n - 1));
        setNotifications(prev => prev.map(x => x.id === notif.id ? { ...x, isRead: true } : x));
      } catch {}
    }
    const route = getNotificationRoute(notif.type, notif.data as any);
    if (route) navigate(route);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-96 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-bold text-gray-900">Notifications</p>
              {unread > 0 && (
                <p className="text-xs text-gray-500">{unread} unread</p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const badge = getTypeBadgeColor(n.type);
                const route = getNotificationRoute(n.type, n.data as any);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3',
                      !n.isRead && 'bg-blue-50 hover:bg-blue-50/80',
                    )}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1">
                      <div className={cn(
                        'w-2 h-2 rounded-full mt-0.5',
                        n.isRead ? 'bg-transparent' : 'bg-blue-500',
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', badge.bg, badge.text)}>
                          {n.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                    </div>

                    {route && (
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              See all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;