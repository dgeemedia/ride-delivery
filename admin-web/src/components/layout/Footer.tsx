import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          © {currentYear} DuoRide. All rights reserved.
        </div>
        <div className="flex items-center space-x-4">
          <a href="#" className="hover:text-primary-500">Privacy Policy</a>
          <a href="#" className="hover:text-primary-500">Terms of Service</a>
          <a href="#" className="hover:text-primary-500">Help</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;