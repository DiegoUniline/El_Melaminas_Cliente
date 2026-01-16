import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { Client } from '@/types/database';

interface CancelClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CancelClientDialog({ client, open, onOpenChange, onSuccess }: CancelClientDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = async () => {
    if (!client || !reason.trim()) {
      toast.error('Por favor ingresa un motivo de cancelación');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          status: 'cancelled',
          cancellation_reason: reason.trim(),
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Servicio cancelado correctamente');
      setReason('');
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al cancelar el servicio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Servicio
          </DialogTitle>
          <DialogDescription>
            Estás a punto de cancelar el servicio de{' '}
            <strong>
              {client.first_name} {client.last_name_paterno}
            </strong>
            . Esta acción moverá al cliente al historial de cancelados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de cancelación *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ingresa el motivo de la cancelación..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancelar Servicio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
