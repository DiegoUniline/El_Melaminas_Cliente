import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import type { Prospect } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();

  if (!prospect) return null;

  const handleFinalize = async () => {
    setIsLoading(true);
    try {
      // 1. Update prospect status
      const { error: prospectError } = await supabase
        .from('prospects')
        .update({
          status: 'finalized',
          finalized_at: new Date().toISOString(),
        })
        .eq('id', prospect.id);

      if (prospectError) throw prospectError;

      // 2. Create client from prospect data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: prospect.first_name,
          last_name_paterno: prospect.last_name_paterno,
          last_name_materno: prospect.last_name_materno,
          phone1: prospect.phone1,
          phone2: prospect.phone2,
          phone3: prospect.phone3_signer,
          street: prospect.street,
          exterior_number: prospect.exterior_number,
          interior_number: prospect.interior_number,
          neighborhood: prospect.neighborhood,
          city: prospect.city,
          postal_code: prospect.postal_code,
          prospect_id: prospect.id,
          created_by: user?.id || null,
          status: 'active',
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 3. Create equipment record with prospect's antenna info
      if (clientData) {
        const { error: equipmentError } = await supabase
          .from('equipment')
          .insert({
            client_id: clientData.id,
            antenna_ssid: prospect.ssid,
            antenna_ip: prospect.antenna_ip,
          });

        if (equipmentError) {
          console.error('Error creating equipment:', equipmentError);
        }

        // 4. Create billing record with default values
        const today = new Date();
        const defaultBillingDay = 10;
        const firstBillingDate = new Date(today.getFullYear(), today.getMonth() + 1, defaultBillingDay);
        
        const { error: billingError } = await supabase
          .from('client_billing')
          .insert({
            client_id: clientData.id,
            monthly_fee: 0, // Will be set when editing client
            installation_cost: 0,
            installation_date: today.toISOString().split('T')[0],
            first_billing_date: firstBillingDate.toISOString().split('T')[0],
            billing_day: defaultBillingDay,
            prorated_amount: 0,
            additional_charges: 0,
            balance: 0,
          });

        if (billingError) {
          console.error('Error creating billing:', billingError);
        }
      }

      toast.success('Prospecto finalizado y cliente creado correctamente');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Finalizar Prospecto
          </DialogTitle>
          <DialogDescription>
            Al finalizar el prospecto, se creará automáticamente un nuevo cliente con los datos del prospecto.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Prospecto a finalizar:
          </p>
          <p className="font-medium">
            {prospect.first_name} {prospect.last_name_paterno} {prospect.last_name_materno || ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {prospect.neighborhood}, {prospect.city}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={isLoading}
            className="bg-success hover:bg-success/90"
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
      </DialogContent>
    </Dialog>
  );
}