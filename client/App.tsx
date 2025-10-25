import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AlbumListPage from './pages/AlbumListPage';
import AlbumEditorPage from './pages/AlbumEditorPage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicAlbumPage from './pages/PublicAlbumPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './hooks/useAuth';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/album/:albumKey" element={<PublicAlbumPage />} />
          
          {/* Redirect root to login or admin dashboard */}
          <Route path="/" element={<Navigate to="/admin" />} />

          {/* Protected Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route index element={<AlbumListPage />} />
            <Route path="album/:albumId" element={<AlbumEditorPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </AuthProvider>
  );
};

export default App;
