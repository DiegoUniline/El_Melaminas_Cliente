import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, MapPin, Phone, FileText, Wifi, CreditCard, Image, Download } from 'lucide-react';
import type { Client, ClientBilling, Equipment, Payment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

interface ClientDetailDialogProps {
  client: ClientWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
  const [selectedTab, setSelectedTab] = useState('info');

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!client?.id && open,
  });

  if (!client) return null;

  const billing = client.client_billing;
  const equipment = client.equipment?.[0];

  const getDocumentUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from('client-documents').createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const handleDownloadDocument = async (path: string | null, filename: string) => {
    if (!path) return;
    const url = await getDocumentUrl(path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {client.first_name} {client.last_name_paterno} {client.last_name_materno || ''}
            </DialogTitle>
            <Badge variant={client.status === 'active' ? 'default' : 'destructive'}>
              {client.status === 'active' ? 'Activo' : 'Cancelado'}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="billing">Facturación</TabsTrigger>
            <TabsTrigger value="equipment">Equipo</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre Completo</p>
                  <p className="font-medium">
                    {client.first_name} {client.last_name_paterno} {client.last_name_materno || ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Alta</p>
                  <p className="font-medium">
                    {format(new Date(client.created_at), 'dd MMMM yyyy', { locale: es })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="h-5 w-5" />
                  Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono 1</p>
                  <p className="font-medium">{client.phone1}</p>
                </div>
                {client.phone2 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono 2</p>
                    <p className="font-medium">{client.phone2}</p>
                  </div>
                )}
                {client.phone3 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono 3</p>
                    <p className="font-medium">{client.phone3}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Dirección
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Calle y Número</p>
                  <p className="font-medium">
                    {client.street} {client.exterior_number}
                    {client.interior_number && ` Int. ${client.interior_number}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Colonia</p>
                  <p className="font-medium">{client.neighborhood}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ciudad</p>
                  <p className="font-medium">{client.city}</p>
                </div>
                {client.postal_code && (
                  <div>
                    <p className="text-sm text-muted-foreground">Código Postal</p>
                    <p className="font-medium">{client.postal_code}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Información de Facturación
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mensualidad</p>
                  <p className="text-2xl font-bold text-primary">
                    ${billing?.monthly_fee?.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Actual</p>
                  <p className={`text-2xl font-bold ${(billing?.balance || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    ${billing?.balance?.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Costo de Instalación</p>
                  <p className="font-medium">${billing?.installation_cost?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Instalación</p>
                  <p className="font-medium">
                    {billing?.installation_date
                      ? format(new Date(billing.installation_date), 'dd MMMM yyyy', { locale: es })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primera Fecha de Cobro</p>
                  <p className="font-medium">
                    {billing?.first_billing_date
                      ? format(new Date(billing.first_billing_date), 'dd MMMM yyyy', { locale: es })
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wifi className="h-5 w-5" />
                  Equipo Instalado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {equipment ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Router</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Marca</p>
                          <p>{equipment.router_brand || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Modelo</p>
                          <p>{equipment.router_model || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">MAC</p>
                          <p className="font-mono text-xs">{equipment.router_mac || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">IP</p>
                          <p className="font-mono text-xs">{equipment.router_ip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Red WiFi</p>
                          <p>{equipment.router_network_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Contraseña WiFi</p>
                          <p className="font-mono text-xs">{equipment.router_password || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Antena</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Marca</p>
                          <p>{equipment.antenna_brand || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Modelo</p>
                          <p>{equipment.antenna_model || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">MAC</p>
                          <p className="font-mono text-xs">{equipment.antenna_mac || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">IP</p>
                          <p className="font-mono text-xs">{equipment.antenna_ip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">SSID</p>
                          <p>{equipment.antenna_ssid || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Fecha de Instalación</p>
                          <p>
                            {equipment.installation_date
                              ? format(new Date(equipment.installation_date), 'dd MMMM yyyy', { locale: es })
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Instalador</p>
                          <p>{equipment.installer_name || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No hay información de equipo registrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Historial de Pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            ${payment.amount.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: es })}
                            {payment.period_month && payment.period_year && (
                              <span> • {payment.period_month}/{payment.period_year}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{payment.payment_type}</Badge>
                          {payment.receipt_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Recibo: {payment.receipt_number}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No hay pagos registrados
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Documentos del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">INE Suscriptor</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.ine_subscriber_front}
                        onClick={() => handleDownloadDocument(client.ine_subscriber_front, 'INE-Frente')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Frente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.ine_subscriber_back}
                        onClick={() => handleDownloadDocument(client.ine_subscriber_back, 'INE-Reverso')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Reverso
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">INE Otro</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.ine_other_front}
                        onClick={() => handleDownloadDocument(client.ine_other_front, 'INE-Otro-Frente')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Frente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.ine_other_back}
                        onClick={() => handleDownloadDocument(client.ine_other_back, 'INE-Otro-Reverso')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Reverso
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <h4 className="font-semibold">Contrato</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.contract_page1}
                        onClick={() => handleDownloadDocument(client.contract_page1, 'Contrato-Pag1')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Página 1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!client.contract_page2}
                        onClick={() => handleDownloadDocument(client.contract_page2, 'Contrato-Pag2')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Página 2
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
