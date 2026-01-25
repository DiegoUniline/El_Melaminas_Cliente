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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, DollarSign, Calculator } from 'lucide-react';
import { formatCurrency, calculateProration } from '@/lib/billing';
import { useAuth } from '@/hooks/useAuth';
import type { Client, ClientBilling } from '@/types/database';

const billingSchema = z.object({
  plan_id: z.string().optional(),
  monthly_fee: z.number().min(0, 'La mensualidad debe ser mayor o igual a 0'),
  installation_date: z.string().min(1, 'La fecha de instalación es requerida'),
  billing_day: z.number().min(1).max(28, 'El día de corte debe ser entre 1 y 28'),
  installation_cost: z.number().min(0, 'El costo de instalación debe ser mayor o igual a 0'),
  prorated_amount: z.number().min(0, 'El prorrateo debe ser mayor o igual a 0'),
  additional_charges: z.number().min(0).optional(),
  additional_charges_notes: z.string().optional(),
});

type BillingFormValues = z.infer<typeof billingSchema>;

interface InitialBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  billing: ClientBilling | null;
  onSuccess: () => void;
}

export function InitialBillingDialog({
  open,
  onOpenChange,
  client,
  billing,
  onSuccess,
}: InitialBillingDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

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

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
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

  useEffect(() => {
    if (billing && open) {
      form.reset({
        plan_id: billing.plan_id || '',
        monthly_fee: billing.monthly_fee || 0,
        installation_date: billing.installation_date || new Date().toISOString().split('T')[0],
        billing_day: billing.billing_day || 10,
        installation_cost: billing.installation_cost || 0,
        prorated_amount: billing.prorated_amount || 0,
        additional_charges: billing.additional_charges || undefined,
        additional_charges_notes: billing.additional_charges_notes || '',
      });
    }
  }, [billing, open, form]);

  const handlePlanChange = (planId: string) => {
    form.setValue('plan_id', planId);
    const plan = servicePlans.find(p => p.id === planId);
    if (plan) {
      form.setValue('monthly_fee', plan.monthly_fee);
      setTimeout(() => {
        const installDate = form.getValues('installation_date');
        const billingDay = form.getValues('billing_day');
        if (installDate && billingDay && plan.monthly_fee > 0) {
          const { proratedAmount } = calculateProration(new Date(installDate), billingDay, plan.monthly_fee);
          form.setValue('prorated_amount', proratedAmount);
        }
      }, 0);
    }
  };

  const calculateProrationAmount = () => {
    const installDate = form.getValues('installation_date');
    const billingDay = form.getValues('billing_day');
    const monthlyFee = form.getValues('monthly_fee');
    
    if (installDate && billingDay && monthlyFee > 0) {
      const { proratedAmount } = calculateProration(new Date(installDate), billingDay, monthlyFee);
      form.setValue('prorated_amount', proratedAmount);
    }
  };

  const handleSubmit = async (data: BillingFormValues) => {
    if (!client || !billing) return;
    
    setIsLoading(true);
    try {
      // Calculate total initial balance
      const totalInitialCharges = 
        (data.installation_cost || 0) + 
        (data.prorated_amount || 0) + 
        (data.additional_charges || 0);

      // Update billing record
      const { error: billingError } = await supabase
        .from('client_billing')
        .update({
          plan_id: data.plan_id || null,
          monthly_fee: data.monthly_fee,
          installation_date: data.installation_date,
          billing_day: data.billing_day,
          installation_cost: data.installation_cost,
          prorated_amount: data.prorated_amount,
          additional_charges: data.additional_charges || 0,
          additional_charges_notes: data.additional_charges_notes || null,
          balance: totalInitialCharges,
        })
        .eq('id', billing.id);

      if (billingError) throw billingError;

      // Create initial charges in client_charges
      const chargesToCreate = [];

      if (data.installation_cost > 0) {
        chargesToCreate.push({
          client_id: client.id,
          description: 'Costo de instalación',
          amount: data.installation_cost,
          status: 'pending',
          created_by: user?.id,
        });
      }

      if (data.prorated_amount > 0) {
        chargesToCreate.push({
          client_id: client.id,
          description: 'Prorrateo inicial',
          amount: data.prorated_amount,
          status: 'pending',
          created_by: user?.id,
        });
      }

      if (data.additional_charges && data.additional_charges > 0) {
        chargesToCreate.push({
          client_id: client.id,
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

        if (chargesError) throw chargesError;
      }

      toast.success('Facturación inicial configurada correctamente');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving billing:', error);
      toast.error('Error al guardar la facturación');
    } finally {
      setIsLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Configurar Facturación Inicial
          </DialogTitle>
          <DialogDescription>
            Configura el plan, mensualidad y cargos iniciales para {client.first_name} {client.last_name_paterno}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                          setTimeout(calculateProration, 0);
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
                          setTimeout(calculateProration, 0);
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
                          setTimeout(calculateProration, 0);
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Facturación'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
