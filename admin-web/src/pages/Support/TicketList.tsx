// ─────────────────────────────────────────────────────────────────────────────
// admin-web/src/pages/Support/TicketList.tsx
// FIX: use native <tr><td> for colSpan
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle } from 'lucide-react';
import { ticketsAPI, SupportTicket } from '@/services/api/tickets';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import toast from 'react-hot-toast';

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  urgent: 'error', high: 'warning', medium: 'info', low: 'default',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const CATEGORY_LABELS: Record<string, string> = {
  account: 'Account', payment: 'Payment', ride: 'Ride',
  delivery: 'Delivery', technical: 'Technical', other: 'Other',
};

const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets]               = useState<SupportTicket[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage]       = useState(1);
  const [totalPages, setTotalPages]         = useState(1);
  const [totalCount, setTotalCount]         = useState(0);

  useEffect(() => { load(); }, [currentPage, statusFilter, priorityFilter, categoryFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ticketsAPI.getTickets({
        page: currentPage, limit: 20,
        status:   statusFilter   || undefined,
        priority: priorityFilter || undefined,
        category: categoryFilter || undefined,
      });
      setTickets(res.data.tickets || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load tickets');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary-500" />Support Tickets
          </h1>
          <p className="text-gray-500 mt-1">{totalCount.toLocaleString()} total tickets</p>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <Input
              placeholder="Search ticket #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => { if (e.key === 'Enter') { setCurrentPage(1); load(); } }}
            />
          </div>
          <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Status' },
              { value: 'open',        label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved',    label: 'Resolved' },
              { value: 'closed',      label: 'Closed' },
            ]}
          />
          <Select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Priority' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high',   label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low',    label: 'Low' },
            ]}
          />
          <Select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Categories' },
              ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); load(); }}>
            <Search className="h-4 w-4 mr-2" />Search
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" showLabel /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* FIX: use native <tr><td> for colSpan */}
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                      No tickets found.
                    </td>
                  </tr>
                ) : tickets.map(ticket => (
                  <TableRow key={ticket.id} onClick={() => navigate(`/support/tickets/${ticket.id}`)}>
                    <TableCell className="font-mono text-sm font-medium text-primary-600">
                      {ticket.ticketNumber}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate text-sm font-medium">{ticket.subject}</div>
                    </TableCell>
                    <TableCell>
                      {ticket.user
                        ? <div><div className="text-sm font-medium">{ticket.user.firstName} {ticket.user.lastName}</div><div className="text-xs text-gray-500">{ticket.user.role}</div></div>
                        : <span className="text-xs text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? 'default'}>
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[ticket.status] ?? 'default'}>
                        {ticket.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); navigate(`/support/tickets/${ticket.id}`); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </Card>
    </div>
  );
};

export default TicketList;