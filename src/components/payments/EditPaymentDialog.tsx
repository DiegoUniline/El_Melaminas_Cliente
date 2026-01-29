import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
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
import type { Payment } from '@/types/database';

interface EditPaymentDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPaymentDialog({ payment, open, onOpenChange, onSuccess }: EditPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: '',
    payment_type: '',
    bank_type: '',
    receipt_number: '',
    payer_name: '',
    payer_phone: '',
    notes: '',
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment_methods_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount.toString(),
        payment_date: payment.payment_date,
        payment_type: payment.payment_type,
        bank_type: payment.bank_type || '',
        receipt_number: payment.receipt_number || '',
        payer_name: payment.payer_name || '',
        payer_phone: payment.payer_phone || '',
        notes: payment.notes || '',
      });
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const oldAmount = payment.amount;
      const amountDiff = amount - oldAmount;

      // Update payment
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          amount,
          payment_date: formData.payment_date,
          payment_type: formData.payment_type,
          bank_type: formData.bank_type || null,
          receipt_number: formData.receipt_number || null,
          payer_name: formData.payer_name || null,
          payer_phone: formData.payer_phone || null,
          notes: formData.notes || null,
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // If amount changed, update client balance
      if (amountDiff !== 0) {
        const { data: billing } = await supabase
          .from('client_billing')
          .select('balance')
          .eq('client_id', payment.client_id)
          .maybeSingle();

        if (billing) {
          // Negative diff means we reduced the payment, so balance increases
          // Positive diff means we increased the payment, so balance decreases
          const newBalance = (billing.balance || 0) - amountDiff;
          await supabase
            .from('client_billing')
            .update({ balance: newBalance })
            .eq('client_id', payment.client_id);
        }
      }

      // Record change history
      const changes: { field: string; old: string; new: string }[] = [];
      
      if (amount !== payment.amount) {
        changes.push({ field: 'Monto', old: payment.amount.toString(), new: amount.toString() });
      }
      if (formData.payment_date !== payment.payment_date) {
        changes.push({ field: 'Fecha', old: payment.payment_date, new: formData.payment_date });
      }
      if (formData.payment_type !== payment.payment_type) {
        changes.push({ field: 'Método', old: payment.payment_type, new: formData.payment_type });
      }
      if ((formData.bank_type || '') !== (payment.bank_type || '')) {
        changes.push({ field: 'Banco', old: payment.bank_type || '', new: formData.bank_type || '' });
      }
      if ((formData.receipt_number || '') !== (payment.receipt_number || '')) {
        changes.push({ field: 'No. Recibo', old: payment.receipt_number || '', new: formData.receipt_number || '' });
      }
      if ((formData.payer_name || '') !== (payment.payer_name || '')) {
        changes.push({ field: 'Pagador', old: payment.payer_name || '', new: formData.payer_name || '' });
      }
      if ((formData.notes || '') !== (payment.notes || '')) {
        changes.push({ field: 'Notas', old: payment.notes || '', new: formData.notes || '' });
      }

      if (changes.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('prospect_change_history').insert(
          changes.map(c => ({
            client_id: payment.client_id,
            field_name: `Pago: ${c.field}`,
            old_value: c.old || null,
            new_value: c.new || null,
            changed_by: user?.id,
          }))
        );
      }

      toast.success('Pago actualizado correctamente');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Pago</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="payment_date">Fecha de Pago *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_type">Método de Pago *</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(v) => setFormData({ ...formData, payment_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_type">Banco</Label>
              <Select
                value={formData.bank_type}
                onValueChange={(v) => setFormData({ ...formData, bank_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin banco</SelectItem>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receipt_number">No. Recibo</Label>
              <Input
                id="receipt_number"
                value={formData.receipt_number}
                onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payer_name">Nombre del Pagador</Label>
              <Input
                id="payer_name"
                value={formData.payer_name}
                onChange={(e) => setFormData({ ...formData, payer_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
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
