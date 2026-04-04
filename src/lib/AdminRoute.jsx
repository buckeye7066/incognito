import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
