import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User } from '@/types';
import { 
  Card, 
  Input, 
  Select, 
  Button, 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell,
  Badge,
  Pagination 
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { USER_ROLES } from '@/utils/constants';
import toast from 'react-hot-toast';

const UserList: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadUsers();
  }, [currentPage, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getUsers({
        page: currentPage,
        limit: 20,
        role: roleFilter || undefined,
        search: search || undefined,
      });
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage all platform users</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              ...Object.entries(USER_ROLES).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card padding={false}>
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
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
                {users.map((user) => (
                  <TableRow key={user.id} onClick={() => navigate(`/users/${user.id}`)}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant="default">{USER_ROLES[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'success' : 'error'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default UserList;