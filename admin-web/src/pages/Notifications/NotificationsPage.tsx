// admin-web/src/pages/Notifications/NotificationsPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, ChevronRight, Filter } from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import {
  getNotificationRoute,
  getTypeBadgeColor,
  getTypeLabel,
} from '@/utils/notificationRouter';
import { cn } from '@/utils/helpers';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

interface Notification {
  id:        string;
  title:     string;
  message:   string;
  type:      string;
  data:      Record<string, unknown>;
  isRead:    boolean;
  createdAt: string;
}

// ── Notification row ──────────────────────────────────────────────────────────

const NotifRow: React.FC<{
  notif:    Notification;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
  onClick:  (notif: Notification) => void;
}> = ({ notif, onRead, onDelete, onClick }) => {
  const badge = getTypeBadgeColor(notif.type);
  const route = getNotificationRoute(notif.type, notif.data as any);

  return (
    <div className={cn(
      'flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group',
      !notif.isRead && 'bg-blue-50/60 hover:bg-blue-50',
    )}>
      {/* Unread indicator */}
      <div className="flex-shrink-0 pt-1.5">
        <div className={cn(
          'w-2.5 h-2.5 rounded-full',
          notif.isRead ? 'bg-gray-200' : 'bg-blue-500',
        )} />
      </div>

      {/* Content — clickable */}
      <button
        onClick={() => onClick(notif)}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', badge.bg, badge.text)}>
            {getTypeLabel(notif.type)}
          </span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </span>
          <span className="text-xs text-gray-300">
            {format(new Date(notif.createdAt), 'dd MMM yyyy HH:mm')}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 mb-0.5">{notif.title}</p>
        <p className="text-sm text-gray-500 line-clamp-2">{notif.message}</p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.isRead && (
          <button
            onClick={() => onRead(notif.id)}
            title="Mark as read"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          title="Delete"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {route && (
          <button
            onClick={() => {}}
            className="p-1.5 rounded-lg text-gray-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total,         setTotal]         = useState(0);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [page,          setPage]          = useState(1);
  const [unreadOnly,    setUnreadOnly]    = useState(false);
  const [loading,       setLoading]       = useState(true);

  const LIMIT = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page:  String(page),
        limit: String(LIMIT),
      };
      if (unreadOnly) params.unreadOnly = 'true';

      const res = await api.get('/notifications', { params });
      setNotifications(res.data.data.notifications ?? []);
      setTotal(res.data.data.pagination?.total ?? 0);
      setUnreadCount(res.data.data.unreadCount ?? 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await api.put(`/notifications/${notif.id}/read`);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch {}
    }
    const route = getNotificationRoute(notif.type, notif.data as any);
    if (route) navigate(route);
  };

  const handleRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.isRead) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
      setTotal(t => t - 1);
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread · ` : ''}{total} total
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <div className="flex gap-2">
          {[
            { label: 'All',    value: false },
            { label: 'Unread', value: true  },
          ].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { setUnreadOnly(opt.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                unreadOnly === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {opt.label}
              {opt.value && unreadCount > 0 && (
                <span className="ml-1.5 bg-white text-blue-600 rounded-full px-1.5 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications list */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-gray-600">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm mt-1">
              {unreadOnly ? 'All caught up!' : 'Activity will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(n => (
              <NotifRow
                key={n.id}
                notif={n}
                onRead={handleRead}
                onDelete={handleDelete}
                onClick={handleClick}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{total} notifications</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {pages}</span>
              <button
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;