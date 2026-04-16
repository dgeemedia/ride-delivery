// admin-web/src/components/layout/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Car, Package, Navigation,
  CreditCard, BarChart3, Settings, X, Truck,
  MessageCircle, Shield, LogOut, Building2, Zap, Wallet,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/helpers';
import api from '@/services/api';
import logo from '@/assets/images/diakite.png';

// ─── Feature flags ────────────────────────────────────────────────────────────
const ENABLE_SHIELD    = import.meta.env.VITE_ENABLE_SHIELD    === 'true';
const ENABLE_CORPORATE = import.meta.env.VITE_ENABLE_CORPORATE === 'true';
const ENABLE_DUOPAY    = import.meta.env.VITE_ENABLE_DUOPAY    === 'true';

interface Counts {
  pendingDrivers:   number;
  pendingPartners:  number;
  openTickets:      number;
  shieldActive:     number;
  pendingPayouts:   number;
  pendingTransfers: number;
}

interface NavItem {
  name:       string;
  href:       string;
  icon:       React.ElementType;
  show:       boolean;
  badge?:     number;
  badgeColor?: string;
  end?:       boolean;
  children?:  { name: string; href: string; show: boolean }[];
}

const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, isMobile } = useUIStore();
  const { user, can, isSuperAdmin, isSupport, dept, logout } = useAuth();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Counts>({
    pendingDrivers:   0,
    pendingPartners:  0,
    openTickets:      0,
    shieldActive:     0,
    pendingPayouts:   0,
    pendingTransfers: 0,
  });

  useEffect(() => {
    const requests: Promise<any>[] = [
      api.get('/admin/dashboard/stats'),
      ENABLE_SHIELD
        ? api.get('/admin/shield/stats')
        : Promise.resolve({ data: { data: { activeSessions: 0 } } }),
      api.get('/wallet/admin/stats').catch(() => ({
        data: { data: { pendingPayouts: 0, pendingTransfers: 0 } },
      })),
    ];

    Promise.allSettled(requests).then(([statsRes, shieldRes, walletRes]) => {
      const d = statsRes.status  === 'fulfilled' ? statsRes.value.data?.data  : null;
      const s = shieldRes.status === 'fulfilled' ? shieldRes.value.data?.data : null;
      const w = walletRes.status === 'fulfilled' ? walletRes.value.data?.data : null;

      setCounts({
        pendingDrivers:   d?.pending?.drivers     ?? 0,
        pendingPartners:  d?.pending?.partners    ?? 0,
        openTickets:      d?.support?.openTickets ?? 0,
        shieldActive:     s?.activeSessions       ?? 0,
        pendingPayouts:   w?.pendingPayouts        ?? 0,
        pendingTransfers: w?.pendingTransfers      ?? 0,
      });
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const DEPT_STYLE: Record<string, string> = {
    RIDES:      'bg-blue-100 text-blue-700',
    DELIVERIES: 'bg-amber-100 text-amber-700',
    SUPPORT:    'bg-green-100 text-green-700',
  };
  const DEPT_LABEL: Record<string, string> = {
    RIDES:      'Rides',
    DELIVERIES: 'Deliveries',
    SUPPORT:    'Support',
  };

  const navigation: NavItem[] = [
    {
      name: 'Dashboard', href: '/', icon: LayoutDashboard,
      end: true, show: true,
    },
    {
      name: 'Users', href: '/users', icon: Users,
      show: can.viewUsers,
    },
    {
      name: 'Drivers', href: '/drivers', icon: Car,
      show: can.manageDrivers,
      badge: counts.pendingDrivers || undefined,
      children: [
        { name: 'All Drivers',      href: '/drivers',         show: can.manageDrivers },
        { name: 'Pending Approval', href: '/drivers/pending', show: can.manageDrivers },
      ],
    },
    {
      name: 'Rides', href: '/rides', icon: Navigation,
      show: can.viewRides,
      children: [
        { name: 'All Rides', href: '/rides',      show: can.viewRides   },
        { name: 'Live Map',  href: '/rides/live', show: can.manageRides },
      ],
    },
    {
      name: 'Partners', href: '/partners', icon: Truck,
      show: can.managePartners,
      badge: counts.pendingPartners || undefined,
      children: [
        { name: 'All Partners',     href: '/partners',         show: can.managePartners },
        { name: 'Pending Approval', href: '/partners/pending', show: can.managePartners },
      ],
    },
    {
      name: 'Deliveries', href: '/deliveries', icon: Package,
      show: can.viewDeliveries,
      children: [
        { name: 'All Deliveries', href: '/deliveries',      show: can.viewDeliveries   },
        { name: 'Live Map',       href: '/deliveries/live', show: can.manageDeliveries },
      ],
    },
    {
      name: 'Wallets', href: '/wallets', icon: Wallet,
      show: can.viewPayments,
      badge: (counts.pendingPayouts + counts.pendingTransfers) || undefined,
      badgeColor: 'bg-yellow-500',
    },

    // ─── Feature-flagged nav items ────────────────────────────────────────────
    {
      name: 'SHIELD', href: '/shield', icon: Shield,
      show: ENABLE_SHIELD,
      badge:      counts.shieldActive || undefined,
      badgeColor: 'bg-green-500',
    },
    {
      name: 'Corporate', href: '/corporate', icon: Building2,
      show: ENABLE_CORPORATE && can.viewUsers,
      children: [
        { name: 'Companies', href: '/corporate',       show: can.viewUsers },
        { name: 'Trips',     href: '/corporate/trips', show: can.viewUsers },
      ],
    },
    {
      name: 'DuoPay', href: '/duopay', icon: Zap,
      show: ENABLE_DUOPAY && can.viewPayments,
      children: [
        { name: 'Accounts', href: '/duopay',          show: can.viewPayments },
        { name: 'Defaults', href: '/duopay/defaults', show: can.viewPayments },
      ],
    },
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'Support Tickets', href: '/support/tickets', icon: MessageCircle,
      show: can.viewTickets,
      badge: counts.openTickets || undefined,
    },
    {
      name: 'Payments',  href: '/payments',  icon: CreditCard, show: can.viewPayments  },
    {
      name: 'Analytics', href: '/analytics', icon: BarChart3,  show: can.viewAnalytics },
    {
      name: 'Settings',  href: '/settings',  icon: Settings,   show: can.viewSettings  },
  ];

  const visibleNav = navigation.filter(item => item.show);

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
        sidebarOpen ? 'w-64' : isMobile ? '-translate-x-full' : 'w-0 overflow-hidden',
      )}>

        {/* Logo header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <img src={logo} alt="Diakite" className="h-8 w-auto" />
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

        {/* User identity */}
        {user && (
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-0.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                      <Shield className="h-2.5 w-2.5" />Super Admin
                    </span>
                  )}
                  {dept && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      DEPT_STYLE[dept] ?? 'bg-gray-100 text-gray-600',
                    )}>
                      {DEPT_LABEL[dept] ?? dept}
                    </span>
                  )}
                  {!isSuperAdmin && !dept && user.role === 'ADMIN' && (
                    <span className="text-xs text-gray-500">Admin</span>
                  )}
                  {isSupport && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      Support
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {visibleNav.map(item => {
            const visibleChildren = item.children?.filter(c => c.show) ?? [];

            if (visibleChildren.length > 0) {
              return (
                <div key={item.name} className="mb-1">
                  <div className="flex items-center px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <item.icon className="mr-3 h-4 w-4" />
                    <span className="flex-1">{item.name}</span>
                    {item.badge !== undefined && (
                      <span className={cn(
                        'text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                        item.badgeColor ?? 'bg-red-500',
                      )}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <div className="ml-7 space-y-0.5">
                    {visibleChildren.map(child => (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        end
                        onClick={() => isMobile && setSidebarOpen(false)}
                        className={({ isActive }) => cn(
                          'flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                        )}
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.badge !== undefined && (
                  <span className={cn(
                    'text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                    item.badgeColor ?? 'bg-red-500',
                  )}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
          <p className="text-xs text-gray-500 text-center">Diakite Admin v1.0.0</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;