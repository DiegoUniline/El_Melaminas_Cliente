import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { ClientDetailDialog } from '@/components/clients/ClientDetailDialog';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { CancelClientDialog } from '@/components/clients/CancelClientDialog';
import { PaymentFormDialog } from '@/components/payments/PaymentFormDialog';
import { exportToExcel } from '@/lib/exportToExcel';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Download, Eye, Edit, CreditCard, XCircle, Users } from 'lucide-react';
import type { Client, ClientBilling, Equipment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

export default function Clients() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithDetails | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithDetails | null>(null);

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['clients', 'active'],
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
      return data as ClientWithDetails[];
    },
  });

  const filteredClients = clients.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(searchLower) ||
      client.last_name_paterno.toLowerCase().includes(searchLower) ||
      (client.last_name_materno?.toLowerCase().includes(searchLower) ?? false) ||
      client.phone1.includes(search) ||
      client.neighborhood.toLowerCase().includes(searchLower) ||
      client.city.toLowerCase().includes(searchLower)
    );
  });

  const handleExport = () => {
    const exportData = filteredClients.map((client) => ({
      'Nombre': `${client.first_name} ${client.last_name_paterno} ${client.last_name_materno || ''}`.trim(),
      'Teléfono 1': client.phone1,
      'Teléfono 2': client.phone2 || '',
      'Dirección': `${client.street} ${client.exterior_number}${client.interior_number ? ' Int. ' + client.interior_number : ''}, ${client.neighborhood}, ${client.city}`,
      'Mensualidad': client.client_billing?.monthly_fee || 0,
      'Saldo': client.client_billing?.balance || 0,
      'Fecha Instalación': client.client_billing?.installation_date || '',
    }));
    exportToExcel(exportData, 'clientes-activos');
  };

  const handleView = (client: ClientWithDetails) => {
    setSelectedClient(client);
    setShowDetailDialog(true);
  };

  const handleEdit = (client: ClientWithDetails) => {
    setEditingClient(client);
    setShowFormDialog(true);
  };

  const handleCancel = (client: ClientWithDetails) => {
    setSelectedClient(client);
    setShowCancelDialog(true);
  };

  const handlePayment = (client: ClientWithDetails) => {
    setSelectedClient(client);
    setShowPaymentDialog(true);
  };

  const handleNewClient = () => {
    setEditingClient(null);
    setShowFormDialog(true);
  };

  const columns = [
    {
      header: 'Cliente',
      accessor: (client: ClientWithDetails) => (
        <div>
          <p className="font-medium">
            {client.first_name} {client.last_name_paterno} {client.last_name_materno || ''}
          </p>
          <p className="text-sm text-muted-foreground">{client.phone1}</p>
        </div>
      ),
    },
    {
      header: 'Dirección',
      accessor: (client: ClientWithDetails) => (
        <div className="max-w-xs">
          <p className="text-sm truncate">
            {client.street} {client.exterior_number}
            {client.interior_number && ` Int. ${client.interior_number}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {client.neighborhood}, {client.city}
          </p>
        </div>
      ),
    },
    {
      header: 'Mensualidad',
      accessor: (client: ClientWithDetails) => (
        <span className="font-medium">
          ${client.client_billing?.monthly_fee?.toLocaleString() || '0'}
        </span>
      ),
    },
    {
      header: 'Saldo',
      accessor: (client: ClientWithDetails) => {
        const balance = client.client_billing?.balance || 0;
        return (
          <Badge variant={balance > 0 ? 'destructive' : 'secondary'}>
            ${balance.toLocaleString()}
          </Badge>
        );
      },
    },
    {
      header: 'Acciones',
      accessor: (client: ClientWithDetails) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleView(client)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(client)} title="Editar">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handlePayment(client)} title="Registrar pago">
                <CreditCard className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCancel(client)} title="Cancelar servicio">
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes Activos</h1>
            <p className="text-muted-foreground">Gestión de clientes con servicio activo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            {isAdmin && (
              <Button onClick={handleNewClient}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cliente
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Clientes ({filteredClients.length})
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
              emptyMessage="No hay clientes activos"
            />
          </CardContent>
        </Card>
      </div>

      <ClientDetailDialog
        client={selectedClient}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />

      <ClientFormDialog
        client={editingClient}
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={() => {
          refetch();
          setShowFormDialog(false);
        }}
      />

      <CancelClientDialog
        client={selectedClient}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onSuccess={() => {
          refetch();
          setShowCancelDialog(false);
        }}
      />

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
