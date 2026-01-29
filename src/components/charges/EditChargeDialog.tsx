import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Charge {
  id: string;
  client_id: string;
  description: string;
  amount: number;
  status: string;
  due_date?: string | null;
  paid_date?: string | null;
}

interface EditChargeDialogProps {
  charge: Charge | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditChargeDialog({ charge, open, onOpenChange, onSuccess }: EditChargeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    status: 'pending',
    due_date: '',
  });

  useEffect(() => {
    if (charge) {
      setFormData({
        description: charge.description,
        amount: charge.amount.toString(),
        status: charge.status,
        due_date: charge.due_date || '',
      });
    }
  }, [charge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charge) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const oldAmount = charge.amount;
      const oldStatus = charge.status;
      const amountDiff = amount - oldAmount;
      const statusChanged = formData.status !== oldStatus;

      // Update charge
      const { error: chargeError } = await supabase
        .from('client_charges')
        .update({
          description: formData.description,
          amount,
          status: formData.status,
          due_date: formData.due_date || null,
          paid_date: formData.status === 'paid' && !charge.paid_date 
            ? new Date().toISOString().split('T')[0] 
            : formData.status === 'pending' ? null : charge.paid_date,
        })
        .eq('id', charge.id);

      if (chargeError) throw chargeError;

      // Update client balance if amount or status changed
      if (amountDiff !== 0 || statusChanged) {
        const { data: billing } = await supabase
          .from('client_billing')
          .select('balance')
          .eq('client_id', charge.client_id)
          .maybeSingle();

        if (billing) {
          let balanceChange = 0;
          
          if (oldStatus === 'pending' && formData.status === 'paid') {
            // Charge was paid - decrease balance by the new amount
            balanceChange = -amount;
          } else if (oldStatus === 'paid' && formData.status === 'pending') {
            // Charge was unpaid - increase balance by the new amount
            balanceChange = amount;
          } else if (oldStatus === 'pending' && formData.status === 'pending') {
            // Still pending - adjust by the difference
            balanceChange = amountDiff;
          }
          // If was paid and still paid, no balance change (amount already paid)

          if (balanceChange !== 0) {
            const newBalance = (billing.balance || 0) + balanceChange;
            await supabase
              .from('client_billing')
              .update({ balance: newBalance })
              .eq('client_id', charge.client_id);
          }
        }
      }

      // Record change history
      const changes: { field: string; old: string; new: string }[] = [];
      
      if (formData.description !== charge.description) {
        changes.push({ field: 'Descripción', old: charge.description, new: formData.description });
      }
      if (amount !== charge.amount) {
        changes.push({ field: 'Monto', old: charge.amount.toString(), new: amount.toString() });
      }
      if (formData.status !== charge.status) {
        const statusLabels: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado' };
        changes.push({ 
          field: 'Estatus', 
          old: statusLabels[charge.status] || charge.status, 
          new: statusLabels[formData.status] || formData.status 
        });
      }
      if ((formData.due_date || '') !== (charge.due_date || '')) {
        changes.push({ field: 'Fecha Vencimiento', old: charge.due_date || '', new: formData.due_date || '' });
      }

      if (changes.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('prospect_change_history').insert(
          changes.map(c => ({
            client_id: charge.client_id,
            field_name: `Cargo: ${c.field}`,
            old_value: c.old || null,
            new_value: c.new || null,
            changed_by: user?.id,
          }))
        );
      }

      toast.success('Cargo actualizado correctamente');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating charge:', error);
      toast.error('Error al actualizar el cargo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!charge) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Cargo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estatus *</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Fecha de Vencimiento</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
