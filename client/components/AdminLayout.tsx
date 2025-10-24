import React from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { Link } from 'react-router-dom';
import { SignOutIcon } from './icons';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, signOut } = useGoogleDrive();

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <Link to="/admin" className="text-2xl font-bold text-brand-primary font-serif">AI Photo Album</Link>
            {user && (
              <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                        <img src={user.getImageUrl()} alt="user" className="w-10 h-10 rounded-full" />
                        <div className="text-right hidden sm:block">
                          <p className="font-semibold text-sm text-gray-800">{user.getName()}</p>
                          <p className="text-xs text-gray-500">{user.getEmail()}</p>
                        </div>
                  </div>
                  <button 
                    onClick={signOut} 
                    className="flex items-center space-x-2 text-gray-600 hover:text-brand-primary p-2 rounded-md hover:bg-gray-100 transition-colors" 
                    title="Sign Out"
                  >
                      <SignOutIcon className="w-6 h-6" />
                      <span className="text-sm font-medium hidden md:inline">Sign Out</span>
                  </button>
              </div>
            )}
        </div>
      </header>
      <div className="font-sans">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
