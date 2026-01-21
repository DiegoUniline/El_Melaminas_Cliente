import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, Edit, Power, PowerOff, DollarSign, Wifi, 
  Loader2, Tag, Settings, CreditCard, Building, Users, KeyRound
} from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

// ========== TYPES ==========
interface ChargeCatalog {
  id: string;
  name: string;
  default_amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface ServicePlan {
  id: string;
  name: string;
  monthly_fee: number;
  speed_download: string | null;
  speed_upload: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Bank {
  id: string;
  name: string;
  short_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface UserWithRole {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  role?: string;
}

export default function Catalogs() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('charges');

  // ========== CHARGE STATE ==========
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ChargeCatalog | null>(null);
  const [chargeForm, setChargeForm] = useState({ name: '', default_amount: '', description: '' });
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);
  const [toggleChargeDialog, setToggleChargeDialog] = useState<ChargeCatalog | null>(null);

  // ========== PLAN STATE ==========
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [planForm, setPlanForm] = useState({ name: '', monthly_fee: '', speed_download: '', speed_upload: '', description: '' });
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [togglePlanDialog, setTogglePlanDialog] = useState<ServicePlan | null>(null);

  // ========== PAYMENT METHOD STATE ==========
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({ name: '', description: '' });
  const [isSubmittingPaymentMethod, setIsSubmittingPaymentMethod] = useState(false);
  const [togglePaymentMethodDialog, setTogglePaymentMethodDialog] = useState<PaymentMethod | null>(null);

  // ========== BANK STATE ==========
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', short_name: '' });
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [toggleBankDialog, setToggleBankDialog] = useState<Bank | null>(null);

  // ========== USER STATE ==========
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ full_name: '', email: '', password: '', role: 'employee' });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  
  // ========== RESET PASSWORD STATE ==========
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ user_id: string; full_name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // ========== FETCH DATA ==========
  const { data: charges = [], isLoading: loadingCharges } = useQuery({
    queryKey: ['charge_catalog_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('charge_catalog').select('*').order('name');
      if (error) throw error;
      return data as ChargeCatalog[];
    },
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['service_plans_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_plans').select('*').order('monthly_fee');
      if (error) throw error;
      return data as ServicePlan[];
    },
  });

  const { data: paymentMethods = [], isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ['payment_methods_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_methods').select('*').order('name');
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });

  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['banks_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('banks').select('*').order('name');
      if (error) throw error;
      return data as Bank[];
    },
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users_with_roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return profiles?.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        role: rolesMap.get(p.user_id) || 'employee',
        user_id: p.user_id,
      })) as (UserWithRole & { user_id: string })[];
    },
  });

  // ========== CHARGE HANDLERS ==========
  const handleNewCharge = () => {
    setEditingCharge(null);
    setChargeForm({ name: '', default_amount: '', description: '' });
    setChargeDialogOpen(true);
  };

  const handleEditCharge = (charge: ChargeCatalog) => {
    setEditingCharge(charge);
    setChargeForm({ name: charge.name, default_amount: charge.default_amount.toString(), description: charge.description || '' });
    setChargeDialogOpen(true);
  };

  const handleSaveCharge = async () => {
    if (!chargeForm.name || !chargeForm.default_amount) {
      toast.error('Completa los campos requeridos');
      return;
    }
    setIsSubmittingCharge(true);
    try {
      const data = { name: chargeForm.name, default_amount: parseFloat(chargeForm.default_amount), description: chargeForm.description || null };
      if (editingCharge) {
        const { error } = await supabase.from('charge_catalog').update(data).eq('id', editingCharge.id);
        if (error) throw error;
        toast.success('Cargo actualizado');
      } else {
        const { error } = await supabase.from('charge_catalog').insert(data);
        if (error) throw error;
        toast.success('Cargo creado');
      }
      queryClient.invalidateQueries({ queryKey: ['charge_catalog_all'] });
      queryClient.invalidateQueries({ queryKey: ['charge_catalog'] });
      setChargeDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  const handleToggleCharge = async () => {
    if (!toggleChargeDialog) return;
    try {
      const { error } = await supabase.from('charge_catalog').update({ is_active: !toggleChargeDialog.is_active }).eq('id', toggleChargeDialog.id);
      if (error) throw error;
      toast.success(toggleChargeDialog.is_active ? 'Cargo desactivado' : 'Cargo activado');
      queryClient.invalidateQueries({ queryKey: ['charge_catalog_all'] });
      setToggleChargeDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error');
    }
  };

  // ========== PLAN HANDLERS ==========
  const handleNewPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', monthly_fee: '', speed_download: '', speed_upload: '', description: '' });
    setPlanDialogOpen(true);
  };

  const handleEditPlan = (plan: ServicePlan) => {
    setEditingPlan(plan);
    setPlanForm({ name: plan.name, monthly_fee: plan.monthly_fee.toString(), speed_download: plan.speed_download || '', speed_upload: plan.speed_upload || '', description: plan.description || '' });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.monthly_fee) {
      toast.error('Completa los campos requeridos');
      return;
    }
    setIsSubmittingPlan(true);
    try {
      const data = { name: planForm.name, monthly_fee: parseFloat(planForm.monthly_fee), speed_download: planForm.speed_download || null, speed_upload: planForm.speed_upload || null, description: planForm.description || null };
      if (editingPlan) {
        const { error } = await supabase.from('service_plans').update(data).eq('id', editingPlan.id);
        if (error) throw error;
        toast.success('Plan actualizado');
      } else {
        const { error } = await supabase.from('service_plans').insert(data);
        if (error) throw error;
        toast.success('Plan creado');
      }
      queryClient.invalidateQueries({ queryKey: ['service_plans_all'] });
      queryClient.invalidateQueries({ queryKey: ['service_plans'] });
      setPlanDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleTogglePlan = async () => {
    if (!togglePlanDialog) return;
    try {
      const { error } = await supabase.from('service_plans').update({ is_active: !togglePlanDialog.is_active }).eq('id', togglePlanDialog.id);
      if (error) throw error;
      toast.success(togglePlanDialog.is_active ? 'Plan desactivado' : 'Plan activado');
      queryClient.invalidateQueries({ queryKey: ['service_plans_all'] });
      setTogglePlanDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error');
    }
  };

  // ========== PAYMENT METHOD HANDLERS ==========
  const handleNewPaymentMethod = () => {
    setEditingPaymentMethod(null);
    setPaymentMethodForm({ name: '', description: '' });
    setPaymentMethodDialogOpen(true);
  };

  const handleEditPaymentMethod = (pm: PaymentMethod) => {
    setEditingPaymentMethod(pm);
    setPaymentMethodForm({ name: pm.name, description: pm.description || '' });
    setPaymentMethodDialogOpen(true);
  };

  const handleSavePaymentMethod = async () => {
    if (!paymentMethodForm.name) {
      toast.error('El nombre es requerido');
      return;
    }
    setIsSubmittingPaymentMethod(true);
    try {
      const data = { name: paymentMethodForm.name, description: paymentMethodForm.description || null };
      if (editingPaymentMethod) {
        const { error } = await supabase.from('payment_methods').update(data).eq('id', editingPaymentMethod.id);
        if (error) throw error;
        toast.success('Método de pago actualizado');
      } else {
        const { error } = await supabase.from('payment_methods').insert(data);
        if (error) throw error;
        toast.success('Método de pago creado');
      }
      queryClient.invalidateQueries({ queryKey: ['payment_methods_all'] });
      setPaymentMethodDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSubmittingPaymentMethod(false);
    }
  };

  const handleTogglePaymentMethod = async () => {
    if (!togglePaymentMethodDialog) return;
    try {
      const { error } = await supabase.from('payment_methods').update({ is_active: !togglePaymentMethodDialog.is_active }).eq('id', togglePaymentMethodDialog.id);
      if (error) throw error;
      toast.success(togglePaymentMethodDialog.is_active ? 'Método desactivado' : 'Método activado');
      queryClient.invalidateQueries({ queryKey: ['payment_methods_all'] });
      setTogglePaymentMethodDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error');
    }
  };

  // ========== BANK HANDLERS ==========
  const handleNewBank = () => {
    setEditingBank(null);
    setBankForm({ name: '', short_name: '' });
    setBankDialogOpen(true);
  };

  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setBankForm({ name: bank.name, short_name: bank.short_name || '' });
    setBankDialogOpen(true);
  };

  const handleSaveBank = async () => {
    if (!bankForm.name) {
      toast.error('El nombre es requerido');
      return;
    }
    setIsSubmittingBank(true);
    try {
      const data = { name: bankForm.name, short_name: bankForm.short_name || null };
      if (editingBank) {
        const { error } = await supabase.from('banks').update(data).eq('id', editingBank.id);
        if (error) throw error;
        toast.success('Banco actualizado');
      } else {
        const { error } = await supabase.from('banks').insert(data);
        if (error) throw error;
        toast.success('Banco creado');
      }
      queryClient.invalidateQueries({ queryKey: ['banks_all'] });
      setBankDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const handleToggleBank = async () => {
    if (!toggleBankDialog) return;
    try {
      const { error } = await supabase.from('banks').update({ is_active: !toggleBankDialog.is_active }).eq('id', toggleBankDialog.id);
      if (error) throw error;
      toast.success(toggleBankDialog.is_active ? 'Banco desactivado' : 'Banco activado');
      queryClient.invalidateQueries({ queryKey: ['banks_all'] });
      setToggleBankDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error');
    }
  };

  // ========== USER ROLE HANDLER ==========
  const handleChangeUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'employee' : 'admin';
    try {
      // Check if role exists
      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', userId).single();
      
      if (existingRole) {
        const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
      
      toast.success(`Rol cambiado a ${newRole === 'admin' ? 'Administrador' : 'Empleado'}`);
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar rol');
    }
  };

  // ========== CREATE USER HANDLER ==========
  const handleNewUser = () => {
    setUserForm({ full_name: '', email: '', password: '', role: 'employee' });
    setUserDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!userForm.full_name || !userForm.email || !userForm.password) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    
    if (userForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsSubmittingUser(true);
    try {
      // Call edge function to create user
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          full_name: userForm.full_name,
          role: userForm.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      toast.success('Usuario creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      setUserDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear usuario');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // ========== RESET PASSWORD HANDLER ==========
  const handleOpenResetPassword = (user: any) => {
    setResetPasswordUser({ user_id: user.user_id, full_name: user.full_name });
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) {
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
          user_id: resetPasswordUser.user_id,
          new_password: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al resetear contraseña');
      }

      toast.success('Contraseña actualizada correctamente');
      setResetPasswordDialogOpen(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Error al resetear contraseña');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Stats
  const activeCharges = charges.filter(c => c.is_active).length;
  const activePlans = plans.filter(p => p.is_active).length;
  const activePaymentMethods = paymentMethods.filter(pm => pm.is_active).length;
  const activeBanks = banks.filter(b => b.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Catálogos
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra todos los catálogos del sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100"><Tag className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{activeCharges}/{charges.length}</p>
                  <p className="text-xs text-muted-foreground">Tipos de Cargo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100"><Wifi className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{activePlans}/{plans.length}</p>
                  <p className="text-xs text-muted-foreground">Planes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100"><CreditCard className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{activePaymentMethods}/{paymentMethods.length}</p>
                  <p className="text-xs text-muted-foreground">Métodos Pago</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100"><Building className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{activeBanks}/{banks.length}</p>
                  <p className="text-xs text-muted-foreground">Bancos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-100"><Users className="h-5 w-5 text-rose-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="charges"><Tag className="h-4 w-4 mr-1 hidden sm:inline" />Cargos</TabsTrigger>
            <TabsTrigger value="plans"><Wifi className="h-4 w-4 mr-1 hidden sm:inline" />Planes</TabsTrigger>
            <TabsTrigger value="payment-methods"><CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />M. Pago</TabsTrigger>
            <TabsTrigger value="banks"><Building className="h-4 w-4 mr-1 hidden sm:inline" />Bancos</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1 hidden sm:inline" />Usuarios</TabsTrigger>
          </TabsList>

          {/* ========== CHARGES TAB ========== */}
          <TabsContent value="charges" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Catálogo de Cargos</CardTitle>
                {isAdmin && <Button onClick={handleNewCharge}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>}
              </CardHeader>
              <CardContent>
                {loadingCharges ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>MONTO</TableHead>
                        <TableHead>DESCRIPCIÓN</TableHead>
                        <TableHead>ESTADO</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((charge) => (
                        <TableRow key={charge.id} className={!charge.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{charge.name}</TableCell>
                          <TableCell>{formatCurrency(charge.default_amount)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">{charge.description || '-'}</TableCell>
                          <TableCell><Badge variant={charge.is_active ? 'default' : 'secondary'}>{charge.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditCharge(charge)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setToggleChargeDialog(charge)}>
                                  {charge.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-emerald-600" />}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {charges.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay cargos registrados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== PLANS TAB ========== */}
          <TabsContent value="plans" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" />Planes de Servicio</CardTitle>
                {isAdmin && <Button onClick={handleNewPlan}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>}
              </CardHeader>
              <CardContent>
                {loadingPlans ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>VELOCIDAD</TableHead>
                        <TableHead>MENSUALIDAD</TableHead>
                        <TableHead>ESTADO</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>{plan.speed_download && plan.speed_upload ? `↓${plan.speed_download} / ↑${plan.speed_upload}` : '-'}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCurrency(plan.monthly_fee)}</TableCell>
                          <TableCell><Badge variant={plan.is_active ? 'default' : 'secondary'}>{plan.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditPlan(plan)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setTogglePlanDialog(plan)}>
                                  {plan.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-emerald-600" />}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {plans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay planes registrados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== PAYMENT METHODS TAB ========== */}
          <TabsContent value="payment-methods" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Métodos de Pago</CardTitle>
                {isAdmin && <Button onClick={handleNewPaymentMethod}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>}
              </CardHeader>
              <CardContent>
                {loadingPaymentMethods ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>DESCRIPCIÓN</TableHead>
                        <TableHead>ESTADO</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentMethods.map((pm) => (
                        <TableRow key={pm.id} className={!pm.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{pm.name}</TableCell>
                          <TableCell className="text-muted-foreground">{pm.description || '-'}</TableCell>
                          <TableCell><Badge variant={pm.is_active ? 'default' : 'secondary'}>{pm.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditPaymentMethod(pm)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setTogglePaymentMethodDialog(pm)}>
                                  {pm.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-emerald-600" />}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {paymentMethods.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay métodos registrados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== BANKS TAB ========== */}
          <TabsContent value="banks" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Bancos</CardTitle>
                {isAdmin && <Button onClick={handleNewBank}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>}
              </CardHeader>
              <CardContent>
                {loadingBanks ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>NOMBRE CORTO</TableHead>
                        <TableHead>ESTADO</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {banks.map((bank) => (
                        <TableRow key={bank.id} className={!bank.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{bank.name}</TableCell>
                          <TableCell>{bank.short_name || '-'}</TableCell>
                          <TableCell><Badge variant={bank.is_active ? 'default' : 'secondary'}>{bank.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditBank(bank)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setToggleBankDialog(bank)}>
                                  {bank.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-emerald-600" />}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {banks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay bancos registrados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== USERS TAB ========== */}
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Usuarios del Sistema</CardTitle>
                {isAdmin && <Button onClick={handleNewUser}><Plus className="h-4 w-4 mr-2" />Nuevo Usuario</Button>}
              </CardHeader>
              <CardContent>
                {loadingUsers ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>EMAIL</TableHead>
                        <TableHead>ROL</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'Administrador' : 'Empleado'}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenResetPassword(user)}>
                                <KeyRound className="h-4 w-4 mr-1" />
                                Contraseña
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleChangeUserRole(user.user_id, user.role)}>
                                {user.role === 'admin' ? 'Hacer Empleado' : 'Hacer Admin'}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {users.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay usuarios registrados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ========== DIALOGS ========== */}
      
      {/* Charge Dialog */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCharge ? 'Editar Cargo' : 'Nuevo Tipo de Cargo'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={chargeForm.name} onChange={(e) => setChargeForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Monto por Defecto *</Label><Input type="number" value={chargeForm.default_amount} onChange={(e) => setChargeForm(prev => ({ ...prev, default_amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={chargeForm.description} onChange={(e) => setChargeForm(prev => ({ ...prev, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCharge} disabled={isSubmittingCharge}>{isSubmittingCharge && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingCharge ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPlan ? 'Editar Plan' : 'Nuevo Plan de Servicio'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={planForm.name} onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Mensualidad *</Label><Input type="number" value={planForm.monthly_fee} onChange={(e) => setPlanForm(prev => ({ ...prev, monthly_fee: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Velocidad Descarga</Label><Input value={planForm.speed_download} onChange={(e) => setPlanForm(prev => ({ ...prev, speed_download: e.target.value }))} placeholder="Ej: 50 Mbps" /></div>
              <div className="space-y-2"><Label>Velocidad Subida</Label><Input value={planForm.speed_upload} onChange={(e) => setPlanForm(prev => ({ ...prev, speed_upload: e.target.value }))} placeholder="Ej: 25 Mbps" /></div>
            </div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={planForm.description} onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePlan} disabled={isSubmittingPlan}>{isSubmittingPlan && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingPlan ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={paymentMethodDialogOpen} onOpenChange={setPaymentMethodDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPaymentMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={paymentMethodForm.name} onChange={(e) => setPaymentMethodForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={paymentMethodForm.description} onChange={(e) => setPaymentMethodForm(prev => ({ ...prev, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentMethodDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePaymentMethod} disabled={isSubmittingPaymentMethod}>{isSubmittingPaymentMethod && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingPaymentMethod ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingBank ? 'Editar Banco' : 'Nuevo Banco'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={bankForm.name} onChange={(e) => setBankForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Nombre Corto</Label><Input value={bankForm.short_name} onChange={(e) => setBankForm(prev => ({ ...prev, short_name: e.target.value }))} placeholder="Ej: BBVA" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBank} disabled={isSubmittingBank}>{isSubmittingBank && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingBank ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre Completo *</Label><Input value={userForm.full_name} onChange={(e) => setUserForm(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Juan Pérez" /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={userForm.email} onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))} placeholder="usuario@email.com" /></div>
            <div className="space-y-2"><Label>Contraseña *</Label><Input type="password" value={userForm.password} onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={userForm.role} onValueChange={(v) => setUserForm(prev => ({ ...prev, role: v }))}>
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
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={isSubmittingUser}>{isSubmittingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crear Usuario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Establece una nueva contraseña para <strong>{resetPasswordUser?.full_name}</strong>
            </p>
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
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar Contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialogs */}
      <ConfirmDialog open={!!toggleChargeDialog} onOpenChange={() => setToggleChargeDialog(null)} title={toggleChargeDialog?.is_active ? 'Desactivar Cargo' : 'Activar Cargo'} description={toggleChargeDialog?.is_active ? `¿Desactivar "${toggleChargeDialog?.name}"?` : `¿Activar "${toggleChargeDialog?.name}"?`} confirmText={toggleChargeDialog?.is_active ? 'Desactivar' : 'Activar'} variant={toggleChargeDialog?.is_active ? 'destructive' : 'default'} onConfirm={handleToggleCharge} />
      <ConfirmDialog open={!!togglePlanDialog} onOpenChange={() => setTogglePlanDialog(null)} title={togglePlanDialog?.is_active ? 'Desactivar Plan' : 'Activar Plan'} description={togglePlanDialog?.is_active ? `¿Desactivar "${togglePlanDialog?.name}"?` : `¿Activar "${togglePlanDialog?.name}"?`} confirmText={togglePlanDialog?.is_active ? 'Desactivar' : 'Activar'} variant={togglePlanDialog?.is_active ? 'destructive' : 'default'} onConfirm={handleTogglePlan} />
      <ConfirmDialog open={!!togglePaymentMethodDialog} onOpenChange={() => setTogglePaymentMethodDialog(null)} title={togglePaymentMethodDialog?.is_active ? 'Desactivar Método' : 'Activar Método'} description={togglePaymentMethodDialog?.is_active ? `¿Desactivar "${togglePaymentMethodDialog?.name}"?` : `¿Activar "${togglePaymentMethodDialog?.name}"?`} confirmText={togglePaymentMethodDialog?.is_active ? 'Desactivar' : 'Activar'} variant={togglePaymentMethodDialog?.is_active ? 'destructive' : 'default'} onConfirm={handleTogglePaymentMethod} />
      <ConfirmDialog open={!!toggleBankDialog} onOpenChange={() => setToggleBankDialog(null)} title={toggleBankDialog?.is_active ? 'Desactivar Banco' : 'Activar Banco'} description={toggleBankDialog?.is_active ? `¿Desactivar "${toggleBankDialog?.name}"?` : `¿Activar "${toggleBankDialog?.name}"?`} confirmText={toggleBankDialog?.is_active ? 'Desactivar' : 'Activar'} variant={toggleBankDialog?.is_active ? 'destructive' : 'default'} onConfirm={handleToggleBank} />
    </AppLayout>
  );
}
