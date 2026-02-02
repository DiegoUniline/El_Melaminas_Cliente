import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog';
import { exportToExcel } from '@/lib/exportToExcel';
import { useAuth } from '@/hooks/useAuth';
import { Download, CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import type { Client, ClientBilling, Equipment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

export default function ClientDebt() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['clients', 'with-debt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_billing (*),
          equipment (*)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter clients with positive balance (debt)
      return (data as ClientWithDetails[]).filter(
        (client) => (client.client_billing?.balance || 0) > 0
      );
    },
  });

  const totalDebt = clients.reduce(
    (sum, client) => sum + (client.client_billing?.balance || 0),
    0
  );

  const filteredClients = clients.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(searchLower) ||
      client.last_name_paterno.toLowerCase().includes(searchLower) ||
      client.phone1.includes(search) ||
      client.neighborhood.toLowerCase().includes(searchLower)
    );
  });

  const handleExport = () => {
    const exportData = filteredClients.map((client) => ({
      'Nombre': `${client.first_name} ${client.last_name_paterno} ${client.last_name_materno || ''}`.trim(),
      'Teléfono 1': client.phone1,
      'Teléfono 2': client.phone2 || '',
      'Dirección': `${client.street} ${client.exterior_number}, ${client.neighborhood}, ${client.city}`,
      'Mensualidad': client.client_billing?.monthly_fee || 0,
      'Saldo Deudor': client.client_billing?.balance || 0,
    }));
    exportToExcel(exportData, 'clientes-con-adeudo');
  };

  const handlePayment = (client: ClientWithDetails) => {
    setSelectedClient(client);
    setShowPaymentDialog(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Cliente',
      render: (client: ClientWithDetails) => (
        <div>
          <p className="font-medium">
            {client.first_name} {client.last_name_paterno} {client.last_name_materno || ''}
          </p>
          <p className="text-sm text-muted-foreground">{client.phone1}</p>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Dirección',
      render: (client: ClientWithDetails) => (
        <div className="max-w-xs">
          <p className="text-sm truncate">
            {client.street} {client.exterior_number}
          </p>
          <p className="text-sm text-muted-foreground">
            {client.neighborhood}, {client.city}
          </p>
        </div>
      ),
    },
    {
      key: 'monthly_fee',
      header: 'Mensualidad',
      render: (client: ClientWithDetails) => (
        <span className="font-medium">
          {formatCurrency(client.client_billing?.monthly_fee || 0)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Saldo Deudor',
      render: (client: ClientWithDetails) => (
        <Badge variant="destructive" className="text-base">
          {formatCurrency(client.client_billing?.balance || 0)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (client: ClientWithDetails) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePayment(client)}
          disabled={!isAdmin}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Registrar Pago
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes con Adeudo</h1>
            <p className="text-muted-foreground">Clientes con saldo pendiente de pago</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Adeudo</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {formatCurrency(totalDebt)}
              </div>
              <p className="text-xs text-muted-foreground">suma de todos los adeudos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes con Adeudo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">clientes pendientes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Lista de Adeudos ({filteredClients.length})
              </CardTitle>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, teléfono, colonia..."
              />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredClients}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No hay clientes con adeudo"
            />
          </CardContent>
        </Card>
      </div>

      <PaymentFormDialog
        client={selectedClient}
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        onSuccess={() => {
          refetch();
          setShowPaymentDialog(false);
        }}
      />
    </AppLayout>
  );
}
