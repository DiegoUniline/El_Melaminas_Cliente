import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MessageSquare, Plus, Edit, Trash2, Save, Loader2, Eye, EyeOff, Settings } from 'lucide-react';
import { MODULE_LABELS, WhatsAppModule } from './SendWhatsAppDialog';

const ALL_MODULES: WhatsAppModule[] = ['payments', 'mensualidades', 'services', 'clients'];

const MODULE_VARIABLES: Record<WhatsAppModule, string[]> = {
  payments: ['nombre_cliente', 'monto', 'recibo', 'fecha_pago', 'tipo_pago', 'banco', 'saldo_pendiente', 'fecha_corte'],
  mensualidades: ['nombre_cliente', 'monto_mensualidad', 'mes_periodo', 'dia_corte', 'saldo_pendiente', 'dias_vencido'],
  services: ['nombre_cliente', 'tipo_servicio', 'fecha_visita', 'hora_visita', 'tecnico', 'trabajo_realizado', 'descripcion'],
  clients: ['nombre_cliente', 'plan', 'velocidad', 'dia_corte', 'telefono', 'direccion', 'mensaje_personalizado'],
};

interface WhatsAppSettings {
  id: string;
  api_token: string;
  api_url: string;
  is_active: boolean;
}

interface WhatsAppTemplate {
  id: string;
  module: string;
  name: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

interface TemplateForm {
  module: WhatsAppModule;
  name: string;
  message_template: string;
}

export function WhatsAppSettingsPanel() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [showToken, setShowToken] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    module: 'payments',
    name: '',
    message_template: '',
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [filterModule, setFilterModule] = useState<string>('all');

  const { data: settings } = useQuery({
    queryKey: ['whatsapp_settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as WhatsAppSettings;
    },
    enabled: isAdmin,
  });

  if (settings && !settingsLoaded) {
    setApiToken(settings.api_token || '');
    setApiUrl(settings.api_url || '');
    setSettingsLoaded(true);
  }

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['whatsapp_templates_all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .select('*')
        .order('module')
        .order('name');
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const filteredTemplates = filterModule === 'all'
    ? templates
    : templates.filter(t => t.module === filterModule);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const { error } = await (supabase as any)
        .from('whatsapp_settings')
        .update({ api_token: apiToken, api_url: apiUrl })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Configuración de WhatsApp guardada');
      queryClient.invalidateQueries({ queryKey: ['whatsapp_settings'] });
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ module: 'payments', name: '', message_template: '' });
    setShowTemplateDialog(true);
  };

  const handleEditTemplate = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      module: template.module as WhatsAppModule,
      name: template.name,
      message_template: template.message_template,
    });
    setShowTemplateDialog(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('whatsapp_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Plantilla eliminada');
      refetchTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.message_template) {
      toast.error('Nombre y mensaje son requeridos');
      return;
    }
    setIsSavingTemplate(true);
    try {
      if (editingTemplate) {
        const { error } = await (supabase as any)
          .from('whatsapp_templates')
          .update({
            module: templateForm.module,
            name: templateForm.name,
            message_template: templateForm.message_template,
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('Plantilla actualizada');
      } else {
        const { error } = await (supabase as any).from('whatsapp_templates').insert({
          module: templateForm.module,
          name: templateForm.name,
          message_template: templateForm.message_template,
        });
        if (error) throw error;
        toast.success('Plantilla creada');
      }
      refetchTemplates();
      setShowTemplateDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar plantilla');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleToggleActive = async (template: WhatsAppTemplate) => {
    try {
      const { error } = await (supabase as any)
        .from('whatsapp_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);
      if (error) throw error;
      refetchTemplates();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración WhatsAPI
          </CardTitle>
          <CardDescription>
            Configura la conexión con WhatsAPI para enviar mensajes de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Token</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Tu API Token de WhatsAPI"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL de API</Label>
            <Input
              value={apiUrl}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
            {isSavingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Configuración
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Plantillas de Mensajes
              </CardTitle>
              <CardDescription>
                Administra las plantillas de WhatsApp para cada módulo
              </CardDescription>
            </div>
            <Button onClick={handleNewTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Plantilla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los módulos</SelectItem>
                {ALL_MODULES.map(m => (
                  <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {MODULE_LABELS[template.module as WhatsAppModule] || template.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                      {template.message_template}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => handleToggleActive(template)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay plantillas configuradas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </DialogTitle>
            <DialogDescription>
              Usa variables con doble llave, ej: {'{{nombre_cliente}}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={templateForm.module}
                onValueChange={(v) => setTemplateForm(prev => ({ ...prev, module: v as WhatsAppModule }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_MODULES.map(m => (
                    <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Confirmación de Pago"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={templateForm.message_template}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, message_template: e.target.value }))}
                placeholder="Hola {{nombre_cliente}}, tu pago de {{monto}} fue recibido..."
                rows={5}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Variables disponibles:</Label>
              <div className="flex flex-wrap gap-1">
                {MODULE_VARIABLES[templateForm.module].map(v => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setTemplateForm(prev => ({
                      ...prev,
                      message_template: prev.message_template + `{{${v}}}`,
                    }))}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
