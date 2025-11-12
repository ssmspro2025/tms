import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  centerOnly?: boolean;
  parentOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false, centerOnly = false, parentOnly = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login page based on current route
    if (location.pathname === '/parent-dashboard') {
      return <Navigate to="/login-parent" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (centerOnly && user.role !== 'center' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (parentOnly && user.role !== 'parent') {
    return <Navigate to="/login-parent" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
