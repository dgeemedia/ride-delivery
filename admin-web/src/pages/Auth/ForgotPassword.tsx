import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input, Button, Alert } from '@/components/common';
import toast from 'react-hot-toast';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
      toast.success('Password reset email sent!');
    } catch (error) {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Reset Password</h2>
        
        {success ? (
          <Alert type="success" message="Check your email for reset instructions" />
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
          className="mt-4 text-sm text-primary-500 hover:text-primary-600"
        >
          Back to login
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;