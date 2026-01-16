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
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import type { Prospect } from '@/types/database';

interface DeleteProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

export function DeleteProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: DeleteProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!prospect) return null;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      // First delete any change history related to this prospect
      await supabase
        .from('prospect_change_history')
        .delete()
        .eq('prospect_id', prospect.id);

      // Then delete the prospect
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', prospect.id);

      if (error) throw error;

      toast.success('Prospecto eliminado correctamente');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error deleting prospect:', error);
      toast.error('Error al eliminar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Eliminar Prospecto
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. El prospecto será eliminado permanentemente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Al eliminar este prospecto, se eliminarán también todos los registros de historial de cambios asociados.
            </p>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">
            Prospecto a eliminar:
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
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
