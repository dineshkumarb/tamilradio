import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StreamProvider } from './context/StreamContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalPlayer from './components/GlobalPlayer';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import LibraryPage from './pages/LibraryPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import ArtistsAdminPage from './pages/ArtistsAdminPage';
import MediaLibraryPage from './pages/MediaLibraryPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StreamProvider>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/player/:artist" element={<PlayerPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
          <Route path="/admin/artists" element={<ProtectedRoute requireAdmin><ArtistsAdminPage /></ProtectedRoute>} />
          <Route path="/admin/media-library" element={<ProtectedRoute requireAdmin><MediaLibraryPage /></ProtectedRoute>} />
          <Route
            path="/library/:artist"
            element={
              <ProtectedRoute requireAdmin>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GlobalPlayer />
        </StreamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
