import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, Info } from 'lucide-react';
import { ComboboxWithCreate, CatalogItem } from '@/components/shared/ComboboxWithCreate';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Client, ClientBilling } from '@/types/database';

type ClientWithBilling = Client & {
  client_billing: ClientBilling | null;
};

const paymentSchema = z.object({
  amount: z.number().min(0, 'El monto debe ser mayor o igual a 0').optional(),
  payment_type: z.string().optional(),
  bank_type: z.string().optional(),
  payment_date: z.string().min(1, 'La fecha es requerida'),
  receipt_number: z.string().optional(),
  payer_name: z.string().optional(),
  payer_phone: z.string().optional(),
  notes: z.string().optional(),
  use_credit_balance: z.boolean().optional(),
  credit_amount_to_use: z.number().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormDialogProps {
  client: ClientWithBilling | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** 
   * The effective available credit balance after considering advance payments.
   * If not provided, it will be calculated from billing.balance, but this may be inaccurate
   * if credit has already been applied to advance mensualidades.
   */
  effectiveCreditBalance?: number;
}


export function PaymentFormDialog({ client, open, onOpenChange, onSuccess, effectiveCreditBalance }: PaymentFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCreditBalance, setUseCreditBalance] = useState(false);
  const [creditAmountToUse, setCreditAmountToUse] = useState(0);
  
  // Use the effective credit balance if provided, otherwise fall back to billing.balance
  // effectiveCreditBalance = 0 means no credit available (all applied to advance payments)
  const availableCreditBalance = effectiveCreditBalance !== undefined 
    ? effectiveCreditBalance 
    : (client?.client_billing?.balance 
        ? Math.abs(Math.min(client.client_billing.balance, 0)) 
        : 0);
  const hasCreditBalance = availableCreditBalance > 0;

  const currentDate = new Date();

  // Fetch payment methods from catalog
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment_methods_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data.map(pm => ({ id: pm.id, name: pm.name })) as CatalogItem[];
    },
  });

  // Fetch banks from catalog
  const { data: banks = [] } = useQuery({
    queryKey: ['banks_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data.map(b => ({ id: b.id, name: b.name })) as CatalogItem[];
    },
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: client?.client_billing?.monthly_fee || undefined,
      payment_type: '',
      bank_type: '',
      payment_date: currentDate.toISOString().split('T')[0],
      receipt_number: '',
      payer_name: '',
      payer_phone: '',
      notes: '',
    },
  });

  const paymentTypeId = form.watch('payment_type');
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === paymentTypeId);
  const needsBank = selectedPaymentMethod?.name === 'Transferencia' || selectedPaymentMethod?.name === 'Depósito';

  const handlePaymentMethodCreated = (item: CatalogItem) => {
    queryClient.invalidateQueries({ queryKey: ['payment_methods_active'] });
    queryClient.invalidateQueries({ queryKey: ['payment_methods_all'] });
  };

  const handleBankCreated = (item: CatalogItem) => {
    queryClient.invalidateQueries({ queryKey: ['banks_active'] });
    queryClient.invalidateQueries({ queryKey: ['banks_all'] });
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (!client) return;

    // Calculate total payment (cash + credit balance)
    const cashAmount = data.amount;
    const creditUsed = useCreditBalance ? creditAmountToUse : 0;
    const totalPaymentValue = cashAmount + creditUsed;

    // Validate: at least some payment must be made
    if (totalPaymentValue <= 0) {
      toast.error('Debe registrar un monto de pago o usar saldo a favor');
      return;
    }

    // Validate payment type is required if cash amount > 0
    if (cashAmount > 0 && !data.payment_type) {
      toast.error('El tipo de pago es requerido cuando hay un monto en efectivo');
      return;
    }

    setIsSubmitting(true);

    try {
      // Only create payment record if there's cash payment
      let paymentId: string | null = null;
      
      if (cashAmount > 0) {
        const { data: paymentData, error: paymentError } = await supabase.from('payments').insert({
          client_id: client.id,
          amount: cashAmount,
          payment_type: data.payment_type || 'Saldo a favor',
          bank_type: data.bank_type || null,
          payment_date: data.payment_date,
          receipt_number: data.receipt_number || null,
          payer_name: data.payer_name || null,
          payer_phone: data.payer_phone || null,
          notes: creditUsed > 0 
            ? `${data.notes || ''} [Incluye $${creditUsed.toLocaleString()} de saldo a favor]`.trim()
            : data.notes || null,
          created_by: user?.id,
        }).select().single();

        if (paymentError) throw paymentError;
        paymentId = paymentData.id;
      } else if (creditUsed > 0) {
        // Create a special payment record for credit balance usage
        // Find a payment method for "Saldo a favor" or use a default
        const saldoFavorMethod = paymentMethods.find(pm => pm.name.toLowerCase().includes('saldo'));
        
        const { data: paymentData, error: paymentError } = await supabase.from('payments').insert({
          client_id: client.id,
          amount: 0,
          payment_type: saldoFavorMethod?.id || paymentMethods[0]?.id || 'Saldo a favor',
          payment_date: data.payment_date,
          notes: `Aplicación de saldo a favor: $${creditUsed.toLocaleString()}`,
          created_by: user?.id,
        }).select().single();

        if (paymentError) throw paymentError;
        paymentId = paymentData.id;
      }

      // Get pending charges ordered by creation date
      const { data: pendingCharges } = await supabase
        .from('client_charges')
        .select('*')
        .eq('client_id', client.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      // Apply total payment to pending charges (oldest first)
      let remainingPayment = totalPaymentValue;
      
      if (pendingCharges && pendingCharges.length > 0) {
        for (const charge of pendingCharges) {
          if (remainingPayment <= 0) break;
          
          if (remainingPayment >= charge.amount) {
            // Full payment of this charge
            await supabase
              .from('client_charges')
              .update({ 
                status: 'paid', 
                paid_date: data.payment_date,
                payment_id: paymentId 
              })
              .eq('id', charge.id);
            
            remainingPayment -= charge.amount;
          }
          // If partial payment, leave charge as pending (will be covered by balance update)
        }
      }

      // If there's remaining payment after paying all debts, create advance payment
      if (remainingPayment > 0 && client.client_billing) {
        const currentBalance = client.client_billing.balance || 0;
        const totalPendingDebt = pendingCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
        
        // Only create advance payment if client has no more debt and there's excess
        if (remainingPayment > totalPendingDebt && client.client_billing.monthly_fee > 0) {
          const monthlyFee = client.client_billing.monthly_fee;
          const excessAfterDebt = remainingPayment;
          
          // Calculate how many months can be covered
          let monthsToCover = Math.floor(excessAfterDebt / monthlyFee);
          let excessAmount = excessAfterDebt % monthlyFee;
          
          // Create advance mensualidad charges if there's enough for at least one month
          if (monthsToCover > 0) {
            const currentDate = new Date();
            const advanceCharges = [];
            
            for (let i = 1; i <= monthsToCover; i++) {
              const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
              const futureMonth = futureDate.getMonth() + 1;
              const futureYear = futureDate.getFullYear();
              
              advanceCharges.push({
                client_id: client.id,
                description: `Mensualidad adelantada ${futureMonth}/${futureYear}`,
                amount: monthlyFee,
                status: 'paid',
                paid_date: data.payment_date,
                payment_id: paymentId,
                created_by: user?.id,
              });
            }
            
            if (advanceCharges.length > 0) {
              const { error: advanceError } = await supabase
                .from('client_charges')
                .insert(advanceCharges);
              
              if (advanceError) {
                console.error('Error creating advance charges:', advanceError);
              }
            }
          }
        }
      }

      // Update client balance
      // Balance change = -(cash payment) + (credit used - credit used) = -cash payment
      // But we also consume the credit, so: new balance = old balance - cash - credit used + credit used = old balance - cash
      // old balance is negative (credit). If we use credit, balance goes towards 0.
      // new balance = old balance - cash + credit used (because credit was negative, using it adds to balance)
      if (client.client_billing) {
        // old_balance + credit_used - cash_paid
        const newBalance = (client.client_billing.balance || 0) + creditUsed - cashAmount;
        const { error: balanceError } = await supabase
          .from('client_billing')
          .update({ balance: newBalance })
          .eq('id', client.client_billing.id);

        if (balanceError) throw balanceError;

        // Build summary message
        const chargesPaidCount = pendingCharges?.filter(c => c.status === 'pending').length || 0;
        const monthsToCovered = client.client_billing.monthly_fee > 0 
          ? Math.floor((totalPaymentValue - (pendingCharges?.reduce((sum, c) => sum + c.amount, 0) || 0)) / client.client_billing.monthly_fee)
          : 0;
        
        let summaryMessage = 'Pago registrado. ';
        if (chargesPaidCount > 0) {
          summaryMessage += `${chargesPaidCount} cargo(s) cubierto(s). `;
        }
        if (monthsToCovered > 0) {
          summaryMessage += `${monthsToCovered} mensualidad(es) adelantada(s). `;
        }
        if (creditUsed > 0) {
          summaryMessage += `Se aplicaron $${creditUsed.toLocaleString()} de saldo a favor. `;
        }
        if (newBalance < 0) {
          summaryMessage += `Saldo a favor: $${Math.abs(newBalance).toLocaleString()}`;
        }
        
        toast.success(summaryMessage.trim());
      } else {
        toast.success('Pago registrado correctamente');
      }
      
      form.reset();
      setUseCreditBalance(false);
      setCreditAmountToUse(0);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al registrar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente: {client.first_name} {client.last_name_paterno}
            <br />
            Saldo actual:{' '}
            <span className={(client.client_billing?.balance || 0) > 0 ? 'text-destructive' : 'text-green-600'}>
              ${client.client_billing?.balance?.toLocaleString() || '0'}
            </span>
            {hasCreditBalance && (
              <span className="ml-2 text-green-600 font-medium">
                (Saldo a favor: ${availableCreditBalance.toLocaleString()})
              </span>
            )}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Credit Balance Section */}
            {hasCreditBalance && (
              <Alert className="bg-green-50 border-green-200">
                <Wallet className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="use_credit"
                        checked={useCreditBalance}
                        onCheckedChange={(checked) => {
                          setUseCreditBalance(!!checked);
                          if (checked) {
                            // Default to use all available credit
                            setCreditAmountToUse(availableCreditBalance);
                          } else {
                            setCreditAmountToUse(0);
                          }
                        }}
                      />
                      <label htmlFor="use_credit" className="text-sm font-medium cursor-pointer">
                        Usar saldo a favor
                      </label>
                    </div>
                    <span className="text-sm font-semibold">
                      Disponible: ${availableCreditBalance.toLocaleString()}
                    </span>
                  </div>
                  
                  {useCreditBalance && (
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-sm">Monto a aplicar:</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={creditAmountToUse}
                        onChange={(e) => {
                          const value = Math.min(
                            parseFloat(e.target.value) || 0,
                            availableCreditBalance
                          );
                          setCreditAmountToUse(Math.max(0, value));
                        }}
                        className="w-32 h-8 bg-white"
                        max={availableCreditBalance}
                        min={0}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditAmountToUse(availableCreditBalance)}
                        className="h-8"
                      >
                        Usar todo
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto en efectivo/transferencia {!useCreditBalance && '*'}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    {useCreditBalance && creditAmountToUse > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total a aplicar: ${(field.value + creditAmountToUse).toLocaleString()}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Pago *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pago *</FormLabel>
                    <FormControl>
                      <ComboboxWithCreate
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        items={paymentMethods}
                        placeholder="Selecciona tipo"
                        searchPlaceholder="Buscar método..."
                        emptyMessage="No hay métodos de pago"
                        tableName="payment_methods"
                        onItemCreated={handlePaymentMethodCreated}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {needsBank && (
                <FormField
                  control={form.control}
                  name="bank_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <ComboboxWithCreate
                          value={field.value || ''}
                          onChange={(value) => field.onChange(value)}
                          items={banks}
                          placeholder="Selecciona banco"
                          searchPlaceholder="Buscar banco..."
                          emptyMessage="No hay bancos"
                          tableName="banks"
                          onItemCreated={handleBankCreated}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="receipt_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Recibo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Pagador</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payer_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono del Pagador</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Pago
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
