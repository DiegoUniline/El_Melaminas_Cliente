import { useState, useEffect } from 'react';
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
import { Loader2, Edit } from 'lucide-react';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { IpAddressInput } from '@/components/shared/IpAddressInput';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import { Separator } from '@/components/ui/separator';
import { PhoneCountry, isPhoneComplete } from '@/lib/phoneUtils';
import { isValidIPAddress } from '@/lib/formatUtils';
import type { Prospect } from '@/types/database';
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
  city_id: z.string().optional(),
  postal_code: z.string().max(10).optional(),
  work_type: z.string().max(100).optional(),
  request_date: z.string().min(1, 'La fecha de solicitud es requerida'),
  assigned_date: z.string().optional(),
  assigned_to: z.string().optional(),
  ssid: z.string().max(50).optional(),
  antenna_ip: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  cancellation_reason: z.string().optional(),
});

type ProspectFormValues = z.infer<typeof prospectSchema>;

interface EditProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess: () => void;
}

export function EditProspectDialog({
  open,
  onOpenChange,
  prospect,
  onSuccess,
}: EditProspectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
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
      request_date: '',
      assigned_date: '',
      assigned_to: '',
      ssid: '',
      antenna_ip: '',
      notes: '',
      cancellation_reason: '',
    },
  });

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
        city_id: (prospect as any).city_id || '',
        postal_code: prospect.postal_code || '',
        work_type: prospect.work_type || '',
        request_date: prospect.request_date || '',
        assigned_date: prospect.assigned_date || '',
        assigned_to: prospect.assigned_to || '',
        ssid: prospect.ssid || '',
        antenna_ip: prospect.antenna_ip || '',
        notes: prospect.notes || '',
        cancellation_reason: prospect.cancellation_reason || '',
      });
    }
  }, [prospect, open, form]);

  if (!prospect) return null;

  const onSubmit = async (values: ProspectFormValues) => {
    // VALIDACIONES OBLIGATORIAS
    const errors: string[] = [];
    
    if (!isPhoneComplete(values.phone1)) {
      errors.push('Teléfono 1 debe tener 10 dígitos');
    }
    if (values.phone2 && !isPhoneComplete(values.phone2)) {
      errors.push('Teléfono 2 debe tener 10 dígitos');
    }
    if (values.phone3_signer && !isPhoneComplete(values.phone3_signer)) {
      errors.push('Teléfono de quien firmará debe tener 10 dígitos');
    }
    if (values.antenna_ip && !isValidIPAddress(values.antenna_ip)) {
      errors.push('IP Antena no tiene formato válido');
    }
    
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }
    
    setIsLoading(true);
    try {
      // Detect changes to save in history
      const fieldsToTrack: { key: keyof ProspectFormValues; label: string }[] = [
        { key: 'first_name', label: 'Nombre' },
        { key: 'last_name_paterno', label: 'Apellido Paterno' },
        { key: 'last_name_materno', label: 'Apellido Materno' },
        { key: 'phone1', label: 'Teléfono 1' },
        { key: 'phone1_country', label: 'País Teléfono 1' },
        { key: 'phone2', label: 'Teléfono 2' },
        { key: 'phone2_country', label: 'País Teléfono 2' },
        { key: 'phone3_signer', label: 'Teléfono Firmante' },
        { key: 'phone3_country', label: 'País Teléfono 3' },
        { key: 'street', label: 'Calle' },
        { key: 'exterior_number', label: 'No. Exterior' },
        { key: 'interior_number', label: 'No. Interior' },
        { key: 'neighborhood', label: 'Colonia' },
        { key: 'city', label: 'Ciudad' },
        { key: 'city_id', label: 'ID Ciudad' },
        { key: 'postal_code', label: 'Código Postal' },
        { key: 'work_type', label: 'Tipo de Trabajo' },
        { key: 'request_date', label: 'Fecha de Solicitud' },
        { key: 'assigned_date', label: 'Fecha Asignada' },
        { key: 'assigned_to', label: 'Técnico Asignado' },
        { key: 'ssid', label: 'SSID' },
        { key: 'antenna_ip', label: 'IP Antena' },
        { key: 'notes', label: 'Notas' },
        { key: 'cancellation_reason', label: 'Motivo de Cancelación' },
      ];

      const changes: { field_name: string; old_value: string | null; new_value: string | null }[] = [];

      fieldsToTrack.forEach(({ key }) => {
        const oldVal = (prospect as any)[key] ?? null;
        const newVal = values[key] ?? null;
        const oldStr = oldVal?.toString() || '';
        const newStr = newVal?.toString() || '';
        
        if (oldStr !== newStr) {
          changes.push({
            field_name: key,
            old_value: oldStr || null,
            new_value: newStr || null,
          });
        }
      });

      // Get city name from city_id if changed
      const cityName = values.city_id ? getCityName(values.city_id) : values.city;
      
      // Update the prospect
      const { error } = await supabase
        .from('prospects')
        .update({
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
          city: cityName,
          city_id: values.city_id || null,
          postal_code: values.postal_code || null,
          work_type: values.work_type || null,
          request_date: values.request_date,
          assigned_date: values.assigned_date || null,
          assigned_to: values.assigned_to || null,
          ssid: values.ssid || null,
          antenna_ip: values.antenna_ip || null,
          notes: values.notes || null,
          cancellation_reason: values.cancellation_reason || null,
        })
        .eq('id', prospect.id);

      if (error) throw error;

      // Save change history
      if (changes.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const historyRecords = changes.map(c => ({
          prospect_id: prospect.id,
          field_name: c.field_name,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by: user?.id || null,
        }));

        const { error: historyError } = await supabase
          .from('prospect_change_history')
          .insert(historyRecords);

        if (historyError) {
          console.error('Error saving change history:', historyError);
        }
      }

      toast.success(`Prospecto actualizado (${changes.length} campo${changes.length !== 1 ? 's' : ''} modificado${changes.length !== 1 ? 's' : ''})`);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating prospect:', error);
      toast.error('Error al actualizar el prospecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Prospecto
          </DialogTitle>
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono 2</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ''}
                          onChange={(val) => field.onChange(val)}
                          country={form.watch('phone2_country') as PhoneCountry}
                          onCountryChange={(country) => form.setValue('phone2_country', country)}
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
                      <FormLabel>Teléfono de quien firmará</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ''}
                          onChange={(val) => field.onChange(val)}
                          country={form.watch('phone3_country') as PhoneCountry}
                          onCountryChange={(country) => form.setValue('phone3_country', country)}
                          placeholder="317-131-5782"
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
                          value={field.value || ''}
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

            {/* Motivo de cancelación si aplica */}
            {prospect.status === 'cancelled' && (
              <FormField
                control={form.control}
                name="cancellation_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de Cancelación</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Motivo de la cancelación..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Historial de Cambios */}
            <ChangeHistoryPanel prospectId={prospect.id} compact maxHeight="250px" />

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
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
