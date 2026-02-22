import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, token, isAdmin } = useAuth();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} state={{ from: location }} replace />;
  }
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
