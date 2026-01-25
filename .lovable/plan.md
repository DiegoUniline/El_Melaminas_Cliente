
# Plan: Eliminar Campo de Periodo y Mejorar Visualización de Mensualidades Cubiertas

## Problema Identificado

El usuario describe correctamente el flujo:
- Si el saldo es $1,000 y la mensualidad es $300, al pagar $1,600:
  - $1,000 van a cubrir el saldo pendiente
  - $600 restantes cubren 2 mensualidades futuras ($600 / $300 = 2 meses)
  - Estas mensualidades deben pre-registrarse como pagadas en el historial

**Estado Actual:**
- El sistema YA tiene la lógica de crear mensualidades adelantadas (líneas 252-296 de `PaymentFormDialog.tsx`)
- PERO el formulario pide "Periodo de Pago" (mes/año) manualmente, lo cual es redundante
- El periodo se guarda en la tabla `payments` pero las mensualidades cubiertas están en `client_charges`

**Problema UX:**
- No tiene sentido pedir periodo ya que el sistema calcula automáticamente qué cargos se cubren
- Las mensualidades adelantadas ya se crean correctamente en `client_charges`
- El campo de periodo confunde porque el pago puede cubrir múltiples periodos

---

## Solución Propuesta

### Parte 1: Eliminar Campos de Periodo del Formulario de Pagos

**Archivo**: `src/components/payments/PaymentFormDialog.tsx`

1. **Eliminar del schema:**
```typescript
// Eliminar estas líneas
period_month: z.number().min(1).max(12).optional(),
period_year: z.number().min(2020).optional(),
```

2. **Eliminar de defaultValues:**
```typescript
// Eliminar
period_month: currentMonth,
period_year: currentYear,
```

3. **Eliminar los campos del formulario (líneas 513-568):**
   - Eliminar el `<div className="grid grid-cols-2 gap-4">` que contiene "Mes del Periodo" y "Año del Periodo"

4. **Actualizar el insert de payments (línea 190-191):**
```typescript
// Eliminar estas líneas
period_month: data.period_month || null,
period_year: data.period_year || null,
```

5. **Eliminar constantes no usadas:**
```typescript
// Eliminar MONTHS array (líneas 67-80)
// Eliminar currentMonth y currentYear si ya no se usan
```

### Parte 2: Mostrar Resumen de Aplicación en Toast

Cuando se registra un pago, mostrar un resumen claro de a qué se aplicó:

```typescript
// Después de procesar el pago, construir mensaje informativo
let summaryMessage = 'Pago registrado. ';
const paidCharges = chargesPaidCount;
const advanceMonths = monthsToCover;

if (paidCharges > 0) {
  summaryMessage += `${paidCharges} cargo(s) cubierto(s). `;
}
if (advanceMonths > 0) {
  summaryMessage += `${advanceMonths} mensualidad(es) adelantada(s). `;
}
if (newBalance < 0) {
  summaryMessage += `Saldo a favor: ${formatCurrency(Math.abs(newBalance))}`;
}

toast.success(summaryMessage);
```

### Parte 3: Actualizar Vista de Pagos

**Archivo**: `src/pages/Payments.tsx`

1. **Eliminar columna de Periodo de la tabla:**
```typescript
// Eliminar en columna 'client' las líneas 103-107
{payment.period_month && payment.period_year && (
  <p className="text-sm text-muted-foreground">
    Periodo: {payment.period_month}/{payment.period_year}
  </p>
)}
```

2. **Actualizar exportación Excel (línea 74):**
```typescript
// Eliminar línea
'Periodo': payment.period_month && payment.period_year ? `${payment.period_month}/${payment.period_year}` : '',
```

3. **Agregar columna "Cargos Cubiertos":** (Opcional pero útil)
   - Mostrar cuántos cargos (`client_charges`) están asociados a este `payment_id`

### Parte 4: Actualizar Detalle de Pago

**Archivo**: `src/components/payments/PaymentDetailDialog.tsx`

1. **Eliminar sección de Periodo (líneas 74-84):**
```typescript
// Eliminar este bloque
{payment.period_month && payment.period_year && (
  <div className="flex items-start gap-3">
    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
    <div>
      <p className="text-sm text-muted-foreground">Periodo</p>
      <p className="font-medium">
        {payment.period_month}/{payment.period_year}
      </p>
    </div>
  </div>
)}
```

2. **Agregar sección "Cargos Cubiertos":** 
   - Hacer query de `client_charges` donde `payment_id = payment.id`
   - Mostrar lista de cargos que fueron pagados con este pago
   - Esto da visibilidad clara de a qué se aplicó el pago

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/payments/PaymentFormDialog.tsx` | Eliminar campos de periodo, actualizar insert |
| `src/pages/Payments.tsx` | Eliminar referencia a periodo en tabla y export |
| `src/components/payments/PaymentDetailDialog.tsx` | Eliminar periodo, agregar lista de cargos cubiertos |

---

## Flujo de Usuario Final

### Al Registrar Pago:
1. Usuario ingresa monto ($1,600)
2. Usuario selecciona tipo de pago y fecha
3. Usuario hace clic en "Registrar Pago"
4. **Sistema procesa automáticamente:**
   - Paga cargos pendientes del más antiguo al más nuevo
   - Si hay excedente, crea mensualidades adelantadas marcadas como pagadas
   - Si queda sobrante (no alcanza para otra mensualidad), queda como saldo a favor
5. **Toast muestra:** "Pago registrado. 3 cargo(s) cubierto(s). 2 mensualidad(es) adelantada(s)."

### Al Ver Detalle de Pago:
1. Muestra monto, fecha, tipo, banco
2. **Nueva sección "Cargos Cubiertos":**
   - Costo de instalación - $1,000
   - Mensualidad adelantada 2/2026 - $300
   - Mensualidad adelantada 3/2026 - $300

### Historial de Mensualidades (client_charges):
El usuario verá en el historial del cliente:
- Mensualidad 2/2026 - Pagada (vinculada al pago)
- Mensualidad 3/2026 - Pagada (vinculada al pago)

---

## Beneficios

1. **Simplicidad**: No se pide información redundante al operador
2. **Precisión**: El sistema calcula exactamente qué se cubre
3. **Trazabilidad**: Cada cargo sabe qué pago lo cubrió
4. **Flexibilidad**: El pago puede cubrir múltiples tipos de cargos (instalación + prorrateo + mensualidades)
5. **Visibilidad**: El detalle del pago muestra exactamente a qué se aplicó

---

## Sección Técnica

### Schema después de cambios:
```typescript
const paymentSchema = z.object({
  amount: z.number().min(0),
  payment_type: z.string().optional(),
  bank_type: z.string().optional(),
  payment_date: z.string().min(1),
  // ELIMINADO: period_month, period_year
  receipt_number: z.string().optional(),
  payer_name: z.string().optional(),
  payer_phone: z.string().optional(),
  notes: z.string().optional(),
  use_credit_balance: z.boolean().optional(),
  credit_amount_to_use: z.number().optional(),
});
```

### Query para cargos cubiertos en PaymentDetailDialog:
```typescript
const { data: coveredCharges } = useQuery({
  queryKey: ['payment_charges', payment?.id],
  queryFn: async () => {
    if (!payment) return [];
    const { data, error } = await supabase
      .from('client_charges')
      .select('id, description, amount, paid_date')
      .eq('payment_id', payment.id)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  enabled: !!payment,
});
```

### Nota sobre datos existentes:
Los pagos existentes que tienen `period_month` y `period_year` seguirán guardados en la base de datos. Simplemente no se mostrarán ni se pedirán en nuevos registros. La información real de qué cargos se cubrieron está en `client_charges.payment_id`.
