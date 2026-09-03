// admin-web/src/pages/Applications/IncompleteApplications.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { applicationsAPI, IncompleteApplicant } from '@/services/api/applications';
import {
  Card, Select, Badge, Pagination, Spinner,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';

const IncompleteApplications: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFilter = (searchParams.get('role') as 'DRIVER' | 'DELIVERY_PARTNER' | null) ?? undefined;

  const [users,       setUsers]       = useState<IncompleteApplicant[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);

  useEffect(() => { load(); }, [currentPage, roleFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await applicationsAPI.getIncomplete({
        page: currentPage, limit: 20, role: roleFilter,
      });
      setUsers(res.data.users || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load incomplete applications');
    } finally {
      setLoading(false);
    }
  };

  const setRole = (value: string) => {
    setCurrentPage(1);
    if (value) setSearchParams({ role: value });
    else setSearchParams({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Incomplete Applications</h1>
        <p className="text-gray-600 mt-1">
          {totalCount > 0 ? `${totalCount.toLocaleString()} total` : 'No incomplete signups'} —
          users who selected a driver or delivery partner role but never submitted a profile.
        </p>
      </div>

      <Card>
        <div className="max-w-xs">
          <Select
            value={roleFilter ?? ''}
            onChange={e => setRole(e.target.value)}
            options={[
              { value: '',                  label: 'All Roles' },
              { value: 'DRIVER',            label: 'Drivers' },
              { value: 'DELIVERY_PARTNER',  label: 'Delivery Partners' },
            ]}
          />
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12 text-sm">
                      No incomplete applications found.
                    </td>
                  </tr>
                ) : users.map(u => (
                  <TableRow key={u.id} onClick={() => navigate(`/users/${u.id}`)}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div className="ml-3 font-medium">{u.firstName} {u.lastName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'DRIVER' ? 'info' : 'warning'}>
                        {u.role === 'DRIVER' ? 'Driver' : 'Delivery Partner'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Mail className="h-3.5 w-3.5" />{u.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />{u.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'success' : 'error'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
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

export default IncompleteApplications;