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
  Plus, Edit, Power, PowerOff, DollarSign, Wifi, 
  Loader2, Tag, Settings 
} from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

// Types
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

export default function Catalogs() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('charges');

  // Charge Catalog State
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ChargeCatalog | null>(null);
  const [chargeForm, setChargeForm] = useState({ name: '', default_amount: '', description: '' });
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);
  const [toggleChargeDialog, setToggleChargeDialog] = useState<ChargeCatalog | null>(null);

  // Service Plans State
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [planForm, setPlanForm] = useState({ 
    name: '', 
    monthly_fee: '', 
    speed_download: '', 
    speed_upload: '', 
    description: '' 
  });
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [togglePlanDialog, setTogglePlanDialog] = useState<ServicePlan | null>(null);

  // Fetch Charge Catalog
  const { data: charges = [], isLoading: loadingCharges } = useQuery({
    queryKey: ['charge_catalog_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_catalog')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ChargeCatalog[];
    },
  });

  // Fetch Service Plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['service_plans_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_plans')
        .select('*')
        .order('monthly_fee');

      if (error) throw error;
      return data as ServicePlan[];
    },
  });

  // ========== CHARGE CATALOG HANDLERS ==========
  const handleNewCharge = () => {
    setEditingCharge(null);
    setChargeForm({ name: '', default_amount: '', description: '' });
    setChargeDialogOpen(true);
  };

  const handleEditCharge = (charge: ChargeCatalog) => {
    setEditingCharge(charge);
    setChargeForm({
      name: charge.name,
      default_amount: charge.default_amount.toString(),
      description: charge.description || '',
    });
    setChargeDialogOpen(true);
  };

  const handleSaveCharge = async () => {
    if (!chargeForm.name || !chargeForm.default_amount) {
      toast.error('Completa los campos requeridos');
      return;
    }

    setIsSubmittingCharge(true);
    try {
      const data = {
        name: chargeForm.name,
        default_amount: parseFloat(chargeForm.default_amount),
        description: chargeForm.description || null,
      };

      if (editingCharge) {
        const { error } = await supabase
          .from('charge_catalog')
          .update(data)
          .eq('id', editingCharge.id);
        if (error) throw error;
        toast.success('Cargo actualizado');
      } else {
        const { error } = await supabase
          .from('charge_catalog')
          .insert(data);
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
      const { error } = await supabase
        .from('charge_catalog')
        .update({ is_active: !toggleChargeDialog.is_active })
        .eq('id', toggleChargeDialog.id);

      if (error) throw error;
      
      toast.success(toggleChargeDialog.is_active ? 'Cargo desactivado' : 'Cargo activado');
      queryClient.invalidateQueries({ queryKey: ['charge_catalog_all'] });
      queryClient.invalidateQueries({ queryKey: ['charge_catalog'] });
      setToggleChargeDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar estado');
    }
  };

  // ========== SERVICE PLANS HANDLERS ==========
  const handleNewPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', monthly_fee: '', speed_download: '', speed_upload: '', description: '' });
    setPlanDialogOpen(true);
  };

  const handleEditPlan = (plan: ServicePlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      monthly_fee: plan.monthly_fee.toString(),
      speed_download: plan.speed_download || '',
      speed_upload: plan.speed_upload || '',
      description: plan.description || '',
    });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.monthly_fee) {
      toast.error('Completa los campos requeridos');
      return;
    }

    setIsSubmittingPlan(true);
    try {
      const data = {
        name: planForm.name,
        monthly_fee: parseFloat(planForm.monthly_fee),
        speed_download: planForm.speed_download || null,
        speed_upload: planForm.speed_upload || null,
        description: planForm.description || null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('service_plans')
          .update(data)
          .eq('id', editingPlan.id);
        if (error) throw error;
        toast.success('Plan actualizado');
      } else {
        const { error } = await supabase
          .from('service_plans')
          .insert(data);
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
      const { error } = await supabase
        .from('service_plans')
        .update({ is_active: !togglePlanDialog.is_active })
        .eq('id', togglePlanDialog.id);

      if (error) throw error;
      
      toast.success(togglePlanDialog.is_active ? 'Plan desactivado' : 'Plan activado');
      queryClient.invalidateQueries({ queryKey: ['service_plans_all'] });
      queryClient.invalidateQueries({ queryKey: ['service_plans'] });
      setTogglePlanDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar estado');
    }
  };

  const activeCharges = charges.filter(c => c.is_active).length;
  const activePlans = plans.filter(p => p.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Catálogos
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra los tipos de cargos y planes de servicio
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Tag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{charges.length}</p>
                  <p className="text-xs text-muted-foreground">Tipos de Cargo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Power className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCharges}</p>
                  <p className="text-xs text-muted-foreground">Cargos Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Wifi className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{plans.length}</p>
                  <p className="text-xs text-muted-foreground">Planes de Servicio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Power className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePlans}</p>
                  <p className="text-xs text-muted-foreground">Planes Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="charges" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tipos de Cargo
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Planes de Servicio
            </TabsTrigger>
          </TabsList>

          {/* CHARGES TAB */}
          <TabsContent value="charges" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Catálogo de Cargos
                </CardTitle>
                {isAdmin && (
                  <Button onClick={handleNewCharge}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Cargo
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loadingCharges ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>MONTO POR DEFECTO</TableHead>
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
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {charge.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={charge.is_active ? 'default' : 'secondary'}>
                              {charge.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCharge(charge)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setToggleChargeDialog(charge)}
                                >
                                  {charge.is_active ? (
                                    <PowerOff className="h-4 w-4 text-destructive" />
                                  ) : (
                                    <Power className="h-4 w-4 text-emerald-600" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {charges.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay cargos registrados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLANS TAB */}
          <TabsContent value="plans" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Planes de Servicio
                </CardTitle>
                {isAdmin && (
                  <Button onClick={handleNewPlan}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Plan
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NOMBRE</TableHead>
                        <TableHead>VELOCIDAD</TableHead>
                        <TableHead>MENSUALIDAD</TableHead>
                        <TableHead>DESCRIPCIÓN</TableHead>
                        <TableHead>ESTADO</TableHead>
                        {isAdmin && <TableHead className="text-right">ACCIONES</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>
                            {plan.speed_download && plan.speed_upload ? (
                              <span className="text-sm">
                                ↓{plan.speed_download} / ↑{plan.speed_upload}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(plan.monthly_fee)}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {plan.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                              {plan.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditPlan(plan)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTogglePlanDialog(plan)}
                                >
                                  {plan.is_active ? (
                                    <PowerOff className="h-4 w-4 text-destructive" />
                                  ) : (
                                    <Power className="h-4 w-4 text-emerald-600" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {plans.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay planes registrados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* CHARGE DIALOG */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCharge ? 'Editar Cargo' : 'Nuevo Tipo de Cargo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={chargeForm.name}
                onChange={(e) => setChargeForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Reconexión de servicio"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto por Defecto *</Label>
              <Input
                type="number"
                value={chargeForm.default_amount}
                onChange={(e) => setChargeForm(prev => ({ ...prev, default_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={chargeForm.description}
                onChange={(e) => setChargeForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción del cargo..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCharge} disabled={isSubmittingCharge}>
              {isSubmittingCharge && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCharge ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PLAN DIALOG */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plan' : 'Nuevo Plan de Servicio'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Plan Premium"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensualidad *</Label>
              <Input
                type="number"
                value={planForm.monthly_fee}
                onChange={(e) => setPlanForm(prev => ({ ...prev, monthly_fee: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Velocidad Descarga</Label>
                <Input
                  value={planForm.speed_download}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, speed_download: e.target.value }))}
                  placeholder="Ej: 50 Mbps"
                />
              </div>
              <div className="space-y-2">
                <Label>Velocidad Subida</Label>
                <Input
                  value={planForm.speed_upload}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, speed_upload: e.target.value }))}
                  placeholder="Ej: 25 Mbps"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={planForm.description}
                onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción del plan..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlan} disabled={isSubmittingPlan}>
              {isSubmittingPlan && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOGGLE CHARGE CONFIRM */}
      <ConfirmDialog
        open={!!toggleChargeDialog}
        onOpenChange={() => setToggleChargeDialog(null)}
        title={toggleChargeDialog?.is_active ? 'Desactivar Cargo' : 'Activar Cargo'}
        description={
          toggleChargeDialog?.is_active
            ? `¿Deseas desactivar "${toggleChargeDialog?.name}"? No aparecerá como opción al agregar cargos.`
            : `¿Deseas activar "${toggleChargeDialog?.name}"? Estará disponible para agregar cargos.`
        }
        confirmText={toggleChargeDialog?.is_active ? 'Desactivar' : 'Activar'}
        variant={toggleChargeDialog?.is_active ? 'destructive' : 'default'}
        onConfirm={handleToggleCharge}
      />

      {/* TOGGLE PLAN CONFIRM */}
      <ConfirmDialog
        open={!!togglePlanDialog}
        onOpenChange={() => setTogglePlanDialog(null)}
        title={togglePlanDialog?.is_active ? 'Desactivar Plan' : 'Activar Plan'}
        description={
          togglePlanDialog?.is_active
            ? `¿Deseas desactivar "${togglePlanDialog?.name}"? No se podrá asignar a nuevos clientes.`
            : `¿Deseas activar "${togglePlanDialog?.name}"? Estará disponible para asignar a clientes.`
        }
        confirmText={togglePlanDialog?.is_active ? 'Desactivar' : 'Activar'}
        variant={togglePlanDialog?.is_active ? 'destructive' : 'default'}
        onConfirm={handleTogglePlan}
      />
    </AppLayout>
  );
}
