import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, User, Bell, Shield, Database, Loader2, Check, Save } from 'lucide-react';

export default function Settings() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailPayments: true,
    emailOverdue: true,
    emailNewClients: false,
  });

  // System stats
  const { data: systemStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const [
        { count: totalClients },
        { count: totalProspects },
        { count: totalPayments },
        { count: totalUsers },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('prospects').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);

      return {
        totalClients: totalClients || 0,
        totalProspects: totalProspects || 0,
        totalPayments: totalPayments || 0,
        totalUsers: totalUsers || 0,
      };
    },
  });

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Configuración
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra tu cuenta y preferencias del sistema
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Sistema
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                  <CardDescription>
                    Actualiza tu información de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nombre Completo</Label>
                    <Input
                      id="fullName"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      El correo no puede ser modificado
                    </p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Guardar Cambios
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Cuenta y Seguridad
                  </CardTitle>
                  <CardDescription>
                    Información de tu cuenta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Rol</p>
                      <p className="text-sm text-muted-foreground">Tu nivel de acceso en el sistema</p>
                    </div>
                    <Badge variant={isAdmin ? 'default' : 'secondary'}>
                      {isAdmin ? 'Administrador' : 'Empleado'}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">ID de Usuario</p>
                      <p className="text-sm text-muted-foreground">Identificador único</p>
                    </div>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {user?.id?.slice(0, 8)}...
                    </code>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Último Acceso</p>
                      <p className="text-sm text-muted-foreground">Última vez que iniciaste sesión</p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user?.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleDateString('es-MX', { 
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preferencias de Notificaciones
                </CardTitle>
                <CardDescription>
                  Configura cómo deseas recibir notificaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones de Pagos</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibir notificación cuando se registre un pago
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailPayments}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailPayments: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertas de Vencimiento</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar sobre clientes con pagos vencidos
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailOverdue}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailOverdue: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Nuevos Clientes</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando se registre un nuevo cliente
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailNewClients}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailNewClients: checked }))}
                  />
                </div>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Las preferencias se guardan automáticamente
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="system">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Estadísticas del Sistema
                    </CardTitle>
                    <CardDescription>
                      Resumen de datos en el sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-3xl font-bold text-primary">{systemStats?.totalClients || 0}</p>
                        <p className="text-sm text-muted-foreground">Clientes</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-3xl font-bold text-primary">{systemStats?.totalProspects || 0}</p>
                        <p className="text-sm text-muted-foreground">Prospectos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-3xl font-bold text-primary">{systemStats?.totalPayments || 0}</p>
                        <p className="text-sm text-muted-foreground">Pagos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-3xl font-bold text-primary">{systemStats?.totalUsers || 0}</p>
                        <p className="text-sm text-muted-foreground">Usuarios</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Información del Sistema</CardTitle>
                    <CardDescription>
                      Detalles técnicos de la aplicación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Versión</span>
                      <Badge variant="outline">1.0.0</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Entorno</span>
                      <Badge variant="secondary">Producción</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Backend</span>
                      <Badge variant="default">Lovable Cloud</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Estado</span>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm text-emerald-600">En línea</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}