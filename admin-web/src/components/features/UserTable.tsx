import React from 'react';
import { User } from '@/types/user';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { USER_ROLES } from '@/utils/constants';

interface UserTableProps {
  users: User[];
  onUserClick: (user: User) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, onUserClick }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} onClick={() => onUserClick(user)}>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UserTable;