import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, eachMonthOfInterval, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Calendar, Search, AlertTriangle, CheckCircle2, Clock, 
  DollarSign, Users, Filter, TrendingUp, AlertCircle,
  Loader2, RefreshCw, FileWarning
} from 'lucide-react';
import { formatCurrency } from '@/lib/billing';

interface ClientMensualidad {
  clientId: string;
  clientName: string;
  phone: string;
  neighborhood: string;
  billingDay: number;
  monthlyFee: number;
  month: number;
  year: number;
  monthName: string;
  dueDate: Date;
  daysUntilDue: number;
  totalPaid: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  chargeId?: string;
  hasCharge: boolean;
}

export default function Mensualidades() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('current');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<string>('all');
  const [chargeFilter, setChargeFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch active clients with billing
  const { data: clients = [], isLoading: loadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['clients-billing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          first_name,
          last_name_paterno,
          last_name_materno,
          phone1,
          neighborhood,
          status,
          client_billing (
            id,
            billing_day,
            monthly_fee,
            installation_date,
            balance
          )
        `)
        .eq('status', 'active')
        .order('last_name_paterno');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['all-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch charges
  const { data: charges = [], isLoading: loadingCharges, refetch: refetchCharges } = useQuery({
    queryKey: ['all-mensualidad-charges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_charges')
        .select('*')
        .ilike('description', '%mensualidad%');
      
      if (error) throw error;
      return data;
    },
  });

  // Get unique neighborhoods
  const neighborhoods = useMemo(() => {
    const unique = new Set(clients.map(c => c.neighborhood).filter(Boolean));
    return Array.from(unique).sort();
  }, [clients]);

  // Generate mensualidades for all clients
  const mensualidades = useMemo(() => {
    const result: ClientMensualidad[] = [];
    const today = new Date();

    clients.forEach(client => {
      const billing = client.client_billing as any;
      if (!billing?.installation_date) return;

      const startDate = startOfMonth(new Date(billing.installation_date));
      const endDate = startOfMonth(new Date());
      const months = eachMonthOfInterval({ start: startDate, end: endDate });

      months.forEach(date => {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const billingDay = billing.billing_day || 10;
        
        // Calculate due date
        const dueDate = new Date(year, month - 1, billingDay);
        const daysUntilDue = differenceInDays(dueDate, today);
        
        // Get payments for this period
        const periodPayments = payments.filter(p => 
          p.client_id === client.id && 
          p.period_month === month && 
          p.period_year === year
        );
        const totalPaid = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        // Calculate balance
        const monthlyFee = billing.monthly_fee || 0;
        const balance = monthlyFee - totalPaid;
        
        // Find charge - look for exact match first, then partial
        const charge = charges.find((c: any) => 
          c.client_id === client.id && 
          (c.description === `Mensualidad ${month}/${year}` || 
           c.description?.includes(`${month}/${year}`))
        );
        
        const hasCharge = !!charge;
        
        // Determine status
        let status: 'paid' | 'partial' | 'pending' | 'overdue';
        if (totalPaid >= monthlyFee) {
          status = 'paid';
        } else if (totalPaid > 0) {
          status = 'partial';
        } else if (daysUntilDue < 0) {
          status = 'overdue';
        } else {
          status = 'pending';
        }

        result.push({
          clientId: client.id,
          clientName: `${client.first_name} ${client.last_name_paterno} ${client.last_name_materno || ''}`.trim(),
          phone: client.phone1,
          neighborhood: client.neighborhood,
          billingDay,
          monthlyFee,
          month,
          year,
          monthName: format(date, 'MMMM yyyy', { locale: es }),
          dueDate,
          daysUntilDue,
          totalPaid,
          balance,
          status,
          chargeId: charge?.id,
          hasCharge,
        });
      });
    });

    return result;
  }, [clients, payments, charges]);
  
  // Generate charges for all clients missing them
  const handleGenerateAllCharges = async () => {
    setIsGenerating(true);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Find mensualidades without charges for current month
      const missingCharges = mensualidades.filter(m => 
        m.month === currentMonth && 
        m.year === currentYear && 
        !m.hasCharge &&
        m.status !== 'paid'
      );
      
      if (missingCharges.length === 0) {
        toast.info('Todos los cargos del mes actual ya están generados');
        setIsGenerating(false);
        return;
      }
      
      const newCharges = missingCharges.map(m => ({
        client_id: m.clientId,
        description: `Mensualidad ${m.month}/${m.year}`,
        amount: m.monthlyFee,
        status: 'pending',
        created_by: user?.id,
      }));
      
      // Insert charges
      const { error: chargeError } = await supabase
        .from('client_charges')
        .insert(newCharges);
      
      if (chargeError) throw chargeError;
      
      // Update balances for each client
      for (const m of missingCharges) {
        const client = clients.find(c => c.id === m.clientId);
        const billing = client?.client_billing as any;
        if (billing?.id) {
          const newBalance = (billing.balance || 0) + m.monthlyFee;
          await supabase
            .from('client_billing')
            .update({ balance: newBalance })
            .eq('id', billing.id);
        }
      }
      
      toast.success(`${newCharges.length} cargos generados correctamente`);
      refetchCharges();
      refetchClients();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al generar cargos');
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply filters
  const filteredMensualidades = useMemo(() => {
    return mensualidades.filter(m => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!m.clientName.toLowerCase().includes(search) && 
            !m.phone.includes(search) &&
            !m.neighborhood.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false;
      }

      // Month filter
      if (monthFilter === 'current') {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        if (m.month !== currentMonth || m.year !== currentYear) {
          return false;
        }
      } else if (monthFilter !== 'all') {
        if (m.month !== parseInt(monthFilter)) {
          return false;
        }
      }

      // Year filter
      if (yearFilter !== 'all' && m.year !== parseInt(yearFilter)) {
        return false;
      }

      // Neighborhood filter
      if (neighborhoodFilter !== 'all' && m.neighborhood !== neighborhoodFilter) {
        return false;
      }

      // Days filter
      if (daysFilter !== 'all') {
        if (daysFilter === 'overdue' && m.daysUntilDue >= 0) return false;
        if (daysFilter === '0-5' && (m.daysUntilDue < 0 || m.daysUntilDue > 5)) return false;
        if (daysFilter === '6-15' && (m.daysUntilDue < 6 || m.daysUntilDue > 15)) return false;
        if (daysFilter === '16+' && m.daysUntilDue < 16) return false;
      }
      
      // Charge filter
      if (chargeFilter === 'with' && !m.hasCharge) return false;
      if (chargeFilter === 'without' && m.hasCharge) return false;

      return true;
    });
  }, [mensualidades, searchTerm, statusFilter, monthFilter, yearFilter, neighborhoodFilter, daysFilter, chargeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentMensualidades = mensualidades.filter(m => m.month === currentMonth && m.year === currentYear);
    
    const paid = currentMensualidades.filter(m => m.status === 'paid');
    const partial = currentMensualidades.filter(m => m.status === 'partial');
    const pending = currentMensualidades.filter(m => m.status === 'pending');
    const overdue = currentMensualidades.filter(m => m.status === 'overdue');
    
    const totalExpected = currentMensualidades.reduce((sum, m) => sum + m.monthlyFee, 0);
    const totalCollected = currentMensualidades.reduce((sum, m) => sum + m.totalPaid, 0);
    const totalPending = currentMensualidades.reduce((sum, m) => sum + Math.max(0, m.balance), 0);
    
    return {
      total: currentMensualidades.length,
      paid: paid.length,
      partial: partial.length,
      pending: pending.length,
      overdue: overdue.length,
      totalExpected,
      totalCollected,
      totalPending,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    };
  }, [mensualidades]);

  const getStatusBadge = (status: string, daysUntilDue: number) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Pagado
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Parcial
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Vencido ({Math.abs(daysUntilDue)}d)
          </Badge>
        );
      default:
        if (daysUntilDue <= 5) {
          return (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Por vencer ({daysUntilDue}d)
            </Badge>
          );
        }
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente ({daysUntilDue}d)
          </Badge>
        );
    }
  };

  const getDaysColor = (daysUntilDue: number, status: string) => {
    if (status === 'paid') return 'text-emerald-600';
    if (daysUntilDue < 0) return 'text-red-600 font-bold';
    if (daysUntilDue <= 5) return 'text-orange-600 font-semibold';
    if (daysUntilDue <= 15) return 'text-amber-600';
    return 'text-blue-600';
  };

  const isLoading = loadingClients || loadingPayments || loadingCharges;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mensualidades</h1>
            <p className="text-muted-foreground">
              Control de cobro mensual de todos los clientes
            </p>
          </div>
          <Button 
            onClick={handleGenerateAllCharges} 
            disabled={isGenerating}
            className="bg-primary"
          >
            {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <RefreshCw className="h-4 w-4 mr-2" />
            Generar Cargos del Mes
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Este Mes</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">clientes</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-emerald-600 uppercase">Pagados</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
              <p className="text-xs text-emerald-600/70">{((stats.paid / stats.total) * 100 || 0).toFixed(0)}%</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-amber-600 uppercase">Parciales</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.partial}</p>
              <p className="text-xs text-amber-600/70">{((stats.partial / stats.total) * 100 || 0).toFixed(0)}%</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-600 uppercase">Pendientes</span>
                <AlertCircle className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
              <p className="text-xs text-blue-600/70">{((stats.pending / stats.total) * 100 || 0).toFixed(0)}%</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-red-600 uppercase">Vencidos</span>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              <p className="text-xs text-red-600/70">{((stats.overdue / stats.total) * 100 || 0).toFixed(0)}%</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-primary uppercase">Cobranza</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary">{stats.collectionRate.toFixed(0)}%</p>
              <p className="text-xs text-primary/70">{formatCurrency(stats.totalCollected)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Esperado este mes</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalExpected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cobrado este mes</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalCollected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendiente de cobro</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="relative col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                  <SelectItem value="partial">Parciales</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Mes actual</SelectItem>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {format(new Date(2024, i, 1), 'MMMM', { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Array.from({ length: 3 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={neighborhoodFilter} onValueChange={setNeighborhoodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Colonia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las colonias</SelectItem>
                  {neighborhoods.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Días" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="0-5">0-5 días</SelectItem>
                  <SelectItem value="6-15">6-15 días</SelectItem>
                  <SelectItem value="16+">16+ días</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={chargeFilter} onValueChange={setChargeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with">Con cargo</SelectItem>
                  <SelectItem value="without">Sin cargo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Mostrando {filteredMensualidades.length} de {mensualidades.length} registros
                {mensualidades.filter(m => !m.hasCharge && m.month === new Date().getMonth() + 1 && m.year === new Date().getFullYear()).length > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">
                    ({mensualidades.filter(m => !m.hasCharge && m.month === new Date().getMonth() + 1 && m.year === new Date().getFullYear()).length} sin cargo este mes)
                  </span>
                )}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setMonthFilter('current');
                  setYearFilter(new Date().getFullYear().toString());
                  setNeighborhoodFilter('all');
                  setDaysFilter('all');
                  setChargeFilter('all');
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CLIENTE</TableHead>
                    <TableHead>COLONIA</TableHead>
                    <TableHead>PERÍODO</TableHead>
                    <TableHead>VENCIMIENTO</TableHead>
                    <TableHead className="text-center">DÍAS</TableHead>
                    <TableHead className="text-right">MENSUALIDAD</TableHead>
                    <TableHead className="text-right">PAGADO</TableHead>
                    <TableHead className="text-right">PENDIENTE</TableHead>
                    <TableHead>CARGO</TableHead>
                    <TableHead>ESTADO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMensualidades.length > 0 ? (
                    filteredMensualidades.map((m, idx) => (
                      <TableRow 
                        key={`${m.clientId}-${m.month}-${m.year}`}
                        className={
                          m.status === 'overdue' ? 'bg-red-50/50' :
                          m.status === 'paid' ? 'bg-emerald-50/30' :
                          m.daysUntilDue <= 5 ? 'bg-orange-50/50' :
                          !m.hasCharge ? 'bg-purple-50/50' :
                          ''
                        }
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{m.clientName}</p>
                            <p className="text-xs text-muted-foreground">{m.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{m.neighborhood}</TableCell>
                        <TableCell className="capitalize">{m.monthName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(m.dueDate, 'dd/MM/yyyy')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getDaysColor(m.daysUntilDue, m.status)}>
                            {m.status === 'paid' ? '-' : m.daysUntilDue < 0 ? `${m.daysUntilDue}` : `+${m.daysUntilDue}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(m.monthlyFee)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {m.totalPaid > 0 ? formatCurrency(m.totalPaid) : '-'}
                        </TableCell>
                        <TableCell className={`text-right ${m.balance > 0 ? 'text-red-600 font-medium' : ''}`}>
                          {m.balance > 0 ? formatCurrency(m.balance) : '-'}
                        </TableCell>
                        <TableCell>
                          {m.hasCharge ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Sí
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                              <FileWarning className="h-3 w-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(m.status, m.daysUntilDue)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        No se encontraron mensualidades con los filtros aplicados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
