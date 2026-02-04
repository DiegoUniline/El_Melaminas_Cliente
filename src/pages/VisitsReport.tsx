import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MapPin, 
  Map as MapIcon,
  List,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Navigation,
  ExternalLink,
  Clock,
  User
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Map as PigeonMap, Marker, Overlay } from 'pigeon-maps';

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
  scheduled: { label: 'Programado', color: 'bg-blue-500' },
  in_progress: { label: 'En Visita', color: 'bg-yellow-500' },
  completed: { label: 'Completado', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

type ServiceType = keyof typeof SERVICE_TYPES;
type ServiceStatus = keyof typeof SERVICE_STATUS;

interface VisitService {
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
  visit_started_at: string | null;
  visit_latitude: number | null;
  visit_longitude: number | null;
  completed_at: string | null;
  completed_notes: string | null;
  clients?: { first_name: string; last_name_paterno: string; street: string; exterior_number: string; neighborhood: string; city: string } | null;
  prospects?: { first_name: string; last_name_paterno: string; street: string; exterior_number: string; neighborhood: string; city: string } | null;
  employee_name?: string;
}

// Get marker color based on service status
const getMarkerColor = (service: VisitService): string => {
  if (service.completed_notes?.includes('[No había nadie')) return '#f97316'; // orange
  if (service.status === 'completed') return '#22c55e'; // green
  if (service.status === 'in_progress') return '#eab308'; // yellow
  return '#ef4444'; // red
};

export default function VisitsReport() {
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch services with visits
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['visits-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_services')
        .select(`
          *,
          clients(first_name, last_name_paterno, street, exterior_number, neighborhood, city),
          prospects(first_name, last_name_paterno, street, exterior_number, neighborhood, city)
        `)
        .gte('scheduled_date', dateFrom)
        .lte('scheduled_date', dateTo)
        .in('status', ['in_progress', 'completed', 'cancelled'])
        .order('scheduled_date', { ascending: false })
        .order('visit_started_at', { ascending: false });

      if (error) throw error;
      
      const employeeMap = new globalThis.Map(employees.map(e => [e.user_id, e.full_name]));
      return (data as unknown as VisitService[]).map(s => ({
        ...s,
        employee_name: employeeMap.get(s.assigned_to) || 'Sin asignar'
      }));
    },
    enabled: employees.length > 0,
  });

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (statusFilter !== 'all' && service.status !== statusFilter) return false;
      if (technicianFilter !== 'all' && service.assigned_to !== technicianFilter) return false;
      if (typeFilter !== 'all' && service.service_type !== typeFilter) return false;
      if (searchQuery) {
        const personName = service.clients 
          ? `${service.clients.first_name} ${service.clients.last_name_paterno}`
          : service.prospects 
            ? `${service.prospects.first_name} ${service.prospects.last_name_paterno}`
            : '';
        const searchLower = searchQuery.toLowerCase();
        if (!service.title.toLowerCase().includes(searchLower) &&
            !personName.toLowerCase().includes(searchLower) &&
            !service.employee_name?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [services, statusFilter, technicianFilter, typeFilter, searchQuery]);

  // Services with GPS
  const servicesWithGPS = filteredServices.filter(s => s.visit_latitude && s.visit_longitude);

  // Calculate map center and zoom
  const mapConfig = useMemo(() => {
    if (servicesWithGPS.length === 0) {
      return { center: [23.6345, -102.5528] as [number, number], zoom: 5 };
    }
    
    const lats = servicesWithGPS.map(s => s.visit_latitude!);
    const lngs = servicesWithGPS.map(s => s.visit_longitude!);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate zoom based on spread
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    let zoom = 14;
    if (maxDiff > 0.5) zoom = 10;
    else if (maxDiff > 0.1) zoom = 12;
    else if (maxDiff > 0.01) zoom = 14;
    
    return { center: [centerLat, centerLng] as [number, number], zoom };
  }, [servicesWithGPS]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredServices.length;
    const withGPS = servicesWithGPS.length;
    const completed = filteredServices.filter(s => s.status === 'completed').length;
    const noOneHome = filteredServices.filter(s => s.completed_notes?.includes('[No había nadie')).length;
    
    const durations = filteredServices
      .filter(s => s.visit_started_at && s.completed_at)
      .map(s => differenceInMinutes(parseISO(s.completed_at!), parseISO(s.visit_started_at!)));
    
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    
    return { total, withGPS, completed, noOneHome, avgDuration };
  }, [filteredServices, servicesWithGPS]);

  const getPersonName = (service: VisitService) => {
    if (service.clients) {
      return `${service.clients.first_name} ${service.clients.last_name_paterno}`;
    }
    if (service.prospects) {
      return `${service.prospects.first_name} ${service.prospects.last_name_paterno} (P)`;
    }
    return 'Sin asignar';
  };

  const getAddress = (service: VisitService) => {
    const person = service.clients || service.prospects;
    if (person) {
      return `${person.street} #${person.exterior_number}, ${person.neighborhood}`;
    }
    return '';
  };

  const getDuration = (service: VisitService) => {
    if (service.visit_started_at && service.completed_at) {
      const mins = differenceInMinutes(parseISO(service.completed_at), parseISO(service.visit_started_at));
      if (mins < 60) return `${mins} min`;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return '-';
  };

  const isNoOneHome = (service: VisitService) => {
    return service.completed_notes?.includes('[No había nadie');
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  return (
    <AppLayout title="Reporte de Visitas">
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Navigation className="h-5 w-5 mx-auto text-primary" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Visitas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <MapPin className="h-5 w-5 mx-auto text-green-500" />
              <p className="text-2xl font-bold">{stats.withGPS}</p>
              <p className="text-xs text-muted-foreground">Con GPS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertCircle className="h-5 w-5 mx-auto text-orange-500" />
              <p className="text-2xl font-bold">{stats.noOneHome}</p>
              <p className="text-xs text-muted-foreground">Sin Nadie</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Timer className="h-5 w-5 mx-auto text-blue-500" />
              <p className="text-2xl font-bold">{stats.avgDuration}</p>
              <p className="text-xs text-muted-foreground">Prom. Min</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por título, cliente, técnico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Desde:</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Hasta:</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in_progress">En Visita</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(SERVICE_TYPES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('map')}
                  >
                    <MapIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {viewMode === 'map' ? (
          <Card>
            <CardContent className="p-0">
              <div className="h-[500px] rounded-lg overflow-hidden">
                {servicesWithGPS.length > 0 ? (
                  <PigeonMap
                    defaultCenter={mapConfig.center}
                    defaultZoom={mapConfig.zoom}
                    onClick={() => setSelectedMarker(null)}
                  >
                    {servicesWithGPS.map((service) => (
                      <Marker
                        key={service.id}
                        anchor={[service.visit_latitude!, service.visit_longitude!]}
                        color={getMarkerColor(service)}
                        width={40}
                        onClick={() => setSelectedMarker(service.id)}
                      />
                    ))}
                    
                    {/* Popup overlay for selected marker */}
                    {selectedMarker && (() => {
                      const service = servicesWithGPS.find(s => s.id === selectedMarker);
                      if (!service) return null;
                      return (
                        <Overlay
                          anchor={[service.visit_latitude!, service.visit_longitude!]}
                          offset={[0, -20]}
                        >
                          <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[220px] max-w-[280px]">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm">{service.title}</p>
                                <button 
                                  onClick={() => setSelectedMarker(null)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  ×
                                </button>
                              </div>
                              <p className="text-xs">{getPersonName(service)}</p>
                              <p className="text-xs text-muted-foreground">{getAddress(service)}</p>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  className="text-xs text-white"
                                  style={{ backgroundColor: getMarkerColor(service) }}
                                >
                                  {isNoOneHome(service) ? 'Sin nadie' : SERVICE_STATUS[service.status]?.label}
                                </Badge>
                              </div>
                              <div className="text-xs space-y-1">
                                <p><strong>Técnico:</strong> {service.employee_name}</p>
                                {service.visit_started_at && (
                                  <p><strong>Llegada:</strong> {format(parseISO(service.visit_started_at), "dd/MM HH:mm")}</p>
                                )}
                                {service.completed_at && (
                                  <p><strong>Duración:</strong> {getDuration(service)}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2"
                                onClick={() => openInMaps(service.visit_latitude!, service.visit_longitude!)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Ver en Google Maps
                              </Button>
                            </div>
                          </div>
                        </Overlay>
                      );
                    })()}
                  </PigeonMap>
                ) : (
                  <div className="h-full flex items-center justify-center bg-muted/20">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No hay visitas con GPS en el rango seleccionado</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Llegada</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>GPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(service.scheduled_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{service.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {SERVICE_TYPES[service.service_type]?.label || 'Otro'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="truncate max-w-[120px]">{getPersonName(service)}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {getAddress(service)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {service.employee_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {service.visit_started_at 
                            ? format(parseISO(service.visit_started_at), "HH:mm")
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getDuration(service)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={cn(SERVICE_STATUS[service.status]?.color, 'text-white text-xs')}>
                              {SERVICE_STATUS[service.status]?.label}
                            </Badge>
                            {isNoOneHome(service) && (
                              <Badge variant="outline" className="text-xs text-orange-600">
                                Sin nadie
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {service.visit_latitude && service.visit_longitude ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => openInMaps(service.visit_latitude!, service.visit_longitude!)}
                            >
                              <MapPin className="h-4 w-4 text-green-500" />
                            </Button>
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredServices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No hay visitas en el rango seleccionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-4 justify-center items-center">
              <span className="text-sm text-muted-foreground">Leyenda:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">Completado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs">En Visita</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">Sin Nadie</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">Cancelado</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
