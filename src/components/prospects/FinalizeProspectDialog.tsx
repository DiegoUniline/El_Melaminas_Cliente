import { useState, useEffect, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, History, DollarSign, Calculator, X, FileText, MapPin, Wifi, ClipboardList } from 'lucide-react';
import type { Prospect } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { type PhoneCountry, formatPhoneDisplay, isPhoneComplete } from '@/lib/phoneUtils';
import { isValidIPAddress } from '@/lib/formatUtils';
import { formatCurrency, calculateProration, formatDateMX } from '@/lib/billing';
import { ConfirmFinalizeDialog } from './ConfirmFinalizeDialog';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { useCities } from '@/hooks/useCities';

interface SelectedCharge {
  catalog_id: string;
  name: string;
  amount: number;
}

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
  city_id: z.string().min(1, 'La ciudad es requerida'),
  postal_code: z.string().optional(),
  // Technical
  ssid: z.string().optional(),
  antenna_ip: z.string().optional(),
  notes: z.string().optional(),
  installer_id: z.string().optional(),
  // Billing
  plan_id: z.string().optional(),
  monthly_fee: z.number().min(0, 'La mensualidad debe ser mayor o igual a 0'),
  installation_date: z.string().min(1, 'La fecha de instalación es requerida'),
  billing_day: z.number().min(1).max(28, 'El día de corte debe ser entre 1 y 28'),
  installation_cost: z.number().min(0),
  prorated_amount: z.number().min(0),
});

type FinalizeFormValues = z.infer<typeof finalizeSchema>;

interface FinalizeProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

const TABS = ['personal', 'address', 'technical', 'billing', 'summary'] as const;
type TabValue = typeof TABS[number];

export function FinalizeProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: FinalizeProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('personal');
  const [selectedCharges, setSelectedCharges] = useState<SelectedCharge[]>([]);
  const [selectedChargeId, setSelectedChargeId] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const pendingDataRef = useRef<FinalizeFormValues | null>(null);
  const { user } = useAuth();
  const { activeCities } = useCities();

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

  // Fetch all technicians for installer selection
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch charge catalog
  const { data: chargeCatalog = [] } = useQuery({
    queryKey: ['charge_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_catalog')
        .select('*')
        .eq('is_active', true)
        .order('name');
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
      city_id: '',
      postal_code: '',
      ssid: '',
      antenna_ip: '',
      notes: '',
      plan_id: '',
      monthly_fee: undefined,
      installation_date: new Date().toISOString().split('T')[0],
      billing_day: 10,
      installation_cost: undefined,
      prorated_amount: undefined,
    },
  });

  // Load prospect data when dialog opens
  useEffect(() => {
    if (prospect && open) {
      // Find city_id from prospect.city if it exists
      const cityId = prospect.city ? activeCities.find(c => c.name === prospect.city)?.id || '' : '';
      
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
        city_id: cityId,
        postal_code: prospect.postal_code || '',
        ssid: prospect.ssid || '',
        antenna_ip: prospect.antenna_ip || '',
        notes: prospect.notes || '',
        // Technical - pre-load installer from prospect
        installer_id: prospect.assigned_to || '',
        // Billing defaults
        plan_id: '',
        monthly_fee: undefined,
        installation_date: new Date().toISOString().split('T')[0],
        billing_day: 10,
        installation_cost: undefined,
        prorated_amount: undefined,
      });
      setActiveTab('personal');
      setSelectedCharges([]);
      setSelectedChargeId('');
      setChargeAmount('');
    }
  }, [prospect, open, form, activeCities]);

  // Navigation handlers
  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const currentIndex = TABS.indexOf(activeTab);
    if (currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const currentIndex = TABS.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1]);
    }
  };

  // Charge catalog handlers
  const handleChargeSelect = (catalogId: string) => {
    setSelectedChargeId(catalogId);
    const item = chargeCatalog.find(c => c.id === catalogId);
    if (item) {
      setChargeAmount(item.default_amount.toString());
    }
  };

  const handleAddCharge = () => {
    const item = chargeCatalog.find(c => c.id === selectedChargeId);
    if (item && chargeAmount) {
      setSelectedCharges([...selectedCharges, {
        catalog_id: item.id,
        name: item.name,
        amount: parseFloat(chargeAmount),
      }]);
      setSelectedChargeId('');
      setChargeAmount('');
    }
  };

  const handleRemoveCharge = (index: number) => {
    setSelectedCharges(selectedCharges.filter((_, i) => i !== index));
  };

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

  // Get selected plan name
  const selectedPlanName = servicePlans.find(p => p.id === form.watch('plan_id'))?.name || 'No seleccionado';

  // Calculate totals
  const totalAdditionalCharges = selectedCharges.reduce((sum, c) => sum + c.amount, 0);
  const monthlyFee = form.watch('monthly_fee') || 0;
  const totalInitialBalance = 
    (form.watch('installation_cost') || 0) + 
    (form.watch('prorated_amount') || 0) + 
    monthlyFee + // Primera mensualidad (pago por adelantado)
    totalAdditionalCharges;

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
      { key: 'city_id', label: 'Ciudad' },
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
      let oldValue = (originalData as any)[field.key] || '';
      let newValue = (newData as any)[field.key] || '';

      // For city_id field, convert to city name for display
      if (field.key === 'city_id') {
        oldValue = originalData.city || '';
        newValue = activeCities.find(c => c.id === newValue)?.name || '';
      }

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

  // Handle form submit - show confirmation dialog
  const handleFormSubmit = (data: FinalizeFormValues) => {
    // VALIDACIONES OBLIGATORIAS
    const errors: string[] = [];
    
    if (!isPhoneComplete(data.phone1)) {
      errors.push('Teléfono 1 debe tener 10 dígitos');
    }
    if (data.phone2 && !isPhoneComplete(data.phone2)) {
      errors.push('Teléfono 2 debe tener 10 dígitos');
    }
    if (data.phone3_signer && !isPhoneComplete(data.phone3_signer)) {
      errors.push('Teléfono de quien firmará debe tener 10 dígitos');
    }
    if (data.antenna_ip && !isValidIPAddress(data.antenna_ip)) {
      errors.push('IP Antena no tiene formato válido');
    }
    
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }

    // Store data and show confirmation dialog
    pendingDataRef.current = data;
    setShowConfirmDialog(true);
  };

  // Actual finalization after confirmation
  const handleConfirmedFinalize = async () => {
    const data = pendingDataRef.current;
    if (!data) return;
    
    setIsLoading(true);
    try {
      // 1. Update prospect with new data and finalize
      const selectedCity = activeCities.find(c => c.id === data.city_id);
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
          city: selectedCity?.name || '',
          city_id: data.city_id,
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
          city: selectedCity?.name || '',
          city_id: data.city_id,
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
        // Get installer name from selected installer_id
        const installerName = technicians.find(t => t.user_id === data.installer_id)?.full_name || null;
        
        const { error: equipmentError } = await supabase
          .from('equipment')
          .insert({
            client_id: clientData.id,
            antenna_ssid: data.ssid || null,
            antenna_ip: data.antenna_ip || null,
            installation_date: data.installation_date,
            installer_name: installerName,
          });

        if (equipmentError) {
          console.error('Error creating equipment:', equipmentError);
        }

        // 5. Calculate billing values
        const installDate = new Date(data.installation_date);
        const { firstBillingDate } = calculateProration(installDate, data.billing_day, data.monthly_fee);

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
            additional_charges: totalAdditionalCharges,
            additional_charges_notes: selectedCharges.map(c => c.name).join(', ') || null,
            balance: totalInitialBalance,
          });

        if (billingError) {
          console.error('Error creating billing:', billingError);
        }

        // 6. Create client charges from selected catalog items
        if (selectedCharges.length > 0) {
          const chargeRecords = selectedCharges.map(charge => ({
            client_id: clientData.id,
            charge_catalog_id: charge.catalog_id,
            description: charge.name,
            amount: charge.amount,
            status: 'pending',
            created_by: user?.id || null,
          }));

          const { error: chargesError } = await supabase
            .from('client_charges')
            .insert(chargeRecords);

          if (chargesError) {
            console.error('Error creating charges:', chargesError);
          }
        }

        toast.success(`Cliente creado exitosamente (${changesCount} cambios registrados)`);
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      console.error('Error finalizing prospect:', error);
      toast.error('Error al finalizar el prospecto. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Prospecto: {prospect.first_name} {prospect.last_name_paterno}</DialogTitle>
            <DialogDescription>
              Completa toda la información para convertir el prospecto en cliente
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="address">Dirección</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="billing">Facturación</TabsTrigger>
              <TabsTrigger value="summary">Resumen</TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 mt-6">
                {/* PERSONAL TAB */}
                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre" {...field} />
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
                          <FormLabel>Apellido Paterno</FormLabel>
                          <FormControl>
                            <Input placeholder="Apellido paterno" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="last_name_materno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido Materno</FormLabel>
                        <FormControl>
                          <Input placeholder="Apellido materno (opcional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono 1</FormLabel>
                          <FormControl>
                            <PhoneInput 
                              value={field.value}
                              onChange={field.onChange}
                              country={(form.watch('phone1_country') as PhoneCountry) || 'MX'}
                              onCountryChange={(country) => form.setValue('phone1_country', country)}
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
                          <FormLabel>Teléfono 2 (opcional)</FormLabel>
                          <FormControl>
                            <PhoneInput 
                              value={field.value || ''}
                              onChange={field.onChange}
                              country={(form.watch('phone2_country') as PhoneCountry) || 'MX'}
                              onCountryChange={(country) => form.setValue('phone2_country', country)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phone3_signer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono de quien Firmará (opcional)</FormLabel>
                        <FormControl>
                          <PhoneInput 
                            value={field.value || ''}
                            onChange={field.onChange}
                            country={(form.watch('phone3_country') as PhoneCountry) || 'MX'}
                            onCountryChange={(country) => form.setValue('phone3_country', country)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* ADDRESS TAB */}
                <TabsContent value="address" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Calle</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre de la calle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="exterior_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número Exterior</FormLabel>
                          <FormControl>
                            <Input placeholder="No. Exterior" {...field} />
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
                          <FormLabel>Número Interior</FormLabel>
                          <FormControl>
                            <Input placeholder="No. Interior (opcional)" {...field} />
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
                            <Input placeholder="C.P. (opcional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colonia</FormLabel>
                        <FormControl>
                          <Input placeholder="Colonia o barrio" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={activeCities.map(c => ({ value: c.id, label: c.name }))}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Seleccionar ciudad..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* TECHNICAL TAB */}
                <TabsContent value="technical" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="ssid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSID WiFi (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre de la red WiFi" {...field} />
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
                        <FormLabel>IP de Antena (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Técnico Instalador (opcional)</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un técnico..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {technicians.map(tech => (
                              <SelectItem key={tech.user_id} value={tech.user_id}>
                                {tech.full_name}
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas Técnicas (opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notas adicionales..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* BILLING TAB */}
                <TabsContent value="billing" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="plan_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan de Servicio</FormLabel>
                          <Select value={field.value} onValueChange={handlePlanChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un plan..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {servicePlans.map(plan => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} - {formatCurrency(plan.monthly_fee)}/mes
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
                          <FormLabel>Mensualidad</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(parseFloat(e.target.value) || 0);
                                calculateProrationAmount();
                              }}
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
                          <FormLabel>Fecha de Instalación</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                calculateProrationAmount();
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
                          <FormLabel>Día de Corte</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="1"
                              max="28"
                              {...field}
                              onChange={(e) => {
                                field.onChange(parseInt(e.target.value) || 0);
                                calculateProrationAmount();
                              }}
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
                      name="installation_cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo de Instalación</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
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
                          <FormLabel>Prorrateo</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00"
                              disabled
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional Charges Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Cargos Adicionales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={selectedChargeId} onValueChange={handleChargeSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona cargo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {chargeCatalog.map(charge => (
                              <SelectItem key={charge.id} value={charge.id}>
                                {charge.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="Cantidad"
                          value={chargeAmount}
                          onChange={(e) => setChargeAmount(e.target.value)}
                        />
                        <Button 
                          type="button"
                          onClick={handleAddCharge}
                          disabled={!selectedChargeId || !chargeAmount}
                        >
                          Agregar
                        </Button>
                      </div>

                      {selectedCharges.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-semibold text-sm">Cargos agregados:</div>
                          {selectedCharges.map((charge, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                              <span className="text-sm">{charge.name} - {formatCurrency(charge.amount)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCharge(i)}
                                className="text-destructive hover:text-destructive/80"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* SUMMARY TAB */}
                <TabsContent value="summary" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen del Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="font-semibold">Información Personal</div>
                          <p>{form.watch('first_name')} {form.watch('last_name_paterno')} {form.watch('last_name_materno')}</p>
                          <p className="text-xs text-muted-foreground">{form.watch('phone1')}</p>
                        </div>
                        <div>
                          <div className="font-semibold">Dirección</div>
                          <p>{form.watch('street')} {form.watch('exterior_number')}{form.watch('interior_number') && ` Int. ${form.watch('interior_number')}`}</p>
                          <p className="text-xs text-muted-foreground">{form.watch('neighborhood')}, {activeCities.find(c => c.id === form.watch('city_id'))?.name}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <div className="font-semibold mb-2">Información de Facturación</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Plan: {selectedPlanName}</div>
                          <div>Mensualidad: {formatCurrency(monthlyFee)}</div>
                          <div>Día de Corte: {form.watch('billing_day')}</div>
                          <div>Costo Instalación: {formatCurrency(form.watch('installation_cost') || 0)}</div>
                          <div>Prorrateo: {formatCurrency(form.watch('prorated_amount') || 0)}</div>
                          <div>Cargos Adicionales: {formatCurrency(totalAdditionalCharges)}</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="bg-primary/5 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Saldo Inicial Total:</span>
                          <span className="text-lg font-bold">{formatCurrency(totalInitialBalance)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Navigation buttons */}
                <div className="flex justify-between mt-6">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={activeTab === 'personal'}
                  >
                    Anterior
                  </Button>

                  {activeTab !== 'summary' ? (
                    <Button 
                      type="button"
                      onClick={handleNext}
                    >
                      Siguiente
                    </Button>
                  ) : (
                    <Button 
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Finalizar y Crear Cliente
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmFinalizeDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        isLoading={isLoading}
        onConfirm={handleConfirmedFinalize}
        totalAmount={totalInitialBalance}
      />
    </>
  );
}