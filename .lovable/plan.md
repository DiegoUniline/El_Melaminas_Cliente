
# Plan: Correcciones de Clientes, MAC Address y Cargos Extras

## Resumen de Problemas Identificados

Tras revisar el código actual, he identificado los siguientes problemas específicos:

---

## 1. Usar MacAddressInput en Campos de MAC

**Problema**: Los campos de MAC address en `ClientDetail.tsx` (líneas 1047-1051 para antena, router sin campo MAC visible) y en `ClientFormDialog.tsx` usan `<Input>` normal en lugar del componente `MacAddressInput` que ya existe.

**Solución**: Reemplazar los inputs de MAC con el componente `MacAddressInput` que ya formatea automáticamente con dos puntos cada 2 dígitos y limita a 12 caracteres hexadecimales.

**Archivos a modificar**:
- `src/pages/ClientDetail.tsx`:
  - Importar `MacAddressInput` 
  - Reemplazar input de MAC antena (línea 1048-1051)
  - Agregar input de MAC router (actualmente falta en el formulario de edición)
- `src/components/clients/ClientFormDialog.tsx`:
  - Importar `MacAddressInput`
  - Reemplazar inputs de `router_mac` y `antenna_mac`

---

## 2. Agregar Botón de Cargos Extras en Estado de Cuenta

**Problema**: La funcionalidad para agregar cargos extras existía en `ClientDetailDialog.tsx` pero no fue migrada a `ClientDetail.tsx`. 

**Solución**: Agregar un formulario similar al que existe en el diálogo anterior para crear cargos manuales.

**Cambios necesarios**:
1. Agregar estados para el formulario de cargo:
   - `isAddingCharge`
   - `selectedChargeType`
   - `chargeAmount`
   - `chargeDescription`

2. Agregar query para obtener catálogo de cargos

3. Agregar función `handleAddCharge` similar a la del diálogo

4. Agregar Card con formulario en la sección de Estado de Cuenta

---

## 3. Simplificar ClientFormDialog para Edición

**Problema**: El formulario de edición de cliente (`ClientFormDialog`) muestra tabs de Personal, Facturación, Equipo, Documentos. El usuario indica que la facturación inicial solo debe configurarse una vez al crear el cliente.

**Solución**: 
1. Cuando se está editando un cliente existente (no creando nuevo), ocultar o deshabilitar los campos de facturación inicial (prorrateo, instalación)
2. Mantener solo editable la mensualidad y día de corte para cambios de plan
3. Mostrar la facturación como información de solo lectura cuando se edita

---

## 4. Verificar Valor Inicial de Cargos Adicionales

**Problema**: Cuando se edita un cliente existente, el campo `additional_charges` se carga con el valor actual de la base de datos, que puede ser 0.

**Solución**: En el `useEffect` que carga los datos del cliente al editar (línea 212), convertir 0 a `undefined` para que el campo se muestre vacío.

**Archivo a modificar**:
- `src/components/clients/ClientFormDialog.tsx` línea 212

---

## 5. Agregar Campo MAC de Router en Edición

**Problema**: En el formulario de edición inline de `ClientDetail.tsx`, no existe el campo para editar el MAC del router.

**Solución**: Agregar campo de MAC del router en la sección de edición del router (después de línea 1162).

---

## Secuencia de Implementación

### Paso 1: Aplicar MacAddressInput en ClientDetail.tsx
- Importar componente
- Reemplazar input de MAC antena
- Agregar input de MAC router

### Paso 2: Aplicar MacAddressInput en ClientFormDialog.tsx  
- Importar componente
- Reemplazar inputs de MAC

### Paso 3: Agregar Funcionalidad de Cargos Extras
- Agregar estados y query de catálogo
- Agregar función handleAddCharge
- Agregar UI del formulario de cargos en Estado de Cuenta

### Paso 4: Ajustar Valor Inicial de Cargos Adicionales
- Modificar carga de datos para convertir 0 a undefined

### Paso 5: Simplificar Facturación en Edición
- Mostrar campos de facturación inicial como solo lectura cuando es edición
- Permitir editar solo mensualidad y día de corte

---

## Detalles Técnicos

### Cambios en ClientDetail.tsx

```typescript
// Importar
import { MacAddressInput } from '@/components/shared/MacAddressInput';

// Estados para cargos extras
const [isAddingCharge, setIsAddingCharge] = useState(false);
const [selectedChargeType, setSelectedChargeType] = useState('');
const [chargeAmount, setChargeAmount] = useState('');
const [chargeDescription, setChargeDescription] = useState('');

// Query para catálogo de cargos
const { data: chargeCatalog = [] } = useQuery({
  queryKey: ['charge_catalog'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('charge_catalog')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },
});

// Función para agregar cargo
const handleAddCharge = async () => { /* ... */ };
```

### Cambio en Input de MAC

```typescript
// Antes
<Input
  value={editedEquipment.antenna_mac || ''}
  onChange={(e) => setEditedEquipment({ ...editedEquipment, antenna_mac: e.target.value })}
/>

// Después
<MacAddressInput
  value={editedEquipment.antenna_mac || ''}
  onChange={(v) => setEditedEquipment({ ...editedEquipment, antenna_mac: v })}
/>
```

### UI de Cargos Extras (en Estado de Cuenta)

```typescript
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-lg flex items-center gap-2">
      <Plus className="h-5 w-5" />
      Agregar Cargo
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-4 gap-3">
      <Select value={selectedChargeType} onValueChange={handleSelectCharge}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo de cargo" />
        </SelectTrigger>
        <SelectContent>
          {chargeCatalog.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name} ({formatCurrency(item.default_amount)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Descripción"
        value={chargeDescription}
        onChange={(e) => setChargeDescription(e.target.value)}
      />
      <Input
        type="number"
        placeholder="Monto"
        value={chargeAmount}
        onChange={(e) => setChargeAmount(e.target.value)}
      />
      <Button onClick={handleAddCharge} disabled={isAddingCharge}>
        Agregar
      </Button>
    </div>
  </CardContent>
</Card>
```

---

## Resultado Esperado

Después de implementar estos cambios:
- Los campos de MAC tendrán formato automático XX:XX:XX:XX:XX:XX
- Solo se permitirán 12 dígitos hexadecimales en MAC
- El botón de agregar cargos extras estará visible en Estado de Cuenta
- El campo de cargos adicionales no mostrará "0" como valor inicial al editar
- La facturación inicial será de solo lectura al editar clientes existentes
