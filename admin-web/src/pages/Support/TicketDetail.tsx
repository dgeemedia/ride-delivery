// admin-web/src/pages/Support/TicketDetail.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, User, Clock, Tag, AlertCircle,
  CheckCircle, MessageCircle, ExternalLink,
} from 'lucide-react';
import { ticketsAPI, SupportTicket, TicketReply } from '@/services/api/tickets';
import { Card, Button, Badge, Select, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  urgent: 'error', high: 'warning', medium: 'info', low: 'default',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];
const CATEGORY_LABELS: Record<string, string> = {
  account: 'Account', payment: 'Payment', ride: 'Ride',
  delivery: 'Delivery', technical: 'Technical', other: 'Other',
};

// ─── Reply bubble ─────────────────────────────────────────────────────────────
const ReplyBubble: React.FC<{ reply: TicketReply; currentUserId?: string }> = ({ reply, currentUserId }) => {
  const isMe = reply.authorId === currentUserId;
  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${reply.isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
        {reply.author?.firstName?.[0] ?? '?'}
      </div>
      <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : ''}`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
          {reply.message}
        </div>
        <p className={`text-xs text-gray-400 px-1 ${isMe ? 'text-right' : ''}`}>
          {reply.author?.firstName} {reply.author?.lastName}
          {reply.isAdmin && <span className="ml-1 text-primary-400">(Admin)</span>}
          {' · '}{formatDateTime(reply.createdAt)}
        </p>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const TicketDetail: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [ticket, setTicket]     = useState<SupportTicket | null>(null);
  const [loading, setLoading]   = useState(true);
  const [reply, setReply]       = useState('');
  const [status, setStatus]     = useState('');
  const [resolution, setResolution] = useState('');
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await ticketsAPI.getTicketById(id);
      setTicket(res.data.ticket);
      setStatus(res.data.ticket.status);
    } catch {
      toast.error('Failed to load ticket');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [ticket?.replies?.length]);

  const handleSend = async () => {
    if (!reply.trim() && status === ticket?.status) {
      toast.error('Add a reply or change the status');
      return;
    }
    setSending(true);
    try {
      await ticketsAPI.updateTicket(id!, {
        status:      status !== ticket?.status ? status : undefined,
        replyMessage: reply.trim() || undefined,
        resolution:  status === 'resolved' ? (resolution.trim() || undefined) : undefined,
      });
      setReply('');
      if (status === 'resolved') setResolution('');
      toast.success(reply.trim() ? 'Reply sent' : 'Ticket updated');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update ticket');
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;
  if (!ticket) return <div className="text-center py-20"><p className="text-gray-500">Ticket not found.</p><Button className="mt-4" onClick={() => navigate('/support/tickets')}>Back</Button></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/support/tickets')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
              <Badge variant={STATUS_VARIANT[ticket.status] ?? 'default'}>
                {ticket.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Badge>
              <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? 'default'}>
                {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{ticket.ticketNumber} · {formatDateTime(ticket.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original message */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold">
                {ticket.user?.firstName?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold">{ticket.user?.firstName} {ticket.user?.lastName}</p>
                <p className="text-xs text-gray-500">{ticket.user?.role} · {ticket.user?.email}</p>
              </div>
              {ticket.user && (
                <button
                  onClick={() => navigate(`/users/${ticket.user!.id}`)}
                  className="ml-auto text-xs text-primary-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />View profile
                </button>
              )}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </Card>

          {/* Reply thread */}
          {(ticket.replies ?? []).length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />Thread ({ticket.replies!.length})
              </h3>
              <div className="space-y-4">
                {ticket.replies!.map(r => (
                  <ReplyBubble key={r.id} reply={r} currentUserId={user?.id} />
                ))}
                <div ref={bottomRef} />
              </div>
            </Card>
          )}

          {/* Reply box */}
          {!['resolved', 'closed'].includes(ticket.status) && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Reply to Customer</h3>
              <textarea
                rows={4}
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Type your response to the customer..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
              {status === 'resolved' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Resolution summary (optional)</label>
                  <input
                    type="text" value={resolution} onChange={e => setResolution(e.target.value)}
                    placeholder="Brief description of how this was resolved..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Button loading={sending} onClick={handleSend}>
                  <Send className="h-4 w-4" />
                  {reply.trim() ? 'Send Reply' : 'Update Status'}
                </Button>
              </div>
            </Card>
          )}

          {['resolved', 'closed'].includes(ticket.status) && ticket.resolution && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />Resolution
              </h3>
              <p className="text-sm text-gray-600">{ticket.resolution}</p>
              {ticket.resolvedAt && (
                <p className="text-xs text-gray-400 mt-2">Resolved {formatDateTime(ticket.resolvedAt)}</p>
              )}
            </Card>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-5">
          {/* Status control */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ticket Status</h3>
            <Select
              value={status}
              onChange={e => setStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
            {status !== ticket.status && (
              <Button className="w-full mt-3" loading={sending} onClick={handleSend}>
                Update Status
              </Button>
            )}
          </Card>

          {/* Info */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                Category: <span className="font-medium">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                Priority: <span className="font-medium capitalize">{ticket.priority}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Created: <span className="font-medium">{formatDateTime(ticket.createdAt)}</span>
              </div>
              {ticket.assignedTo && (
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  Assigned: <span className="font-medium">{ticket.assignedTo}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Customer quick info */}
          {ticket.user && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-primary-500" />Customer</h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{ticket.user.firstName} {ticket.user.lastName}</p>
                <p className="text-gray-500 text-xs">{ticket.user.email}</p>
                <p className="text-gray-500 text-xs">{ticket.user.phone}</p>
                <p className="text-xs mt-1"><Badge variant="default">{ticket.user.role}</Badge></p>
              </div>
              <button
                onClick={() => navigate(`/users/${ticket.user!.id}`)}
                className="mt-3 text-xs text-primary-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />View full profile
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;