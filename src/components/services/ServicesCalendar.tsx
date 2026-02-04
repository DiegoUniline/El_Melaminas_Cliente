import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

interface ServicesCalendarProps {
  services: ScheduledService[];
  onServiceClick?: (service: ScheduledService) => void;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function ServicesCalendar({ services, onServiceClick }: ServicesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days at the beginning to align with weekday
    const startDayOfWeek = getDay(start);
    const paddingDays = Array(startDayOfWeek).fill(null);
    
    return [...paddingDays, ...days];
  }, [currentMonth]);

  const servicesByDate = useMemo(() => {
    const map: Record<string, ScheduledService[]> = {};
    services.forEach(service => {
      // El scheduled_date ya viene como string 'yyyy-MM-dd', usarlo directamente
      const dateKey = service.scheduled_date;
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(service);
    });
    return map;
  }, [services]);

  const getPersonName = (service: ScheduledService) => {
    if (service.clients) {
      return `${service.clients.first_name} ${service.clients.last_name_paterno}`;
    }
    if (service.prospects) {
      return `${service.prospects.first_name} ${service.prospects.last_name_paterno} (P)`;
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

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Stats for current month
  const monthStats = useMemo(() => {
    const monthServices = services.filter(s => {
      const serviceDate = new Date(s.scheduled_date);
      return isSameMonth(serviceDate, currentMonth);
    });
    
    return {
      total: monthServices.length,
      scheduled: monthServices.filter(s => s.status === 'scheduled').length,
      in_progress: monthServices.filter(s => s.status === 'in_progress').length,
      completed: monthServices.filter(s => s.status === 'completed').length,
      cancelled: monthServices.filter(s => s.status === 'cancelled').length,
    };
  }, [services, currentMonth]);

  return (
    <div className="space-y-4">
      {/* Header with navigation and stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
        </div>
        
        {/* Mini stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="font-normal">Total:</span> {monthStats.total}
          </Badge>
          <Badge className="bg-blue-500 text-white gap-1">
            <span className="font-normal">Prog:</span> {monthStats.scheduled}
          </Badge>
          <Badge className="bg-yellow-500 text-white gap-1">
            <span className="font-normal">Visita:</span> {monthStats.in_progress}
          </Badge>
          <Badge className="bg-green-500 text-white gap-1">
            <span className="font-normal">Comp:</span> {monthStats.completed}
          </Badge>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="min-h-[100px] sm:min-h-[120px]" />;
              }

              // Crear dateKey manualmente para evitar problemas de UTC
              const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const dayServices = servicesByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "min-h-[100px] sm:min-h-[120px] border rounded-md p-1 transition-colors",
                    !isCurrentMonth && "opacity-40",
                    isDayToday && "ring-2 ring-primary bg-primary/5",
                    dayServices.length > 0 && "bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1 text-center rounded-full w-7 h-7 flex items-center justify-center mx-auto",
                    isDayToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayServices.slice(0, 3).map((service) => {
                      const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                      const statusInfo = SERVICE_STATUS[service.status];
                      
                      return (
                        <Popover key={service.id}>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "w-full text-left text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                                statusInfo.color,
                                "text-white"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              {service.scheduled_time?.slice(0, 5)} {service.title}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3" side="right" align="start">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold">{service.title}</h4>
                                <Badge className={cn(statusInfo.color, "text-white text-xs")}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {typeInfo.label}
                              </Badge>
                              
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{getPersonName(service)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{getAddress(service)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span>{format(parseISO(service.scheduled_date), "dd 'de' MMMM", { locale: es })}</span>
                                </div>
                                {service.scheduled_time && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span>{service.scheduled_time.slice(0, 5)} hrs</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span>Técnico: {service.employee_name}</span>
                                </div>
                              </div>
                              
                              {service.description && (
                                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                                  {service.description}
                                </p>
                              )}
                              
                              {onServiceClick && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full mt-2"
                                  onClick={() => onServiceClick(service)}
                                >
                                  Ver detalles
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                    
                    {dayServices.length > 3 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full text-xs text-center text-muted-foreground hover:text-foreground">
                            +{dayServices.length - 3} más
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 max-h-80 overflow-y-auto" side="right">
                          <h4 className="font-semibold mb-2">
                            {format(day, "dd 'de' MMMM", { locale: es })}
                          </h4>
                          <div className="space-y-2">
                            {dayServices.map((service) => {
                              const statusInfo = SERVICE_STATUS[service.status];
                              return (
                                <div
                                  key={service.id}
                                  className="p-2 rounded border text-sm cursor-pointer hover:bg-muted/50"
                                  onClick={() => onServiceClick?.(service)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{service.title}</span>
                                    <Badge className={cn(statusInfo.color, "text-white text-xs shrink-0")}>
                                      {statusInfo.label}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {service.scheduled_time?.slice(0, 5)} - {getPersonName(service)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-4 justify-center">
            <span className="text-sm text-muted-foreground">Estados:</span>
            {Object.entries(SERVICE_STATUS).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded", value.color)} />
                <span className="text-xs">{value.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
