import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, MapPin, KeyRound, Shield } from 'lucide-react';
import { useCities } from '@/hooks/useCities';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    user_id: string;
    full_name: string;
    email: string | null;
    role?: string;
  } | null;
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const { activeCities, isLoadingActive: isLoadingCities } = useCities();
  
  const [assignedCities, setAssignedCities] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('employee');
  const [isSaving, setIsSaving] = useState(false);
  
  // Reset password state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Fetch user's assigned cities
  const { data: userCities = [], isLoading: isLoadingUserCities } = useQuery({
    queryKey: ['user_cities', user?.user_id],
    queryFn: async () => {
      if (!user?.user_id) return [];
      const { data, error } = await supabase
        .from('user_cities')
        .select('city_id')
        .eq('user_id', user.user_id);
      if (error) throw error;
      return data.map(uc => uc.city_id);
    },
    enabled: !!user?.user_id && open,
  });

  // Initialize state when user changes
  useEffect(() => {
    if (user) {
      setSelectedRole(user.role || 'employee');
      setShowResetPassword(false);
      setNewPassword('');
    }
  }, [user]);

  useEffect(() => {
    if (userCities) {
      setAssignedCities(userCities);
    }
  }, [userCities]);

  const toggleCity = (cityId: string) => {
    setAssignedCities(prev => 
      prev.includes(cityId) 
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      // Update role if changed
      if (selectedRole !== user.role) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.user_id)
          .single();
        
        if (existingRole) {
          await supabase
            .from('user_roles')
            .update({ role: selectedRole as 'admin' | 'employee' })
            .eq('user_id', user.user_id);
        } else {
          await supabase
            .from('user_roles')
            .insert({ user_id: user.user_id, role: selectedRole as 'admin' | 'employee' });
        }
      }

      // Update city assignments
      // Delete existing assignments
      await supabase
        .from('user_cities')
        .delete()
        .eq('user_id', user.user_id);
      
      // Insert new assignments
      if (assignedCities.length > 0) {
        const { error } = await supabase
          .from('user_cities')
          .insert(assignedCities.map(cityId => ({
            user_id: user.user_id,
            city_id: cityId,
          })));
        if (error) throw error;
      }

      toast.success('Usuario actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['user_cities'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !newPassword) {
      toast.error('Ingresa la nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          new_password: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al resetear contraseña');
      }

      toast.success('Contraseña actualizada correctamente');
      setShowResetPassword(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Error al resetear contraseña');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const isLoading = isLoadingCities || isLoadingUserCities;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        
        {user && (
          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="space-y-2">
              <p className="font-medium text-lg">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <Separator />

            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rol del Usuario
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Empleado</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {selectedRole === 'admin' && (
                <p className="text-xs text-muted-foreground">
                  Los administradores tienen acceso completo y no requieren asignación de ciudades.
                </p>
              )}
            </div>

            <Separator />

            {/* City Assignments */}
            {selectedRole !== 'admin' && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ciudades Asignadas
                </Label>
                <p className="text-sm text-muted-foreground">
                  El usuario solo verá clientes y prospectos de estas ciudades.
                </p>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activeCities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No hay ciudades configuradas.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {activeCities.map((city) => (
                      <div
                        key={city.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
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
                        <span className="text-sm">{city.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {assignedCities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {assignedCities.map(cityId => {
                      const city = activeCities.find(c => c.id === cityId);
                      return city ? (
                        <Badge key={cityId} variant="secondary" className="text-xs">
                          {city.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Reset Password */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Contraseña
              </Label>
              
              {!showResetPassword ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowResetPassword(true)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Cambiar Contraseña
                </Button>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña (mínimo 6 caracteres)"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setShowResetPassword(false);
                        setNewPassword('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar Contraseña
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
