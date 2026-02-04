import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Wrench,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Loader2,
  Phone,
  FileText,
  ChevronRight,
  Home,
  Users,
  ClipboardList,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/billing';

const SERVICE_TYPES = {
  installation: { label: 'Instalación', color: 'bg-blue-500', textColor: 'text-blue-500' },
  maintenance: { label: 'Mantenimiento', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  equipment_change: { label: 'Cambio de Equipo', color: 'bg-purple-500', textColor: 'text-purple-500' },
  relocation: { label: 'Reubicación', color: 'bg-orange-500', textColor: 'text-orange-500' },
  repair: { label: 'Reparación', color: 'bg-red-500', textColor: 'text-red-500' },
  disconnection: { label: 'Desconexión', color: 'bg-gray-500', textColor: 'text-gray-500' },
  other: { label: 'Otro', color: 'bg-slate-500', textColor: 'text-slate-500' },
};

const SERVICE_STATUS = {
  scheduled: { label: 'Programado', color: 'bg-blue-500', icon: Calendar },
  in_progress: { label: 'En Visita', color: 'bg-yellow-500', icon: PlayCircle },
  completed: { label: 'Completado', color: 'bg-green-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

const COMPLETION_REASONS = [
  { value: 'completed', label: 'Servicio completado correctamente' },
  { value: 'no_one_home', label: 'No había nadie en el domicilio' },
  { value: 'rescheduled', label: 'Cliente solicitó reprogramar' },
  { value: 'other', label: 'Otro motivo' },
];

type ServiceType = keyof typeof SERVICE_TYPES;
type ServiceStatus = keyof typeof SERVICE_STATUS;

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
  clients?: { 
    first_name: string; 
    last_name_paterno: string; 
    street: string; 
    exterior_number: string; 
    neighborhood: string;
    phone1: string;
    city: string;
  } | null;
  prospects?: { 
    first_name: string; 
    last_name_paterno: string; 
    street: string; 
    exterior_number: string; 
    neighborhood: string;
    phone1: string;
    city: string;
  } | null;
}

interface Prospect {
  id: string;
  first_name: string;
  last_name_paterno: string;
  last_name_materno: string | null;
  phone1: string;
  phone2: string | null;
  street: string;
  exterior_number: string;
  interior_number: string | null;
  neighborhood: string;
  city: string;
  request_date: string;
  notes: string | null;
  status: string;
  created_by: string | null;
}

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'services' | 'prospects' | 'history'>('services');
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ScheduledService | null>(null);
  const [completedNotes, setCompletedNotes] = useState('');
  const [completionReason, setCompletionReason] = useState('completed');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailService, setDetailService] = useState<ScheduledService | null>(null);
  const [prospectDetailOpen, setProspectDetailOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [startingService, setStartingService] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Fetch my assigned services
  const { data: myServices = [], isLoading: loadingServices } = useQuery({
    queryKey: ['my-services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('scheduled_services')
        .select(`
          *,
          clients(first_name, last_name_paterno, street, exterior_number, neighborhood, phone1, city),
          prospects(first_name, last_name_paterno, street, exterior_number, neighborhood, phone1, city)
        `)
        .eq('assigned_to', user.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      return data as unknown as ScheduledService[];
    },
    enabled: !!user?.id,
  });

  // Fetch my prospects (created by me)
  const { data: myProspects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['my-prospects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('created_by', user.id)
        .eq('status', 'pending')
        .order('request_date', { ascending: false });

      if (error) throw error;
      return data as Prospect[];
    },
    enabled: !!user?.id,
  });

  // Fetch my completed services (history)
  const { data: myHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['my-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('scheduled_services')
        .select(`
          *,
          clients(first_name, last_name_paterno, street, exterior_number, neighborhood, phone1, city),
          prospects(first_name, last_name_paterno, street, exterior_number, neighborhood, phone1, city)
        `)
        .eq('assigned_to', user.id)
        .in('status', ['completed', 'cancelled'])
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ScheduledService[];
    },
    enabled: !!user?.id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes,
      visit_started_at,
      visit_latitude,
      visit_longitude
    }: { 
      id: string; 
      status: ServiceStatus; 
      notes?: string;
      visit_started_at?: string;
      visit_latitude?: number;
      visit_longitude?: number;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'in_progress' && visit_started_at) {
        updateData.visit_started_at = visit_started_at;
        updateData.visit_latitude = visit_latitude || null;
        updateData.visit_longitude = visit_longitude || null;
      }
      
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
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      queryClient.invalidateQueries({ queryKey: ['my-history'] });
      toast.success('Servicio actualizado');
      setCompleteDialogOpen(false);
      setSelectedService(null);
      setCompletedNotes('');
      setCompletionReason('completed');
      setStartingService(null);
      setGpsLoading(false);
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
      setStartingService(null);
      setGpsLoading(false);
    },
  });

  const handleStartService = async (service: ScheduledService) => {
    setStartingService(service.id);
    setGpsLoading(true);
    
    const visit_started_at = new Date().toISOString();
    let visit_latitude: number | undefined;
    let visit_longitude: number | undefined;
    
    // Try to get GPS coordinates
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        visit_latitude = position.coords.latitude;
        visit_longitude = position.coords.longitude;
        toast.success(`Ubicación capturada: ${visit_latitude.toFixed(6)}, ${visit_longitude.toFixed(6)}`);
      } catch (gpsError) {
        console.error('GPS error:', gpsError);
        toast.warning('No se pudo obtener la ubicación GPS, pero se registró la hora de inicio');
      }
    } else {
      toast.warning('GPS no disponible en este dispositivo');
    }
    
    updateStatusMutation.mutate({ 
      id: service.id, 
      status: 'in_progress',
      visit_started_at,
      visit_latitude,
      visit_longitude
    });
  };

  const handleCompleteService = (service: ScheduledService) => {
    setSelectedService(service);
    setCompleteDialogOpen(true);
  };

  const confirmComplete = () => {
    if (selectedService) {
      const reasonLabel = COMPLETION_REASONS.find(r => r.value === completionReason)?.label || '';
      const finalNotes = completionReason === 'completed' 
        ? completedNotes 
        : `[${reasonLabel}] ${completedNotes}`.trim();
      
      updateStatusMutation.mutate({ 
        id: selectedService.id, 
        status: 'completed',
        notes: finalNotes 
      });
    }
  };

  const getPersonName = (service: ScheduledService) => {
    if (service.clients) {
      return `${service.clients.first_name} ${service.clients.last_name_paterno}`;
    }
    if (service.prospects) {
      return `${service.prospects.first_name} ${service.prospects.last_name_paterno}`;
    }
    return 'Sin asignar';
  };

  const getPersonPhone = (service: ScheduledService) => {
    return service.clients?.phone1 || service.prospects?.phone1 || '';
  };

  const getAddress = (service: ScheduledService) => {
    const person = service.clients || service.prospects;
    if (person) {
      return `${person.street} #${person.exterior_number}, ${person.neighborhood}, ${person.city}`;
    }
    return '';
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    if (isPast(date)) return 'Atrasado';
    return format(date, "EEE dd MMM", { locale: es });
  };

  const getDateColor = (dateStr: string, status: ServiceStatus) => {
    if (status === 'in_progress') return 'text-yellow-600 bg-yellow-100';
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'text-red-600 bg-red-100';
    if (isToday(date)) return 'text-green-600 bg-green-100';
    if (isTomorrow(date)) return 'text-blue-600 bg-blue-100';
    return 'text-muted-foreground bg-muted';
  };

  // Group services by date
  const groupedServices = myServices.reduce((acc, service) => {
    const dateKey = service.scheduled_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(service);
    return acc;
  }, {} as Record<string, ScheduledService[]>);

  const todayServices = myServices.filter(s => isToday(parseISO(s.scheduled_date)));
  const inProgressServices = myServices.filter(s => s.status === 'in_progress');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Mi Panel</h1>
            <p className="text-sm opacity-90">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold">{todayServices.length}</p>
              <p className="text-xs opacity-90">servicios hoy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-3 text-center">
            <PlayCircle className="h-5 w-5 mx-auto text-yellow-600" />
            <p className="text-xl font-bold text-yellow-700">{inProgressServices.length}</p>
            <p className="text-xs text-yellow-600">En Progreso</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 text-center">
            <Calendar className="h-5 w-5 mx-auto text-blue-600" />
            <p className="text-xl font-bold text-blue-700">{myServices.length}</p>
            <p className="text-xs text-blue-600">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600" />
            <p className="text-xl font-bold text-green-700">{myProspects.length}</p>
            <p className="text-xs text-green-600">Prospectos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="px-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services" className="gap-1">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="prospects" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Prospectos</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Historial</span>
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-4 pb-20">
          {loadingServices ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myServices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground">No tienes servicios pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-4">
                {Object.entries(groupedServices).map(([date, services]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getDateColor(date, 'scheduled')}>
                        {getDateLabel(date)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(date), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {services.map((service) => {
                        const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                        const isInProgress = service.status === 'in_progress';
                        
                        return (
                          <Card 
                            key={service.id} 
                            className={`overflow-hidden ${isInProgress ? 'border-yellow-400 border-2' : ''}`}
                            onClick={() => {
                              setDetailService(service);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <div className={`h-1 ${typeInfo.color}`} />
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isInProgress && (
                                      <span className="flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                                      </span>
                                    )}
                                    <p className="font-medium truncate">{service.title}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {getPersonName(service)}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    {service.scheduled_time && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {service.scheduled_time.slice(0, 5)}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-xs py-0">
                                      {typeInfo.label}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {service.status === 'scheduled' && (
                                    <Button 
                                      size="sm" 
                                      className="h-8"
                                      disabled={startingService === service.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartService(service);
                                      }}
                                    >
                                      {startingService === service.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Navigation className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  {isInProgress && (
                                    <Button 
                                      size="sm" 
                                      className="h-8 bg-green-600 hover:bg-green-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompleteService(service);
                                      }}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Prospects Tab */}
        <TabsContent value="prospects" className="mt-4 pb-20">
          {loadingProspects ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myProspects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tienes prospectos registrados</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2">
                {myProspects.map((prospect) => (
                  <Card 
                    key={prospect.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedProspect(prospect);
                      setProspectDetailOpen(true);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {prospect.first_name} {prospect.last_name_paterno}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {prospect.street} #{prospect.exterior_number}, {prospect.neighborhood}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(prospect.request_date), "dd/MM/yyyy")}
                            </span>
                            <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4 pb-20">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myHistory.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay historial de servicios</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2">
                {myHistory.map((service) => {
                  const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                  const isCompleted = service.status === 'completed';
                  
                  return (
                    <Card key={service.id} className="overflow-hidden">
                      <div className={`h-1 ${isCompleted ? 'bg-green-500' : 'bg-red-500'}`} />
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <p className="font-medium truncate">{service.title}</p>
                            </div>
                            <p className="text-sm text-muted-foreground truncate ml-6">
                              {getPersonName(service)}
                            </p>
                            <div className="flex items-center gap-2 mt-1 ml-6">
                              <span className="text-xs text-muted-foreground">
                                {service.completed_at 
                                  ? format(parseISO(service.completed_at), "dd/MM/yyyy HH:mm")
                                  : format(parseISO(service.scheduled_date), "dd/MM/yyyy")
                                }
                              </span>
                              <Badge variant="outline" className="text-xs py-0">
                                {typeInfo.label}
                              </Badge>
                            </div>
                            {service.completed_notes && (
                              <p className="text-xs text-muted-foreground mt-1 ml-6 italic">
                                "{service.completed_notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>{detailService?.title}</DialogTitle>
          </DialogHeader>
          {detailService && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={SERVICE_TYPES[detailService.service_type]?.color || 'bg-slate-500'}>
                  {SERVICE_TYPES[detailService.service_type]?.label || 'Otro'}
                </Badge>
                <Badge variant={detailService.status === 'in_progress' ? 'default' : 'secondary'}>
                  {SERVICE_STATUS[detailService.status]?.label}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{getPersonName(detailService)}</p>
                    {detailService.prospects && (
                      <Badge variant="outline" className="text-xs mt-1">Prospecto</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <a 
                    href={`tel:${getPersonPhone(detailService)}`}
                    className="text-primary hover:underline"
                  >
                    {getPersonPhone(detailService)}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{getAddress(detailService)}</p>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p>
                    {format(parseISO(detailService.scheduled_date), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>

                {detailService.scheduled_time && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <p>{detailService.scheduled_time.slice(0, 5)} hrs</p>
                  </div>
                )}

                {detailService.description && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">{detailService.description}</p>
                  </div>
                )}

                {detailService.charge_amount && detailService.charge_amount > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <p className="font-medium">Cobrar: {formatCurrency(detailService.charge_amount)}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {detailService.status === 'scheduled' && (
                  <Button 
                    className="w-full"
                    disabled={startingService === detailService.id}
                    onClick={() => {
                      handleStartService(detailService);
                      setDetailDialogOpen(false);
                    }}
                  >
                    {startingService === detailService.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4 mr-2" />
                    )}
                    En Visita (Iniciar + GPS)
                  </Button>
                )}
                {detailService.status === 'in_progress' && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      handleCompleteService(detailService);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Completar Servicio
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    const address = getAddress(detailService);
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
                  }}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Abrir en Maps
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prospect Detail Dialog */}
      <Dialog open={prospectDetailOpen} onOpenChange={setProspectDetailOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>
              {selectedProspect?.first_name} {selectedProspect?.last_name_paterno}
            </DialogTitle>
          </DialogHeader>
          {selectedProspect && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <a 
                      href={`tel:${selectedProspect.phone1}`}
                      className="text-primary hover:underline block"
                    >
                      {selectedProspect.phone1}
                    </a>
                    {selectedProspect.phone2 && (
                      <a 
                        href={`tel:${selectedProspect.phone2}`}
                        className="text-primary hover:underline block text-sm"
                      >
                        {selectedProspect.phone2}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm">
                    {selectedProspect.street} #{selectedProspect.exterior_number}
                    {selectedProspect.interior_number && ` Int. ${selectedProspect.interior_number}`}, 
                    {selectedProspect.neighborhood}, {selectedProspect.city}
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm">
                    Solicitud: {format(parseISO(selectedProspect.request_date), "dd/MM/yyyy")}
                  </p>
                </div>

                {selectedProspect.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">{selectedProspect.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    const address = `${selectedProspect.street} #${selectedProspect.exterior_number}, ${selectedProspect.neighborhood}, ${selectedProspect.city}`;
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
                  }}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Abrir en Maps
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  asChild
                >
                  <a href={`tel:${selectedProspect.phone1}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Llamar
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Service Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Completar Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Completar el servicio "{selectedService?.title}"?
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de finalización</label>
              <Select value={completionReason} onValueChange={setCompletionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el motivo" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLETION_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Textarea
              placeholder={completionReason === 'no_one_home' 
                ? "Describe la situación (opcional)" 
                : "Notas del servicio completado (opcional)"
              }
              value={completedNotes}
              onChange={(e) => setCompletedNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={confirmComplete}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {completionReason === 'no_one_home' 
                ? 'Marcar como Terminado (No había nadie)'
                : 'Confirmar Completado'
              }
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setCompleteDialogOpen(false);
                setCompletionReason('completed');
                setCompletedNotes('');
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 flex justify-around">
        <Button 
          variant="ghost" 
          className="flex-col h-auto py-2 px-4"
          onClick={() => window.location.href = '/dashboard'}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Inicio</span>
        </Button>
        <Button 
          variant="ghost" 
          className={`flex-col h-auto py-2 px-4 ${activeTab === 'services' ? 'text-primary' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Wrench className="h-5 w-5" />
          <span className="text-xs mt-1">Servicios</span>
        </Button>
        <Button 
          variant="ghost" 
          className={`flex-col h-auto py-2 px-4 ${activeTab === 'prospects' ? 'text-primary' : ''}`}
          onClick={() => setActiveTab('prospects')}
        >
          <Users className="h-5 w-5" />
          <span className="text-xs mt-1">Prospectos</span>
        </Button>
        <Button 
          variant="ghost" 
          className={`flex-col h-auto py-2 px-4 ${activeTab === 'history' ? 'text-primary' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <ClipboardList className="h-5 w-5" />
          <span className="text-xs mt-1">Historial</span>
        </Button>
      </div>
    </div>
  );
}
