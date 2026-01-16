import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { History, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import type { Prospect } from '@/types/database';

interface ChangeHistoryItem {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

interface ProspectDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
}

export function ProspectDetailDialog({
  open,
  onOpenChange,
  prospect,
}: ProspectDetailDialogProps) {
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchChangeHistory = async () => {
      if (!prospect || prospect.status !== 'finalized') {
        setChangeHistory([]);
        return;
      }

      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('prospect_change_history')
          .select('id, field_name, old_value, new_value, changed_at')
          .eq('prospect_id', prospect.id)
          .order('changed_at', { ascending: false });

        if (error) throw error;
        setChangeHistory(data || []);
      } catch (error) {
        console.error('Error fetching change history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (open && prospect) {
      fetchChangeHistory();
    }
  }, [open, prospect]);

  if (!prospect) return null;

  const getStatusBadge = () => {
    switch (prospect.status) {
      case 'pending':
        return <Badge variant="secondary">PENDIENTE</Badge>;
      case 'finalized':
        return <Badge variant="default">FINALIZADO</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">CANCELADO</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalle del Prospecto</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Datos personales */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Datos Personales
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre completo</p>
                <p className="font-medium">
                  {prospect.first_name} {prospect.last_name_paterno} {prospect.last_name_materno || ''}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Teléfonos */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Teléfonos
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Teléfono 1</p>
                <p className="font-medium">
                  {formatPhoneDisplay(prospect.phone1, (prospect as any).phone1_country)}
                </p>
              </div>
              {prospect.phone2 && (
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono 2</p>
                  <p className="font-medium">
                    {formatPhoneDisplay(prospect.phone2, (prospect as any).phone2_country)}
                  </p>
                </div>
              )}
              {prospect.phone3_signer && (
                <div>
                  <p className="text-sm text-muted-foreground">Tel. Firmante</p>
                  <p className="font-medium">
                    {formatPhoneDisplay(prospect.phone3_signer, (prospect as any).phone3_country)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dirección */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Dirección
            </h3>
            <div className="space-y-2">
              <p className="font-medium">
                {prospect.street} #{prospect.exterior_number}
                {prospect.interior_number ? ` Int. ${prospect.interior_number}` : ''}
              </p>
              <p className="text-muted-foreground">
                {prospect.neighborhood}, {prospect.city}
                {prospect.postal_code ? `, C.P. ${prospect.postal_code}` : ''}
              </p>
            </div>
          </div>

          <Separator />

          {/* Trabajo */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Información del Trabajo
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {prospect.work_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Trabajo</p>
                  <p className="font-medium">{prospect.work_type}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Fecha Solicitud</p>
                <p className="font-medium">
                  {new Date(prospect.request_date).toLocaleDateString('es-MX')}
                </p>
              </div>
              {prospect.assigned_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Asignada</p>
                  <p className="font-medium">
                    {new Date(prospect.assigned_date).toLocaleDateString('es-MX')}
                  </p>
                </div>
              )}
              {prospect.ssid && (
                <div>
                  <p className="text-sm text-muted-foreground">SSID</p>
                  <p className="font-medium">{prospect.ssid}</p>
                </div>
              )}
              {prospect.antenna_ip && (
                <div>
                  <p className="text-sm text-muted-foreground">IP Antena</p>
                  <p className="font-medium">{prospect.antenna_ip}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          {prospect.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  Notas
                </h3>
                <p className="text-sm bg-muted p-3 rounded-lg">{prospect.notes}</p>
              </div>
            </>
          )}

          {/* Historial de cambios */}
          {prospect.status === 'finalized' && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historial de Cambios
                </h3>
                {loadingHistory ? (
                  <p className="text-sm text-muted-foreground">Cargando historial...</p>
                ) : changeHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    No se realizaron cambios al finalizar este prospecto.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {changeHistory.map((change) => (
                      <div
                        key={change.id}
                        className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                            {change.field_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(change.changed_at).toLocaleString('es-MX')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-600 dark:text-red-400 line-through">
                            {change.old_value || '(vacío)'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {change.new_value || '(vacío)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Razón de cancelación */}
          {prospect.status === 'cancelled' && prospect.cancellation_reason && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-sm text-destructive uppercase tracking-wide mb-3">
                  Motivo de Cancelación
                </h3>
                <p className="text-sm bg-destructive/10 p-3 rounded-lg text-destructive">
                  {prospect.cancellation_reason}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
