import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AlbumListPage from './pages/AlbumListPage';
import AlbumEditorPage from './pages/AlbumEditorPage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicAlbumPage from './pages/PublicAlbumPage';

const App: React.FC = () => {
  return (
    <div className="min-h-screen font-sans">
       <Routes>
        <Route path="/" element={<Navigate to="/admin" />} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route index element={<AlbumListPage />} />
          <Route path="album/:albumId" element={<AlbumEditorPage />} />
        </Route>

        {/* Public Album Viewing Route */}
        <Route path="/album/:publicDataFileId" element={<PublicAlbumPage />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default App;