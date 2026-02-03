import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wifi, Router } from 'lucide-react';
import { formatCurrency } from '@/lib/billing';
import { MacAddressInput } from '@/components/shared/MacAddressInput';
import { IpAddressInput } from '@/components/shared/IpAddressInput';
import { isValidIPAddress, isMacAddressComplete } from '@/lib/formatUtils';
import type { Equipment } from '@/types/database';

interface ChangeEquipmentDialogProps {
  clientId: string;
  clientName: string;
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ChangeEquipmentDialog({ 
  clientId, 
  clientName,
  equipment, 
  open, 
  onOpenChange, 
  onSuccess 
}: ChangeEquipmentDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changeType, setChangeType] = useState<'antenna' | 'router'>('antenna');
  const [generateCharge, setGenerateCharge] = useState(true);
  const [selectedChargeId, setSelectedChargeId] = useState<string>('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [notes, setNotes] = useState('');

  // New equipment data
  const [newAntenna, setNewAntenna] = useState({
    brand: '',
    model: '',
    mac: '',
    ip: '',
    ssid: '',
    serial: '',
  });

  const [newRouter, setNewRouter] = useState({
    brand: '',
    model: '',
    mac: '',
    ip: '',
    serial: '',
    network_name: '',
    password: '',
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
    enabled: open,
  });

  const handleSelectCharge = (catalogId: string) => {
    setSelectedChargeId(catalogId);
    const selected = chargeCatalog.find((c: any) => c.id === catalogId);
    if (selected) {
      setChargeAmount(selected.default_amount.toString());
    }
  };

  const handleSubmit = async () => {
    // Validaciones
    const errors: string[] = [];
    
    if (changeType === 'antenna') {
      if (newAntenna.mac && !isMacAddressComplete(newAntenna.mac)) {
        errors.push('MAC de antena debe tener 12 caracteres hexadecimales');
      }
      if (newAntenna.ip && !isValidIPAddress(newAntenna.ip)) {
        errors.push('IP de antena no tiene formato válido');
      }
    } else {
      if (newRouter.mac && !isMacAddressComplete(newRouter.mac)) {
        errors.push('MAC de router debe tener 12 caracteres hexadecimales');
      }
      if (newRouter.ip && !isValidIPAddress(newRouter.ip)) {
        errors.push('IP de router no tiene formato válido');
      }
    }
    
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }
    
    setIsSubmitting(true);
    try {
      const isAntennaChange = changeType === 'antenna';
      const oldValues = isAntennaChange 
        ? {
            antenna_brand: equipment?.antenna_brand,
            antenna_model: equipment?.antenna_model,
            antenna_mac: equipment?.antenna_mac,
            antenna_ip: equipment?.antenna_ip,
            antenna_ssid: equipment?.antenna_ssid,
            antenna_serial: (equipment as any)?.antenna_serial,
          }
        : {
            router_brand: equipment?.router_brand,
            router_model: equipment?.router_model,
            router_mac: equipment?.router_mac,
            router_ip: equipment?.router_ip,
            router_serial: equipment?.router_serial,
            router_network_name: equipment?.router_network_name,
            router_password: equipment?.router_password,
          };

      const newValues = isAntennaChange
        ? {
            antenna_brand: newAntenna.brand || null,
            antenna_model: newAntenna.model || null,
            antenna_mac: newAntenna.mac || null,
            antenna_ip: newAntenna.ip || null,
            antenna_ssid: newAntenna.ssid || null,
            antenna_serial: newAntenna.serial || null,
          }
        : {
            router_brand: newRouter.brand || null,
            router_model: newRouter.model || null,
            router_mac: newRouter.mac || null,
            router_ip: newRouter.ip || null,
            router_serial: newRouter.serial || null,
            router_network_name: newRouter.network_name || null,
            router_password: newRouter.password || null,
          };

      // Update equipment
      if (equipment) {
        const { error: equipmentError } = await supabase
          .from('equipment')
          .update(newValues)
          .eq('id', equipment.id);

        if (equipmentError) throw equipmentError;
      }

      let chargeId: string | null = null;

      // Create charge if needed
      if (generateCharge && chargeAmount) {
        const amount = parseFloat(chargeAmount);
        if (amount > 0) {
          const chargeDescription = isAntennaChange ? 'Cambio de antena' : 'Cambio de router';
          
          const { data: chargeData, error: chargeError } = await supabase
            .from('client_charges')
            .insert({
              client_id: clientId,
              charge_catalog_id: selectedChargeId || null,
              description: chargeDescription,
              amount,
              status: 'pending',
              created_by: user?.id,
            })
            .select()
            .single();

          if (chargeError) throw chargeError;
          chargeId = chargeData.id;

          // Update balance
          const { data: billing } = await supabase
            .from('client_billing')
            .select('balance')
            .eq('client_id', clientId)
            .single();

          if (billing) {
            const { error: balanceError } = await supabase
              .from('client_billing')
              .update({ balance: (billing.balance || 0) + amount })
              .eq('client_id', clientId);

            if (balanceError) throw balanceError;
          }
        }
      }

      // Register in equipment_history
      const { error: historyError } = await supabase
        .from('equipment_history')
        .insert({
          client_id: clientId,
          equipment_id: equipment?.id || null,
          change_type: isAntennaChange ? 'antenna_change' : 'router_change',
          old_values: oldValues,
          new_values: newValues,
          charge_id: chargeId,
          notes: notes || null,
          created_by: user?.id,
        });

      if (historyError) throw historyError;

      toast.success(`${isAntennaChange ? 'Antena' : 'Router'} actualizado correctamente`);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client_charges'] });
      queryClient.invalidateQueries({ queryKey: ['client_billing'] });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al cambiar el equipo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Cambiar Equipo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clientName}</span>
          </div>

          <Tabs value={changeType} onValueChange={(v) => setChangeType(v as 'antenna' | 'router')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="antenna" className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Cambiar Antena
              </TabsTrigger>
              <TabsTrigger value="router" className="flex items-center gap-2">
                <Router className="h-4 w-4" />
                Cambiar Router
              </TabsTrigger>
            </TabsList>

            <TabsContent value="antenna" className="space-y-4 mt-4">
              {/* Current Antenna */}
              {equipment && (
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Antena Actual</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <span><strong>Marca:</strong> {equipment.antenna_brand || '-'}</span>
                      <span><strong>Modelo:</strong> {equipment.antenna_model || '-'}</span>
                      <span><strong>MAC:</strong> {equipment.antenna_mac || '-'}</span>
                      <span><strong>IP:</strong> {equipment.antenna_ip || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* New Antenna */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Nueva Antena</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Marca</Label>
                      <Input 
                        value={newAntenna.brand} 
                        onChange={(e) => setNewAntenna(prev => ({ ...prev, brand: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input 
                        value={newAntenna.model} 
                        onChange={(e) => setNewAntenna(prev => ({ ...prev, model: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>MAC</Label>
                      <MacAddressInput 
                        value={newAntenna.mac} 
                        onChange={(val) => setNewAntenna(prev => ({ ...prev, mac: val }))}
                      />
                    </div>
                    <div>
                      <Label>IP</Label>
                      <IpAddressInput 
                        value={newAntenna.ip} 
                        onChange={(val) => setNewAntenna(prev => ({ ...prev, ip: val }))}
                      />
                    </div>
                    <div>
                      <Label>SSID</Label>
                      <Input
                        value={newAntenna.ssid} 
                        onChange={(e) => setNewAntenna(prev => ({ ...prev, ssid: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Serie</Label>
                      <Input 
                        value={newAntenna.serial} 
                        onChange={(e) => setNewAntenna(prev => ({ ...prev, serial: e.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="router" className="space-y-4 mt-4">
              {/* Current Router */}
              {equipment && (
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Router Actual</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <span><strong>Marca:</strong> {equipment.router_brand || '-'}</span>
                      <span><strong>Modelo:</strong> {equipment.router_model || '-'}</span>
                      <span><strong>MAC:</strong> {equipment.router_mac || '-'}</span>
                      <span><strong>IP:</strong> {equipment.router_ip || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* New Router */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Nuevo Router</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Marca</Label>
                      <Input 
                        value={newRouter.brand} 
                        onChange={(e) => setNewRouter(prev => ({ ...prev, brand: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input 
                        value={newRouter.model} 
                        onChange={(e) => setNewRouter(prev => ({ ...prev, model: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>MAC</Label>
                      <MacAddressInput 
                        value={newRouter.mac} 
                        onChange={(val) => setNewRouter(prev => ({ ...prev, mac: val }))}
                      />
                    </div>
                    <div>
                      <Label>IP</Label>
                      <IpAddressInput 
                        value={newRouter.ip} 
                        onChange={(val) => setNewRouter(prev => ({ ...prev, ip: val }))}
                      />
                    </div>
                    <div>
                      <Label>Serie</Label>
                      <Input
                        value={newRouter.serial} 
                        onChange={(e) => setNewRouter(prev => ({ ...prev, serial: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Nombre de Red</Label>
                      <Input 
                        value={newRouter.network_name} 
                        onChange={(e) => setNewRouter(prev => ({ ...prev, network_name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Contraseña WiFi</Label>
                      <Input 
                        value={newRouter.password} 
                        onChange={(e) => setNewRouter(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Charge Options */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="generateCharge" 
                  checked={generateCharge} 
                  onCheckedChange={(checked) => setGenerateCharge(checked as boolean)}
                />
                <Label htmlFor="generateCharge">Generar cargo por cambio de equipo</Label>
              </div>

              {generateCharge && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label>Tipo de cargo</Label>
                    <Select value={selectedChargeId} onValueChange={handleSelectCharge}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {chargeCatalog.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({formatCurrency(item.default_amount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Motivo del cambio de equipo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
