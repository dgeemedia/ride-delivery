// admin-web/src/pages/Users/UserCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Select, Button } from '@/components/common';
import { USER_ROLES } from '@/utils/constants';
import toast from 'react-hot-toast';

const UserCreate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'CUSTOMER',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // API call to create user
    toast.success('User created successfully');
    navigate('/users');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create New User</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={Object.entries(USER_ROLES).map(([value, label]) => ({ value, label }))}
          />

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => navigate('/users')}>
              Cancel
            </Button>
            <Button type="submit">Create User</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default UserCreate;