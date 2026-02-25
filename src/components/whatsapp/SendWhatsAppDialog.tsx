import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageSquare, Eye } from 'lucide-react';

export type WhatsAppModule = 'payments' | 'mensualidades' | 'services' | 'clients';

export const MODULE_LABELS: Record<WhatsAppModule, string> = {
  payments: 'Pagos',
  mensualidades: 'Mensualidades',
  services: 'Servicios',
  clients: 'Clientes',
};

export interface WhatsAppVariables {
  [key: string]: string;
}

interface WhatsAppTemplate {
  id: string;
  module: string;
  name: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: WhatsAppModule;
  phone: string;
  variables: WhatsAppVariables;
  clientName?: string;
}

function replaceVariables(template: string, variables: WhatsAppVariables): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  });
  return result;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  module,
  phone,
  variables,
  clientName,
}: SendWhatsAppDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editedMessage, setEditedMessage] = useState('');
  const [editedPhone, setEditedPhone] = useState(phone);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp_templates', module],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .select('*')
        .eq('module', module)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: open,
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedTemplateId('');
      setEditedMessage('');
      setEditedPhone(phone);
      setShowPreview(false);
    }
    onOpenChange(isOpen);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const processed = replaceVariables(template.message_template, variables);
      setEditedMessage(processed);
    }
  };

  const remainingVars = useMemo(() => {
    const matches = editedMessage.match(/\{\{(\w+)\}\}/g);
    return matches ? matches.map(m => m.replace(/[{}]/g, '')) : [];
  }, [editedMessage]);

  const handleSend = async () => {
    if (!editedMessage.trim() || !editedPhone.trim()) {
      toast.error('Teléfono y mensaje son requeridos');
      return;
    }

    if (remainingVars.length > 0) {
      toast.error(`Hay variables sin reemplazar: ${remainingVars.join(', ')}`);
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            phone: editedPhone.replace(/\D/g, ''),
            message: editedMessage,
            templateId: selectedTemplateId || null,
            module,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar mensaje');
      }

      toast.success('Mensaje de WhatsApp enviado correctamente');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Enviar mensaje a ${clientName}` : `Módulo: ${MODULE_LABELS[module]}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={editedPhone}
              onChange={(e) => setEditedPhone(e.target.value)}
              placeholder="10 dígitos"
            />
          </div>

          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una plantilla..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensaje</Label>
              {editedMessage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {showPreview ? 'Editar' : 'Preview'}
                </Button>
              )}
            </div>
            {showPreview ? (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap min-h-[120px]">
                {editedMessage}
              </div>
            ) : (
              <Textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                placeholder="Escribe tu mensaje o selecciona una plantilla..."
                rows={5}
              />
            )}
          </div>

          {remainingVars.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-amber-600">Variables pendientes:</span>
              {remainingVars.map((v) => (
                <Badge key={v} variant="outline" className="text-xs">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          )}

          {Object.keys(variables).length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Variables disponibles:</Label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(variables).map(([key, value]) => (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="text-xs cursor-pointer"
                    onClick={() => setEditedMessage(prev => prev + ` {{${key}}}`)}
                    title={value}
                  >
                    {key}: {value.substring(0, 20)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !editedMessage.trim() || !editedPhone.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
