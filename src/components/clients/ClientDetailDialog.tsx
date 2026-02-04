import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, addMonths, isBefore, startOfDay, startOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  User, MapPin, Phone, FileText, Wifi, DollarSign, 
  Calendar, Image, Plus, StickyNote, CreditCard, 
  Receipt, CheckCircle2, Clock, AlertCircle, Edit, Loader2,
  History, ChevronDown, Settings, Router, CalendarClock, Trash2, MoreHorizontal, RefreshCw, Filter
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/billing';
import { ChangePlanDialog } from './ChangePlanDialog';
import { ChangeBillingDayDialog } from './ChangeBillingDayDialog';
import { ChangeEquipmentDialog } from './ChangeEquipmentDialog';
import { RelocationDialog } from './RelocationDialog';
import type { Client, ClientBilling, Equipment, Payment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

interface ClientDetailDialogProps {
  client: ClientWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegisterPayment?: () => void;
  onEdit?: () => void;
}

// Función para calcular la próxima fecha de cobro
function getNextBillingDate(billingDay: number): Date {
  const today = startOfDay(new Date());
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let nextBilling = new Date(currentYear, currentMonth, billingDay);
  
  if (isBefore(nextBilling, today) || nextBilling.getTime() === today.getTime()) {
    nextBilling = addMonths(nextBilling, 1);
  }
  
  return nextBilling;
}

// Función para generar ID de cliente
function generateClientCode(id: string): string {
  return `#CLI${id.slice(0, 6).toUpperCase()}`;
}

const SERVICE_TYPES: Record<string, { label: string; color: string }> = {
  installation: { label: 'Instalación', color: 'bg-blue-500' },
  maintenance: { label: 'Mantenimiento', color: 'bg-yellow-500' },
  equipment_change: { label: 'Cambio de Equipo', color: 'bg-purple-500' },
  relocation: { label: 'Reubicación', color: 'bg-orange-500' },
  repair: { label: 'Reparación', color: 'bg-red-500' },
  disconnection: { label: 'Desconexión', color: 'bg-gray-500' },
  other: { label: 'Otro', color: 'bg-slate-500' },
};

const SERVICE_STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: 'bg-blue-500' },
  in_progress: { label: 'En Progreso', color: 'bg-yellow-500' },
  completed: { label: 'Completado', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

export function ClientDetailDialog({ client, open, onOpenChange, onRegisterPayment, onEdit }: ClientDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('servicios');
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  // Dialog states for service changes
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changeBillingDayOpen, setChangeBillingDayOpen] = useState(false);
  const [changeEquipmentOpen, setChangeEquipmentOpen] = useState(false);
  const [relocationOpen, setRelocationOpen] = useState(false);
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [selectedChargeType, setSelectedChargeType] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  
  // Mensualidad manual states
  const [isAddingMensualidad, setIsAddingMensualidad] = useState(false);
  const [mensualidadMonth, setMensualidadMonth] = useState(new Date().getMonth() + 1);
  const [mensualidadYear, setMensualidadYear] = useState(new Date().getFullYear());
  const [mensualidadAmount, setMensualidadAmount] = useState('');
  
  // Mensualidad filters
  const [mensualidadFilter, setMensualidadFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [mensualidadYearFilter, setMensualidadYearFilter] = useState<string>('all');
  
  // Mensualidad edit states
  const [editingCharge, setEditingCharge] = useState<any>(null);
  const [editChargeAmount, setEditChargeAmount] = useState('');
  const [editChargeDescription, setEditChargeDescription] = useState('');
  
  // Delete confirmation
  const [chargeToDelete, setChargeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Auto-generate mensualidades
  const [isGeneratingMensualidades, setIsGeneratingMensualidades] = useState(false);
  
  // Service states
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceData, setNewServiceData] = useState({
    service_type: 'maintenance',
    title: '',
    description: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    charge_amount: 0,
    assigned_to: '',
  });
  
  // Edit service states
  const [editingService, setEditingService] = useState<any>(null);
  const [isUpdatingService, setIsUpdatingService] = useState(false);

  // Fetch billing (to get updated balance)
  const { data: billingData, refetch: refetchBilling } = useQuery({
    queryKey: ['client_billing', client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data, error } = await supabase
        .from('client_billing')
        .select('*')
        .eq('client_id', client.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!client?.id && open,
  });

  // Fetch charges
  const { data: charges = [], refetch: refetchCharges } = useQuery({
    queryKey: ['client_charges', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('client_charges')
        .select('*, charge_catalog(*)')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  // Fetch notes
  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['client_notes', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  // Fetch charge catalog
  const { data: chargeCatalog = [] } = useQuery({
    queryKey: ['charge_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_catalog')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch client services
  const { data: clientServices = [], refetch: refetchServices } = useQuery({
    queryKey: ['client_services', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('scheduled_services')
        .select('*')
        .eq('client_id', client.id)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  // Fetch employees for service assignment
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Use fetched billing data or fallback to client prop
  const billing = billingData || client?.client_billing as any;
  const equipment = client?.equipment?.[0] as any;
  const billingDay = billing?.billing_day || 10;
  const nextBillingDate = getNextBillingDate(billingDay);
  
  // Balance calculation (negative = saldo a favor)
  const balance = billing?.balance || 0;
  const hasFavorBalance = balance < 0;
  const hasDebt = balance > 0;
  const displayBalance = Math.abs(balance);

  // Pending charges
  const pendingCharges = charges.filter((c: any) => c.status === 'pending');
  const totalPendingCharges = pendingCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

  // Mensualidad charges (filter only monthly charges)
  const mensualidadCharges = charges.filter((c: any) => 
    c.description?.toLowerCase().includes('mensualidad')
  );

  // Calcular meses de servicio
  const installDate = billing?.installation_date ? new Date(billing.installation_date) : null;
  const monthsOfService = installDate 
    ? Math.floor((new Date().getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  // Generar historial de mensualidades
  const generateMensualidades = () => {
    if (!billing?.installation_date) return [];
    
    const startDate = startOfMonth(new Date(billing.installation_date));
    const endDate = startOfMonth(new Date());
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    return months.map(date => {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthPayments = payments.filter(p => 
        p.period_month === month && p.period_year === year
      );
      const totalPaid = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const monthlyFee = billing?.monthly_fee || 0;
      const isPaid = totalPaid >= monthlyFee;
      const isPartial = totalPaid > 0 && totalPaid < monthlyFee;
      
      // Find corresponding charge
      const charge = mensualidadCharges.find((c: any) => 
        c.description?.includes(`${month}/${year}`)
      );
      
      return {
        month,
        year,
        monthName: format(date, 'MMMM yyyy', { locale: es }),
        monthlyFee,
        totalPaid,
        balance: monthlyFee - totalPaid,
        isPaid,
        isPartial,
        payments: monthPayments,
        charge,
      };
    }).reverse();
  };

  const mensualidades = generateMensualidades();
  
  // Get unique years for filter - MUST be before early return
  const availableYears = useMemo(() => {
    const years = new Set(mensualidades.map(m => m.year.toString()));
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [mensualidades]);
  
  // Apply filters to mensualidades - MUST be before early return
  const filteredMensualidades = useMemo(() => {
    return mensualidades.filter(m => {
      // Status filter
      if (mensualidadFilter === 'paid' && !m.isPaid) return false;
      if (mensualidadFilter === 'pending' && m.isPaid) return false;
      
      // Year filter
      if (mensualidadYearFilter !== 'all' && m.year.toString() !== mensualidadYearFilter) return false;
      
      return true;
    });
  }, [mensualidades, mensualidadFilter, mensualidadYearFilter]);

  // Early return AFTER all hooks
  if (!client) return null;

  const getDocumentUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from('client-documents').createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const handleDownloadDocument = async (path: string | null) => {
    if (!path) return;
    const url = await getDocumentUrl(path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !client.id) return;
    
    setIsAddingNote(true);
    try {
      const { error } = await supabase.from('client_notes').insert({
        client_id: client.id,
        note: newNote.trim(),
        created_by: user?.id,
      });

      if (error) throw error;
      
      toast.success('Nota agregada');
      setNewNote('');
      refetchNotes();
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar nota');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleAddCharge = async () => {
    if (!chargeAmount || !chargeDescription || !client.id) return;
    
    setIsAddingCharge(true);
    try {
      const amount = parseFloat(chargeAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('El monto debe ser mayor a 0');
        return;
      }

      // Insert charge
      const { error: chargeError } = await supabase.from('client_charges').insert({
        client_id: client.id,
        charge_catalog_id: selectedChargeType || null,
        description: chargeDescription,
        amount,
        status: 'pending',
        created_by: user?.id,
      });

      if (chargeError) throw chargeError;

      // Update balance
      if (billing) {
        const newBalance = (billing.balance || 0) + amount;
        const { error: balanceError } = await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('client_id', client.id);

        if (balanceError) throw balanceError;
      }
      
      toast.success('Cargo agregado');
      setSelectedChargeType('');
      setChargeAmount('');
      setChargeDescription('');
      refetchCharges();
      refetchBilling();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar cargo');
    } finally {
      setIsAddingCharge(false);
    }
  };

  const handleSelectChargeFromCatalog = (catalogId: string) => {
    setSelectedChargeType(catalogId);
    const selected = chargeCatalog.find((c: any) => c.id === catalogId);
    if (selected) {
      setChargeAmount(selected.default_amount.toString());
      setChargeDescription(selected.name);
    }
  };

  // Agregar mensualidad manual
  const handleAddMensualidad = async () => {
    if (!mensualidadAmount || !client.id) return;
    
    setIsAddingMensualidad(true);
    try {
      const amount = parseFloat(mensualidadAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('El monto debe ser mayor a 0');
        return;
      }

      // Insert charge for mensualidad
      const { error: chargeError } = await supabase.from('client_charges').insert({
        client_id: client.id,
        description: `Mensualidad ${mensualidadMonth}/${mensualidadYear}`,
        amount,
        status: 'pending',
        created_by: user?.id,
      });

      if (chargeError) throw chargeError;

      // Update balance
      if (billing) {
        const newBalance = (billing.balance || 0) + amount;
        await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('client_id', client.id);
      }
      
      toast.success('Mensualidad cargada correctamente');
      setMensualidadAmount('');
      refetchCharges();
      refetchBilling();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments', client.id] });
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar mensualidad');
    } finally {
      setIsAddingMensualidad(false);
    }
  };
  
  // Edit mensualidad charge
  const handleEditCharge = async () => {
    if (!editingCharge || !editChargeAmount || !client.id) return;
    
    try {
      const amount = parseFloat(editChargeAmount);
      const oldAmount = editingCharge.amount;
      const difference = amount - oldAmount;
      
      // Update charge
      const { error: chargeError } = await supabase
        .from('client_charges')
        .update({ 
          amount, 
          description: editChargeDescription 
        })
        .eq('id', editingCharge.id);
      
      if (chargeError) throw chargeError;
      
      // Update balance if amount changed and charge is pending
      if (difference !== 0 && editingCharge.status === 'pending' && billing) {
        const newBalance = (billing.balance || 0) + difference;
        await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('client_id', client.id);
      }
      
      toast.success('Cargo actualizado');
      setEditingCharge(null);
      refetchCharges();
      refetchBilling();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar cargo');
    }
  };
  
  // Delete mensualidad charge
  const handleDeleteCharge = async () => {
    if (!chargeToDelete || !client.id) return;
    
    setIsDeleting(true);
    try {
      const chargeToRemove = charges.find((c: any) => c.id === chargeToDelete);
      
      // Delete charge
      const { error: deleteError } = await supabase
        .from('client_charges')
        .delete()
        .eq('id', chargeToDelete);
      
      if (deleteError) throw deleteError;
      
      // Update balance if charge was pending
      if (chargeToRemove?.status === 'pending' && billing) {
        const newBalance = (billing.balance || 0) - chargeToRemove.amount;
        await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('client_id', client.id);
      }
      
      toast.success('Cargo eliminado');
      setChargeToDelete(null);
      refetchCharges();
      refetchBilling();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar cargo');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Auto-generate mensualidades
  const handleAutoGenerateMensualidades = async () => {
    if (!client.id || !billing || client.status !== 'active') return;
    
    setIsGeneratingMensualidades(true);
    try {
      const startDate = startOfMonth(new Date(billing.installation_date));
      const endDate = startOfMonth(new Date());
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      const newCharges: any[] = [];
      
      for (const date of months) {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const description = `Mensualidad ${month}/${year}`;
        
        // Check if charge already exists
        const exists = charges.some((c: any) => 
          c.description === description
        );
        
        if (!exists) {
          newCharges.push({
            client_id: client.id,
            description,
            amount: billing.monthly_fee,
            status: 'pending',
            created_by: user?.id,
          });
        }
      }
      
      if (newCharges.length === 0) {
        toast.info('Todas las mensualidades ya están generadas');
        setIsGeneratingMensualidades(false);
        return;
      }
      
      // Insert all charges
      const { error: chargeError } = await supabase
        .from('client_charges')
        .insert(newCharges);
      
      if (chargeError) throw chargeError;
      
      // Update balance
      const totalNewCharges = newCharges.reduce((sum, c) => sum + c.amount, 0);
      const newBalance = (billing.balance || 0) + totalNewCharges;
      await supabase
        .from('client_billing')
        .update({ balance: newBalance })
        .eq('client_id', client.id);
      
      toast.success(`${newCharges.length} mensualidades generadas`);
      refetchCharges();
      refetchBilling();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al generar mensualidades');
    } finally {
      setIsGeneratingMensualidades(false);
    }
  };

  // Crear servicio para este cliente
  const handleAddClientService = async () => {
    if (!newServiceData.title || !client.id) {
      toast.error('El título es requerido');
      return;
    }
    
    if (!newServiceData.assigned_to) {
      toast.error('Debe asignar un empleado');
      return;
    }
    
    setIsAddingService(true);
    try {
      const { error } = await supabase.from('scheduled_services').insert([{
        client_id: client.id,
        assigned_to: newServiceData.assigned_to,
        service_type: newServiceData.service_type as 'installation' | 'maintenance' | 'equipment_change' | 'relocation' | 'repair' | 'disconnection' | 'other',
        title: newServiceData.title,
        description: newServiceData.description || null,
        scheduled_date: newServiceData.scheduled_date,
        scheduled_time: newServiceData.scheduled_time || null,
        charge_amount: newServiceData.charge_amount,
        created_by: user?.id,
      }]);

      if (error) throw error;
      
      toast.success('Servicio agendado');
      setNewServiceData({
        service_type: 'maintenance',
        title: '',
        description: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        scheduled_time: '09:00',
        charge_amount: 0,
        assigned_to: '',
      });
      refetchServices();
      queryClient.invalidateQueries({ queryKey: ['scheduled-services'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al crear servicio');
    } finally {
      setIsAddingService(false);
    }
  };
  
  // Update service
  const handleUpdateService = async () => {
    if (!editingService) return;
    
    setIsUpdatingService(true);
    try {
      const { error } = await supabase
        .from('scheduled_services')
        .update({
          service_type: editingService.service_type,
          title: editingService.title,
          description: editingService.description,
          scheduled_date: editingService.scheduled_date,
          scheduled_time: editingService.scheduled_time,
          charge_amount: editingService.charge_amount,
          assigned_to: editingService.assigned_to,
          status: editingService.status,
        })
        .eq('id', editingService.id);
      
      if (error) throw error;
      
      toast.success('Servicio actualizado');
      setEditingService(null);
      refetchServices();
      queryClient.invalidateQueries({ queryKey: ['scheduled-services'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar servicio');
    } finally {
      setIsUpdatingService(false);
    }
  };
  
  // Cancel service
  const handleCancelService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_services')
        .update({ status: 'cancelled' })
        .eq('id', serviceId);
      
      if (error) throw error;
      
      toast.success('Servicio cancelado');
      refetchServices();
      queryClient.invalidateQueries({ queryKey: ['scheduled-services'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al cancelar servicio');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header similar a la imagen */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-6">
            {/* Avatar con iniciales */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20">
              <span className="text-3xl font-bold text-primary">
                {client.first_name.charAt(0)}{client.last_name_paterno.charAt(0)}
              </span>
            </div>
            
            {/* Info del cliente */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold">
                  {client.first_name} {client.last_name_paterno} {client.last_name_materno || ''}
                </h2>
                <span className="text-muted-foreground text-sm">{generateClientCode(client.id)}</span>
                <Badge 
                  variant={client.status === 'active' ? 'default' : 'destructive'} 
                  className={client.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                >
                  {client.status === 'active' ? 'ACTIVO' : 'CANCELADO'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {client.phone1}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {client.street} {client.exterior_number}
                </span>
              </div>
              
              {/* Botones de acción */}
              <div className="flex gap-3 mt-4">
                <Button onClick={onRegisterPayment} className="bg-emerald-600 hover:bg-emerald-700">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Registrar Pago
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Gestionar Servicio
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setChangePlanOpen(true)}>
                      <Wifi className="h-4 w-4 mr-2" />
                      Cambiar Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChangeBillingDayOpen(true)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Cambiar Día de Corte
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChangeEquipmentOpen(true)}>
                      <Router className="h-4 w-4 mr-2" />
                      Cambiar Equipo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRelocationOpen(true)}>
                      <MapPin className="h-4 w-4 mr-2" />
                      Cambio de Domicilio
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Cards de resumen */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Tarifa mensual */}
            <Card className="border-2">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarifa Mensual</span>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{formatCurrency(billing?.monthly_fee || 0)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {billing?.monthly_fee ? 'Plan activo' : 'Sin plan asignado'}
                </p>
              </CardContent>
            </Card>

            {/* Saldo actual */}
            <Card className={`border-2 ${hasFavorBalance ? 'border-emerald-200 bg-emerald-50/50' : hasDebt ? 'border-red-200 bg-red-50/50' : ''}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Actual</span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasFavorBalance ? 'bg-emerald-100' : hasDebt ? 'bg-red-100' : 'bg-muted'}`}>
                    <CreditCard className={`h-5 w-5 ${hasFavorBalance ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-muted-foreground'}`} />
                  </div>
                </div>
                <p className={`text-3xl font-bold ${hasFavorBalance ? 'text-emerald-600' : hasDebt ? 'text-red-600' : ''}`}>
                  {hasFavorBalance ? '-' : ''}{formatCurrency(displayBalance)}
                </p>
                <p className="text-xs flex items-center gap-1 mt-1">
                  <span className={`w-2 h-2 rounded-full ${hasFavorBalance ? 'bg-emerald-500' : hasDebt ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                  <span className={hasFavorBalance ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-emerald-600'}>
                    {hasFavorBalance ? 'Saldo a favor' : hasDebt ? 'Con adeudo' : 'Cuenta al corriente'}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* Próximo vencimiento */}
            <Card className="border-2">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximo Vencimiento</span>
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">
                  {format(nextBillingDate, 'dd MMM yyyy', { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {pendingCharges.length > 0 
                    ? `${pendingCharges.length} cargo(s) pendiente(s)` 
                    : 'Sin cargos pendientes'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pb-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="servicios" className="data-[state=active]:bg-background">
                Servicios
              </TabsTrigger>
              <TabsTrigger value="mensualidades" className="data-[state=active]:bg-background">
                Mensualidades
              </TabsTrigger>
              <TabsTrigger value="servicios-programados" className="data-[state=active]:bg-background">
                Agenda
              </TabsTrigger>
              <TabsTrigger value="estado-cuenta" className="data-[state=active]:bg-background">
                Estado de Cuenta
              </TabsTrigger>
              <TabsTrigger value="documentos" className="data-[state=active]:bg-background">
                Documentos INE
              </TabsTrigger>
              <TabsTrigger value="notas" className="data-[state=active]:bg-background">
                Notas
              </TabsTrigger>
            </TabsList>

            {/* TAB SERVICIOS - Equipo instalado */}
            <TabsContent value="servicios" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      Servicios Contratados
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PLAN</TableHead>
                        <TableHead>TARIFA</TableHead>
                        <TableHead>FECHA ALTA</TableHead>
                        <TableHead>ESTATUS</TableHead>
                        <TableHead>ANTIGÜEDAD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Internet Residencial</TableCell>
                        <TableCell>{formatCurrency(billing?.monthly_fee || 0)}</TableCell>
                        <TableCell>
                          {billing?.installation_date 
                            ? format(new Date(billing.installation_date), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Activo
                          </Badge>
                        </TableCell>
                        <TableCell>{monthsOfService} meses</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Equipo */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-blue-600" />
                      Antena
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {equipment ? (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground">Marca/Modelo</p>
                            <p className="font-medium">{equipment.antenna_brand} {equipment.antenna_model}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Serie</p>
                            <p className="font-mono text-xs">{equipment.antenna_serial || '-'}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground">IP</p>
                            <p className="font-mono">{equipment.antenna_ip || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">MAC</p>
                            <p className="font-mono text-xs">{equipment.antenna_mac || '-'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">SSID</p>
                          <p className="font-medium">{equipment.antenna_ssid || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Sin información</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-green-600" />
                      Router
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {equipment ? (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground">Marca/Modelo</p>
                            <p className="font-medium">{equipment.router_brand} {equipment.router_model}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Serie</p>
                            <p className="font-mono text-xs">{equipment.router_serial || '-'}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="bg-primary/5 p-3 rounded-lg">
                          <p className="text-muted-foreground text-xs">Red WiFi</p>
                          <p className="font-bold">{equipment.router_network_name || '-'}</p>
                          <p className="text-muted-foreground text-xs mt-2">Contraseña</p>
                          <p className="font-mono bg-white px-2 py-1 rounded border">{equipment.router_password || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Sin información</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {equipment && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Instalador:</span>
                        <span className="font-medium ml-2">{equipment.installer_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fecha instalación:</span>
                        <span className="font-medium ml-2">
                          {equipment.installation_date 
                            ? format(new Date(equipment.installation_date), 'dd/MM/yyyy')
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB MENSUALIDADES */}
            <TabsContent value="mensualidades" className="mt-4 space-y-4">
              {/* Cargar mensualidad manual */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Cargar Mensualidad Manual
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleAutoGenerateMensualidades}
                      disabled={isGeneratingMensualidades || client.status !== 'active'}
                    >
                      {isGeneratingMensualidades && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generar Mensualidades Automáticas
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="space-y-2">
                      <Label>Mes</Label>
                      <Select 
                        value={mensualidadMonth.toString()} 
                        onValueChange={(v) => setMensualidadMonth(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {format(new Date(2024, i, 1), 'MMMM', { locale: es })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Select 
                        value={mensualidadYear.toString()} 
                        onValueChange={(v) => setMensualidadYear(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => {
                            const year = new Date().getFullYear() - 2 + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        placeholder={formatCurrency(billing?.monthly_fee || 0)}
                        value={mensualidadAmount}
                        onChange={(e) => setMensualidadAmount(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddMensualidad} disabled={isAddingMensualidad || !mensualidadAmount}>
                      {isAddingMensualidad && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Cargar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Filtros */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filtros:</span>
                    </div>
                    <Select value={mensualidadFilter} onValueChange={(v: any) => setMensualidadFilter(v)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="paid">Pagados</SelectItem>
                        <SelectItem value="pending">Pendientes</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={mensualidadYearFilter} onValueChange={setMensualidadYearFilter}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground ml-auto">
                      Mostrando {filteredMensualidades.length} de {mensualidades.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Historial de mensualidades */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Historial de Mensualidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredMensualidades.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PERÍODO</TableHead>
                          <TableHead>TARIFA</TableHead>
                          <TableHead>PAGADO</TableHead>
                          <TableHead>PENDIENTE</TableHead>
                          <TableHead>ESTATUS</TableHead>
                          <TableHead className="text-right">ACCIONES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMensualidades.map((m) => (
                          <TableRow key={`${m.month}-${m.year}`}>
                            <TableCell className="font-medium capitalize">{m.monthName}</TableCell>
                            <TableCell>{formatCurrency(m.monthlyFee)}</TableCell>
                            <TableCell className="text-emerald-600">{formatCurrency(m.totalPaid)}</TableCell>
                            <TableCell className={m.balance > 0 ? 'text-red-600' : ''}>
                              {m.balance > 0 ? formatCurrency(m.balance) : '-'}
                            </TableCell>
                            <TableCell>
                              {m.isPaid ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Pagado
                                </Badge>
                              ) : m.isPartial ? (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Parcial
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {m.charge && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setEditingCharge(m.charge);
                                      setEditChargeAmount(m.charge.amount.toString());
                                      setEditChargeDescription(m.charge.description);
                                    }}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => setChargeToDelete(m.charge.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay historial de mensualidades
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB SERVICIOS PROGRAMADOS */}
            <TabsContent value="servicios-programados" className="mt-4 space-y-4">
              {/* Crear nuevo servicio */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarClock className="h-5 w-5" />
                    Agendar Servicio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Tipo de Servicio</Label>
                      <Select 
                        value={newServiceData.service_type} 
                        onValueChange={(v) => setNewServiceData({ ...newServiceData, service_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SERVICE_TYPES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={newServiceData.title}
                        onChange={(e) => setNewServiceData({ ...newServiceData, title: e.target.value })}
                        placeholder="Ej: Revisión de señal"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={newServiceData.scheduled_date}
                        onChange={(e) => setNewServiceData({ ...newServiceData, scheduled_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={newServiceData.scheduled_time}
                        onChange={(e) => setNewServiceData({ ...newServiceData, scheduled_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo ($)</Label>
                      <Input
                        type="number"
                        value={newServiceData.charge_amount}
                        onChange={(e) => setNewServiceData({ ...newServiceData, charge_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Asignar a</Label>
                      <Select 
                        value={newServiceData.assigned_to} 
                        onValueChange={(v) => setNewServiceData({ ...newServiceData, assigned_to: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp: any) => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label>Descripción</Label>
                    <Textarea
                      value={newServiceData.description}
                      onChange={(e) => setNewServiceData({ ...newServiceData, description: e.target.value })}
                      placeholder="Detalles del servicio..."
                      rows={2}
                    />
                  </div>
                  <Button onClick={handleAddClientService} disabled={isAddingService || !newServiceData.title || !newServiceData.assigned_to}>
                    {isAddingService && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Plus className="h-4 w-4 mr-2" />
                    Agendar Servicio
                  </Button>
                </CardContent>
              </Card>

              {/* Historial de servicios */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Servicios del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {clientServices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FECHA</TableHead>
                          <TableHead>TIPO</TableHead>
                          <TableHead>TÍTULO</TableHead>
                          <TableHead>CARGO</TableHead>
                          <TableHead>ESTATUS</TableHead>
                          <TableHead className="text-right">ACCIONES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientServices.map((service: any) => {
                          const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                          const statusInfo = SERVICE_STATUS[service.status] || SERVICE_STATUS.scheduled;
                          return (
                            <TableRow key={service.id}>
                              <TableCell>
                                {format(parseISO(service.scheduled_date), 'dd/MM/yyyy')}
                                {service.scheduled_time && (
                                  <span className="text-muted-foreground text-xs ml-1">
                                    {service.scheduled_time.slice(0, 5)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{typeInfo.label}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{service.title}</TableCell>
                              <TableCell>
                                {service.charge_amount > 0 ? formatCurrency(service.charge_amount) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${statusInfo.color} text-white`}>
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditingService(service)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    {service.status !== 'cancelled' && service.status !== 'completed' && (
                                      <DropdownMenuItem 
                                        className="text-red-600"
                                        onClick={() => handleCancelService(service.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Cancelar
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay servicios registrados para este cliente
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB ESTADO DE CUENTA */}
            <TabsContent value="estado-cuenta" className="mt-4 space-y-4">
              {/* Agregar cargo */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Agregar Cargo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    <Select value={selectedChargeType} onValueChange={handleSelectChargeFromCatalog}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {chargeCatalog.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({formatCurrency(item.default_amount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Descripción"
                      value={chargeDescription}
                      onChange={(e) => setChargeDescription(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Monto"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                    />
                    <Button onClick={handleAddCharge} disabled={isAddingCharge || !chargeAmount || !chargeDescription}>
                      {isAddingCharge && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Agregar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Cargos pendientes */}
              {pendingCharges.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                      <AlertCircle className="h-5 w-5" />
                      Cargos Pendientes ({pendingCharges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>DESCRIPCIÓN</TableHead>
                          <TableHead>MONTO</TableHead>
                          <TableHead>FECHA</TableHead>
                          <TableHead>ESTATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingCharges.map((charge: any) => (
                          <TableRow key={charge.id}>
                            <TableCell>{charge.description}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(charge.amount)}</TableCell>
                            <TableCell>{format(new Date(charge.created_at), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendiente
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end mt-3 pt-3 border-t">
                      <span className="font-bold text-amber-700">
                        Total Pendiente: {formatCurrency(totalPendingCharges)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Historial de pagos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Historial de Pagos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FECHA</TableHead>
                          <TableHead>MONTO</TableHead>
                          <TableHead>TIPO</TableHead>
                          <TableHead>PERIODO</TableHead>
                          <TableHead>RECIBO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.payment_type}</Badge>
                            </TableCell>
                            <TableCell>
                              {payment.period_month && payment.period_year 
                                ? `${payment.period_month}/${payment.period_year}`
                                : '-'}
                            </TableCell>
                            <TableCell>{payment.receipt_number || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay pagos registrados
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Historial de cargos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Historial de Cargos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {charges.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FECHA</TableHead>
                          <TableHead>DESCRIPCIÓN</TableHead>
                          <TableHead>MONTO</TableHead>
                          <TableHead>ESTATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {charges.map((charge: any) => (
                          <TableRow key={charge.id}>
                            <TableCell>{format(new Date(charge.created_at), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{charge.description}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(charge.amount)}</TableCell>
                            <TableCell>
                              {charge.status === 'paid' ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Pagado
                                </Badge>
                              ) : charge.status === 'cancelled' ? (
                                <Badge variant="secondary">Cancelado</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay cargos registrados
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB DOCUMENTOS */}
            <TabsContent value="documentos" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Documentos del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold">INE Suscriptor</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={client.ine_subscriber_front ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.ine_subscriber_front}
                          onClick={() => handleDownloadDocument(client.ine_subscriber_front)}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Frente
                        </Button>
                        <Button
                          variant={client.ine_subscriber_back ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.ine_subscriber_back}
                          onClick={() => handleDownloadDocument(client.ine_subscriber_back)}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Reverso
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">INE Adicional</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={client.ine_other_front ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.ine_other_front}
                          onClick={() => handleDownloadDocument(client.ine_other_front)}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Frente
                        </Button>
                        <Button
                          variant={client.ine_other_back ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.ine_other_back}
                          onClick={() => handleDownloadDocument(client.ine_other_back)}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Reverso
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 col-span-2">
                      <h4 className="font-semibold">Contrato Firmado</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={client.contract_page1 ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.contract_page1}
                          onClick={() => handleDownloadDocument(client.contract_page1)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Página 1
                        </Button>
                        <Button
                          variant={client.contract_page2 ? 'default' : 'outline'}
                          size="sm"
                          disabled={!client.contract_page2}
                          onClick={() => handleDownloadDocument(client.contract_page2)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Página 2
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB NOTAS */}
            <TabsContent value="notas" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <StickyNote className="h-5 w-5" />
                    Agregar Nota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Textarea
                      placeholder="Escribe una nota sobre el cliente..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={handleAddNote} disabled={isAddingNote || !newNote.trim()}>
                      {isAddingNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Historial de Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  {notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.map((note: any) => (
                        <div key={note.id} className="p-4 bg-muted/50 rounded-lg border">
                          <p className="text-sm">{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(note.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay notas registradas
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Service Change Dialogs */}
        <ChangePlanDialog
          clientId={client.id}
          clientName={`${client.first_name} ${client.last_name_paterno}`}
          currentBilling={billing}
          open={changePlanOpen}
          onOpenChange={setChangePlanOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            refetchBilling();
          }}
        />

        <ChangeBillingDayDialog
          clientId={client.id}
          clientName={`${client.first_name} ${client.last_name_paterno}`}
          currentBilling={billing}
          open={changeBillingDayOpen}
          onOpenChange={setChangeBillingDayOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            refetchBilling();
          }}
        />

        <ChangeEquipmentDialog
          clientId={client.id}
          clientName={`${client.first_name} ${client.last_name_paterno}`}
          equipment={equipment}
          open={changeEquipmentOpen}
          onOpenChange={setChangeEquipmentOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
          }}
        />

        <RelocationDialog
          client={client}
          equipment={equipment}
          open={relocationOpen}
          onOpenChange={setRelocationOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
          }}
        />
        
        {/* Edit Charge Dialog */}
        <Dialog open={!!editingCharge} onOpenChange={(open) => !open && setEditingCharge(null)}>
          <DialogContent className="max-w-md">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Editar Cargo</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    value={editChargeDescription}
                    onChange={(e) => setEditChargeDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    value={editChargeAmount}
                    onChange={(e) => setEditChargeAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCharge(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditCharge}>
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Edit Service Dialog */}
        <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
          <DialogContent className="max-w-lg">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Editar Servicio</h2>
              {editingService && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Servicio</Label>
                      <Select 
                        value={editingService.service_type} 
                        onValueChange={(v) => setEditingService({ ...editingService, service_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SERVICE_TYPES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select 
                        value={editingService.status} 
                        onValueChange={(v) => setEditingService({ ...editingService, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SERVICE_STATUS).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={editingService.title}
                      onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={editingService.scheduled_date}
                        onChange={(e) => setEditingService({ ...editingService, scheduled_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={editingService.scheduled_time || ''}
                        onChange={(e) => setEditingService({ ...editingService, scheduled_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo ($)</Label>
                      <Input
                        type="number"
                        value={editingService.charge_amount || 0}
                        onChange={(e) => setEditingService({ ...editingService, charge_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Asignar a</Label>
                    <Select 
                      value={editingService.assigned_to} 
                      onValueChange={(v) => setEditingService({ ...editingService, assigned_to: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp: any) => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={editingService.description || ''}
                      onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingService(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateService} disabled={isUpdatingService}>
                  {isUpdatingService && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete Charge Confirmation */}
        <AlertDialog open={!!chargeToDelete} onOpenChange={(open) => !open && setChargeToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cargo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El cargo será eliminado permanentemente y el saldo del cliente se actualizará.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCharge} disabled={isDeleting}>
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
