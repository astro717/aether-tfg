import { Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { useOrganization } from '../../modules/organization/context/OrganizationContext';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface ProtectedManagerRouteProps {
  children: ReactNode;
}

export function ProtectedManagerRoute({ children }: ProtectedManagerRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isManager, loading: orgLoading } = useOrganization();

  // Show loading state while checking auth and organization
  if (authLoading || orgLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if not a manager
  if (!isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
