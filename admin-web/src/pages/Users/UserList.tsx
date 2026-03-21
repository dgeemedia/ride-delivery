// admin-web/src/pages/Users/UserList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { USER_ROLES } from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const roleBadgeVariant = (role: string): 'success' | 'warning' | 'error' | 'info' | 'default' => ({
  SUPER_ADMIN: 'error', ADMIN: 'info', SUPPORT: 'warning', MODERATOR: 'warning',
  DRIVER: 'default', DELIVERY_PARTNER: 'default', CUSTOMER: 'default',
} as any)[role] ?? 'default';

const UserList: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [users, setUsers]             = useState<User[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  useEffect(() => { loadUsers(); }, [currentPage, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getUsers({
        page: currentPage, limit: 20,
        role:     roleFilter   || undefined,
        search:   search       || undefined,
        isActive: statusFilter || undefined,
      });
      setUsers(res.data.users || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString()} total` : 'Manage all platform users'}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => navigate('/users/create-admin')}>
            <UserPlus className="h-4 w-4" />Create Admin
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => { if (e.key === 'Enter') { setCurrentPage(1); loadUsers(); } }}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Roles' },
              ...Object.entries(USER_ROLES).map(([value, label]) => ({ value, label: label as string })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '',     label: 'All Status' },
              { value: 'true', label: 'Active' },
              { value: 'false',label: 'Inactive / Suspended' },
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); loadUsers(); }}>
            <Search className="h-4 w-4 mr-2" />Search
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" showLabel /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center text-gray-400 py-12" colSpan={7}>No users found.</TableCell>
                  </TableRow>
                ) : users.map(user => (
                  <TableRow key={user.id} onClick={() => navigate(`/users/${user.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm flex-shrink-0">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          {user.isSuspended && <div className="text-xs text-red-500">Suspended</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="text-sm">{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {USER_ROLES[user.role as keyof typeof USER_ROLES] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'success' : 'error'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); navigate(`/users/${user.id}`); }}>
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

export default UserList;