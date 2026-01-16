import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';
import type { Prospect } from '@/types/database';

interface ReactivateProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

export function ReactivateProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: ReactivateProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!prospect) return null;

  const handleReactivate = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('prospects')
        .update({
          status: 'pending',
          cancelled_at: null,
          cancellation_reason: null,
        })
        .eq('id', prospect.id);

      if (error) throw error;

      toast.success('Prospecto reactivado correctamente');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error reactivating prospect:', error);
      toast.error('Error al reactivar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Reactivar Prospecto
          </DialogTitle>
          <DialogDescription>
            El prospecto volverá al listado de pendientes para ser procesado nuevamente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Prospecto a reactivar:
          </p>
          <p className="font-medium">
            {prospect.first_name} {prospect.last_name_paterno} {prospect.last_name_materno || ''}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {prospect.street} #{prospect.exterior_number}, {prospect.neighborhood}, {prospect.city}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReactivate}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivando...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reactivar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
