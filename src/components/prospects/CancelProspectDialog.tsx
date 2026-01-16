import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import type { Prospect } from '@/types/database';

const cancelSchema = z.object({
  cancellation_reason: z.string().min(1, 'El motivo es requerido').max(500),
});

interface CancelProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

export function CancelProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: CancelProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(cancelSchema),
    defaultValues: {
      cancellation_reason: '',
    },
  });

  if (!prospect) return null;

  const onSubmit = async (values: z.infer<typeof cancelSchema>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('prospects')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: values.cancellation_reason,
        })
        .eq('id', prospect.id);

      if (error) throw error;

      toast.success('Prospecto cancelado correctamente');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error cancelling prospect:', error);
      toast.error('Error al cancelar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancelar Prospecto
          </DialogTitle>
          <DialogDescription>
            El prospecto será marcado como cancelado y pasará al historial.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="py-2">
              <p className="text-sm text-muted-foreground mb-2">
                Prospecto a cancelar:
              </p>
              <p className="font-medium">
                {prospect.first_name} {prospect.last_name_paterno} {prospect.last_name_materno || ''}
              </p>
            </div>

            <FormField
              control={form.control}
              name="cancellation_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de Cancelación *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ingresa el motivo por el cual se cancela este prospecto..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                type="submit"
                variant="destructive"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelación'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}