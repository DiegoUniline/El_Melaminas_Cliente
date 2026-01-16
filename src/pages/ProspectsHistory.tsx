import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV } from '@/lib/exportToExcel';
import { translateStatus, formatPhoneDisplay, getCountryInfo } from '@/lib/phoneUtils';
import { Download, Eye, Edit, Trash2, RotateCcw, UserPlus, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { ProspectDetailDialog } from '@/components/prospects/ProspectDetailDialog';
import { EditProspectDialog } from '@/components/prospects/EditProspectDialog';
import { DeleteProspectDialog } from '@/components/prospects/DeleteProspectDialog';
import { ReactivateProspectDialog } from '@/components/prospects/ReactivateProspectDialog';
import { FinalizeProspectDialog } from '@/components/prospects/FinalizeProspectDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Prospect } from '@/types/database';

export default function ProspectsHistory() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  const fetchProspects = async () => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .neq('status', 'pending')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProspects((data as Prospect[]) || []);
    } catch (error) {
      console.error('Error fetching prospects history:', error);
      toast.error('Error al cargar el historial');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const filteredProspects = useMemo(() => {
    if (!search) return prospects;
    const searchLower = search.toLowerCase();
    return prospects.filter(
      (p) =>
        p.first_name.toLowerCase().includes(searchLower) ||
        p.last_name_paterno.toLowerCase().includes(searchLower) ||
        (p.last_name_materno?.toLowerCase().includes(searchLower)) ||
        p.phone1.includes(search) ||
        p.city.toLowerCase().includes(searchLower) ||
        p.neighborhood.toLowerCase().includes(searchLower) ||
        p.status.toLowerCase().includes(searchLower)
    );
  }, [prospects, search]);

  const handleExport = () => {
    // Map data to translate status to Spanish and format phones
    const exportData = filteredProspects.map(p => ({
      ...p,
      status: translateStatus(p.status),
      phone1: `${getCountryInfo((p as any).phone1_country).code} ${p.phone1}`,
      phone2: p.phone2 ? `${getCountryInfo((p as any).phone2_country).code} ${p.phone2}` : '',
      phone3_signer: p.phone3_signer ? `${getCountryInfo((p as any).phone3_country).code} ${p.phone3_signer}` : '',
    }));

    exportToCSV(exportData, 'prospectos_historial', [
      { key: 'first_name', header: 'Nombre' },
      { key: 'last_name_paterno', header: 'Apellido Paterno' },
      { key: 'last_name_materno', header: 'Apellido Materno' },
      { key: 'phone1', header: 'Teléfono 1' },
      { key: 'phone2', header: 'Teléfono 2' },
      { key: 'phone3_signer', header: 'Teléfono Firmante' },
      { key: 'street', header: 'Calle' },
      { key: 'exterior_number', header: 'No. Ext' },
      { key: 'neighborhood', header: 'Colonia' },
      { key: 'city', header: 'Ciudad' },
      { key: 'status', header: 'Estado' },
      { key: 'request_date', header: 'Fecha Solicitud' },
      { key: 'cancellation_reason', header: 'Motivo Cancelación' },
    ]);
    toast.success('Historial exportado correctamente');
  };

  const handleView = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowDetailDialog(true);
  };

  const handleEdit = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowEditDialog(true);
  };

  const handleDelete = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowDeleteDialog(true);
  };

  const handleReactivate = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowReactivateDialog(true);
  };

  const handleFinalize = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowFinalizeDialog(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (p: Prospect) => (
        <span className="font-medium">
          {p.first_name} {p.last_name_paterno} {p.last_name_materno || ''}
        </span>
      ),
    },
    { 
      key: 'phone1', 
      header: 'Teléfono',
      render: (p: Prospect) => (
        <span>{formatPhoneDisplay(p.phone1, (p as any).phone1_country)}</span>
      ),
    },
    {
      key: 'address',
      header: 'Dirección',
      render: (p: Prospect) => (
        <span className="text-sm text-muted-foreground">
          {p.neighborhood}, {p.city}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (p: Prospect) => (
        <Badge variant={p.status === 'finalized' ? 'default' : 'destructive'}>
          {p.status === 'finalized' ? 'FINALIZADO' : 'CANCELADO'}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (p: Prospect) => {
        const date = p.status === 'finalized' ? p.finalized_at : p.cancelled_at;
        return date ? new Date(date).toLocaleDateString('es-MX') : '-';
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (p: Prospect) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => handleView(p)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(p)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {p.status === 'cancelled' && (
              <>
                <DropdownMenuItem onClick={() => handleReactivate(p)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reactivar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFinalize(p)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convertir a Cliente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem 
              onClick={() => handleDelete(p)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AppLayout title="Historial de Prospectos">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Prospectos Finalizados y Cancelados</CardTitle>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, teléfono, ciudad, estado..."
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredProspects}
              isLoading={isLoading}
              emptyMessage="No hay prospectos en el historial"
              onRowClick={handleView}
            />
          </CardContent>
        </Card>
      </div>

      <ProspectDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        prospect={selectedProspect}
      />

      <EditProspectDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        prospect={selectedProspect}
        onSuccess={fetchProspects}
      />

      <DeleteProspectDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        prospect={selectedProspect}
        onSuccess={fetchProspects}
      />

      <ReactivateProspectDialog
        open={showReactivateDialog}
        onOpenChange={setShowReactivateDialog}
        prospect={selectedProspect}
        onSuccess={fetchProspects}
      />

      <FinalizeProspectDialog
        open={showFinalizeDialog}
        onOpenChange={setShowFinalizeDialog}
        prospect={selectedProspect}
        onSuccess={fetchProspects}
      />
    </AppLayout>
  );
}
