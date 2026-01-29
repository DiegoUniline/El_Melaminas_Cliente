import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { History, ArrowRight, User, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface ChangeHistoryItem {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  profiles?: { full_name: string } | null;
}

interface ChangeHistoryPanelProps {
  prospectId?: string;
  clientId?: string;
  compact?: boolean;
  maxHeight?: string;
}

export function ChangeHistoryPanel({ 
  prospectId, 
  clientId, 
  compact = false,
  maxHeight = '400px'
}: ChangeHistoryPanelProps) {
  const [history, setHistory] = useState<ChangeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!prospectId && !clientId) {
        setHistory([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let query = supabase
          .from('prospect_change_history')
          .select(`
            id,
            field_name,
            old_value,
            new_value,
            changed_at,
            changed_by
          `)
          .order('changed_at', { ascending: false });

        if (clientId) {
          query = query.eq('client_id', clientId);
        } else if (prospectId) {
          query = query.eq('prospect_id', prospectId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Fetch user names for changed_by
        if (data && data.length > 0) {
          const userIds = [...new Set(data.filter(d => d.changed_by).map(d => d.changed_by))];
          
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', userIds as string[]);

            const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
            
            const enrichedData = data.map(item => ({
              ...item,
              profiles: item.changed_by ? { full_name: profileMap.get(item.changed_by) || 'Desconocido' } : null
            }));
            
            setHistory(enrichedData);
          } else {
            setHistory(data.map(item => ({ ...item, profiles: null })));
          }
        } else {
          setHistory([]);
        }
      } catch (error) {
        console.error('Error fetching change history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [prospectId, clientId]);

  const formatFieldName = (fieldName: string): string => {
    const fieldLabels: Record<string, string> = {
      first_name: 'Nombre',
      last_name_paterno: 'Apellido Paterno',
      last_name_materno: 'Apellido Materno',
      phone1: 'Teléfono 1',
      phone1_country: 'País Teléfono 1',
      phone2: 'Teléfono 2',
      phone2_country: 'País Teléfono 2',
      phone3: 'Teléfono 3',
      phone3_country: 'País Teléfono 3',
      phone3_signer: 'Teléfono Firmante',
      street: 'Calle',
      exterior_number: 'No. Exterior',
      interior_number: 'No. Interior',
      neighborhood: 'Colonia',
      city: 'Ciudad',
      postal_code: 'Código Postal',
      work_type: 'Tipo de Trabajo',
      request_date: 'Fecha Solicitud',
      assigned_date: 'Fecha Asignada',
      assigned_to: 'Técnico Asignado',
      ssid: 'SSID',
      antenna_ip: 'IP Antena',
      notes: 'Notas',
      cancellation_reason: 'Motivo Cancelación',
      status: 'Estatus',
    };
    return fieldLabels[fieldName] || fieldName;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Historial de Cambios
          </span>
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Historial de Cambios
        </span>
        {history.length > 0 && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          No hay cambios registrados.
        </p>
      ) : (
        <ScrollArea style={{ maxHeight }} className="pr-2">
          <div className="space-y-2">
            {history.map((change) => (
              <div
                key={change.id}
                className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                    {formatFieldName(change.field_name)}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(change.changed_at).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {change.profiles?.full_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {change.profiles.full_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-sm ${compact ? 'flex-wrap' : ''}`}>
                  <span className="text-red-600 dark:text-red-400 line-through break-all">
                    {change.old_value || '(vacío)'}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-green-600 dark:text-green-400 font-medium break-all">
                    {change.new_value || '(vacío)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
