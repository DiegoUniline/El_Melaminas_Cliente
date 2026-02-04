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
import { format, addDays, subDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

interface Employee {
  user_id: string;
  full_name: string;
}

interface ServicesScheduleGridProps {
  services: ScheduledService[];
  employees: Employee[];
  onServiceClick?: (service: ScheduledService) => void;
}

// Hours from 7 AM to 8 PM
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export function ServicesScheduleGrid({ services, employees, onServiceClick }: ServicesScheduleGridProps) {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');
  const [daysToShow, setDaysToShow] = useState(7);

  // Generate array of dates for the columns
  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));
  }, [startDate, daysToShow]);

  // Filter services by selected technician
  const filteredServices = useMemo(() => {
    if (selectedTechnician === 'all') return services;
    return services.filter(s => s.assigned_to === selectedTechnician);
  }, [services, selectedTechnician]);

  // Create a map of services by date and hour
  const serviceGrid = useMemo(() => {
    const grid: Record<string, Record<number, ScheduledService[]>> = {};
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      grid[dateKey] = {};
      HOURS.forEach(hour => {
        grid[dateKey][hour] = [];
      });
    });

    filteredServices.forEach(service => {
      const dateKey = service.scheduled_date;
      if (!grid[dateKey]) return;
      
      if (service.scheduled_time) {
        const hour = parseInt(service.scheduled_time.split(':')[0], 10);
        if (grid[dateKey][hour]) {
          grid[dateKey][hour].push(service);
        }
      } else {
        // Services without time go to 8 AM by default
        if (grid[dateKey][8]) {
          grid[dateKey][8].push(service);
        }
      }
    });

    return grid;
  }, [dates, filteredServices]);

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

  const goToPrevious = () => setStartDate(subDays(startDate, daysToShow));
  const goToNext = () => setStartDate(addDays(startDate, daysToShow));
  const goToToday = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Get unique technicians from services
  const techniciansInServices = useMemo(() => {
    const seen = new Set<string>();
    return employees.filter(e => {
      const hasServices = services.some(s => s.assigned_to === e.user_id);
      if (hasServices && !seen.has(e.user_id)) {
        seen.add(e.user_id);
        return true;
      }
      return false;
    });
  }, [services, employees]);

  return (
    <div className="space-y-4">
      {/* Header with navigation and filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <span className="text-lg font-semibold">
              {format(dates[0], "dd MMM", { locale: es })} - {format(dates[dates.length - 1], "dd MMM yyyy", { locale: es })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Días:</span>
            <Select value={daysToShow.toString()} onValueChange={(v) => setDaysToShow(parseInt(v))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="14">14</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Técnico:</span>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los técnicos</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Header row with dates */}
              <div className="flex border-b sticky top-0 bg-background z-10">
                <div className="w-20 shrink-0 p-2 border-r font-medium text-sm text-center text-muted-foreground">
                  Hora
                </div>
                {dates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "flex-1 min-w-[120px] p-2 border-r text-center",
                      isToday(date) && "bg-primary/10"
                    )}
                  >
                    <div className={cn(
                      "text-xs text-muted-foreground uppercase",
                    )}>
                      {format(date, 'EEE', { locale: es })}
                    </div>
                    <div className={cn(
                      "text-lg font-semibold",
                      isToday(date) && "text-primary"
                    )}>
                      {format(date, 'd')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(date, 'MMM', { locale: es })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time slots */}
              <div className="divide-y">
                {HOURS.map((hour) => (
                  <div key={hour} className="flex min-h-[60px]">
                    <div className="w-20 shrink-0 p-2 border-r text-sm text-muted-foreground text-center flex items-center justify-center">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    {dates.map((date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const cellServices = serviceGrid[dateKey]?.[hour] || [];
                      
                      return (
                        <div
                          key={`${dateKey}-${hour}`}
                          className={cn(
                            "flex-1 min-w-[120px] p-1 border-r",
                            isToday(date) && "bg-primary/5",
                            "hover:bg-muted/30 transition-colors"
                          )}
                        >
                          <div className="space-y-1">
                            {cellServices.map((service) => {
                              const typeInfo = SERVICE_TYPES[service.service_type] || SERVICE_TYPES.other;
                              const statusInfo = SERVICE_STATUS[service.status];
                              
                              return (
                                <Popover key={service.id}>
                                  <PopoverTrigger asChild>
                                    <button
                                      className={cn(
                                        "w-full text-left text-xs p-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity",
                                        statusInfo.color,
                                        "text-white"
                                      )}
                                    >
                                      <div className="font-medium truncate">{service.title}</div>
                                      <div className="truncate opacity-90">{getPersonName(service)}</div>
                                      {selectedTechnician === 'all' && (
                                        <div className="truncate opacity-75 text-[10px]">
                                          {service.employee_name}
                                        </div>
                                      )}
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
                                          <span>{format(new Date(service.scheduled_date), "dd 'de' MMMM", { locale: es })}</span>
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
