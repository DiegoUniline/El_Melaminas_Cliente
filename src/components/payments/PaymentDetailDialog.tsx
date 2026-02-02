import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, User, Calendar, Receipt, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Payment, Client } from '@/types/database';

type PaymentWithClient = Payment & {
  clients: Pick<Client, 'id' | 'first_name' | 'last_name_paterno' | 'last_name_materno'>;
};

interface PaymentDetailDialogProps {
  payment: PaymentWithClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDetailDialog({ payment, open, onOpenChange }: PaymentDetailDialogProps) {
  // Fetch covered charges for this payment
  const { data: coveredCharges = [], isLoading: isLoadingCharges } = useQuery({
    queryKey: ['payment_charges', payment?.id],
    queryFn: async () => {
      if (!payment) return [];
      const { data, error } = await supabase
        .from('client_charges')
        .select('id, description, amount, paid_date')
        .eq('payment_id', payment.id)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!payment?.id && open,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name, short_name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const getPaymentMethodName = (id: string) => {
    const method = paymentMethods.find(m => m.id === id);
    return method?.name || id;
  };

  const getBankName = (id: string) => {
    const bank = banks.find(b => b.id === id);
    return bank?.short_name || bank?.name || id;
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Detalle de Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monto</p>
              <p className="text-3xl font-bold text-green-600">
                ${payment.amount.toLocaleString()}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-1">
              {getPaymentMethodName(payment.payment_type)}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">
                  {payment.clients?.first_name} {payment.clients?.last_name_paterno}{' '}
                  {payment.clients?.last_name_materno || ''}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Pago</p>
                <p className="font-medium">
                  {format(new Date(payment.payment_date), 'dd MMMM yyyy', { locale: es })}
                </p>
              </div>
            </div>

            {payment.bank_type && (
              <div>
                <p className="text-sm text-muted-foreground">Banco</p>
                <p className="font-medium">{getBankName(payment.bank_type)}</p>
              </div>
            )}

            {payment.receipt_number && (
              <div>
                <p className="text-sm text-muted-foreground">Número de Recibo</p>
                <p className="font-mono">{payment.receipt_number}</p>
              </div>
            )}

            {payment.payer_name && (
              <div>
                <p className="text-sm text-muted-foreground">Nombre del Pagador</p>
                <p className="font-medium">{payment.payer_name}</p>
              </div>
            )}

            {payment.payer_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Teléfono del Pagador</p>
                <p className="font-medium">{payment.payer_phone}</p>
              </div>
            )}
          </div>

          {payment.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notas</p>
                <p className="text-sm">{payment.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Covered Charges Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <p className="font-medium">Cargos Cubiertos</p>
            </div>
            
            {isLoadingCharges ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : coveredCharges.length > 0 ? (
              <div className="space-y-2">
                {coveredCharges.map((charge) => (
                  <div
                    key={charge.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                  >
                    <span className="text-sm">{charge.description}</span>
                    <span className="text-sm font-medium text-green-600">
                      ${charge.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Total aplicado</span>
                  <span className="font-bold text-green-600">
                    ${coveredCharges.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No hay cargos vinculados a este pago
              </p>
            )}
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground">
            Registrado:{' '}
            {format(new Date(payment.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
