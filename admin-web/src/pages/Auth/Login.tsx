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
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);

      if (
        response.data.user.role === 'CUSTOMER' ||
        response.data.user.role === 'DRIVER' ||
        response.data.user.role === 'DELIVERY_PARTNER'
      ) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-md w-full relative">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary-500 via-primary-400 to-blue-500" />

          <div className="p-8">
            {/* Logo + branding */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mx-auto mb-4">
                <img src={logo} alt="Diakite" className="h-16 w-auto" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Diakite Admin</h2>
              <p className="text-gray-500 mt-1.5 text-sm">Sign in to your account</p>
            </div>

            {/* Error alert */}
            {error && (
              <Alert variant="error" className="mb-6">
                {error}
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@diakite.com"
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
                className="w-full"
              >
                Sign In
              </Button>
            </form>

            {/* Forgot password */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 text-sm text-slate-400">
          © 2026 Diakite. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;