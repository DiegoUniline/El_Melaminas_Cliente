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
import { CreditCard, User, Calendar, FileText } from 'lucide-react';
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
              {payment.payment_type}
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

            {payment.period_month && payment.period_year && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Periodo</p>
                  <p className="font-medium">
                    {payment.period_month}/{payment.period_year}
                  </p>
                </div>
              </div>
            )}

            {payment.bank_type && (
              <div>
                <p className="text-sm text-muted-foreground">Banco</p>
                <p className="font-medium">{payment.bank_type}</p>
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

          <div className="text-xs text-muted-foreground">
            Registrado:{' '}
            {format(new Date(payment.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
