import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { PaymentDetailDialog } from '@/components/payments/PaymentDetailDialog';
import { exportToExcel } from '@/lib/exportToExcel';
import { Download, Eye, CreditCard, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/billing';
import type { Payment, Client } from '@/types/database';

type PaymentWithClient = Payment & {
  clients: Pick<Client, 'id' | 'first_name' | 'last_name_paterno' | 'last_name_materno'>;
};

export default function Payments() {
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithClient | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          clients (id, first_name, last_name_paterno, last_name_materno)
        `)
        .order('payment_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as PaymentWithClient[];
    },
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

  // Calculate stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthlyPayments = payments.filter((p) => {
    const date = new Date(p.payment_date);
    return date >= monthStart && date <= monthEnd;
  });

  const totalMonthly = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
  const avgPayment = monthlyPayments.length > 0 ? totalMonthly / monthlyPayments.length : 0;

  const filteredPayments = payments.filter((payment) => {
    const searchLower = search.toLowerCase();
    const clientName = `${payment.clients?.first_name} ${payment.clients?.last_name_paterno}`.toLowerCase();
    return (
      clientName.includes(searchLower) ||
      payment.receipt_number?.includes(search) ||
      payment.payment_type.toLowerCase().includes(searchLower)
    );
  });

  const handleExport = () => {
    const exportData = filteredPayments.map((payment) => ({
      'Fecha': format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: es }),
      'Cliente': `${payment.clients?.first_name} ${payment.clients?.last_name_paterno}`,
      'Monto': payment.amount,
      'Tipo': payment.payment_type,
      'Banco': payment.bank_type || '',
      'Recibo': payment.receipt_number || '',
      'Notas': payment.notes || '',
    }));
    exportToExcel(exportData, 'pagos');
  };

  const handleView = (payment: PaymentWithClient) => {
    setSelectedPayment(payment);
    setShowDetailDialog(true);
  };

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      render: (payment: PaymentWithClient) => (
        <span className="text-sm">
          {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: es })}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (payment: PaymentWithClient) => (
        <p className="font-medium">
          {payment.clients?.first_name} {payment.clients?.last_name_paterno}
        </p>
      ),
    },
    {
      key: 'amount',
      header: 'Monto',
      render: (payment: PaymentWithClient) => (
        <span className="font-bold text-green-600">
          {formatCurrency(payment.amount)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (payment: PaymentWithClient) => (
        <div>
          <Badge variant="outline">{getPaymentMethodName(payment.payment_type)}</Badge>
          {payment.bank_type && (
            <p className="text-xs text-muted-foreground mt-1">{getBankName(payment.bank_type)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'receipt',
      header: 'Recibo',
      render: (payment: PaymentWithClient) => (
        <span className="text-sm font-mono">{payment.receipt_number || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (payment: PaymentWithClient) => (
        <Button variant="ghost" size="icon" onClick={() => handleView(payment)} title="Ver detalles">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
            <p className="text-muted-foreground">Historial de todos los pagos registrados</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalMonthly)}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(now, 'MMMM yyyy', { locale: es })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagos del Mes</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyPayments.length}</div>
              <p className="text-xs text-muted-foreground">transacciones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio por Pago</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgPayment.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">este mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Histórico</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.length}</div>
              <p className="text-xs text-muted-foreground">pagos registrados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Historial de Pagos ({filteredPayments.length})
              </CardTitle>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por cliente, recibo, tipo..."
              />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredPayments}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No hay pagos registrados"
            />
          </CardContent>
        </Card>
      </div>

      <PaymentDetailDialog
        payment={selectedPayment}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </AppLayout>
  );
}
