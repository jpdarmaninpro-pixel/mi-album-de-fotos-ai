import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignOutIcon, UserIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { PhotographerProfile } from '../types';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const { getProfile } = useApi();
  const [profile, setProfile] = useState<PhotographerProfile | null>(null);

  useEffect(() => {
      getProfile().then(setProfile).catch(() => setProfile(null));
  }, [getProfile]);


  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <Link to="/admin" className="text-2xl font-bold text-brand-primary font-serif">AI Photo Album</Link>
            <div className="flex items-center space-x-4">
                {profile && (
                  <Link to="/admin/profile" className="flex items-center space-x-3 hover:bg-gray-100 p-2 rounded-md">
                        <img src={profile.profilePictureUrl} alt="user" className="w-10 h-10 rounded-full" />
                        <div className="text-right hidden sm:block">
                          <p className="font-semibold text-sm text-gray-800">{profile.name}</p>
                        </div>
                  </Link>
                )}
                 <button 
                    onClick={logout} 
                    className="flex items-center space-x-2 text-gray-600 hover:text-brand-primary p-2 rounded-md hover:bg-gray-100 transition-colors" 
                    title="Sign Out"
                  >
                      <SignOutIcon className="w-6 h-6" />
                      <span className="text-sm font-medium hidden md:inline">Sign Out</span>
                  </button>
            </div>
        </div>
      </header>
      <div className="font-sans">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
