// admin-web/src/components/layout/Layout.tsx
import React, { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from '@/layout/Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { setIsMobile } = useUIStore();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Layout;