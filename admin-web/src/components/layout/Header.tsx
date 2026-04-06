// admin-web/src/components/layout/Header.tsx
import React, { useState } from 'react';
import { Menu, LogOut, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import NotificationBell from '@/components/notifications/NotificationBell';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-gray-500 hover:text-gray-700 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      
      </div>

      <div className="flex-1" />

      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-gray-500">{user?.role}</div>
            </div>
          </button>

          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20 border">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowDropdown(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <User className="mr-3 h-4 w-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowDropdown(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  Settings
                </button>
                <hr className="my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-error-600 hover:bg-gray-100"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;