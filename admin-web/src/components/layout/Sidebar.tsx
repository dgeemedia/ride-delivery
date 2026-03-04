import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Package, 
  Navigation,
  CreditCard,
  BarChart3,
  Settings,
  X
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/helpers';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Drivers', href: '/drivers', icon: Car },
  { name: 'Partners', href: '/partners', icon: Package },
  { name: 'Rides', href: '/rides', icon: Navigation },
  { name: 'Deliveries', href: '/deliveries', icon: Package },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, isMobile } = useUIStore();

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-30',
        isMobile ? 'fixed inset-y-0 left-0' : 'relative',
        sidebarOpen ? 'w-64' : isMobile ? '-translate-x-full' : 'w-0'
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <span className="text-xl font-bold text-gray-900">DuoRide</span>
          </div>
          
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="text-xs text-gray-500 text-center">
            DuoRide Admin v1.0.0
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;