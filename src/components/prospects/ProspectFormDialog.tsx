import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const prospectSchema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido').max(100),
  last_name_paterno: z.string().min(1, 'El apellido paterno es requerido').max(100),
  last_name_materno: z.string().max(100).optional(),
  phone1: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos').max(15),
  phone2: z.string().max(15).optional(),
  phone3_signer: z.string().max(15).optional(),
  street: z.string().min(1, 'La calle es requerida').max(200),
  exterior_number: z.string().min(1, 'El número exterior es requerido').max(20),
  interior_number: z.string().max(20).optional(),
  neighborhood: z.string().min(1, 'La colonia es requerida').max(100),
  city: z.string().min(1, 'La ciudad es requerida').max(100),
  postal_code: z.string().max(10).optional(),
  work_type: z.string().max(100).optional(),
  request_date: z.string().min(1, 'La fecha de solicitud es requerida'),
  assigned_date: z.string().optional(),
  ssid: z.string().max(50).optional(),
  antenna_ip: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
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

  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      first_name: '',
      last_name_paterno: '',
      last_name_materno: '',
      phone1: '',
      phone2: '',
      phone3_signer: '',
      street: '',
      exterior_number: '',
      interior_number: '',
      neighborhood: '',
      city: '',
      postal_code: '',
      work_type: '',
      request_date: new Date().toISOString().split('T')[0],
      assigned_date: '',
      ssid: '',
      antenna_ip: '',
      notes: '',
    },
  });

  const onSubmit = async (values: ProspectFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('prospects').insert({
        first_name: values.first_name,
        last_name_paterno: values.last_name_paterno,
        last_name_materno: values.last_name_materno || null,
        phone1: values.phone1,
        phone2: values.phone2 || null,
        phone3_signer: values.phone3_signer || null,
        street: values.street,
        exterior_number: values.exterior_number,
        interior_number: values.interior_number || null,
        neighborhood: values.neighborhood,
        city: values.city,
        postal_code: values.postal_code || null,
        work_type: values.work_type || null,
        request_date: values.request_date,
        assigned_date: values.assigned_date || null,
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
                        <Input placeholder="5551234567" {...field} />
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
                        <Input placeholder="5559876543" {...field} />
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
                        <Input placeholder="5551112222" {...field} />
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
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ciudad de México" {...field} />
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
                        <Input placeholder="192.168.1.1" {...field} />
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