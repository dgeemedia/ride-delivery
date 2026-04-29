// admin-web/src/pages/Feedback/AppFeedbackList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Star, MessageSquare, Smartphone, RefreshCw } from 'lucide-react';
import { Card, Spinner } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedbackItem {
  id:         string;
  rating:     number;
  comment:    string | null;
  category:   string;
  platform:   string;
  appVersion: string | null;
  createdAt:  string;
  user: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
    role:      string;
  };
}

interface FeedbackStats {
  total:        number;
  averageRating: number;
  distribution: Record<string, number>; // '1'...'5' → count
  byCategory:   Record<string, number>;
}

interface PaginationMeta {
  total: number;
  page:  number;
  pages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  general:     'General',
  ui_ux:       'Design / UX',
  performance: 'Performance',
  feature:     'Feature Idea',
  bug:         'Bug Report',
  pricing:     'Pricing',
};

const CATEGORY_COLORS: Record<string, string> = {
  general:     'bg-gray-100 text-gray-700',
  ui_ux:       'bg-purple-100 text-purple-700',
  performance: 'bg-blue-100 text-blue-700',
  feature:     'bg-green-100 text-green-700',
  bug:         'bg-red-100 text-red-700',
  pricing:     'bg-yellow-100 text-yellow-700',
};

const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <Star
        key={s}
        size={size}
        className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
      />
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AppFeedbackList: React.FC = () => {
  const [items,      setItems]      = useState<FeedbackItem[]>([]);
  const [stats,      setStats]      = useState<FeedbackStats | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, page: 1, pages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);

  // Filters
  const [filterRating,   setFilterRating]   = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (filterRating)   params.rating   = filterRating;
      if (filterCategory) params.category = filterCategory;

      const [feedbackRes, statsRes] = await Promise.all([
        api.get('/admin/feedback', { params }),
        page === 1 ? api.get('/admin/feedback/stats') : Promise.resolve(null),
      ]);

      setItems(feedbackRes.data.data.feedback);
      setPagination(feedbackRes.data.data.pagination);
      if (statsRes) setStats(statsRes.data.data);
    } catch {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [page, filterRating, filterCategory]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterRating, filterCategory]);

  const avgColor = !stats ? 'text-gray-500'
    : stats.averageRating >= 4 ? 'text-green-600'
    : stats.averageRating >= 3 ? 'text-yellow-600'
    : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Feedback</h1>
          <p className="text-gray-600 mt-1">User ratings and comments submitted in-app</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Star size={20} className="text-yellow-500 fill-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Avg Rating</p>
                <p className={`text-2xl font-bold ${avgColor}`}>
                  {stats.averageRating.toFixed(1)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <MessageSquare size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="col-span-2">
            <p className="text-xs text-gray-500 font-medium mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats.distribution[String(star)] ?? 0;
                const pct   = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 w-3">{star}</span>
                    <Star size={10} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterRating}
          onChange={e => setFilterRating(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map(r => (
            <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {(filterRating || filterCategory) && (
          <button
            onClick={() => { setFilterRating(''); setFilterCategory(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <span className="text-sm text-gray-500 ml-auto">
          {pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <Star size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No feedback yet</p>
            <p className="text-sm mt-1">Submissions will appear here once users rate the app.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {item.user.firstName[0]}{item.user.lastName[0]}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {item.user.firstName} {item.user.lastName}
                    </span>
                    <span className="text-xs text-gray-400">{item.user.email}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                  </div>

                  {/* Stars + meta */}
                  <div className="flex items-center gap-3 mb-2">
                    <StarRating rating={item.rating} />
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Smartphone size={11} />
                      {item.platform}
                      {item.appVersion ? ` v${item.appVersion}` : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Comment */}
                  {item.comment ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{item.comment}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No comment</p>
                  )}
                </div>

                {/* Big rating badge */}
                <div className={`flex-shrink-0 text-xl font-black ${
                  item.rating >= 4 ? 'text-green-500' : item.rating >= 3 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {item.rating}/5
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AppFeedbackList;