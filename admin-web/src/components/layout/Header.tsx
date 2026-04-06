// admin-web/src/components/layout/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import NotificationBell from '@/components/notifications/NotificationBell';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    SUPPORT: 'Support',
    MODERATOR: 'Moderator',
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 md:px-6 gap-4 flex-shrink-0">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* User Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(prev => !prev)}
            className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2.5 py-1.5 transition-colors group"
          >
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-xs tracking-wide">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="hidden md:block text-left leading-tight">
              <p className="text-sm font-semibold text-gray-900 leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {roleLabel[user?.role ?? ''] ?? user?.role}
              </p>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 overflow-hidden">
              {/* Mini profile header */}
              <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => { navigate('/profile'); setShowDropdown(false); }}
                className="flex items-center w-full gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="h-4 w-4 text-gray-400" />Profile
              </button>
              <button
                onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="flex items-center w-full gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-400" />Settings
              </button>

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;