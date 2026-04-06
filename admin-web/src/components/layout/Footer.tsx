// admin-web/src/layout/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>© {year} Diakite. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-gray-600 transition-colors">Privacy</a>
          <a href="#" className="hover:text-gray-600 transition-colors">Terms</a>
          <a href="#" className="hover:text-gray-600 transition-colors">Help</a>
          <span className="text-gray-300">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;