import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchInput } from '@/components/shared/SearchInput';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Wrench,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Loader2,
  DollarSign,
  LayoutGrid,
  TableIcon,
  CalendarDays
} from 'lucide-react';
import { ServicesCalendar } from '@/components/services/ServicesCalendar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/billing';

const SERVICE_TYPES = {
  installation: { label: 'Instalación', color: 'bg-blue-500' },
  maintenance: { label: 'Mantenimiento', color: 'bg-yellow-500' },
  equipment_change: { label: 'Cambio de Equipo', color: 'bg-purple-500' },
  relocation: { label: 'Reubicación', color: 'bg-orange-500' },
  repair: { label: 'Reparación', color: 'bg-red-500' },
  disconnection: { label: 'Desconexión', color: 'bg-gray-500' },
  other: { label: 'Otro', color: 'bg-slate-500' },
};

const SERVICE_STATUS = {
  scheduled: { label: 'Programado', color: 'bg-blue-500', icon: Calendar },
  in_progress: { label: 'En Visita', color: 'bg-yellow-500', icon: PlayCircle },
  completed: { label: 'Completado', color: 'bg-green-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

type ServiceType = keyof typeof SERVICE_TYPES;
type ServiceStatus = keyof typeof SERVICE_STATUS;
type ViewMode = 'kanban' | 'table' | 'calendar';

interface ScheduledService {
  id: string;
  client_id: string | null;
  prospect_id: string | null;
  assigned_to: string;
  service_type: ServiceType;
  status: ServiceStatus;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  charge_amount: number | null;
  completed_at: string | null;
  completed_notes: string | null;
  created_at: string;
  clients?: { id: string; first_name: string; last_name_paterno: string; street: string; exterior_number: string; neighborhood: string } | null;
  prospects?: { id: string; first_name: string; last_name_paterno: string; street: string; exterior_number: string; neighborhood: string } | null;
  employee_name?: string;
}

export default function Services() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ServiceStatus | 'all'>('scheduled');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ScheduledService | null>(null);
  const [completedNotes, setCompletedNotes] = useState('');
  
  // New state for search, filters, and view mode
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterTechnician, setFilterTechnician] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    client_id: '',
    prospect_id: '',
    assigned_to: '',
    service_type: 'other' as ServiceType,
    title: '',
    description: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    estimated_duration: 60,
    charge_amount: '',
  });

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['scheduled-services', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_services')
        .select(`
          *,
          clients(id, first_name, last_name_paterno, street, exterior_number, neighborhood),
          prospects(id, first_name, last_name_paterno, street, exterior_number, neighborhood)
        `)
        .order('scheduled_date', { ascending: true });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch employee names separately
      const assignedIds = [...new Set(data?.map(s => s.assigned_to).filter(Boolean) || [])];
      let employeeMap: Record<string, string> = {};
      
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', assignedIds);
        
        profiles?.forEach(p => {
          employeeMap[p.user_id] = p.full_name;
        });
      }
      
      return (data || []).map(service => ({
        ...service,
        employee_name: employeeMap[service.assigned_to] || 'Sin asignar'
      })) as unknown as ScheduledService[];
    },
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name_paterno')
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch prospects for dropdown
  const { data: prospects = [] } = useQuery({
    queryKey: ['prospects-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospects')
        .select('id, first_name, last_name_paterno')
        .eq('status', 'pending')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch employees for assignment
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

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const personName = getPersonName(service).toLowerCase();
        const address = getAddress(service).toLowerCase();
        const title = service.title.toLowerCase();
        const employeeName = (service.employee_name || '').toLowerCase();
        
        if (!personName.includes(query) && 
            !address.includes(query) && 
            !title.includes(query) &&
            !employeeName.includes(query)) {
          return false;
        }
      }
      
      // Date from filter
      if (filterDateFrom && service.scheduled_date < filterDateFrom) {
        return false;
      }
      
      // Date to filter
      if (filterDateTo && service.scheduled_date > filterDateTo) {
        return false;
      }
      
      // Client filter
      if (filterClient !== 'all') {
        const clientId = service.client_id || service.prospect_id;
        if (clientId !== filterClient) {
          return false;
        }
      }
      
      // Technician filter
      if (filterTechnician !== 'all' && service.assigned_to !== filterTechnician) {
        return false;
      }
      
      // Status filter (additional to tab)
      if (filterStatus !== 'all' && service.status !== filterStatus) {
        return false;
      }
      
      return true;
    });
  }, [services, searchQuery, filterDateFrom, filterDateTo, filterClient, filterTechnician, filterStatus]);

  // Get unique clients/prospects from services for filter dropdown
  const serviceClientsProspects = useMemo(() => {
    const items: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    
    services.forEach(s => {
      if (s.clients && !seen.has(s.clients.id)) {
        seen.add(s.clients.id);
        items.push({ id: s.clients.id, name: `${s.clients.first_name} ${s.clients.last_name_paterno}` });
      }
      if (s.prospects && !seen.has(s.prospects.id)) {
        seen.add(s.prospects.id);
        items.push({ id: s.prospects.id, name: `${s.prospects.first_name} ${s.prospects.last_name_paterno} (P)` });
      }
    });
    
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  // Create service mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData = {
        client_id: data.client_id && data.client_id !== '' ? data.client_id : null,
        prospect_id: data.prospect_id && data.prospect_id !== '' ? data.prospect_id : null,
        assigned_to: data.assigned_to,
        service_type: data.service_type,
        title: data.title,
        description: data.description || null,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time || null,
        estimated_duration: data.estimated_duration,
        charge_amount: data.charge_amount ? parseFloat(data.charge_amount) : null,
        created_by: user?.id,
      };
      
      const { data: result, error } = await supabase
        .from('scheduled_services')
        .insert(insertData)
        .select();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-services'] });
      toast.success('Servicio agendado correctamente');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Error al agendar servicio: ' + error.message);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ServiceStatus; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_notes = notes || null;
      }
      const { error } = await supabase
        .from('scheduled_services')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-services'] });
      toast.success('Estado actualizado');
      setCompleteDialogOpen(false);
      setSelectedService(null);
      setCompletedNotes('');
    },
    onError: (error) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      prospect_id: '',
      assigned_to: '',
      service_type: 'other',
      title: '',
      description: '',
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '09:00',
      estimated_duration: 60,
      charge_amount: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id && !formData.prospect_id) {
      toast.error('Debes seleccionar un cliente o prospecto');
      return;
    }
    if (!formData.assigned_to) {
      toast.error('Debes asignar a un empleado');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleStartService = (service: ScheduledService) => {
    updateStatusMutation.mutate({ id: service.id, status: 'in_progress' });
  };

  const handleCompleteService = (service: ScheduledService) => {
    setSelectedService(service);
    setCompleteDialogOpen(true);
  };

  const handleCancelService = (service: ScheduledService) => {
    updateStatusMutation.mutate({ id: service.id, status: 'cancelled' });
  };

  const confirmComplete = () => {
    if (selectedService) {
      updateStatusMutation.mutate({ 
        id: selectedService.id, 
        status: 'completed',
        notes: completedNotes 
      });
    }
  };

  const getPersonName = (service: ScheduledService) => {
    if (service.clients) {
      return `${service.clients.first_name} ${service.clients.last_name_paterno}`;
    }
    if (service.prospects) {
      return `${service.prospects.first_name} ${service.prospects.last_name_paterno} (Prospecto)`;
    }
    return 'Sin asignar';
  };

  const getAddress = (service: ScheduledService) => {
    const person = service.clients || service.prospects;
    if (person) {
      return `${person.street} #${person.exterior_number}, ${person.neighborhood}`;
    }
    return '';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterClient('all');
    setFilterTechnician('all');
    setFilterStatus('all');
  };

  const hasActiveFilters = searchQuery || filterDateFrom || filterDateTo || filterTechnician !== 'all' || filterClient !== 'all' || filterStatus !== 'all';

  // Render service card (for kanban view)
  const renderServiceCard = (service: ScheduledService) => {
    const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
    const statusInfo = SERVICE_STATUS[service.status];
    const StatusIcon = statusInfo.icon;

    return (
      <Card key={service.id} className="overflow-hidden">
        <div className={`h-1 ${typeInfo.color}`} />
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{service.title}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {typeInfo.label}
              </Badge>
            </div>
            <Badge className={`${statusInfo.color} text-white`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{getPersonName(service)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{getAddress(service)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(new Date(service.scheduled_date), "dd 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
          {service.scheduled_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{service.scheduled_time.slice(0, 5)} hrs</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span>Asignado a: {service.employee_name || 'Sin asignar'}</span>
          </div>
          {service.charge_amount && service.charge_amount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>Cargo: {formatCurrency(service.charge_amount)}</span>
            </div>
          )}
          {service.description && (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              {service.description}
            </p>
          )}

          {/* Actions */}
          {service.status === 'scheduled' && (
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => handleStartService(service)}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Iniciar
              </Button>
              {isAdmin && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleCancelService(service)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {service.status === 'in_progress' && (
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleCompleteService(service)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Completar
              </Button>
            </div>
          )}
          {service.status === 'completed' && service.completed_notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Notas de cierre:</p>
              <p className="text-sm">{service.completed_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render table view
  const renderTableView = () => {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente/Prospecto</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay servicios que coincidan con los filtros
                </TableCell>
              </TableRow>
            ) : (
              filteredServices.map((service) => {
                const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                const statusInfo = SERVICE_STATUS[service.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getPersonName(service)}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {getAddress(service)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{service.employee_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(service.scheduled_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {service.scheduled_time ? service.scheduled_time.slice(0, 5) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusInfo.color} text-white whitespace-nowrap`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {service.status === 'scheduled' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleStartService(service)}
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleCancelService(service)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {service.status === 'in_progress' && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleCompleteService(service)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AppLayout title="Agenda de Servicios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              Gestiona los servicios programados para clientes y prospectos
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Servicio
            </Button>
          )}
        </div>

        {/* Search and Filters Panel */}
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Buscar por título, cliente, dirección, técnico..."
                />
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('calendar')}
                  className="rounded-r-none"
                  title="Vista Calendario"
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('kanban')}
                  title="Vista Tarjetas"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('table')}
                  className="rounded-l-none"
                  title="Vista Tabla"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Fecha Desde</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cliente/Prospecto</Label>
                  <SearchableSelect
                    value={filterClient}
                    onChange={setFilterClient}
                    options={[
                      { value: 'all', label: 'Todos' },
                      ...serviceClientsProspects.map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                    placeholder="Todos"
                    searchPlaceholder="Buscar cliente..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Técnico Asignado</Label>
                  <SearchableSelect
                    value={filterTechnician}
                    onChange={setFilterTechnician}
                    options={[
                      { value: 'all', label: 'Todos' },
                      ...employees.map((e) => ({
                        value: e.user_id,
                        label: e.full_name,
                      })),
                    ]}
                    placeholder="Todos"
                    searchPlaceholder="Buscar técnico..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(SERVICE_STATUS).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <div className="flex items-end lg:col-span-5">
                    <Button variant="ghost" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Object.entries(SERVICE_STATUS).map(([key, value]) => {
            const count = services.filter(s => s.status === key).length;
            const Icon = value.icon;
            return (
              <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab(key as ServiceStatus)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${value.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{value.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ServiceStatus | 'all')}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="scheduled">Programados</TabsTrigger>
            <TabsTrigger value="in_progress">En Visita</TabsTrigger>
            <TabsTrigger value="completed">Completados</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredServices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {hasActiveFilters 
                      ? 'No hay servicios que coincidan con los filtros'
                      : 'No hay servicios en esta categoría'
                    }
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Limpiar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : viewMode === 'calendar' ? (
              <ServicesCalendar services={filteredServices} />
            ) : viewMode === 'kanban' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map(renderServiceCard)}
              </div>
            ) : (
              renderTableView()
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Nuevo Servicio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Servicio</Label>
              <Select 
                value={formData.service_type} 
                onValueChange={(v) => setFormData({ ...formData, service_type: v as ServiceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Instalación de servicio"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select 
                  value={formData.client_id || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, client_id: v === 'none' ? '' : v, prospect_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name_paterno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prospecto</Label>
                <Select 
                  value={formData.prospect_id || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, prospect_id: v === 'none' ? '' : v, client_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prospecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {prospects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name_paterno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select 
                value={formData.assigned_to} 
                onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duración (minutos)</Label>
                <Input
                  type="number"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo ($)</Label>
                <Input
                  type="number"
                  value={formData.charge_amount}
                  onChange={(e) => setFormData({ ...formData, charge_amount: e.target.value })}
                  placeholder="0 si no aplica"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales del servicio..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Agendar Servicio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Service Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Confirmas que el servicio "{selectedService?.title}" ha sido completado?
            </p>
            <div className="space-y-2">
              <Label>Notas de cierre (opcional)</Label>
              <Textarea
                value={completedNotes}
                onChange={(e) => setCompletedNotes(e.target.value)}
                placeholder="Observaciones del servicio realizado..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={confirmComplete}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
