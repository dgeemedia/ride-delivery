// admin-web/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

// Layout
import Layout from '@/components/layout/Layout';

// Auth Pages
import Login from '@/pages/Auth/Login';

// Dashboard
import Dashboard from '@/pages/Dashboard/Dashboard';

// User Pages
import UserList from '@/pages/Users/UserList';
import UserDetails from '@/pages/Users/UserDetails';

// Driver Pages
import DriverList from '@/pages/Drivers/DriverList';
import DriverApproval from '@/pages/Drivers/DriverApproval';
import DriverDetails from '@/pages/Drivers/DriverDetails';
import DriverDocuments from '@/pages/Drivers/DriverDocuments';  // ← add this import

// Partner Pages
import PartnerList from '@/pages/Partners/PartnerList';
import PartnerApproval from '@/pages/Partners/PartnerApproval';
import PartnerDetails from '@/pages/Partners/PartnerDetails';

// Ride Pages
import RideList from '@/pages/Rides/RideList';
import RideDetails from '@/pages/Rides/RideDetails';
import LiveRides from '@/pages/Rides/LiveRides';

// Delivery Pages
import DeliveryList from '@/pages/Deliveries/DeliveryList';
import DeliveryDetails from '@/pages/Deliveries/DeliveryDetails';

// Payment Pages
import PaymentList from '@/pages/Payments/PaymentList';

// Analytics
import Analytics from '@/pages/Analytics/Overview';

// Settings
import GeneralSettings from '@/pages/Settings/GeneralSettings';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Router>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
          />

          {/* Dashboard */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Users */}
          <Route path="/users"     element={<ProtectedRoute><UserList /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute><UserDetails /></ProtectedRoute>} />

          {/* Drivers
              Order matters: more-specific static segments before :id wildcards */}
          <Route path="/drivers"                   element={<ProtectedRoute><DriverList /></ProtectedRoute>} />
          <Route path="/drivers/pending"            element={<ProtectedRoute><DriverApproval /></ProtectedRoute>} />
          <Route path="/drivers/:id"               element={<ProtectedRoute><DriverDetails /></ProtectedRoute>} />
          <Route path="/drivers/:id/documents"     element={<ProtectedRoute><DriverDocuments /></ProtectedRoute>} />  {/* ← THE FIX */}

          {/* Partners */}
          <Route path="/partners"         element={<ProtectedRoute><PartnerList /></ProtectedRoute>} />
          <Route path="/partners/pending" element={<ProtectedRoute><PartnerApproval /></ProtectedRoute>} />
          <Route path="/partners/:id"     element={<ProtectedRoute><PartnerDetails /></ProtectedRoute>} />

          {/* Rides */}
          <Route path="/rides"      element={<ProtectedRoute><RideList /></ProtectedRoute>} />
          <Route path="/rides/live" element={<ProtectedRoute><LiveRides /></ProtectedRoute>} />
          <Route path="/rides/:id"  element={<ProtectedRoute><RideDetails /></ProtectedRoute>} />

          {/* Deliveries */}
          <Route path="/deliveries"     element={<ProtectedRoute><DeliveryList /></ProtectedRoute>} />
          <Route path="/deliveries/:id" element={<ProtectedRoute><DeliveryDetails /></ProtectedRoute>} />

          {/* Payments */}
          <Route path="/payments" element={<ProtectedRoute><PaymentList /></ProtectedRoute>} />

          {/* Analytics */}
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

          {/* Settings */}
          <Route path="/settings" element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />

          {/* 404 catch-all — must be last */}
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