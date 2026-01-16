import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
import { format, addMonths, isBefore, startOfDay, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  User, MapPin, Phone, FileText, Wifi, DollarSign, 
  Calendar, Image, Plus, StickyNote, CreditCard, 
  Receipt, CheckCircle2, Clock, AlertCircle, Edit, Loader2,
  History, ChevronDown, Settings, Router, CalendarClock, Trash2, 
  MoreHorizontal, RefreshCw, Filter, ArrowLeft, Save, X
} from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import { formatPhoneNumber, formatPhoneDisplay, PhoneCountry } from '@/lib/phoneUtils';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { ChangePlanDialog } from '@/components/clients/ChangePlanDialog';
import { ChangeBillingDayDialog } from '@/components/clients/ChangeBillingDayDialog';
import { ChangeEquipmentDialog } from '@/components/clients/ChangeEquipmentDialog';
import { RelocationDialog } from '@/components/clients/RelocationDialog';
import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog';
import type { Client, ClientBilling, Equipment, Payment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

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

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edited data - using Record for flexibility with all db fields
  const [editedClient, setEditedClient] = useState<Record<string, any>>({});
  const [editedEquipment, setEditedEquipment] = useState<Record<string, any>>({});
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState('servicios');
  
  // Dialog states
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changeBillingDayOpen, setChangeBillingDayOpen] = useState(false);
  const [changeEquipmentOpen, setChangeEquipmentOpen] = useState(false);
  const [relocationOpen, setRelocationOpen] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  // Note states
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  // Mensualidad states
  const [isAddingMensualidad, setIsAddingMensualidad] = useState(false);
  const [mensualidadMonth, setMensualidadMonth] = useState(new Date().getMonth() + 1);
  const [mensualidadYear, setMensualidadYear] = useState(new Date().getFullYear());
  const [mensualidadAmount, setMensualidadAmount] = useState('');
  const [mensualidadFilter, setMensualidadFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [mensualidadYearFilter, setMensualidadYearFilter] = useState<string>('all');
  
  // Charge states
  const [editingCharge, setEditingCharge] = useState<any>(null);
  const [editChargeAmount, setEditChargeAmount] = useState('');
  const [editChargeDescription, setEditChargeDescription] = useState('');
  const [chargeToDelete, setChargeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
  const [editingService, setEditingService] = useState<any>(null);
  const [isUpdatingService, setIsUpdatingService] = useState(false);

  // Fetch client data
  const { data: client, isLoading, refetch: refetchClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_billing (*),
          equipment (*)
        `)
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as ClientWithDetails;
    },
    enabled: !!clientId,
  });

  // Fetch billing
  const { data: billingData, refetch: refetchBilling } = useQuery({
    queryKey: ['client_billing', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('client_billing')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['payments', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!clientId,
  });

  // Fetch charges
  const { data: charges = [], refetch: refetchCharges } = useQuery({
    queryKey: ['client_charges', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_charges')
        .select('*, charge_catalog(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch notes
  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['client_notes', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch client services
  const { data: clientServices = [], refetch: refetchServices } = useQuery({
    queryKey: ['client_services', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('scheduled_services')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch employees
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
  });

  // Fetch service plans
  const { data: servicePlans = [] } = useQuery({
    queryKey: ['service_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_fee');
      if (error) throw error;
      return data;
    },
  });

  // Initialize edited data when client changes
  useEffect(() => {
    if (client) {
      const c = client as any;
      setEditedClient({
        first_name: c.first_name,
        last_name_paterno: c.last_name_paterno,
        last_name_materno: c.last_name_materno || '',
        phone1: c.phone1,
        phone1_country: c.phone1_country || 'MX',
        phone2: c.phone2 || '',
        phone2_country: c.phone2_country || 'MX',
        phone3_signer: c.phone3_signer || '',
        phone3_country: c.phone3_country || 'MX',
        street: c.street,
        exterior_number: c.exterior_number,
        interior_number: c.interior_number || '',
        neighborhood: c.neighborhood,
        city: c.city,
        postal_code: c.postal_code || '',
      });
      
      if (client.equipment?.[0]) {
        const eq = client.equipment[0] as any;
        setEditedEquipment({
          antenna_brand: eq.antenna_brand || '',
          antenna_model: eq.antenna_model || '',
          antenna_serial: eq.antenna_serial || '',
          antenna_mac: eq.antenna_mac || '',
          antenna_ip: eq.antenna_ip || '',
          antenna_ssid: eq.antenna_ssid || '',
          router_brand: eq.router_brand || '',
          router_model: eq.router_model || '',
          router_serial: eq.router_serial || '',
          router_mac: eq.router_mac || '',
          router_ip: eq.router_ip || '',
          router_network_name: eq.router_network_name || '',
          router_password: eq.router_password || '',
          installer_name: eq.installer_name || '',
        });
      }
    }
  }, [client]);

  // Derived values
  const billing = billingData || client?.client_billing as any;
  const equipment = client?.equipment?.[0] as any;
  const billingDay = billing?.billing_day || 10;
  const nextBillingDate = getNextBillingDate(billingDay);
  
  const balance = billing?.balance || 0;
  const hasFavorBalance = balance < 0;
  const hasDebt = balance > 0;
  const displayBalance = Math.abs(balance);

  const pendingCharges = charges.filter((c: any) => c.status === 'pending');
  const totalPendingCharges = pendingCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

  const mensualidadCharges = charges.filter((c: any) => 
    c.description?.toLowerCase().includes('mensualidad')
  );

  // Generate mensualidades
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
  
  const availableYears = useMemo(() => {
    const years = new Set(mensualidades.map(m => m.year.toString()));
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [mensualidades]);
  
  const filteredMensualidades = useMemo(() => {
    return mensualidades.filter(m => {
      if (mensualidadFilter === 'paid' && !m.isPaid) return false;
      if (mensualidadFilter === 'pending' && m.isPaid) return false;
      if (mensualidadYearFilter !== 'all' && m.year.toString() !== mensualidadYearFilter) return false;
      return true;
    });
  }, [mensualidades, mensualidadFilter, mensualidadYearFilter]);

  // Handlers
  const handleCancelEdit = () => {
    if (client) {
      const c = client as any;
      setEditedClient({
        first_name: c.first_name,
        last_name_paterno: c.last_name_paterno,
        last_name_materno: c.last_name_materno || '',
        phone1: c.phone1,
        phone1_country: c.phone1_country || 'MX',
        phone2: c.phone2 || '',
        phone2_country: c.phone2_country || 'MX',
        phone3_signer: c.phone3_signer || '',
        phone3_country: c.phone3_country || 'MX',
        street: c.street,
        exterior_number: c.exterior_number,
        interior_number: c.interior_number || '',
        neighborhood: c.neighborhood,
        city: c.city,
        postal_code: c.postal_code || '',
      });
      
      if (client.equipment?.[0]) {
        const eq = client.equipment[0] as any;
        setEditedEquipment({
          antenna_brand: eq.antenna_brand || '',
          antenna_model: eq.antenna_model || '',
          antenna_serial: eq.antenna_serial || '',
          antenna_mac: eq.antenna_mac || '',
          antenna_ip: eq.antenna_ip || '',
          antenna_ssid: eq.antenna_ssid || '',
          router_brand: eq.router_brand || '',
          router_model: eq.router_model || '',
          router_serial: eq.router_serial || '',
          router_mac: eq.router_mac || '',
          router_ip: eq.router_ip || '',
          router_network_name: eq.router_network_name || '',
          router_password: eq.router_password || '',
          installer_name: eq.installer_name || '',
        });
      }
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!client || !clientId) return;
    
    setIsSaving(true);
    try {
      // Track changes for history
      const clientChanges: { field: string; oldValue: string; newValue: string }[] = [];
      
      const clientFields = [
        'first_name', 'last_name_paterno', 'last_name_materno', 
        'phone1', 'phone1_country', 'phone2', 'phone2_country',
        'phone3_signer', 'phone3_country',
        'street', 'exterior_number', 'interior_number', 
        'neighborhood', 'city', 'postal_code'
      ] as const;
      
      clientFields.forEach(field => {
        const oldVal = (client as any)[field] || '';
        const newVal = (editedClient as any)[field] || '';
        if (oldVal !== newVal) {
          clientChanges.push({ field, oldValue: oldVal, newValue: newVal });
        }
      });

      // Update client
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          first_name: editedClient.first_name,
          last_name_paterno: editedClient.last_name_paterno,
          last_name_materno: editedClient.last_name_materno || null,
          phone1: editedClient.phone1,
          phone1_country: editedClient.phone1_country,
          phone2: editedClient.phone2 || null,
          phone2_country: editedClient.phone2_country,
          phone3_signer: editedClient.phone3_signer || null,
          phone3_country: editedClient.phone3_country,
          street: editedClient.street,
          exterior_number: editedClient.exterior_number,
          interior_number: editedClient.interior_number || null,
          neighborhood: editedClient.neighborhood,
          city: editedClient.city,
          postal_code: editedClient.postal_code || null,
        })
        .eq('id', clientId);

      if (clientError) throw clientError;

      // Update equipment if exists
      if (equipment?.id) {
        const { error: equipError } = await supabase
          .from('equipment')
          .update({
            antenna_brand: editedEquipment.antenna_brand || null,
            antenna_model: editedEquipment.antenna_model || null,
            antenna_serial: editedEquipment.antenna_serial || null,
            antenna_mac: editedEquipment.antenna_mac || null,
            antenna_ip: editedEquipment.antenna_ip || null,
            antenna_ssid: editedEquipment.antenna_ssid || null,
            router_brand: editedEquipment.router_brand || null,
            router_model: editedEquipment.router_model || null,
            router_serial: editedEquipment.router_serial || null,
            router_mac: editedEquipment.router_mac || null,
            router_ip: editedEquipment.router_ip || null,
            router_network_name: editedEquipment.router_network_name || null,
            router_password: editedEquipment.router_password || null,
            installer_name: editedEquipment.installer_name || null,
          })
          .eq('id', equipment.id);

        if (equipError) throw equipError;
      }

      // Save change history
      if (clientChanges.length > 0) {
        const historyRecords = clientChanges.map(c => ({
          client_id: clientId,
          field_name: c.field,
          old_value: c.oldValue || null,
          new_value: c.newValue || null,
          changed_by: user?.id || null,
        }));

        await supabase.from('prospect_change_history').insert(historyRecords);
      }

      toast.success(`Cliente actualizado (${clientChanges.length} campo(s) modificado(s))`);
      setIsEditing(false);
      refetchClient();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

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
    if (!newNote.trim() || !clientId) return;
    
    setIsAddingNote(true);
    try {
      const { error } = await supabase.from('client_notes').insert({
        client_id: clientId,
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

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">Cliente no encontrado</h2>
          <Button variant="link" onClick={() => navigate('/clients')}>
            Volver a clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          ) : (
            isAdmin && (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )
          )}
        </div>

        {/* Client Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20 flex-shrink-0">
                <span className="text-3xl font-bold text-primary">
                  {(editedClient.first_name || client.first_name)?.charAt(0)}
                  {(editedClient.last_name_paterno || client.last_name_paterno)?.charAt(0)}
                </span>
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* Name row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label>Nombre</Label>
                        <Input
                          value={editedClient.first_name || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, first_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Apellido Paterno</Label>
                        <Input
                          value={editedClient.last_name_paterno || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, last_name_paterno: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Apellido Materno</Label>
                        <Input
                          value={editedClient.last_name_materno || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, last_name_materno: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    {/* Phones row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label>Teléfono 1</Label>
                        <PhoneInput
                          value={editedClient.phone1 || ''}
                          onChange={(v) => setEditedClient({ ...editedClient, phone1: v })}
                          country={(editedClient.phone1_country as PhoneCountry) || 'MX'}
                          onCountryChange={(c) => setEditedClient({ ...editedClient, phone1_country: c })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Teléfono 2</Label>
                        <PhoneInput
                          value={editedClient.phone2 || ''}
                          onChange={(v) => setEditedClient({ ...editedClient, phone2: v })}
                          country={(editedClient.phone2_country as PhoneCountry) || 'MX'}
                          onCountryChange={(c) => setEditedClient({ ...editedClient, phone2_country: c })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Teléfono Firmante</Label>
                        <PhoneInput
                          value={editedClient.phone3_signer || ''}
                          onChange={(v) => setEditedClient({ ...editedClient, phone3_signer: v })}
                          country={(editedClient.phone3_country as PhoneCountry) || 'MX'}
                          onCountryChange={(c) => setEditedClient({ ...editedClient, phone3_country: c })}
                        />
                      </div>
                    </div>
                    
                    {/* Address row */}
                    <div className="grid grid-cols-6 gap-4">
                      <div className="space-y-1 col-span-2">
                        <Label>Calle</Label>
                        <Input
                          value={editedClient.street || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, street: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>No. Ext</Label>
                        <Input
                          value={editedClient.exterior_number || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, exterior_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>No. Int</Label>
                        <Input
                          value={editedClient.interior_number || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, interior_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Colonia</Label>
                        <Input
                          value={editedClient.neighborhood || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, neighborhood: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Ciudad</Label>
                        <Input
                          value={editedClient.city || ''}
                          onChange={(e) => setEditedClient({ ...editedClient, city: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
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
                    <div className="flex items-center gap-4 text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {formatPhoneDisplay(client.phone1, (client as any).phone1_country)}
                      </span>
                      {client.phone2 && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {formatPhoneDisplay(client.phone2, (client as any).phone2_country)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {client.street} {client.exterior_number}
                        {client.interior_number ? ` Int. ${client.interior_number}` : ''}, {client.neighborhood}, {client.city}
                      </span>
                    </div>
                  </>
                )}
                
                {/* Action buttons - only when not editing */}
                {!isEditing && (
                  <div className="flex gap-3 mt-4">
                    <Button onClick={() => setShowPaymentDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
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
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Tabs Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="servicios" className="data-[state=active]:bg-background">
              Servicios
            </TabsTrigger>
            <TabsTrigger value="mensualidades" className="data-[state=active]:bg-background">
              Mensualidades
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

          {/* TAB SERVICIOS */}
          <TabsContent value="servicios" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Servicios Contratados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PLAN</TableHead>
                      <TableHead>TARIFA</TableHead>
                      <TableHead>FECHA ALTA</TableHead>
                      <TableHead>DÍA CORTE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Plan de Internet
                      </TableCell>
                      <TableCell>{formatCurrency(billing?.monthly_fee || 0)}</TableCell>
                      <TableCell>
                        {billing?.installation_date 
                          ? format(new Date(billing.installation_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>Día {billingDay}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Equipment cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    Antena
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Marca</Label>
                          <Input
                            value={editedEquipment.antenna_brand || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_brand: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Modelo</Label>
                          <Input
                            value={editedEquipment.antenna_model || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_model: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Serie</Label>
                          <Input
                            value={editedEquipment.antenna_serial || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_serial: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">MAC</Label>
                          <Input
                            value={editedEquipment.antenna_mac || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_mac: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">IP</Label>
                          <Input
                            value={editedEquipment.antenna_ip || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_ip: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SSID</Label>
                          <Input
                            value={editedEquipment.antenna_ssid || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_ssid: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : equipment ? (
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
                    <Router className="h-4 w-4 text-green-600" />
                    Router
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Marca</Label>
                          <Input
                            value={editedEquipment.router_brand || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_brand: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Modelo</Label>
                          <Input
                            value={editedEquipment.router_model || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_model: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Red WiFi</Label>
                          <Input
                            value={editedEquipment.router_network_name || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_network_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Contraseña</Label>
                          <Input
                            value={editedEquipment.router_password || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_password: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Serie</Label>
                          <Input
                            value={editedEquipment.router_serial || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_serial: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">IP</Label>
                          <Input
                            value={editedEquipment.router_ip || ''}
                            onChange={(e) => setEditedEquipment({ ...editedEquipment, router_ip: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : equipment ? (
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

            {/* Installer info */}
            {(equipment || isEditing) && (
              <Card>
                <CardContent className="py-4">
                  {isEditing ? (
                    <div className="flex items-center gap-6">
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs">Instalador</Label>
                        <Input
                          value={editedEquipment.installer_name || ''}
                          onChange={(e) => setEditedEquipment({ ...editedEquipment, installer_name: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Instalador:</span>
                        <span className="font-medium ml-2">{equipment?.installer_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fecha instalación:</span>
                        <span className="font-medium ml-2">
                          {equipment?.installation_date 
                            ? format(new Date(equipment.installation_date), 'dd/MM/yyyy')
                            : '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB MENSUALIDADES */}
          <TabsContent value="mensualidades" className="mt-4 space-y-4">
            {/* Filters */}
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

            {/* Historial */}
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

          {/* TAB ESTADO CUENTA */}
          <TabsContent value="estado-cuenta" className="mt-4 space-y-4">
            {/* Pending charges */}
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

            {/* Payment history */}
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

        {/* Dialogs */}
        <ChangePlanDialog
          clientId={clientId || ''}
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
          clientId={clientId || ''}
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
          clientId={clientId || ''}
          clientName={`${client.first_name} ${client.last_name_paterno}`}
          equipment={equipment}
          open={changeEquipmentOpen}
          onOpenChange={setChangeEquipmentOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            refetchClient();
          }}
        />

        <RelocationDialog
          client={client}
          equipment={equipment}
          open={relocationOpen}
          onOpenChange={setRelocationOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            refetchClient();
          }}
        />

        <PaymentFormDialog
          client={client}
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client_billing', clientId] });
            refetchBilling();
          }}
        />
      </div>
    </AppLayout>
  );
}
