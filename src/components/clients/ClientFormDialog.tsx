import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload } from 'lucide-react';
import type { Client, ClientBilling, Equipment } from '@/types/database';

type ClientWithDetails = Client & {
  client_billing: ClientBilling | null;
  equipment: Equipment[];
};

const clientSchema = z.object({
  // Personal
  first_name: z.string().min(2, 'El nombre es requerido'),
  last_name_paterno: z.string().min(2, 'El apellido paterno es requerido'),
  last_name_materno: z.string().optional(),
  phone1: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  phone2: z.string().optional(),
  phone3: z.string().optional(),
  // Address
  street: z.string().min(2, 'La calle es requerida'),
  exterior_number: z.string().min(1, 'El número exterior es requerido'),
  interior_number: z.string().optional(),
  neighborhood: z.string().min(2, 'La colonia es requerida'),
  city: z.string().min(2, 'La ciudad es requerida'),
  postal_code: z.string().optional(),
  // Billing
  monthly_fee: z.number().min(0, 'La mensualidad debe ser mayor a 0'),
  installation_cost: z.number().min(0),
  installation_date: z.string().min(1, 'La fecha de instalación es requerida'),
  first_billing_date: z.string().min(1, 'La fecha de primer cobro es requerida'),
  // Equipment
  router_brand: z.string().optional(),
  router_model: z.string().optional(),
  router_mac: z.string().optional(),
  router_ip: z.string().optional(),
  router_serial: z.string().optional(),
  router_network_name: z.string().optional(),
  router_password: z.string().optional(),
  antenna_brand: z.string().optional(),
  antenna_model: z.string().optional(),
  antenna_mac: z.string().optional(),
  antenna_ip: z.string().optional(),
  antenna_ssid: z.string().optional(),
  installer_name: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  client: ClientWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClientFormDialog({ client, open, onOpenChange, onSuccess }: ClientFormDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [documents, setDocuments] = useState<{
    ine_subscriber_front: File | null;
    ine_subscriber_back: File | null;
    ine_other_front: File | null;
    ine_other_back: File | null;
    contract_page1: File | null;
    contract_page2: File | null;
  }>({
    ine_subscriber_front: null,
    ine_subscriber_back: null,
    ine_other_front: null,
    ine_other_back: null,
    contract_page1: null,
    contract_page2: null,
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      first_name: '',
      last_name_paterno: '',
      last_name_materno: '',
      phone1: '',
      phone2: '',
      phone3: '',
      street: '',
      exterior_number: '',
      interior_number: '',
      neighborhood: '',
      city: '',
      postal_code: '',
      monthly_fee: 0,
      installation_cost: 0,
      installation_date: new Date().toISOString().split('T')[0],
      first_billing_date: new Date().toISOString().split('T')[0],
      router_brand: '',
      router_model: '',
      router_mac: '',
      router_ip: '',
      router_serial: '',
      router_network_name: '',
      router_password: '',
      antenna_brand: '',
      antenna_model: '',
      antenna_mac: '',
      antenna_ip: '',
      antenna_ssid: '',
      installer_name: '',
    },
  });

  useEffect(() => {
    if (client) {
      const equipment = client.equipment?.[0];
      const billing = client.client_billing;
      
      form.reset({
        first_name: client.first_name,
        last_name_paterno: client.last_name_paterno,
        last_name_materno: client.last_name_materno || '',
        phone1: client.phone1,
        phone2: client.phone2 || '',
        phone3: client.phone3 || '',
        street: client.street,
        exterior_number: client.exterior_number,
        interior_number: client.interior_number || '',
        neighborhood: client.neighborhood,
        city: client.city,
        postal_code: client.postal_code || '',
        monthly_fee: billing?.monthly_fee || 0,
        installation_cost: billing?.installation_cost || 0,
        installation_date: billing?.installation_date || new Date().toISOString().split('T')[0],
        first_billing_date: billing?.first_billing_date || new Date().toISOString().split('T')[0],
        router_brand: equipment?.router_brand || '',
        router_model: equipment?.router_model || '',
        router_mac: equipment?.router_mac || '',
        router_ip: equipment?.router_ip || '',
        router_serial: equipment?.router_serial || '',
        router_network_name: equipment?.router_network_name || '',
        router_password: equipment?.router_password || '',
        antenna_brand: equipment?.antenna_brand || '',
        antenna_model: equipment?.antenna_model || '',
        antenna_mac: equipment?.antenna_mac || '',
        antenna_ip: equipment?.antenna_ip || '',
        antenna_ssid: equipment?.antenna_ssid || '',
        installer_name: equipment?.installer_name || '',
      });
    } else {
      form.reset({
        first_name: '',
        last_name_paterno: '',
        last_name_materno: '',
        phone1: '',
        phone2: '',
        phone3: '',
        street: '',
        exterior_number: '',
        interior_number: '',
        neighborhood: '',
        city: '',
        postal_code: '',
        monthly_fee: 0,
        installation_cost: 0,
        installation_date: new Date().toISOString().split('T')[0],
        first_billing_date: new Date().toISOString().split('T')[0],
        router_brand: '',
        router_model: '',
        router_mac: '',
        router_ip: '',
        router_serial: '',
        router_network_name: '',
        router_password: '',
        antenna_brand: '',
        antenna_model: '',
        antenna_mac: '',
        antenna_ip: '',
        antenna_ssid: '',
        installer_name: '',
      });
    }
  }, [client, form]);

  const handleFileChange = (field: keyof typeof documents) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocuments(prev => ({ ...prev, [field]: file }));
    }
  };

  const uploadDocument = async (file: File, clientId: string, docType: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}/${docType}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('client-documents')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading document:', error);
      return null;
    }

    return fileName;
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);

    try {
      let clientId = client?.id;

      if (client) {
        // Update existing client
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            first_name: data.first_name,
            last_name_paterno: data.last_name_paterno,
            last_name_materno: data.last_name_materno || null,
            phone1: data.phone1,
            phone2: data.phone2 || null,
            phone3: data.phone3 || null,
            street: data.street,
            exterior_number: data.exterior_number,
            interior_number: data.interior_number || null,
            neighborhood: data.neighborhood,
            city: data.city,
            postal_code: data.postal_code || null,
          })
          .eq('id', client.id);

        if (clientError) throw clientError;

        // Update billing
        if (client.client_billing) {
          const { error: billingError } = await supabase
            .from('client_billing')
            .update({
              monthly_fee: data.monthly_fee,
              installation_cost: data.installation_cost,
              installation_date: data.installation_date,
              first_billing_date: data.first_billing_date,
            })
            .eq('id', client.client_billing.id);

          if (billingError) throw billingError;
        }

        // Update equipment
        const equipment = client.equipment?.[0];
        if (equipment) {
          const { error: equipmentError } = await supabase
            .from('equipment')
            .update({
              router_brand: data.router_brand || null,
              router_model: data.router_model || null,
              router_mac: data.router_mac || null,
              router_ip: data.router_ip || null,
              router_serial: data.router_serial || null,
              router_network_name: data.router_network_name || null,
              router_password: data.router_password || null,
              antenna_brand: data.antenna_brand || null,
              antenna_model: data.antenna_model || null,
              antenna_mac: data.antenna_mac || null,
              antenna_ip: data.antenna_ip || null,
              antenna_ssid: data.antenna_ssid || null,
              installer_name: data.installer_name || null,
              installation_date: data.installation_date,
            })
            .eq('id', equipment.id);

          if (equipmentError) throw equipmentError;
        }
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            first_name: data.first_name,
            last_name_paterno: data.last_name_paterno,
            last_name_materno: data.last_name_materno || null,
            phone1: data.phone1,
            phone2: data.phone2 || null,
            phone3: data.phone3 || null,
            street: data.street,
            exterior_number: data.exterior_number,
            interior_number: data.interior_number || null,
            neighborhood: data.neighborhood,
            city: data.city,
            postal_code: data.postal_code || null,
            created_by: user?.id,
            status: 'active',
          })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;

        // Create billing
        const { error: billingError } = await supabase
          .from('client_billing')
          .insert({
            client_id: clientId,
            monthly_fee: data.monthly_fee,
            installation_cost: data.installation_cost,
            installation_date: data.installation_date,
            first_billing_date: data.first_billing_date,
            balance: 0,
          });

        if (billingError) throw billingError;

        // Create equipment
        const { error: equipmentError } = await supabase
          .from('equipment')
          .insert({
            client_id: clientId,
            router_brand: data.router_brand || null,
            router_model: data.router_model || null,
            router_mac: data.router_mac || null,
            router_ip: data.router_ip || null,
            router_serial: data.router_serial || null,
            router_network_name: data.router_network_name || null,
            router_password: data.router_password || null,
            antenna_brand: data.antenna_brand || null,
            antenna_model: data.antenna_model || null,
            antenna_mac: data.antenna_mac || null,
            antenna_ip: data.antenna_ip || null,
            antenna_ssid: data.antenna_ssid || null,
            installer_name: data.installer_name || null,
            installation_date: data.installation_date,
          });

        if (equipmentError) throw equipmentError;
      }

      // Upload documents
      if (clientId) {
        const docUpdates: Record<string, string | null> = {};
        
        for (const [key, file] of Object.entries(documents)) {
          if (file) {
            const path = await uploadDocument(file, clientId, key);
            if (path) {
              docUpdates[key] = path;
            }
          }
        }

        if (Object.keys(docUpdates).length > 0) {
          const { error } = await supabase
            .from('clients')
            .update(docUpdates)
            .eq('id', clientId);

          if (error) throw error;
        }
      }

      toast.success(client ? 'Cliente actualizado' : 'Cliente creado');
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al guardar el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="billing">Facturación</TabsTrigger>
                <TabsTrigger value="equipment">Equipo</TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name_paterno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido Paterno *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name_materno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido Materno</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="phone1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono 1 *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono 2</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono 3</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Calle *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="exterior_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Ext. *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interior_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Int.</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colonia *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Postal</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="billing" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthly_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensualidad *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="installation_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo de Instalación</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="installation_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Instalación *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="first_billing_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primera Fecha de Cobro *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Router</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="router_brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="router_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="router_mac"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MAC</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="router_ip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="router_serial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="router_network_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de Red WiFi</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="router_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña WiFi</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Antena</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="antenna_brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="antenna_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="antenna_mac"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MAC</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="antenna_ip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="antenna_ssid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SSID</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="installer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Instalador</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">INE Suscriptor</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.ine_subscriber_front?.name || 'INE Frente'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange('ine_subscriber_front')}
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.ine_subscriber_back?.name || 'INE Reverso'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange('ine_subscriber_back')}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">INE Otro</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.ine_other_front?.name || 'INE Frente'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange('ine_other_front')}
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.ine_other_back?.name || 'INE Reverso'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange('ine_other_back')}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 col-span-2">
                    <h4 className="font-semibold">Contrato</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.contract_page1?.name || 'Contrato Página 1'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={handleFileChange('contract_page1')}
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {documents.contract_page2?.name || 'Contrato Página 2'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={handleFileChange('contract_page2')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {client ? 'Actualizar' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
