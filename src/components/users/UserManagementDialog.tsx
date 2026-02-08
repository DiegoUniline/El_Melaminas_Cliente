import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  MoreHorizontal,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
  Shield,
  User,
} from 'lucide-react';

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string | null;
  isAdmin?: boolean;
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
  const queryClient = useQueryClient();
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'employee' as 'admin' | 'employee',
  });

  // Fetch all users with roles
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['all_users_management'],
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

      return (profiles as UserProfile[]).map(p => ({
        ...p,
        isAdmin: adminIds.has(p.user_id),
      }));
    },
    enabled: open,
  });

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.full_name) {
      toast.error('Todos los campos son requeridos');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: createForm.email,
          password: createForm.password,
          full_name: createForm.full_name,
          role: createForm.role,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Usuario creado correctamente');
      setShowCreateDialog(false);
      setCreateForm({ email: '', password: '', full_name: '', role: 'employee' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['all_users_for_permissions'] });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear usuario');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error('Ingresa una nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await supabase.functions.invoke('reset-password', {
        body: {
          user_id: selectedUser.user_id,
          new_password: newPassword,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Contraseña restablecida correctamente');
      setShowResetPasswordDialog(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Error al restablecer contraseña');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    try {
      if (user.isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id)
          .eq('role', 'admin');
        if (error) throw error;
        toast.success(`${user.full_name} ya no es administrador`);
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.user_id, role: 'admin' });
        if (error) throw error;
        toast.success(`${user.full_name} ahora es administrador`);
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['all_users_for_permissions'] });
    } catch (error: any) {
      console.error('Error toggling role:', error);
      toast.error(error.message || 'Error al cambiar rol');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Usuarios
            </DialogTitle>
            <DialogDescription>
              Crear usuarios, restablecer contraseñas y gestionar roles del sistema
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.isAdmin ? 'default' : 'secondary'}>
                          {user.isAdmin ? 'Administrador' : 'Empleado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetPasswordDialog(true);
                              }}
                            >
                              <KeyRound className="h-4 w-4 mr-2" />
                              Restablecer Contraseña
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleRole(user)}>
                              {user.isAdmin ? (
                                <>
                                  <User className="h-4 w-4 mr-2" />
                                  Quitar Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Hacer Admin
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo usuario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo *</Label>
              <Input
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={createForm.role}
                onValueChange={(value: 'admin' | 'employee') => setCreateForm({ ...createForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Empleado</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetPasswordDialog(false);
              setNewPassword('');
              setSelectedUser(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting}>
              {isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
