// admin-web/src/pages/Auth/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/services/api/auth';
import { Input, Button, Alert } from '@/components/common';
import toast from 'react-hot-toast';
import logo from '@/assets/images/diakite.png';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      
      if (response.data.user.role === 'CUSTOMER' || response.data.user.role === 'DRIVER' || response.data.user.role === 'DELIVERY_PARTNER') {
        setError('You do not have admin access');
        return;
      }

      login(response.data.user, response.data.token);
      toast.success('Login successful!');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mx-auto mb-4">
              <img src={logo} alt="Diakite" className="h-16 w-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Diakite Admin</h2>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>

          {error && (
            <Alert type="error" message={error} className="mb-6" />
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@duoride.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
              className="w-full"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button className="text-sm text-primary-500 hover:text-primary-600">
              Forgot password?
            </button>
          </div>
        </div>

        <div className="text-center mt-4 text-sm text-gray-600">
          © 2026 Diakite. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;