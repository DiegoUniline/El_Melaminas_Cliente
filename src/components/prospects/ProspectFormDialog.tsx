import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { IpAddressInput } from '@/components/shared/IpAddressInput';
import { PhoneCountry, formatPhoneNumber, isPhoneComplete } from '@/lib/phoneUtils';
import { isValidIPAddress } from '@/lib/formatUtils';
import { useCities } from '@/hooks/useCities';
import { SearchableSelect } from '@/components/shared/SearchableSelect';

const prospectSchema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido').max(100),
  last_name_paterno: z.string().min(1, 'El apellido paterno es requerido').max(100),
  last_name_materno: z.string().max(100).optional(),
  phone1: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos').max(15),
  phone1_country: z.string().default('MX'),
  phone2: z.string().max(15).optional(),
  phone2_country: z.string().default('MX'),
  phone3_signer: z.string().max(15).optional(),
  phone3_country: z.string().default('MX'),
  street: z.string().min(1, 'La calle es requerida').max(200),
  exterior_number: z.string().min(1, 'El número exterior es requerido').max(20),
  interior_number: z.string().max(20).optional(),
  neighborhood: z.string().min(1, 'La colonia es requerida').max(100),
  city: z.string().max(100).optional(), // Keep for backward compatibility
  city_id: z.string().min(1, 'La ciudad es requerida'),
  postal_code: z.string().max(10).optional(),
  work_type: z.string().max(100).optional(),
  request_date: z.string().min(1, 'La fecha de solicitud es requerida'),
  assigned_date: z.string().optional(),
  assigned_to: z.string().optional(),
  ssid: z.string().max(50).optional(),
  antenna_ip: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  // Validar phone2 si tiene algún valor
  if (data.phone2 && data.phone2.length > 0 && !isPhoneComplete(data.phone2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El teléfono 2 debe tener 10 dígitos',
      path: ['phone2'],
    });
  }
  // Validar phone3_signer si tiene algún valor
  if (data.phone3_signer && data.phone3_signer.length > 0 && !isPhoneComplete(data.phone3_signer)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El teléfono de quien firmará debe tener 10 dígitos',
      path: ['phone3_signer'],
    });
  }
  // Validar antenna_ip si tiene algún valor
  if (data.antenna_ip && data.antenna_ip.length > 0 && !isValidIPAddress(data.antenna_ip)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La IP de antena no tiene formato válido',
      path: ['antenna_ip'],
    });
  }
});

type ProspectFormValues = z.infer<typeof prospectSchema>;

interface ProspectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProspectFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProspectFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { activeCities, cityOptions, getCityName } = useCities();

  // Fetch employees for technician selector
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
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
      city_id: '',
      postal_code: '',
      work_type: '',
      request_date: new Date().toISOString().split('T')[0],
      assigned_date: '',
      assigned_to: '',
      ssid: '',
      antenna_ip: '',
      notes: '',
    },
  });

  const onSubmit = async (values: ProspectFormValues) => {
    setIsLoading(true);
    try {
      // Get city name from city_id
      const cityName = getCityName(values.city_id);
      
      const { error } = await supabase.from('prospects').insert({
        first_name: values.first_name,
        last_name_paterno: values.last_name_paterno,
        last_name_materno: values.last_name_materno || null,
        phone1: values.phone1,
        phone1_country: values.phone1_country,
        phone2: values.phone2 || null,
        phone2_country: values.phone2_country,
        phone3_signer: values.phone3_signer || null,
        phone3_country: values.phone3_country,
        street: values.street,
        exterior_number: values.exterior_number,
        interior_number: values.interior_number || null,
        neighborhood: values.neighborhood,
        city: cityName, // Keep text for backward compatibility
        city_id: values.city_id,
        postal_code: values.postal_code || null,
        work_type: values.work_type || null,
        request_date: values.request_date,
        assigned_date: values.assigned_date || null,
        assigned_to: values.assigned_to || null,
        ssid: values.ssid || null,
        antenna_ip: values.antenna_ip || null,
        notes: values.notes || null,
        created_by: user?.id || null,
        status: 'pending' as const,
      });

      if (error) throw error;

      toast.success('Prospecto registrado correctamente');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating prospect:', error);
      toast.error('Error al registrar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Prospecto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Datos personales */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Datos Personales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" {...field} />
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
                        <Input placeholder="Pérez" {...field} />
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
                        <Input placeholder="García" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Teléfonos */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Teléfonos de Contacto
              </h3>
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
                          onChange={(val) => field.onChange(val)}
                          country={form.watch('phone1_country') as PhoneCountry}
                          onCountryChange={(country) => form.setValue('phone1_country', country)}
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
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Teléfono 2</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ''}
                          onChange={(val) => field.onChange(val)}
                          country={form.watch('phone2_country') as PhoneCountry}
                          onCountryChange={(country) => form.setValue('phone2_country', country)}
                          placeholder="317-131-5782"
                          hasError={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone3_signer"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Teléfono de quien firmará</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ''}
                          onChange={(val) => field.onChange(val)}
                          country={form.watch('phone3_country') as PhoneCountry}
                          onCountryChange={(country) => form.setValue('phone3_country', country)}
                          placeholder="317-131-5782"
                          hasError={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Dirección
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Calle *</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Principal" {...field} />
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
                        <Input placeholder="123" {...field} />
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
                        <Input placeholder="A" {...field} />
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
                        <Input placeholder="Centro" {...field} />
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
                      <FormLabel>Ciudad *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={cityOptions}
                          placeholder="Seleccionar ciudad"
                          searchPlaceholder="Buscar ciudad..."
                          emptyMessage="No se encontraron ciudades"
                        />
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
                        <Input placeholder="06000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Trabajo y fechas */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Información del Trabajo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="work_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Trabajo</FormLabel>
                      <FormControl>
                        <Input placeholder="Instalación nueva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="request_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Solicitud *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Asignada</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Técnico Asignado</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar técnico" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>
                              {emp.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ssid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSID</FormLabel>
                      <FormControl>
                        <Input placeholder="Skynet_123" {...field} />
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
                        <IpAddressInput
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* Notas */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas / Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Información adicional sobre el prospecto..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
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
                  'Guardar Prospecto'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
