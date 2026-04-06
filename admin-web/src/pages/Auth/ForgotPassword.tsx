// admin-web/src/pages/Auth/ForgotPassword.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input, Button, Alert } from '@/components/common';
import toast from 'react-hot-toast';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
      toast.success('Password reset email sent!');
    } catch {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
          <p className="text-gray-500 mt-2 text-sm">Enter your email to receive reset instructions</p>
        </div>

        {success ? (
          <Alert variant="success">
            Check your email for reset instructions
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Send Reset Link
            </Button>
          </form>
        )}

        <button
          onClick={() => navigate('/login')}
          className="mt-6 w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;