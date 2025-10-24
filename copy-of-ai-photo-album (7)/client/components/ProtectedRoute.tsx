import React, { useEffect } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import Spinner from './Spinner';
import { Outlet } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const ProtectedRoute: React.FC = () => {
  const { isGapiLoaded, isSignedIn, signIn, initError } = useGoogleDrive();

  useEffect(() => {
    // Automatically trigger sign-in when ready and not already signed in.
    if (isGapiLoaded && !isSignedIn && !initError) {
      signIn();
    }
  }, [isGapiLoaded, isSignedIn, signIn, initError]);


  if (initError) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white p-6 rounded-lg shadow">
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
            <p className="font-bold">Initialization Error</p>
            <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{initError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show a loading screen while initializing or signing in.
  if (!isGapiLoaded || !isSignedIn) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <main className="container mx-auto flex items-center justify-center">
            <div className="text-center bg-white p-12 rounded-lg shadow-xl max-w-lg">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-600">Connecting to Google Drive...</p>
            </div>
        </main>
      </div>
    );
  }

  // Once signed in, render the protected content.
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
};

export default ProtectedRoute;
