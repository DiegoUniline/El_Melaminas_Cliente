import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions, type Module, type Action } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  module: Module;
  action?: Action;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function PermissionGuard({ 
  children, 
  module, 
  action = 'view',
  fallback,
  redirectTo 
}: PermissionGuardProps) {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const isLoading = authLoading || permissionsLoading;
  // Show loading while checking
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Admins have all permissions
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check specific permission
  if (hasPermission(module, action)) {
    return <>{children}</>;
  }

  // Redirect if specified
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  // Show fallback or null
  return fallback ? <>{fallback}</> : null;
}

// Higher-order component for wrapping entire pages
interface WithPermissionProps {
  module: Module;
  action?: Action;
}

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  { module, action = 'view' }: WithPermissionProps
) {
  return function PermissionWrapper(props: P) {
    return (
      <PermissionGuard 
        module={module} 
        action={action}
        redirectTo="/dashboard"
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
