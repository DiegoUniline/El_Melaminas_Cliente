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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/billing';

interface ConfirmFinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  totalAmount: number;
  isLoading?: boolean;
}

export function ConfirmFinalizeDialog({
  open,
  onOpenChange,
  onConfirm,
  totalAmount,
  isLoading = false,
}: ConfirmFinalizeDialogProps) {
  const [confirmCode, setConfirmCode] = useState('');
  const expectedCode = 'CONFIRMAR';

  const handleConfirm = () => {
    if (confirmCode.toUpperCase() === expectedCode) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setConfirmCode('');
    onOpenChange(false);
  };

  const isValid = confirmCode.toUpperCase() === expectedCode;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirmar Creación de Cliente
          </DialogTitle>
          <DialogDescription>
            Esta acción creará el cliente y no se puede deshacer. 
            Por favor verifica que los datos sean correctos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Saldo Inicial</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-code">
              Escribe <span className="font-bold text-primary">CONFIRMAR</span> para continuar
            </Label>
            <Input
              id="confirm-code"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="Escribe CONFIRMAR"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !isLoading) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Cliente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
