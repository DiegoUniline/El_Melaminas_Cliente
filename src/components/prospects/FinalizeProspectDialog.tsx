import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, History, DollarSign, Calculator } from 'lucide-react';
import type { Prospect } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PhoneCountry, formatPhoneNumber } from '@/lib/phoneUtils';
import { formatCurrency, calculateProration } from '@/lib/billing';

const finalizeSchema = z.object({
  // Personal data
  first_name: z.string().min(1, 'El nombre es requerido'),
  last_name_paterno: z.string().min(1, 'El apellido paterno es requerido'),
  last_name_materno: z.string().optional(),
  phone1: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  phone1_country: z.string().default('MX'),
  phone2: z.string().optional(),
  phone2_country: z.string().default('MX'),
  phone3_signer: z.string().optional(),
  phone3_country: z.string().default('MX'),
  // Address
  street: z.string().min(1, 'La calle es requerida'),
  exterior_number: z.string().min(1, 'El número exterior es requerido'),
  interior_number: z.string().optional(),
  neighborhood: z.string().min(1, 'La colonia es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  postal_code: z.string().optional(),
  // Technical
  ssid: z.string().optional(),
  antenna_ip: z.string().optional(),
  notes: z.string().optional(),
  // Billing
  plan_id: z.string().optional(),
  monthly_fee: z.number().min(0, 'La mensualidad debe ser mayor o igual a 0'),
  installation_date: z.string().min(1, 'La fecha de instalación es requerida'),
  billing_day: z.number().min(1).max(28, 'El día de corte debe ser entre 1 y 28'),
  installation_cost: z.number().min(0),
  prorated_amount: z.number().min(0),
  additional_charges: z.number().min(0).optional(),
  additional_charges_notes: z.string().optional(),
});

type FinalizeFormValues = z.infer<typeof finalizeSchema>;

interface FinalizeProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

export function FinalizeProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: FinalizeProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const { user } = useAuth();

  // Fetch service plans
  const { data: servicePlans = [] } = useQuery({
    queryKey: ['service_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_fee');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FinalizeFormValues>({
    resolver: zodResolver(finalizeSchema),
    defaultValues: {
      first_name: '',
      last_name_paterno: '',
      last_name_materno: '',
      phone1: '',
      phone1_country: 'MX',
      phone2: '',
      phone2_country: 'MX',
      phone3_signer: '',
      phone3_country: 'MX',
      street: '',
      exterior_number: '',
      interior_number: '',
      neighborhood: '',
      city: '',
      postal_code: '',
      ssid: '',
      antenna_ip: '',
      notes: '',
      plan_id: '',
      monthly_fee: 0,
      installation_date: new Date().toISOString().split('T')[0],
      billing_day: 10,
      installation_cost: 0,
      prorated_amount: 0,
      additional_charges: undefined,
      additional_charges_notes: '',
    },
  });

  // Load prospect data when dialog opens
  useEffect(() => {
    if (prospect && open) {
      form.reset({
        first_name: prospect.first_name || '',
        last_name_paterno: prospect.last_name_paterno || '',
        last_name_materno: prospect.last_name_materno || '',
        phone1: prospect.phone1 || '',
        phone1_country: (prospect as any).phone1_country || 'MX',
        phone2: prospect.phone2 || '',
        phone2_country: (prospect as any).phone2_country || 'MX',
        phone3_signer: prospect.phone3_signer || '',
        phone3_country: (prospect as any).phone3_country || 'MX',
        street: prospect.street || '',
        exterior_number: prospect.exterior_number || '',
        interior_number: prospect.interior_number || '',
        neighborhood: prospect.neighborhood || '',
        city: prospect.city || '',
        postal_code: prospect.postal_code || '',
        ssid: prospect.ssid || '',
        antenna_ip: prospect.antenna_ip || '',
        notes: prospect.notes || '',
        // Billing defaults
        plan_id: '',
        monthly_fee: 0,
        installation_date: new Date().toISOString().split('T')[0],
        billing_day: 10,
        installation_cost: 0,
        prorated_amount: 0,
        additional_charges: undefined,
        additional_charges_notes: '',
      });
      setActiveTab('personal');
    }
  }, [prospect, open, form]);

  // Handle plan selection
  const handlePlanChange = (planId: string) => {
    form.setValue('plan_id', planId);
    const plan = servicePlans.find(p => p.id === planId);
    if (plan) {
      form.setValue('monthly_fee', plan.monthly_fee);
      calculateProrationAmount();
    }
  };

  // Calculate proration
  const calculateProrationAmount = () => {
    const installDate = form.getValues('installation_date');
    const billingDay = form.getValues('billing_day');
    const monthlyFee = form.getValues('monthly_fee');
    
    if (installDate && billingDay && monthlyFee > 0) {
      const { proratedAmount } = calculateProration(new Date(installDate), billingDay, monthlyFee);
      form.setValue('prorated_amount', proratedAmount);
    }
  };

  if (!prospect) return null;

  // Function to record changes in history
  const recordChanges = async (
    prospectId: string,
    clientId: string,
    originalData: Prospect,
    newData: FinalizeFormValues
  ) => {
    const fieldsToCompare = [
      { key: 'first_name', label: 'Nombre' },
      { key: 'last_name_paterno', label: 'Apellido Paterno' },
      { key: 'last_name_materno', label: 'Apellido Materno' },
      { key: 'phone1', label: 'Teléfono 1' },
      { key: 'phone2', label: 'Teléfono 2' },
      { key: 'phone3_signer', label: 'Teléfono Firmante' },
      { key: 'street', label: 'Calle' },
      { key: 'exterior_number', label: 'Número Exterior' },
      { key: 'interior_number', label: 'Número Interior' },
      { key: 'neighborhood', label: 'Colonia' },
      { key: 'city', label: 'Ciudad' },
      { key: 'postal_code', label: 'Código Postal' },
      { key: 'ssid', label: 'SSID' },
      { key: 'antenna_ip', label: 'IP Antena' },
    ];

    const changes: {
      prospect_id: string;
      client_id: string;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      changed_by: string | null;
    }[] = [];

    for (const field of fieldsToCompare) {
      const oldValue = (originalData as any)[field.key] || '';
      const newValue = (newData as any)[field.key] || '';

      if (oldValue !== newValue) {
        changes.push({
          prospect_id: prospectId,
          client_id: clientId,
          field_name: field.label,
          old_value: oldValue || null,
          new_value: newValue || null,
          changed_by: user?.id || null,
        });
      }
    }

    if (changes.length > 0) {
      const { error } = await supabase
        .from('prospect_change_history')
        .insert(changes);

      if (error) {
        console.error('Error recording changes:', error);
      }
    }

    return changes.length;
  };

  const handleFinalize = async (data: FinalizeFormValues) => {
    setIsLoading(true);
    try {
      // 1. Update prospect with new data and finalize
      const { error: prospectError } = await supabase
        .from('prospects')
        .update({
          first_name: data.first_name,
          last_name_paterno: data.last_name_paterno,
          last_name_materno: data.last_name_materno || null,
          phone1: data.phone1,
          phone1_country: data.phone1_country,
          phone2: data.phone2 || null,
          phone2_country: data.phone2_country,
          phone3_signer: data.phone3_signer || null,
          phone3_country: data.phone3_country,
          street: data.street,
          exterior_number: data.exterior_number,
          interior_number: data.interior_number || null,
          neighborhood: data.neighborhood,
          city: data.city,
          postal_code: data.postal_code || null,
          ssid: data.ssid || null,
          antenna_ip: data.antenna_ip || null,
          notes: data.notes || null,
          status: 'finalized',
          finalized_at: new Date().toISOString(),
        })
        .eq('id', prospect.id);

      if (prospectError) throw prospectError;

      // 2. Create client from updated data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name,
          last_name_paterno: data.last_name_paterno,
          last_name_materno: data.last_name_materno || null,
          phone1: data.phone1,
          phone1_country: data.phone1_country,
          phone2: data.phone2 || null,
          phone2_country: data.phone2_country,
          phone3: data.phone3_signer || null,
          phone3_country: data.phone3_country,
          street: data.street,
          exterior_number: data.exterior_number,
          interior_number: data.interior_number || null,
          neighborhood: data.neighborhood,
          city: data.city,
          postal_code: data.postal_code || null,
          prospect_id: prospect.id,
          created_by: user?.id || null,
          status: 'active',
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 3. Record changes in history
      const changesCount = await recordChanges(prospect.id, clientData.id, prospect, data);

      // 4. Create equipment record
      if (clientData) {
        const { error: equipmentError } = await supabase
          .from('equipment')
          .insert({
            client_id: clientData.id,
            antenna_ssid: data.ssid || null,
            antenna_ip: data.antenna_ip || null,
          });

        if (equipmentError) {
          console.error('Error creating equipment:', equipmentError);
        }

        // 5. Calculate billing values
        const installDate = new Date(data.installation_date);
        const { firstBillingDate } = calculateProration(installDate, data.billing_day, data.monthly_fee);
        
        // Calculate total initial balance
        const totalInitialBalance = 
          (data.installation_cost || 0) + 
          (data.prorated_amount || 0) + 
          (data.additional_charges || 0);

        // Create billing record with real values
        const { error: billingError } = await supabase
          .from('client_billing')
          .insert({
            client_id: clientData.id,
            plan_id: data.plan_id || null,
            monthly_fee: data.monthly_fee,
            installation_cost: data.installation_cost,
            installation_date: data.installation_date,
            first_billing_date: firstBillingDate.toISOString().split('T')[0],
            billing_day: data.billing_day,
            prorated_amount: data.prorated_amount,
            additional_charges: data.additional_charges || 0,
            additional_charges_notes: data.additional_charges_notes || null,
            balance: totalInitialBalance,
          });

        if (billingError) {
          console.error('Error creating billing:', billingError);
        }

        // 6. Create initial charges in client_charges
        const chargesToCreate = [];

        if (data.installation_cost > 0) {
          chargesToCreate.push({
            client_id: clientData.id,
            description: 'Costo de instalación',
            amount: data.installation_cost,
            status: 'pending',
            created_by: user?.id,
          });
        }

        if (data.prorated_amount > 0) {
          chargesToCreate.push({
            client_id: clientData.id,
            description: 'Prorrateo inicial',
            amount: data.prorated_amount,
            status: 'pending',
            created_by: user?.id,
          });
        }

        if (data.additional_charges && data.additional_charges > 0) {
          chargesToCreate.push({
            client_id: clientData.id,
            description: data.additional_charges_notes || 'Cargos adicionales',
            amount: data.additional_charges,
            status: 'pending',
            created_by: user?.id,
          });
        }

        if (chargesToCreate.length > 0) {
          const { error: chargesError } = await supabase
            .from('client_charges')
            .insert(chargesToCreate);

          if (chargesError) {
            console.error('Error creating charges:', chargesError);
          }
        }
      }

      const message = changesCount > 0 
        ? `Prospecto finalizado con ${changesCount} cambio(s) registrado(s) en historial`
        : 'Prospecto finalizado y cliente creado correctamente';
      
      toast.success(message);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error finalizing prospect:', error);
      toast.error('Error al finalizar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Finalizar Prospecto
          </DialogTitle>
          <DialogDescription>
            Revisa y modifica los datos si es necesario. Los cambios se guardarán en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Si modificas algún campo, el valor anterior quedará registrado en el historial para futuras consultas.
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFinalize)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="address">Dirección</TabsTrigger>
                <TabsTrigger value="technical">Técnico</TabsTrigger>
                <TabsTrigger value="billing" className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Facturación
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="phone1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono 1 *</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            country={form.watch('phone1_country') as PhoneCountry}
                            onCountryChange={(c) => form.setValue('phone1_country', c)}
                            placeholder="317-131-5782"
                          />
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
                          <PhoneInput
                            value={field.value || ''}
                            onChange={field.onChange}
                            country={form.watch('phone2_country') as PhoneCountry}
                            onCountryChange={(c) => form.setValue('phone2_country', c)}
                            placeholder="317-131-5782"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone3_signer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono Firmante</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value || ''}
                            onChange={field.onChange}
                            country={form.watch('phone3_country') as PhoneCountry}
                            onCountryChange={(c) => form.setValue('phone3_country', c)}
                            placeholder="317-131-5782"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
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
                        <FormLabel>No. Exterior *</FormLabel>
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
                        <FormLabel>No. Interior</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <TabsContent value="technical" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ssid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Skynet_123" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="antenna_ip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Antena</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="192.168.1.1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Observaciones adicionales..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plan_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan de Servicio</FormLabel>
                        <Select value={field.value} onValueChange={handlePlanChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {servicePlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - {formatCurrency(plan.monthly_fee)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthly_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensualidad *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(e) => {
                              field.onChange(parseFloat(e.target.value) || 0);
                              setTimeout(calculateProrationAmount, 0);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="installation_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Instalación *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setTimeout(calculateProrationAmount, 0);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billing_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Día de Corte *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="28"
                            {...field}
                            onChange={(e) => {
                              field.onChange(parseInt(e.target.value) || 10);
                              setTimeout(calculateProrationAmount, 0);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="installation_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo de Instalación</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prorated_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Prorrateo
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={calculateProrationAmount}
                            title="Calcular prorrateo"
                          >
                            <Calculator className="h-3 w-3" />
                          </Button>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additional_charges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargos Adicionales</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="additional_charges_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas de Cargos Adicionales</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="Describe los cargos adicionales..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Resumen de Cargos Iniciales:</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Instalación:</span>
                      <span className="ml-2 font-medium">{formatCurrency(form.watch('installation_cost') || 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prorrateo:</span>
                      <span className="ml-2 font-medium">{formatCurrency(form.watch('prorated_amount') || 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Adicionales:</span>
                      <span className="ml-2 font-medium">{formatCurrency(form.watch('additional_charges') || 0)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-muted-foreground">Total Saldo Inicial:</span>
                    <span className="ml-2 font-bold text-primary">
                      {formatCurrency(
                        (form.watch('installation_cost') || 0) + 
                        (form.watch('prorated_amount') || 0) + 
                        (form.watch('additional_charges') || 0)
                      )}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  'Finalizar y Crear Cliente'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
