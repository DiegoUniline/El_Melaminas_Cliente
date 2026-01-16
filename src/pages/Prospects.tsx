import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV } from '@/lib/exportToExcel';
import { Plus, Download, Eye, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProspectFormDialog } from '@/components/prospects/ProspectFormDialog';
import { ProspectDetailDialog } from '@/components/prospects/ProspectDetailDialog';
import { FinalizeProspectDialog } from '@/components/prospects/FinalizeProspectDialog';
import { CancelProspectDialog } from '@/components/prospects/CancelProspectDialog';
import type { Prospect } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

export default function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const fetchProspects = async () => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProspects((data as Prospect[]) || []);
    } catch (error) {
      console.error('Error fetching prospects:', error);
      toast.error('Error al cargar los prospectos');
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
        p.neighborhood.toLowerCase().includes(searchLower)
    );
  }, [prospects, search]);

  const handleExport = () => {
    exportToCSV(filteredProspects, 'prospectos_pendientes', [
      { key: 'first_name', header: 'Nombre' },
      { key: 'last_name_paterno', header: 'Apellido Paterno' },
      { key: 'last_name_materno', header: 'Apellido Materno' },
      { key: 'phone1', header: 'Teléfono 1' },
      { key: 'phone2', header: 'Teléfono 2' },
      { key: 'phone3_signer', header: 'Teléfono Firmante' },
      { key: 'street', header: 'Calle' },
      { key: 'exterior_number', header: 'No. Ext' },
      { key: 'interior_number', header: 'No. Int' },
      { key: 'neighborhood', header: 'Colonia' },
      { key: 'city', header: 'Ciudad' },
      { key: 'postal_code', header: 'C.P.' },
      { key: 'work_type', header: 'Tipo de Trabajo' },
      { key: 'request_date', header: 'Fecha Solicitud' },
      { key: 'assigned_date', header: 'Fecha Asignada' },
      { key: 'ssid', header: 'SSID' },
      { key: 'antenna_ip', header: 'IP Antena' },
      { key: 'notes', header: 'Notas' },
    ]);
    toast.success('Prospectos exportados correctamente');
  };

  const handleView = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowDetailDialog(true);
  };

  const handleFinalize = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowFinalizeDialog(true);
  };

  const handleCancel = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setShowCancelDialog(true);
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
    { key: 'phone1', header: 'Teléfono' },
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
      key: 'request_date',
      header: 'Fecha Solicitud',
      render: (p: Prospect) => new Date(p.request_date).toLocaleDateString('es-MX'),
    },
    {
      key: 'assigned_date',
      header: 'Fecha Asignada',
      render: (p: Prospect) =>
        p.assigned_date ? new Date(p.assigned_date).toLocaleDateString('es-MX') : '-',
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (p: Prospect) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleView(p);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-success hover:text-success"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFinalize(p);
                }}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel(p);
                }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Prospectos">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Prospectos Pendientes</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button onClick={() => setShowFormDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Prospecto
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, teléfono, ciudad, colonia..."
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredProspects}
              isLoading={isLoading}
              emptyMessage="No hay prospectos pendientes"
              onRowClick={handleView}
            />
          </CardContent>
        </Card>
      </div>

      <ProspectFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={fetchProspects}
      />

      <ProspectDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        prospect={selectedProspect}
      />

      <FinalizeProspectDialog
        open={showFinalizeDialog}
        onOpenChange={setShowFinalizeDialog}
        prospect={selectedProspect}
        onSuccess={() => {
          fetchProspects();
          navigate('/clients');
        }}
      />

      <CancelProspectDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        prospect={selectedProspect}
        onSuccess={fetchProspects}
      />
    </AppLayout>
  );
}