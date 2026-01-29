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
  MoreHorizontal, RefreshCw, Filter, ArrowLeft, Save, X, Upload, Eye,
  FileDown, Printer, Download
} from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import { formatPhoneNumber, formatPhoneDisplay, PhoneCountry } from '@/lib/phoneUtils';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { MacAddressInput } from '@/components/shared/MacAddressInput';
import { ChangePlanDialog } from '@/components/clients/ChangePlanDialog';
import { ChangeBillingDayDialog } from '@/components/clients/ChangeBillingDayDialog';
import { ChangeEquipmentDialog } from '@/components/clients/ChangeEquipmentDialog';
import { RelocationDialog } from '@/components/clients/RelocationDialog';
import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog';
import { EditPaymentDialog } from '@/components/payments/EditPaymentDialog';
import { EditChargeDialog } from '@/components/charges/EditChargeDialog';
import { InitialBillingDialog } from '@/components/clients/InitialBillingDialog';
import { PrintableDocument } from '@/components/documents/PrintableDocument';
import { AccountStatementDocument } from '@/components/documents/AccountStatementDocument';
import { PaymentReceiptDocument } from '@/components/documents/PaymentReceiptDocument';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
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

// Función para calcular próximo vencimiento basado en mensualidades pagadas
function getNextDueDateFromCharges(charges: any[], billingDay: number): { date: Date; coveredUntil: string | null } {
  // Filtrar solo mensualidades pagadas
  const paidMensualidades = charges.filter((c: any) => 
    c.description?.toLowerCase().includes('mensualidad') && 
    c.status === 'paid'
  );
  
  if (paidMensualidades.length === 0) {
    // Sin mensualidades pagadas, usar cálculo tradicional
    return { date: getNextBillingDate(billingDay), coveredUntil: null };
  }
  
  // Encontrar el mes/año más alto
  let maxMonth = 0;
  let maxYear = 0;
  
  paidMensualidades.forEach((charge: any) => {
    const match = charge.description?.match(/(\d{1,2})\/(\d{4})/);
    if (match) {
      const month = parseInt(match[1]);
      const year = parseInt(match[2]);
      if (year > maxYear || (year === maxYear && month > maxMonth)) {
        maxYear = year;
        maxMonth = month;
      }
    }
  });
  
  if (maxYear === 0) {
    return { date: getNextBillingDate(billingDay), coveredUntil: null };
  }
  
  // El siguiente mes después del último pagado
  let nextMonth = maxMonth + 1;
  let nextYear = maxYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  
  const coveredUntil = format(new Date(maxYear, maxMonth - 1, 1), 'MMMM yyyy', { locale: es });
  
  return {
    date: new Date(nextYear, nextMonth - 1, billingDay),
    coveredUntil
  };
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
  const [showInitialBillingDialog, setShowInitialBillingDialog] = useState(false);
  
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
  
  // Charge filters
  const [chargeTypeFilter, setChargeTypeFilter] = useState<string>('all');
  const [chargeDateFrom, setChargeDateFrom] = useState<Date | undefined>(undefined);
  const [chargeDateTo, setChargeDateTo] = useState<Date | undefined>(undefined);
  const [chargeStatusFilter, setChargeStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  
  // Document dialogs
  const [showAccountStatement, setShowAccountStatement] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any>(null);
  
  // Charge states
  const [editingCharge, setEditingCharge] = useState<any>(null);
  const [showEditChargeDialog, setShowEditChargeDialog] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<any>(null);
  const [isDeletingCharge, setIsDeletingCharge] = useState(false);
  const [isGeneratingMensualidades, setIsGeneratingMensualidades] = useState(false);
  
  // Payment edit/delete states
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditPaymentDialog, setShowEditPaymentDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  
  // Extra charges form states
  const [isAddingExtraCharge, setIsAddingExtraCharge] = useState(false);
  const [selectedChargeType, setSelectedChargeType] = useState('');
  const [extraChargeAmount, setExtraChargeAmount] = useState('');
  const [extraChargeDescription, setExtraChargeDescription] = useState('');
  
  // Service states
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceData, setNewServiceData] = useState({
    service_type: 'maintenance',
    title: '',
    description: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    charge_amount: '',
    assigned_to: '',
  });
  const [editingService, setEditingService] = useState<any>(null);
  const [isUpdatingService, setIsUpdatingService] = useState(false);
  
  // Document upload states
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
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

  // Fetch payment methods for displaying names
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment_methods_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch banks for displaying names
  const { data: banks = [] } = useQuery({
    queryKey: ['banks_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name, short_name');
      if (error) throw error;
      return data;
    },
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
  });

  const getPaymentMethodName = (paymentTypeId: string) => {
    const method = paymentMethods.find(pm => pm.id === paymentTypeId);
    return method?.name || paymentTypeId;
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    return bank?.short_name || bank?.name || bankId;
  };

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
        phone3: c.phone3 || '',
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
  
  // Calcular próximo vencimiento basado en mensualidades pagadas
  const { date: nextDueDate, coveredUntil } = useMemo(() => {
    return getNextDueDateFromCharges(charges, billingDay);
  }, [charges, billingDay]);

  const pendingCharges = charges.filter((c: any) => c.status === 'pending');
  const totalPendingCharges = pendingCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

  // Calcular saldo efectivo basado en cargos pendientes
  const pendingChargesTotal = useMemo(() => {
    return charges
      .filter((c: any) => c.status === 'pending')
      .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  }, [charges]);

  const hasAdvancePayments = useMemo(() => {
    return charges.some((c: any) => 
      c.description?.toLowerCase().includes('mensualidad adelantada') && 
      c.status === 'paid'
    );
  }, [charges]);

  // El saldo efectivo es el total de cargos pendientes
  const isUpToDate = pendingChargesTotal === 0 && hasAdvancePayments;
  const hasDebt = pendingChargesTotal > 0;
  const displayBalance = isUpToDate ? 0 : pendingChargesTotal;

  // Calcular crédito realmente disponible (solo si hay saldo a favor NO aplicado a mensualidades)
  // Si ya se crearon mensualidades adelantadas, el crédito ya se usó
  const effectiveCreditBalance = useMemo(() => {
    if (hasAdvancePayments) {
      // El crédito ya fue aplicado a mensualidades adelantadas
      return 0;
    }
    // Si no hay mensualidades adelantadas pero hay saldo negativo en billing, ese es crédito disponible
    const billingBalance = billing?.balance || 0;
    return billingBalance < 0 ? Math.abs(billingBalance) : 0;
  }, [hasAdvancePayments, billing?.balance]);

  const mensualidadCharges = charges.filter((c: any) => 
    c.description?.toLowerCase().includes('mensualidad')
  );

  // Generate mensualidades - now based on client_charges records
  const generateMensualidades = () => {
    if (!billing?.installation_date) return [];
    
    const monthlyFee = billing?.monthly_fee || 0;
    const results: Array<{
      month: number;
      year: number;
      monthName: string;
      monthlyFee: number;
      totalPaid: number;
      balance: number;
      isPaid: boolean;
      isPartial: boolean;
      payments: any[];
      charge: any;
    }> = [];
    
    // Get all mensualidad charges (both regular and advance)
    const mensualidadChargesAll = charges.filter((c: any) => 
      c.description?.toLowerCase().includes('mensualidad')
    );
    
    // Extract unique month/year combinations from charges
    const chargeMonths = new Map<string, { month: number; year: number; charges: any[] }>();
    
    mensualidadChargesAll.forEach((charge: any) => {
      // Extract month/year from description like "Mensualidad 1/2026" or "Mensualidad adelantada 2/2027"
      const match = charge.description?.match(/(\d{1,2})\/(\d{4})/);
      if (match) {
        const month = parseInt(match[1]);
        const year = parseInt(match[2]);
        const key = `${month}-${year}`;
        
        if (!chargeMonths.has(key)) {
          chargeMonths.set(key, { month, year, charges: [] });
        }
        chargeMonths.get(key)?.charges.push(charge);
      }
    });
    
    // Also generate months from installation to now (for periods without charges)
    const startDate = startOfMonth(new Date(billing.installation_date));
    const endDate = startOfMonth(new Date());
    const intervalMonths = eachMonthOfInterval({ start: startDate, end: endDate });
    
    intervalMonths.forEach(date => {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${month}-${year}`;
      
      if (!chargeMonths.has(key)) {
        chargeMonths.set(key, { month, year, charges: [] });
      }
    });
    
    // Convert to array and calculate totals
    chargeMonths.forEach(({ month, year, charges: periodCharges }) => {
      const totalPaid = periodCharges
        .filter((c: any) => c.status === 'paid')
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      
      const isPaid = totalPaid >= monthlyFee;
      const isPartial = totalPaid > 0 && totalPaid < monthlyFee;
      
      // Create a date for formatting (1st of that month)
      const monthDate = new Date(year, month - 1, 1);
      
      results.push({
        month,
        year,
        monthName: format(monthDate, 'MMMM yyyy', { locale: es }),
        monthlyFee,
        totalPaid,
        balance: monthlyFee - totalPaid,
        isPaid,
        isPartial,
        payments: [], // Legacy - not used anymore
        charge: periodCharges[0] || null,
      });
    });
    
    // Sort by year and month (newest first)
    return results.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
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

  // Get unique charge types for filter
  const chargeTypes = useMemo(() => {
    const types = new Set<string>();
    charges.forEach((c: any) => {
      if (c.description?.toLowerCase().includes('mensualidad')) {
        types.add('mensualidad');
      } else if (c.description?.toLowerCase().includes('instalación')) {
        types.add('instalacion');
      } else if (c.description?.toLowerCase().includes('prorrateo')) {
        types.add('prorrateo');
      } else {
        types.add('otro');
      }
    });
    return Array.from(types);
  }, [charges]);

  // Filter charges
  const filteredCharges = useMemo(() => {
    return charges.filter((c: any) => {
      // Status filter
      if (chargeStatusFilter === 'paid' && c.status !== 'paid') return false;
      if (chargeStatusFilter === 'pending' && c.status !== 'pending') return false;
      
      // Type filter
      if (chargeTypeFilter !== 'all') {
        const desc = c.description?.toLowerCase() || '';
        if (chargeTypeFilter === 'mensualidad' && !desc.includes('mensualidad')) return false;
        if (chargeTypeFilter === 'instalacion' && !desc.includes('instalación')) return false;
        if (chargeTypeFilter === 'prorrateo' && !desc.includes('prorrateo')) return false;
        if (chargeTypeFilter === 'otro') {
          if (desc.includes('mensualidad') || desc.includes('instalación') || desc.includes('prorrateo')) return false;
        }
      }
      
      // Date filters
      if (chargeDateFrom) {
        const chargeDate = new Date(c.created_at);
        if (chargeDate < chargeDateFrom) return false;
      }
      if (chargeDateTo) {
        const chargeDate = new Date(c.created_at);
        const endOfDay = new Date(chargeDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (chargeDate > endOfDay) return false;
      }
      
      return true;
    });
  }, [charges, chargeStatusFilter, chargeTypeFilter, chargeDateFrom, chargeDateTo]);

  const handleShowPaymentReceipt = (payment: any) => {
    setSelectedPaymentForReceipt(payment);
    setShowPaymentReceipt(true);
  };

  // Handle adding extra charge
  const handleAddExtraCharge = async () => {
    if (!clientId || !extraChargeAmount) {
      toast.error('Ingresa un monto para el cargo');
      return;
    }

    setIsAddingExtraCharge(true);
    try {
      const selectedCatalog = chargeCatalog.find((c: any) => c.id === selectedChargeType);
      const description = extraChargeDescription || selectedCatalog?.name || 'Cargo adicional';
      const amount = parseFloat(extraChargeAmount);

      // Create the charge
      const { error: chargeError } = await supabase
        .from('client_charges')
        .insert({
          client_id: clientId,
          description,
          amount,
          status: 'pending',
          created_by: user?.id,
          charge_catalog_id: selectedChargeType || null,
        });

      if (chargeError) throw chargeError;

      // Update client balance
      const newBalance = (billing?.balance || 0) + amount;
      const { error: balanceError } = await supabase
        .from('client_billing')
        .update({ balance: newBalance })
        .eq('client_id', clientId);

      if (balanceError) throw balanceError;

      toast.success('Cargo agregado correctamente');
      setSelectedChargeType('');
      setExtraChargeAmount('');
      setExtraChargeDescription('');
      refetchCharges();
      refetchBilling();
    } catch (error: any) {
      console.error('Error adding charge:', error);
      toast.error('Error al agregar el cargo');
    } finally {
      setIsAddingExtraCharge(false);
    }
  };

  const handleSelectChargeType = (chargeId: string) => {
    setSelectedChargeType(chargeId);
    const catalog = chargeCatalog.find((c: any) => c.id === chargeId);
    if (catalog) {
      setExtraChargeAmount(catalog.default_amount.toString());
      setExtraChargeDescription(catalog.name);
    }
  };

  // Handle edit charge
  const handleEditCharge = (charge: any) => {
    setEditingCharge(charge);
    setShowEditChargeDialog(true);
  };

  // Handle delete charge
  const handleDeleteCharge = async () => {
    if (!chargeToDelete || !clientId) return;

    setIsDeletingCharge(true);
    try {
      // If the charge was pending, reduce the balance
      if (chargeToDelete.status === 'pending') {
        const { data: billing } = await supabase
          .from('client_billing')
          .select('balance')
          .eq('client_id', clientId)
          .maybeSingle();

        if (billing) {
          const newBalance = (billing.balance || 0) - chargeToDelete.amount;
          await supabase
            .from('client_billing')
            .update({ balance: newBalance })
            .eq('client_id', clientId);
        }
      }

      // Record deletion in history
      await supabase.from('prospect_change_history').insert({
        client_id: clientId,
        field_name: `Cargo Eliminado: ${chargeToDelete.description}`,
        old_value: `$${chargeToDelete.amount} - ${chargeToDelete.status === 'paid' ? 'Pagado' : 'Pendiente'}`,
        new_value: null,
        changed_by: user?.id,
      });

      const { error } = await supabase
        .from('client_charges')
        .delete()
        .eq('id', chargeToDelete.id);

      if (error) throw error;

      toast.success('Cargo eliminado correctamente');
      setChargeToDelete(null);
      refetchCharges();
      refetchBilling();
    } catch (error: any) {
      console.error('Error deleting charge:', error);
      toast.error('Error al eliminar el cargo');
    } finally {
      setIsDeletingCharge(false);
    }
  };

  // Handle edit payment
  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setShowEditPaymentDialog(true);
  };

  // Handle delete payment
  const handleDeletePayment = async () => {
    if (!paymentToDelete || !clientId) return;

    setIsDeletingPayment(true);
    try {
      // Unlink charges associated with this payment
      const { data: linkedCharges } = await supabase
        .from('client_charges')
        .select('id, amount')
        .eq('payment_id', paymentToDelete.id);

      if (linkedCharges && linkedCharges.length > 0) {
        // Reset charges to pending and remove payment_id
        for (const charge of linkedCharges) {
          await supabase
            .from('client_charges')
            .update({ 
              status: 'pending', 
              payment_id: null,
              paid_date: null 
            })
            .eq('id', charge.id);
        }
      }

      // Update balance - add back the payment amount
      const { data: billing } = await supabase
        .from('client_billing')
        .select('balance')
        .eq('client_id', clientId)
        .maybeSingle();

      if (billing) {
        const newBalance = (billing.balance || 0) + paymentToDelete.amount;
        await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('client_id', clientId);
      }

      // Record deletion in history
      await supabase.from('prospect_change_history').insert({
        client_id: clientId,
        field_name: `Pago Eliminado`,
        old_value: `$${paymentToDelete.amount} - ${paymentToDelete.payment_date}`,
        new_value: null,
        changed_by: user?.id,
      });

      // Delete the payment
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentToDelete.id);

      if (error) throw error;

      toast.success('Pago eliminado correctamente');
      setPaymentToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['payments', clientId] });
      refetchCharges();
      refetchBilling();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast.error('Error al eliminar el pago');
    } finally {
      setIsDeletingPayment(false);
    }
  };

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
        phone3: c.phone3 || '',
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
        'phone3', 'phone3_country',
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
          phone3: editedClient.phone3 || null,
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

  const handleUploadDocument = async (file: File, fieldName: string) => {
    if (!clientId) return;
    
    setUploadingDoc(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/${fieldName}_${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Update client record
      const { error: updateError } = await supabase
        .from('clients')
        .update({ [fieldName]: fileName })
        .eq('id', clientId);
      
      if (updateError) throw updateError;
      
      toast.success('Documento subido correctamente');
      refetchClient();
    } catch (error: any) {
      toast.error(error.message || 'Error al subir documento');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleDocumentInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadDocument(file, fieldName);
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
        {/* Edit mode action bar - only shows when editing */}
        {isEditing && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-sm font-medium text-primary">Modo edición activo</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Save className="h-4 w-4 mr-1" />
                Guardar
              </Button>
            </div>
          </div>
        )}

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
                        <Label>Teléfono 3</Label>
                        <PhoneInput
                          value={editedClient.phone3 || ''}
                          onChange={(v) => setEditedClient({ ...editedClient, phone3: v })}
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
                  <div className="flex gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Button>
                    <Button onClick={() => setShowPaymentDialog(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Registrar Pago
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-1" />
                          Gestionar
                          <ChevronDown className="h-4 w-4 ml-1" />
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
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                    {/* Show initial billing button if not configured */}
                    {isAdmin && billing && billing.monthly_fee === 0 && billing.installation_cost === 0 && billing.prorated_amount === 0 && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => setShowInitialBillingDialog(true)}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Configurar Cargos Iniciales
                      </Button>
                    )}
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

          <Card className={`border-2 ${isUpToDate ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30' : hasDebt ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30' : ''}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Actual</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUpToDate ? 'bg-emerald-100 dark:bg-emerald-900/50' : hasDebt ? 'bg-red-100 dark:bg-red-900/50' : 'bg-muted'}`}>
                  <CreditCard className={`h-5 w-5 ${isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-muted-foreground'}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : ''}`}>
                {formatCurrency(displayBalance)}
              </p>
              <p className="text-xs flex items-center gap-1 mt-1">
                <span className={`w-2 h-2 rounded-full ${isUpToDate ? 'bg-emerald-500' : hasDebt ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                <span className={isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-emerald-600'}>
                  {isUpToDate ? 'Pagado por adelantado' : hasDebt ? 'Con adeudo' : 'Cuenta al corriente'}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${coveredUntil ? 'border-emerald-200 dark:border-emerald-800' : ''}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximo Vencimiento</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${coveredUntil ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                  <Calendar className={`h-5 w-5 ${coveredUntil ? 'text-emerald-600' : 'text-amber-600'}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">
                {format(nextDueDate, 'dd MMM yyyy', { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className={`w-2 h-2 rounded-full ${coveredUntil ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {coveredUntil 
                  ? `Cubierto hasta ${coveredUntil}` 
                  : pendingCharges.length > 0 
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
                          <MacAddressInput
                            value={editedEquipment.antenna_mac || ''}
                            onChange={(v) => setEditedEquipment({ ...editedEquipment, antenna_mac: v })}
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
                      <div className="space-y-1">
                        <Label className="text-xs">MAC</Label>
                        <MacAddressInput
                          value={editedEquipment.router_mac || ''}
                          onChange={(v) => setEditedEquipment({ ...editedEquipment, router_mac: v })}
                        />
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">IP</p>
                          <p className="font-mono">{equipment.router_ip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">MAC</p>
                          <p className="font-mono text-xs">{equipment.router_mac || '-'}</p>
                        </div>
                      </div>
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
            {/* Header with document buttons */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Estado de Cuenta</h3>
              <Button variant="outline" onClick={() => setShowAccountStatement(true)}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar Estado de Cuenta
              </Button>
            </div>

            <Tabs defaultValue="cargos" className="w-full">
              <TabsList className="bg-muted/50 p-1 h-auto">
                <TabsTrigger value="cargos" className="data-[state=active]:bg-background">
                  <Receipt className="h-4 w-4 mr-2" />
                  Todos los Cargos
                </TabsTrigger>
                <TabsTrigger value="pagos" className="data-[state=active]:bg-background">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pagos Recibidos
                </TabsTrigger>
              </TabsList>

              {/* Sub-tab: Todos los Cargos */}
              <TabsContent value="cargos" className="mt-4 space-y-4">
                {/* Filters for charges */}
                <Card>
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filtros:</span>
                      </div>
                      
                      <Select value={chargeStatusFilter} onValueChange={(v: any) => setChargeStatusFilter(v)}>
                        <SelectTrigger className="w-[130px]">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="paid">Pagados</SelectItem>
                          <SelectItem value="pending">Pendientes</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={chargeTypeFilter} onValueChange={setChargeTypeFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="mensualidad">Mensualidades</SelectItem>
                          <SelectItem value="instalacion">Instalación</SelectItem>
                          <SelectItem value="prorrateo">Prorrateo</SelectItem>
                          <SelectItem value="otro">Otros cargos</SelectItem>
                        </SelectContent>
                      </Select>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-[130px] justify-start">
                            <Calendar className="h-4 w-4 mr-2" />
                            {chargeDateFrom ? format(chargeDateFrom, 'dd/MM/yy') : 'Desde'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={chargeDateFrom}
                            onSelect={setChargeDateFrom}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-[130px] justify-start">
                            <Calendar className="h-4 w-4 mr-2" />
                            {chargeDateTo ? format(chargeDateTo, 'dd/MM/yy') : 'Hasta'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={chargeDateTo}
                            onSelect={setChargeDateTo}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      {(chargeStatusFilter !== 'all' || chargeTypeFilter !== 'all' || chargeDateFrom || chargeDateTo) && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setChargeStatusFilter('all');
                            setChargeTypeFilter('all');
                            setChargeDateFrom(undefined);
                            setChargeDateTo(undefined);
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Limpiar
                        </Button>
                      )}

                      <span className="text-sm text-muted-foreground ml-auto">
                        Mostrando {filteredCharges.length} de {charges.length}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Initial costs summary */}
                {billing && (billing.installation_cost > 0 || billing.prorated_amount > 0 || (billing.additional_charges || 0) > 0) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Costos Iniciales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground uppercase">Instalación</p>
                          <p className="text-xl font-bold">{formatCurrency(billing.installation_cost || 0)}</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground uppercase">Prorrateo</p>
                          <p className="text-xl font-bold">{formatCurrency(billing.prorated_amount || 0)}</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground uppercase">Cargos Adicionales</p>
                          <p className="text-xl font-bold">{formatCurrency(billing.additional_charges || 0)}</p>
                          {billing.additional_charges_notes && (
                            <p className="text-xs text-muted-foreground mt-1">{billing.additional_charges_notes}</p>
                          )}
                        </div>
                        <div className="bg-primary/10 p-4 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground uppercase">Total Inicial</p>
                          <p className="text-xl font-bold text-primary">
                            {formatCurrency((billing.installation_cost || 0) + (billing.prorated_amount || 0) + (billing.additional_charges || 0))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Add Extra Charge Form */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Agregar Cargo Extra
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de Cargo</Label>
                        <Select value={selectedChargeType} onValueChange={handleSelectChargeType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {chargeCatalog.map((item: any) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({formatCurrency(item.default_amount)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descripción</Label>
                        <Input
                          placeholder="Descripción del cargo"
                          value={extraChargeDescription}
                          onChange={(e) => setExtraChargeDescription(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Monto</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={extraChargeAmount}
                          onChange={(e) => setExtraChargeAmount(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleAddExtraCharge} 
                        disabled={isAddingExtraCharge || !extraChargeAmount}
                      >
                        {isAddingExtraCharge ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Agregar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary of charges */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Total Cargos</p>
                      <p className="text-2xl font-bold">{filteredCharges.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Pagados</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {filteredCharges.filter((c: any) => c.status === 'paid').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Pendientes</p>
                      <p className="text-2xl font-bold text-red-600">
                        {filteredCharges.filter((c: any) => c.status === 'pending').length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* All charges table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Historial de Cargos ({filteredCharges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredCharges.length > 0 ? (
                      <div className="max-h-[500px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>FECHA</TableHead>
                              <TableHead>DESCRIPCIÓN</TableHead>
                              <TableHead>MONTO</TableHead>
                              <TableHead>ESTATUS</TableHead>
                              <TableHead>FECHA PAGO</TableHead>
                              <TableHead className="text-right">ACCIONES</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCharges.map((charge: any) => (
                              <TableRow key={charge.id}>
                                <TableCell className="text-muted-foreground">
                                  {format(new Date(charge.created_at), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell className="font-medium">{charge.description}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(charge.amount)}</TableCell>
                                <TableCell>
                                  {charge.status === 'paid' ? (
                                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-700">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Pagado
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-700">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {charge.paid_date 
                                    ? format(new Date(charge.paid_date), 'dd/MM/yyyy')
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditCharge(charge)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setChargeToDelete(charge)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No hay cargos que coincidan con los filtros
                      </p>
                    )}
                    {filteredCharges.length > 0 && (
                      <div className="flex justify-between mt-3 pt-3 border-t">
                        <span className="text-muted-foreground">
                          Total Pagado: <span className="font-bold text-emerald-600">
                            {formatCurrency(filteredCharges.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + Number(c.amount), 0))}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Total Pendiente: <span className="font-bold text-amber-600">
                            {formatCurrency(filteredCharges.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + Number(c.amount), 0))}
                          </span>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-tab: Pagos Recibidos */}
              <TabsContent value="pagos" className="mt-4 space-y-4">
                {/* Summary of payments */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Total Pagos</p>
                      <p className="text-2xl font-bold">{payments.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Total Recaudado</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase">Último Pago</p>
                      <p className="text-2xl font-bold">
                        {payments.length > 0 
                          ? format(new Date(payments[0].payment_date), 'dd/MM/yy')
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payments table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Historial de Pagos Recibidos ({payments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {payments.length > 0 ? (
                      <div className="max-h-[500px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>FECHA</TableHead>
                              <TableHead>MONTO</TableHead>
                              <TableHead>MÉTODO DE PAGO</TableHead>
                              <TableHead>BANCO</TableHead>
                              <TableHead>RECIBO</TableHead>
                              <TableHead>NOTAS</TableHead>
                              <TableHead className="text-right">ACCIONES</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell className="font-bold text-emerald-600">
                                  {formatCurrency(payment.amount)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getPaymentMethodName(payment.payment_type)}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {payment.bank_type ? getBankName(payment.bank_type) : '-'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {payment.receipt_number || '-'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                                  {payment.notes || '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleShowPaymentReceipt(payment)}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Ver Recibo
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditPayment(payment)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setPaymentToDelete(payment)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No hay pagos registrados
                      </p>
                    )}
                    {payments.length > 0 && (
                      <div className="flex justify-end mt-3 pt-3 border-t">
                        <span className="font-bold text-emerald-600 text-lg">
                          Total: {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                  {/* INE Suscriptor */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">INE Suscriptor</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Frente:</span>
                        {client.ine_subscriber_front ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.ine_subscriber_front)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'ine_subscriber_front')}
                            disabled={uploadingDoc === 'ine_subscriber_front'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'ine_subscriber_front'}>
                            <span>
                              {uploadingDoc === 'ine_subscriber_front' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Reverso:</span>
                        {client.ine_subscriber_back ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.ine_subscriber_back)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'ine_subscriber_back')}
                            disabled={uploadingDoc === 'ine_subscriber_back'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'ine_subscriber_back'}>
                            <span>
                              {uploadingDoc === 'ine_subscriber_back' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* INE Adicional */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">INE Adicional</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Frente:</span>
                        {client.ine_other_front ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.ine_other_front)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'ine_other_front')}
                            disabled={uploadingDoc === 'ine_other_front'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'ine_other_front'}>
                            <span>
                              {uploadingDoc === 'ine_other_front' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Reverso:</span>
                        {client.ine_other_back ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.ine_other_back)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'ine_other_back')}
                            disabled={uploadingDoc === 'ine_other_back'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'ine_other_back'}>
                            <span>
                              {uploadingDoc === 'ine_other_back' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Contrato Firmado */}
                  <div className="space-y-3 col-span-2">
                    <h4 className="font-semibold">Contrato Firmado</h4>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Pág 1:</span>
                        {client.contract_page1 ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.contract_page1)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'contract_page1')}
                            disabled={uploadingDoc === 'contract_page1'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'contract_page1'}>
                            <span>
                              {uploadingDoc === 'contract_page1' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Pág 2:</span>
                        {client.contract_page2 ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadDocument(client.contract_page2)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleDocumentInputChange(e, 'contract_page2')}
                            disabled={uploadingDoc === 'contract_page2'}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'contract_page2'}>
                            <span>
                              {uploadingDoc === 'contract_page2' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
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

            {/* Historial de Cambios del Cliente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historial de Cambios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChangeHistoryPanel clientId={clientId} maxHeight="500px" />
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
          effectiveCreditBalance={effectiveCreditBalance}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client_billing', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client_charges', clientId] });
            refetchBilling();
            refetchCharges();
          }}
        />

        <InitialBillingDialog
          client={client}
          billing={billing}
          open={showInitialBillingDialog}
          onOpenChange={setShowInitialBillingDialog}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['client_billing', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client_charges', clientId] });
            refetchBilling();
            refetchCharges();
          }}
        />

        {/* Account Statement Document */}
        {billing && (
          <PrintableDocument
            open={showAccountStatement}
            onOpenChange={setShowAccountStatement}
            title="Estado de Cuenta"
          >
            <AccountStatementDocument
              client={client}
              billing={billing}
              charges={charges}
              payments={payments}
              paymentMethods={paymentMethods}
            />
          </PrintableDocument>
        )}

        {/* Payment Receipt Document */}
        {selectedPaymentForReceipt && (
          <PrintableDocument
            open={showPaymentReceipt}
            onOpenChange={(open) => {
              setShowPaymentReceipt(open);
              if (!open) setSelectedPaymentForReceipt(null);
            }}
            title="Comprobante de Pago"
          >
            <PaymentReceiptDocument
              payment={selectedPaymentForReceipt}
              client={client}
              paymentMethodName={getPaymentMethodName(selectedPaymentForReceipt.payment_type)}
              bankName={selectedPaymentForReceipt.bank_type ? getBankName(selectedPaymentForReceipt.bank_type) : undefined}
            />
          </PrintableDocument>
        )}

        {/* Edit Charge Dialog */}
        <EditChargeDialog
          charge={editingCharge}
          open={showEditChargeDialog}
          onOpenChange={(open) => {
            setShowEditChargeDialog(open);
            if (!open) setEditingCharge(null);
          }}
          onSuccess={() => {
            refetchCharges();
            refetchBilling();
          }}
        />

        {/* Delete Charge Confirmation */}
        <AlertDialog open={!!chargeToDelete} onOpenChange={(open) => !open && setChargeToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cargo?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de eliminar el cargo "{chargeToDelete?.description}" por {chargeToDelete && formatCurrency(chargeToDelete.amount)}? 
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingCharge}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCharge}
                disabled={isDeletingCharge}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingCharge && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Payment Dialog */}
        <EditPaymentDialog
          payment={editingPayment}
          open={showEditPaymentDialog}
          onOpenChange={(open) => {
            setShowEditPaymentDialog(open);
            if (!open) setEditingPayment(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments', clientId] });
            refetchCharges();
            refetchBilling();
          }}
        />

        {/* Delete Payment Confirmation */}
        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de eliminar el pago de {paymentToDelete && formatCurrency(paymentToDelete.amount)} del {paymentToDelete && format(new Date(paymentToDelete.payment_date), 'dd/MM/yyyy')}? 
                Los cargos asociados volverán a estado pendiente. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingPayment}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePayment}
                disabled={isDeletingPayment}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
