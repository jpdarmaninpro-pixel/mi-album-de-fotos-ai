import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AdminLayout from './AdminLayout';
import Spinner from './Spinner';
import { useApi } from '../hooks/useApi';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { getProfile } = useApi();
  const [isProfileSetup, setIsProfileSetup] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const checkProfile = async () => {
      setIsCheckingProfile(true);
      try {
        await getProfile();
        setIsProfileSetup(true);
        // If they are authenticated and have a profile but land on the profile page, send them to the dashboard.
        if (location.pathname === '/admin/profile') {
            // This can be the default behavior, or we can allow them to stay.
            // For now, let's let them view/edit their profile.
        }
      } catch (error: any) {
        if (error.message.includes('404')) { // Profile not found
          setIsProfileSetup(false);
          // If profile is not set up, force redirect to profile setup page
          if (location.pathname !== '/admin/profile') {
            navigate('/admin/profile', { replace: true });
          }
        } else {
            // Handle other errors, maybe show an error page or log out
            console.error("Error checking profile:", error);
        }
      } finally {
        setIsCheckingProfile(false);
      }
    };
    checkProfile();
  }, [isAuthenticated, isLoading, getProfile, location.pathname, navigate]);

  if (isLoading || (isAuthenticated && isCheckingProfile)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If profile is not set up, only allow access to the profile page
  if (!isProfileSetup && location.pathname !== '/admin/profile') {
    return <Navigate to="/admin/profile" replace />;
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
};

export default ProtectedRoute;
