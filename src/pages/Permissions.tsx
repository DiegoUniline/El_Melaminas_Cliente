import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Shield, 
  Users, 
  Save, 
  Loader2,
  Eye,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Settings
} from 'lucide-react';
import { 
  ALL_MODULES, 
  MODULE_LABELS, 
  type Module 
} from '@/hooks/usePermissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCities, useUserCityAssignments } from '@/hooks/useCities';
import { UserManagementDialog } from '@/components/users/UserManagementDialog';

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string | null;
}

interface UserPermission {
  id?: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function Permissions() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localPermissions, setLocalPermissions] = useState<Map<string, UserPermission>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  // Fetch all users (non-admins)
  const { data: users = [] } = useQuery({
    queryKey: ['all_users_for_permissions'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get admin user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Filter out admins
      return (profiles as UserProfile[]).filter(p => !adminIds.has(p.user_id));
    },
    enabled: isAdmin,
  });

  // Cities data
  const { activeCities, isLoadingActive: isLoadingCities } = useCities();
  const { assignedCities, isLoading: isLoadingCityAssignments, toggleCity } = useUserCityAssignments(selectedUserId);

  // Fetch permissions for selected user
  const { data: userPermissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['user_permissions_admin', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', selectedUserId);

      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!selectedUserId,
  });

  // Initialize local permissions when user changes
  const initializeLocalPermissions = (permissions: UserPermission[]) => {
    const permMap = new Map<string, UserPermission>();
    
    // Initialize all modules with false
    ALL_MODULES.forEach(module => {
      const existing = permissions.find(p => p.module === module);
      permMap.set(module, existing || {
        user_id: selectedUserId!,
        module,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      });
    });
    
    setLocalPermissions(permMap);
    setHasChanges(false);
  };

  // Handle user selection
  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    setHasChanges(false);
  };

  // Update when permissions load
  useState(() => {
    if (userPermissions.length > 0 || selectedUserId) {
      initializeLocalPermissions(userPermissions);
    }
  });

  // Toggle permission
  const togglePermission = (module: Module, action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    const current = localPermissions.get(module);
    if (!current) return;

    const updated = { ...current, [action]: !current[action] };
    
    // If enabling create/edit/delete, also enable view
    if (action !== 'can_view' && updated[action] && !updated.can_view) {
      updated.can_view = true;
    }
    
    // If disabling view, disable all others
    if (action === 'can_view' && !updated.can_view) {
      updated.can_create = false;
      updated.can_edit = false;
      updated.can_delete = false;
    }

    const newMap = new Map(localPermissions);
    newMap.set(module, updated);
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  // Toggle all permissions for a module
  const toggleAllForModule = (module: Module, enable: boolean) => {
    const current = localPermissions.get(module);
    if (!current) return;

    const updated = {
      ...current,
      can_view: enable,
      can_create: enable,
      can_edit: enable,
      can_delete: enable,
    };

    const newMap = new Map(localPermissions);
    newMap.set(module, updated);
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  // Toggle all permissions for an action across all modules
  const toggleAllForAction = (action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete', enable: boolean) => {
    const newMap = new Map(localPermissions);
    
    ALL_MODULES.forEach(module => {
      const current = newMap.get(module);
      if (current) {
        const updated = { ...current, [action]: enable };
        
        // If enabling create/edit/delete, also enable view
        if (action !== 'can_view' && enable && !updated.can_view) {
          updated.can_view = true;
        }
        
        // If disabling view, disable all others
        if (action === 'can_view' && !enable) {
          updated.can_create = false;
          updated.can_edit = false;
          updated.can_delete = false;
        }
        
        newMap.set(module, updated);
      }
    });
    
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedUserId) return;

    setIsSaving(true);
    try {
      const permissionsToSave = Array.from(localPermissions.values());

      // Delete existing permissions for this user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUserId);

      // Insert new permissions (only if any permission is granted)
      const permissionsWithGrants = permissionsToSave.filter(
        p => p.can_view || p.can_create || p.can_edit || p.can_delete
      );

      if (permissionsWithGrants.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsWithGrants.map(p => ({
            user_id: selectedUserId,
            module: p.module,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          })));

        if (error) throw error;
      }

      toast.success('Permisos guardados correctamente');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['user_permissions_admin', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar permisos');
    } finally {
      setIsSaving(false);
    }
  };

  // Preset: Grant all
  const grantAll = () => {
    const newMap = new Map(localPermissions);
    ALL_MODULES.forEach(module => {
      const current = newMap.get(module);
      if (current) {
        newMap.set(module, {
          ...current,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        });
      }
    });
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  // Preset: View only
  const viewOnly = () => {
    const newMap = new Map(localPermissions);
    ALL_MODULES.forEach(module => {
      const current = newMap.get(module);
      if (current) {
        newMap.set(module, {
          ...current,
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
        });
      }
    });
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  // Preset: Revoke all
  const revokeAll = () => {
    const newMap = new Map(localPermissions);
    ALL_MODULES.forEach(module => {
      const current = newMap.get(module);
      if (current) {
        newMap.set(module, {
          ...current,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        });
      }
    });
    setLocalPermissions(newMap);
    setHasChanges(true);
  };

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  // Initialize permissions when they load
  if (userPermissions && selectedUserId && localPermissions.size === 0) {
    initializeLocalPermissions(userPermissions);
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Acceso Denegado</h2>
              <p className="text-muted-foreground">
                Solo los administradores pueden gestionar permisos.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Gestión de Permisos
            </h1>
            <p className="text-muted-foreground mt-1">
              Configura qué puede ver y hacer cada usuario en el sistema
            </p>
          </div>
          <Button onClick={() => setShowUserManagement(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Gestionar Usuarios
          </Button>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* User List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios
              </CardTitle>
              <CardDescription>
                Selecciona un usuario para configurar sus permisos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {users.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No hay usuarios disponibles
                  </div>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.user_id}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                        selectedUserId === u.user_id && "bg-muted"
                      )}
                      onClick={() => handleUserSelect(u.user_id)}
                    >
                      <p className="font-medium truncate">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Permissions Table */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedUser 
                      ? `Permisos de ${selectedUser.full_name}`
                      : 'Selecciona un usuario'
                    }
                  </CardTitle>
                  {selectedUser && (
                    <CardDescription>{selectedUser.email}</CardDescription>
                  )}
                </div>
                {selectedUser && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={viewOnly}>
                      Solo ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={grantAll}>
                      Dar todo
                    </Button>
                    <Button variant="outline" size="sm" onClick={revokeAll}>
                      Quitar todo
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={!hasChanges || isSaving}
                      className="ml-2"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecciona un usuario de la lista para configurar sus permisos</p>
                </div>
              ) : isLoadingPermissions ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Módulo</TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span className="text-xs">Ver</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Plus className="h-4 w-4" />
                            <span className="text-xs">Crear</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Pencil className="h-4 w-4" />
                            <span className="text-xs">Editar</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Trash2 className="h-4 w-4" />
                            <span className="text-xs">Eliminar</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_MODULES.map((module) => {
                        const perm = localPermissions.get(module);
                        const hasAnyPermission = perm?.can_view || perm?.can_create || perm?.can_edit || perm?.can_delete;
                        
                        return (
                          <TableRow key={module}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {MODULE_LABELS[module]}
                                {hasAnyPermission && (
                                  <Badge variant="outline" className="text-xs">
                                    Activo
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm?.can_view || false}
                                onCheckedChange={() => togglePermission(module, 'can_view')}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm?.can_create || false}
                                onCheckedChange={() => togglePermission(module, 'can_create')}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm?.can_edit || false}
                                onCheckedChange={() => togglePermission(module, 'can_edit')}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm?.can_delete || false}
                                onCheckedChange={() => togglePermission(module, 'can_delete')}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleAllForModule(module, true)}
                                  title="Dar todos los permisos"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleAllForModule(module, false)}
                                  title="Quitar todos los permisos"
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* City Assignments Section */}
              {selectedUser && !isLoadingPermissions && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      <h3 className="font-semibold">Ciudades Asignadas</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecciona las ciudades que este usuario puede ver. Solo verá clientes y prospectos de estas ciudades.
                    </p>
                    
                    {isLoadingCities || isLoadingCityAssignments ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : activeCities.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No hay ciudades configuradas. Ve a Catálogos para agregar ciudades.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {activeCities.map((city) => (
                          <div
                            key={city.id}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                              assignedCities.includes(city.id) 
                                ? "bg-primary/10 border-primary" 
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => toggleCity(city.id)}
                          >
                            <Checkbox
                              checked={assignedCities.includes(city.id)}
                              onCheckedChange={() => toggleCity(city.id)}
                            />
                            <span className="text-sm font-medium">{city.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasChanges && selectedUser && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar" para aplicar los permisos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>

    <UserManagementDialog 
      open={showUserManagement} 
      onOpenChange={setShowUserManagement} 
    />
  </>
  );
}
