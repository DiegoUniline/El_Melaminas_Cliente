
# Plan: Correcciones del Flujo de Conversión Prospecto → Cliente

## Resumen de Problemas a Resolver

1. **Técnico asignado no aparece**: En el paso "Técnico" no se muestra el instalador que ya viene asignado desde el prospecto
2. **Prorrateo mal calculado**: Se está contando el día de corte cuando no debería incluirse
3. **Cargos no editables en resumen**: Al editar un cargo en el resumen no se actualiza el total
4. **Formulario se guarda antes de tiempo**: El submit no debe ocurrir hasta el paso final con confirmación explícita

---

## 1. Agregar Técnico al Tab Técnico

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

En el tab "technical" (líneas 782-829), agregar un campo para mostrar y poder cambiar el técnico instalador:

**Agregar al schema** (línea 72):
```typescript
installer_id: z.string().optional(),
```

**Agregar query para técnicos** (después de línea 135):
```typescript
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
```

**Cargar el técnico asignado al abrir** (en el useEffect línea 182-216):
```typescript
// Agregar al form.reset:
installer_id: prospect.assigned_to || '',
```

**Agregar campo en tab Técnico** (antes de línea 812):
```typescript
<FormField
  control={form.control}
  name="installer_id"
  render={({ field }) => (
    <FormItem className="md:col-span-2">
      <FormLabel>Técnico Instalador</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar técnico" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {technicians.map((t) => (
            <SelectItem key={t.user_id} value={t.user_id}>
              {t.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Mostrar técnico en resumen** (agregar a la card de Datos Técnicos línea 1102):
```typescript
{getInstallerName() && <p><strong>Instalador:</strong> {getInstallerName()}</p>}
```

**Usar installer_id al crear equipment** (modificar línea 448):
```typescript
installer_name: technicians.find(t => t.user_id === data.installer_id)?.full_name || null,
```

---

## 2. Corregir Cálculo de Prorrateo

**Archivo:** `src/lib/billing.ts`

El problema está en el caso cuando `installDay <= billingDay`. Actualmente:
- Instalación día 2, corte día 10
- Cálculo: `10 - 2 = 8 días`
- A $5/día = $40

Pero si el usuario ve $45, significa 9 días. Revisando la lógica de negocio:
- Del día 2 al día 9 son los días que se cobran (el 10 inicia nuevo ciclo)
- Días: 2, 3, 4, 5, 6, 7, 8, 9 = 8 días

**El cálculo actual es correcto matemáticamente**. El problema podría ser:
1. La mensualidad no es exactamente divisible ($135 / 30 = $4.5, y 10 × $4.5 = $45)
2. O hay un error en cómo se calcula la tarifa diaria

**Sin embargo**, hay un caso especial: si la instalación es el mismo día del corte (ej: instalar el 10, corte el 10), el prorrateo debería ser 0, pero actualmente `10 - 10 = 0` ✓

**Verificar y ajustar** para que sea más claro (líneas 14-18):
```typescript
if (installDay <= billingDay) {
  firstBillingDate = new Date(installYear, installMonth, billingDay);
  // Cobrar desde el día de instalación hasta el día ANTERIOR al corte
  // Ejemplo: instalar día 2, corte día 10 → cobrar días 2,3,4,5,6,7,8,9 = 8 días
  daysCharged = billingDay - installDay;
}
```

El código actual es correcto. El problema probablemente está en que el monto que el usuario ve ($45) viene de una mensualidad diferente. Si la mensualidad es $150, entonces $150/30 = $5, y 8 días × $5 = $40.

Pero si la mensualidad es $168.75, entonces $168.75/30 = $5.625, y 8 días × $5.625 = $45.

**No se requiere cambio en billing.ts** si los números son correctos.

---

## 3. Hacer Cargos Editables en Resumen

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

Modificar la sección de cargos en el resumen (líneas 1144-1149) para permitir editar el monto:

```typescript
{selectedCharges.map((charge, i) => (
  <div key={i} className="flex justify-between items-center">
    <span>{charge.name}:</span>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={charge.amount}
        onChange={(e) => {
          const newCharges = [...selectedCharges];
          newCharges[i] = { ...charge, amount: parseFloat(e.target.value) || 0 };
          setSelectedCharges(newCharges);
        }}
        className="w-24 h-7 text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => handleRemoveCharge(i)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  </div>
))}
```

También hacer editables el costo de instalación y el prorrateo en el resumen:

```typescript
<div className="flex justify-between items-center">
  <span>Costo de Instalación:</span>
  <Input
    type="number"
    min="0"
    step="0.01"
    value={form.watch('installation_cost') || ''}
    onChange={(e) => form.setValue('installation_cost', parseFloat(e.target.value) || 0)}
    className="w-24 h-7 text-sm text-right"
  />
</div>
<div className="flex justify-between items-center">
  <span>Prorrateo:</span>
  <Input
    type="number"
    min="0"
    step="0.01"
    value={form.watch('prorated_amount') || ''}
    onChange={(e) => form.setValue('prorated_amount', parseFloat(e.target.value) || 0)}
    className="w-24 h-7 text-sm text-right"
  />
</div>
```

El `totalInitialBalance` ya está calculado dinámicamente con `form.watch()`, así que se actualizará automáticamente.

---

## 4. Evitar Submit Accidental

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

El problema es que aunque hay `onKeyDown` para prevenir Enter, los botones "Siguiente" podrían estar triggereando submit. 

**Solución**: Cambiar el botón de submit en el último paso para que sea explícito y agregar `type="button"` a los demás:

Ya está implementado correctamente:
- "Siguiente" tiene `type="button"` (línea 1199)
- "Anterior" tiene `type="button"` (línea 1176)
- Solo "Finalizar y Crear Cliente" tiene `type="submit"` (línea 1184-1185)

**Agregar confirmación adicional antes del submit** (modificar handleFinalize línea 355):

```typescript
const handleFinalize = async (data: FinalizeFormValues) => {
  // Confirmar antes de guardar
  const confirmed = window.confirm(
    `¿Confirmas que los datos son correctos?\n\nTotal a cobrar: ${formatCurrency(totalInitialBalance)}`
  );
  if (!confirmed) return;
  
  // VALIDACIONES OBLIGATORIAS
  // ... resto del código
};
```

---

## Resumen de Cambios

| Archivo | Cambios |
|---------|---------|
| `src/components/prospects/FinalizeProspectDialog.tsx` | Agregar técnico al tab, editables en resumen, confirmación |

---

## Sección Técnica

### Flujo Completo del Técnico

```
1. Usuario crea prospecto con assigned_to (UUID del técnico)
2. Al convertir, el useQuery obtiene full_name del assigned_to
3. Se pre-carga en installer_id del formulario
4. Usuario puede cambiarlo con un Select
5. Al guardar, se busca el full_name del installer_id seleccionado
6. Se guarda en equipment.installer_name
```

### Cálculo de Prorrateo (Verificación)

```
Fecha: 2 de febrero 2026
Día de corte: 10
Días a cobrar: 2, 3, 4, 5, 6, 7, 8, 9 = 8 días

Formula: billing_day - install_day = 10 - 2 = 8 días ✓

Si mensualidad = $150:
  Tarifa diaria = $150 / 30 = $5
  Prorrateo = 8 × $5 = $40 ✓

Si mensualidad = $135:
  Tarifa diaria = $135 / 30 = $4.50
  Prorrateo = 8 × $4.50 = $36 ✓
```

El cálculo en `billing.ts` es correcto. Si el usuario ve $45 con 8 días, la mensualidad calculada sería:
- $45 / 8 días = $5.625/día
- $5.625 × 30 = $168.75 mensualidad

Esto sugiere que el plan/mensualidad seleccionado podría no ser el esperado.
