// admin-web/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/layout/Layout';

import Login              from '@/pages/Auth/Login';
import Dashboard          from '@/pages/Dashboard/Dashboard';
import UserList           from '@/pages/Users/UserList';
import UserDetails        from '@/pages/Users/UserDetails';
import CreateAdminUser    from '@/pages/Users/CreateAdminUser';
import DriverList         from '@/pages/Drivers/DriverList';
import DriverApproval     from '@/pages/Drivers/DriverApproval';
import DriverDetails      from '@/pages/Drivers/DriverDetails';
import DriverDocuments    from '@/pages/Drivers/DriverDocuments';
import PartnerList        from '@/pages/Partners/PartnerList';
import PartnerApproval    from '@/pages/Partners/PartnerApproval';
import PartnerDetails     from '@/pages/Partners/PartnerDetails';
import RideList           from '@/pages/Rides/RideList';
import RideDetails        from '@/pages/Rides/RideDetails';
import LiveRides          from '@/pages/Rides/LiveRides';
import DeliveryList       from '@/pages/Deliveries/DeliveryList';
import DeliveryDetails    from '@/pages/Deliveries/DeliveryDetails';
import TicketList         from '@/pages/Support/TicketList';
import TicketDetail       from '@/pages/Support/TicketDetail';
import PaymentList        from '@/pages/Payments/PaymentList';
import Analytics          from '@/pages/Analytics/Overview';
import GeneralSettings    from '@/pages/Settings/GeneralSettings';
import NotificationsPage  from '@/pages/Notifications/NotificationsPage';
import PayoutManagement   from '@/pages/Wallets/PayoutManagement';
import AppFeedbackList from '@/pages/Feedback/AppFeedbackList';


// Feature-flagged page imports — only used when flags are enabled
import ShieldMonitor      from '@/pages/Shield/ShieldMonitor';
import ShieldSession      from '@/pages/Shield/ShieldSession';
import CompanyList        from '@/pages/Corporate/CompanyList';
import CompanyDetails     from '@/pages/Corporate/CompanyDetails';
import DuoPayMonitor      from '@/pages/DuoPay/DuoPayMonitor';
import DuoPayDefaults     from '@/pages/DuoPay/DuoPayDefaults';

// ─── Feature flags (set in admin-web/.env) ────────────────────────────────────
const ENABLE_SHIELD    = import.meta.env.VITE_ENABLE_SHIELD    === 'true';
const ENABLE_CORPORATE = import.meta.env.VITE_ENABLE_CORPORATE === 'true';
const ENABLE_DUOPAY    = import.meta.env.VITE_ENABLE_DUOPAY    === 'true';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  const { isAuthenticated } = useAuthStore();
  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Notifications */}
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

          {/* Users */}
          <Route path="/users"              element={<ProtectedRoute><UserList /></ProtectedRoute>} />
          <Route path="/users/create-admin" element={<SuperAdminRoute><CreateAdminUser /></SuperAdminRoute>} />
          <Route path="/users/:id"          element={<ProtectedRoute><UserDetails /></ProtectedRoute>} />

          {/* Drivers — statics before :id wildcard */}
          <Route path="/drivers"               element={<ProtectedRoute><DriverList /></ProtectedRoute>} />
          <Route path="/drivers/pending"        element={<ProtectedRoute><DriverApproval /></ProtectedRoute>} />
          <Route path="/drivers/:id/documents" element={<ProtectedRoute><DriverDocuments /></ProtectedRoute>} />
          <Route path="/drivers/:id"           element={<ProtectedRoute><DriverDetails /></ProtectedRoute>} />

          {/* Partners */}
          <Route path="/partners"         element={<ProtectedRoute><PartnerList /></ProtectedRoute>} />
          <Route path="/partners/pending" element={<ProtectedRoute><PartnerApproval /></ProtectedRoute>} />
          <Route path="/partners/:id"     element={<ProtectedRoute><PartnerDetails /></ProtectedRoute>} />

          {/* Rides — /live before /:id */}
          <Route path="/rides"      element={<ProtectedRoute><RideList /></ProtectedRoute>} />
          <Route path="/rides/live" element={<ProtectedRoute><LiveRides /></ProtectedRoute>} />
          <Route path="/rides/:id"  element={<ProtectedRoute><RideDetails /></ProtectedRoute>} />

          {/* Deliveries */}
          <Route path="/deliveries"     element={<ProtectedRoute><DeliveryList /></ProtectedRoute>} />
          <Route path="/deliveries/:id" element={<ProtectedRoute><DeliveryDetails /></ProtectedRoute>} />

          {/* wallet management */}
          <Route path="/wallets" element={<ProtectedRoute><PayoutManagement /></ProtectedRoute>} />

          {/* Feedback */}
          <Route path="/feedback" element={<ProtectedRoute><AppFeedbackList /></ProtectedRoute>} />
          
          {/* Support */}
          <Route path="/support/tickets"     element={<ProtectedRoute><TicketList /></ProtectedRoute>} />
          <Route path="/support/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />

          {/* ─── Feature-flagged routes ─────────────────────────────────────── */}

          {/* SHIELD */}
          {ENABLE_SHIELD && (
            <>
              <Route path="/shield"     element={<ProtectedRoute><ShieldMonitor /></ProtectedRoute>} />
              <Route path="/shield/:id" element={<ProtectedRoute><ShieldSession /></ProtectedRoute>} />
            </>
          )}

          {/* Corporate */}
          {ENABLE_CORPORATE && (
            <>
              <Route path="/corporate"       element={<ProtectedRoute><CompanyList /></ProtectedRoute>} />
              <Route path="/corporate/trips" element={<ProtectedRoute><CompanyList /></ProtectedRoute>} />
              <Route path="/corporate/:id"   element={<ProtectedRoute><CompanyDetails /></ProtectedRoute>} />
            </>
          )}

          {/* DuoPay */}
          {ENABLE_DUOPAY && (
            <>
              <Route path="/duopay"          element={<ProtectedRoute><DuoPayMonitor /></ProtectedRoute>} />
              <Route path="/duopay/defaults" element={<ProtectedRoute><DuoPayDefaults /></ProtectedRoute>} />
            </>
          )}

          {/* Other */}
          <Route path="/payments"  element={<ProtectedRoute><PaymentList /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#fff', color: '#363636' },
          success: { duration: 3000, iconTheme: { primary: '#34C759', secondary: '#fff' } },
          error:   { duration: 4000, iconTheme: { primary: '#FF3B30', secondary: '#fff' } },
        }}
      />
    </>
  );
}

export default App;