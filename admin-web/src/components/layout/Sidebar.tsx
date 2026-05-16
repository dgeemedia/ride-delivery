// admin-web/src/components/layout/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Car, Package, Navigation,
  CreditCard, BarChart3, Settings, X, Truck,
  MessageCircle, Shield, LogOut, Building2, Zap, Wallet, Star,
  ChevronDown,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/helpers';
import api from '@/services/api';
import logo from '@/assets/images/diakite.png';

// ─── Feature flags ─────────────────────────────────────────────────────────
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

interface NavChild { name: string; href: string; show: boolean }
interface NavItem {
  name:       string;
  href:       string;
  icon:       React.ElementType;
  show:       boolean;
  badge?:     number;
  badgeColor?: string;
  end?:       boolean;
  children?:  NavChild[];
}

// ─── Collapsible group ─────────────────────────────────────────────────────
const NavGroup: React.FC<{
  item:      NavItem;
  isMobile:  boolean;
  onClose:   () => void;
}> = ({ item, isMobile, onClose }) => {
  const location = useLocation();
  const visibleChildren = item.children?.filter(c => c.show) ?? [];

  // Auto-open if any child is active
  const isAnyChildActive = visibleChildren.some(c => location.pathname === c.href || location.pathname.startsWith(c.href + '/'));
  const [open, setOpen] = useState(isAnyChildActive);

  // Re-open when navigating to a child via external means
  useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [location.pathname]);

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
          isAnyChildActive
            ? 'bg-white/10 text-white'
            : 'text-white/60 hover:bg-white/8 hover:text-white/90',
        )}
      >
        <span className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all duration-150',
          isAnyChildActive ? 'bg-white/15' : 'group-hover:bg-white/10',
        )}>
          <item.icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-left">{item.name}</span>
        {item.badge !== undefined && (
          <span className={cn(
            'text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none mr-1',
            item.badgeColor ?? 'bg-red-500',
          )}>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
        <ChevronDown className={cn(
          'h-3.5 w-3.5 text-white/40 transition-transform duration-200 flex-shrink-0',
          open && 'rotate-180',
        )} />
      </button>

      {/* Children — CSS-height transition */}
      <div className={cn(
        'overflow-hidden transition-all duration-200 ease-in-out',
        open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0',
      )}>
        <div className="ml-11 mt-0.5 space-y-0.5 pb-1">
          {visibleChildren.map(child => (
            <NavLink
              key={child.href}
              to={child.href}
              end
              onClick={() => isMobile && onClose()}
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/50 hover:bg-white/8 hover:text-white/80',
              )}
            >
              <span className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-150',
                location.pathname === child.href || location.pathname.startsWith(child.href + '/')
                  ? 'bg-white'
                  : 'bg-white/25',
              )} />
              {child.name}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Single nav link ───────────────────────────────────────────────────────
const NavSingle: React.FC<{
  item:     NavItem;
  isMobile: boolean;
  onClose:  () => void;
}> = ({ item, isMobile, onClose }) => (
  <NavLink
    to={item.href}
    end={item.end}
    onClick={() => isMobile && onClose()}
    className={({ isActive }) => cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group mb-0.5',
      isActive
        ? 'bg-white/10 text-white'
        : 'text-white/60 hover:bg-white/8 hover:text-white/90',
    )}
  >
    {({ isActive }) => (
      <>
        <span className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all duration-150',
          isActive ? 'bg-white/15' : 'group-hover:bg-white/10',
        )}>
          <item.icon className="h-4 w-4" />
        </span>
        <span className="flex-1">{item.name}</span>
        {item.badge !== undefined && (
          <span className={cn(
            'text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
            item.badgeColor ?? 'bg-red-500',
          )}>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

// ─── Section divider ───────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25 select-none">
    {label}
  </p>
);

// ─── Main Sidebar ──────────────────────────────────────────────────────────
const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, isMobile } = useUIStore();
  const { user, can, isSuperAdmin, isSupport, dept, logout } = useAuth();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Counts>({
    pendingDrivers: 0, pendingPartners: 0, openTickets: 0,
    shieldActive: 0, pendingPayouts: 0, pendingTransfers: 0,
  });

  useEffect(() => {
    const requests = [
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

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeMobile  = () => setSidebarOpen(false);

  // ── Role badge ──────────────────────────────────────────────────────────
  const DEPT_COLOR: Record<string, string> = {
    RIDES:      'bg-blue-500/20 text-blue-300',
    DELIVERIES: 'bg-amber-500/20 text-amber-300',
    SUPPORT:    'bg-emerald-500/20 text-emerald-300',
  };
  const roleBadge = isSuperAdmin
    ? { label: 'Super Admin', cls: 'bg-red-500/20 text-red-300' }
    : dept
    ? { label: dept.charAt(0) + dept.slice(1).toLowerCase(), cls: DEPT_COLOR[dept] ?? 'bg-white/10 text-white/60' }
    : isSupport
    ? { label: 'Support', cls: 'bg-emerald-500/20 text-emerald-300' }
    : { label: 'Admin', cls: 'bg-white/10 text-white/60' };

  // ── Nav definition ──────────────────────────────────────────────────────
  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true, show: true },
    { name: 'Users',     href: '/users',    icon: Users,  show: can.viewUsers },
    { name: 'Feedback',  href: '/feedback', icon: Star,   show: can.viewUsers },
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
    {
      name: 'SHIELD', href: '/shield', icon: Shield,
      show: ENABLE_SHIELD,
      badge: counts.shieldActive || undefined,
      badgeColor: 'bg-emerald-500',
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
    {
      name: 'Support',   href: '/support/tickets', icon: MessageCircle,
      show: can.viewTickets,
      badge: counts.openTickets || undefined,
    },
    { name: 'Payments',  href: '/payments',  icon: CreditCard, show: can.viewPayments  },
    { name: 'Analytics', href: '/analytics', icon: BarChart3,  show: can.viewAnalytics },
    { name: 'Settings',  href: '/settings',  icon: Settings,   show: can.viewSettings  },
  ];

  // Grouping for section labels
  const coreItems     = navigation.filter(i => i.show && ['/', '/users', '/feedback'].includes(i.href));
  const opsItems      = navigation.filter(i => i.show && ['/drivers', '/rides', '/partners', '/deliveries'].includes(i.href));
  const financeItems  = navigation.filter(i => i.show && ['/wallets', '/payments'].includes(i.href));
  const featureItems  = navigation.filter(i => i.show && ['/shield', '/corporate', '/duopay'].includes(i.href));
  const systemItems   = navigation.filter(i => i.show && ['/support/tickets', '/analytics', '/settings'].includes(i.href));

  const renderItem = (item: NavItem) => {
    const visibleChildren = item.children?.filter(c => c.show) ?? [];
    return visibleChildren.length > 0
      ? <NavGroup  key={item.href} item={item} isMobile={isMobile} onClose={closeMobile} />
      : <NavSingle key={item.href} item={item} isMobile={isMobile} onClose={closeMobile} />;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20"
          onClick={closeMobile}
        />
      )}

      <aside className={cn(
        'flex flex-col z-30 transition-all duration-300',
        // Dark sidebar — deep navy
        'bg-[#0f1623]',
        isMobile ? 'fixed inset-y-0 left-0' : 'relative',
        sidebarOpen ? 'w-[232px]' : isMobile ? '-translate-x-full' : 'w-0 overflow-hidden',
      )}>

        {/* Top border accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 flex-shrink-0" />

        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0">
          <img src={logo} alt="Diakite" className="h-7 w-auto" />
          {isMobile && (
            <button
              onClick={closeMobile}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* User card */}
        {user && (
          <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center font-semibold text-xs text-white flex-shrink-0 shadow-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5',
                  roleBadge.cls,
                )}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide">

          {coreItems.length > 0 && (
            <>
              <SectionLabel label="Main" />
              {coreItems.map(renderItem)}
            </>
          )}

          {opsItems.length > 0 && (
            <>
              <SectionLabel label="Operations" />
              {opsItems.map(renderItem)}
            </>
          )}

          {financeItems.length > 0 && (
            <>
              <SectionLabel label="Finance" />
              {financeItems.map(renderItem)}
            </>
          )}

          {featureItems.length > 0 && (
            <>
              <SectionLabel label="Features" />
              {featureItems.map(renderItem)}
            </>
          )}

          {systemItems.length > 0 && (
            <>
              <SectionLabel label="System" />
              {systemItems.map(renderItem)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 flex-shrink-0 border-t border-white/8 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 group"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg group-hover:bg-red-500/10 transition-colors">
              <LogOut className="h-4 w-4" />
            </span>
            Sign out
          </button>
          <p className="text-[10px] text-white/20 text-center mt-2 tracking-wide">
            Diakite Admin v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;