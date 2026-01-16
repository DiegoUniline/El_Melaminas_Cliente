import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Module = 
  | 'dashboard'
  | 'prospects'
  | 'prospects_history'
  | 'clients'
  | 'clients_history'
  | 'clients_debt'
  | 'mensualidades'
  | 'payments'
  | 'services'
  | 'chat'
  | 'catalogs'
  | 'reports'
  | 'settings';

export type Action = 'view' | 'create' | 'edit' | 'delete';

export interface ModulePermission {
  module: Module;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard',
  prospects: 'Prospectos',
  prospects_history: 'Historial Prospectos',
  clients: 'Clientes',
  clients_history: 'Historial Clientes',
  clients_debt: 'Deudores',
  mensualidades: 'Mensualidades',
  payments: 'Pagos',
  services: 'Agenda Servicios',
  chat: 'Chat Interno',
  catalogs: 'Catálogos',
  reports: 'Reportes',
  settings: 'Configuración',
};

export const ALL_MODULES: Module[] = [
  'dashboard',
  'prospects',
  'prospects_history',
  'clients',
  'clients_history',
  'clients_debt',
  'mensualidades',
  'payments',
  'services',
  'chat',
  'catalogs',
  'reports',
  'settings',
];

export function usePermissions() {
  const { user, isAdmin } = useAuth();

  const { data: permissions = [], isLoading, refetch } = useQuery({
    queryKey: ['user_permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as ModulePermission[];
    },
    enabled: !!user?.id,
  });

  // Check if user has permission for a specific action on a module
  const hasPermission = (module: Module, action: Action): boolean => {
    // Admins have all permissions
    if (isAdmin) return true;

    const modulePermission = permissions.find(p => p.module === module);
    if (!modulePermission) return false;

    switch (action) {
      case 'view':
        return modulePermission.can_view;
      case 'create':
        return modulePermission.can_create;
      case 'edit':
        return modulePermission.can_edit;
      case 'delete':
        return modulePermission.can_delete;
      default:
        return false;
    }
  };

  // Check if user can view a module (for navigation)
  const canView = (module: Module): boolean => hasPermission(module, 'view');
  const canCreate = (module: Module): boolean => hasPermission(module, 'create');
  const canEdit = (module: Module): boolean => hasPermission(module, 'edit');
  const canDelete = (module: Module): boolean => hasPermission(module, 'delete');

  return {
    permissions,
    isLoading,
    refetch,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    isAdmin,
  };
}

// Hook to get all users' permissions (admin only)
export function useAllPermissions() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['all_user_permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .order('user_id');

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}
