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
import { exportToExcel } from '@/lib/exportToExcel';
import { Download, Eye, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client, ClientBilling, Equipment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

export default function ClientsHistory() {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithDetails | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', 'cancelled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_billing (*),
          equipment (*)
        `)
        .eq('status', 'cancelled')
        .order('cancelled_at', { ascending: false });

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
      client.neighborhood.toLowerCase().includes(searchLower)
    );
  });

  const handleExport = () => {
    const exportData = filteredClients.map((client) => ({
      'Nombre': `${client.first_name} ${client.last_name_paterno} ${client.last_name_materno || ''}`.trim(),
      'Teléfono': client.phone1,
      'Dirección': `${client.street} ${client.exterior_number}, ${client.neighborhood}, ${client.city}`,
      'Fecha Cancelación': client.cancelled_at ? format(new Date(client.cancelled_at), 'dd/MM/yyyy', { locale: es }) : '',
      'Motivo': client.cancellation_reason || '',
    }));
    exportToExcel(exportData, 'clientes-cancelados');
  };

  const handleView = (client: ClientWithDetails) => {
    setSelectedClient(client);
    setShowDetailDialog(true);
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
          </p>
          <p className="text-sm text-muted-foreground">
            {client.neighborhood}, {client.city}
          </p>
        </div>
      ),
    },
    {
      header: 'Fecha Cancelación',
      accessor: (client: ClientWithDetails) => (
        <span className="text-sm">
          {client.cancelled_at
            ? format(new Date(client.cancelled_at), 'dd MMM yyyy', { locale: es })
            : '-'}
        </span>
      ),
    },
    {
      header: 'Motivo',
      accessor: (client: ClientWithDetails) => (
        <p className="text-sm max-w-xs truncate" title={client.cancellation_reason || ''}>
          {client.cancellation_reason || '-'}
        </p>
      ),
    },
    {
      header: 'Estado',
      accessor: () => <Badge variant="destructive">Cancelado</Badge>,
    },
    {
      header: 'Acciones',
      accessor: (client: ClientWithDetails) => (
        <Button variant="ghost" size="icon" onClick={() => handleView(client)} title="Ver detalles">
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
            <h1 className="text-3xl font-bold tracking-tight">Clientes Cancelados</h1>
            <p className="text-muted-foreground">Historial de clientes con servicio cancelado</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Historial ({filteredClients.length})
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
              emptyMessage="No hay clientes cancelados"
            />
          </CardContent>
        </Card>
      </div>

      <ClientDetailDialog
        client={selectedClient}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </AppLayout>
  );
}
