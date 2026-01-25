
# Plan: Corregir Visualización de Saldo y Próximo Vencimiento

## Problema Identificado

El cliente pagó $90,000 y el sistema creó correctamente 272 mensualidades adelantadas hasta Junio 2047. Sin embargo:

1. **Saldo Actual muestra -$92,751.67** (saldo a favor) cuando debería mostrar $0 o un pequeño remanente
2. **Próximo Vencimiento muestra Febrero 2026** cuando debería mostrar Julio 2047 (el mes después del último pagado)

### Datos Actuales:
- Total pagos: $95,350.00
- Total mensualidades creadas y pagadas: $95,200.00 (272 × $350)
- Cargos pendientes: 0
- Última mensualidad pagada: Junio 2047

---

## Solución

### Parte 1: Calcular el Próximo Vencimiento Basado en Mensualidades Pagadas

**Archivo**: `src/pages/ClientDetail.tsx`

Crear una función que encuentre el último mes pagado y devuelva el siguiente:

```typescript
// Nueva función para calcular próximo vencimiento basado en mensualidades
function getNextDueDate(charges: any[], billingDay: number): { date: Date; coveredUntil: string | null } {
  // Filtrar solo mensualidades pagadas
  const paidMensualidades = charges.filter((c: any) => 
    c.description?.toLowerCase().includes('mensualidad') && 
    c.status === 'paid'
  );
  
  if (paidMensualidades.length === 0) {
    // Sin mensualidades pagadas, usar cálculo tradicional
    return { date: getNextBillingDate(billingDay), coveredUntil: null };
  }
  
  // Encontrar el mes/año más alto
  let maxMonth = 0;
  let maxYear = 0;
  
  paidMensualidades.forEach((charge: any) => {
    const match = charge.description?.match(/(\d{1,2})\/(\d{4})/);
    if (match) {
      const month = parseInt(match[1]);
      const year = parseInt(match[2]);
      if (year > maxYear || (year === maxYear && month > maxMonth)) {
        maxYear = year;
        maxMonth = month;
      }
    }
  });
  
  if (maxYear === 0) {
    return { date: getNextBillingDate(billingDay), coveredUntil: null };
  }
  
  // El siguiente mes después del último pagado
  let nextMonth = maxMonth + 1;
  let nextYear = maxYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  
  const coveredUntil = format(new Date(maxYear, maxMonth - 1, 1), 'MMMM yyyy', { locale: es });
  
  return {
    date: new Date(nextYear, nextMonth - 1, billingDay),
    coveredUntil
  };
}
```

### Parte 2: Mostrar Saldo Correcto

El saldo debería calcularse como:
```
Saldo = Total de cargos pendientes - Crédito no aplicado
```

Si no hay cargos pendientes y todo se aplicó a mensualidades, el saldo es $0.

**Actualizar la visualización del saldo:**

```typescript
// Calcular el saldo real basado en cargos
const pendingChargesTotal = charges
  .filter((c: any) => c.status === 'pending')
  .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

// Si no hay cargos pendientes y hay mensualidades adelantadas, el saldo efectivo es 0
const paidAdvanceMensualidades = charges.filter((c: any) => 
  c.description?.toLowerCase().includes('mensualidad adelantada') && 
  c.status === 'paid'
);

const hasAdvancePayments = paidAdvanceMensualidades.length > 0;
const effectiveBalance = pendingChargesTotal; // Saldo real = cargos pendientes

// Para mostrar en UI
const displayEffectiveBalance = hasAdvancePayments && pendingChargesTotal === 0 
  ? 0 
  : billing?.balance || 0;
```

### Parte 3: Actualizar la UI de las Cards de Resumen

**Card "Saldo Actual" (líneas 1057-1075):**

Cambiar la lógica para mostrar:
- Si hay cargos pendientes: mostrar el total de cargos pendientes como adeudo
- Si no hay cargos pendientes pero hay mensualidades adelantadas: mostrar $0 y "Pagado por adelantado"
- Si hay saldo a favor real (crédito no aplicado): mostrar el saldo a favor

**Card "Próximo Vencimiento" (líneas 1077-1095):**

Usar la nueva función `getNextDueDate` y mostrar:
- La fecha del próximo mes no cubierto
- Un subtítulo indicando hasta cuándo está cubierto: "Cubierto hasta Junio 2047"

---

## Cambios Específicos

### Archivo: `src/pages/ClientDetail.tsx`

#### 1. Agregar nueva función `getNextDueDate` (después de línea 86)

#### 2. Actualizar valores derivados (líneas 384-396)

```typescript
// Derived values
const billing = billingData || client?.client_billing as any;
const equipment = client?.equipment?.[0] as any;
const billingDay = billing?.billing_day || 10;

// Nuevo: Calcular próximo vencimiento basado en mensualidades pagadas
const { date: nextDueDate, coveredUntil } = useMemo(() => {
  return getNextDueDate(charges, billingDay);
}, [charges, billingDay]);

// Calcular saldo efectivo
const pendingChargesTotal = useMemo(() => {
  return charges
    .filter((c: any) => c.status === 'pending')
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
}, [charges]);

const hasAdvancePayments = useMemo(() => {
  return charges.some((c: any) => 
    c.description?.toLowerCase().includes('mensualidad adelantada') && 
    c.status === 'paid'
  );
}, [charges]);

// El saldo efectivo es el total de cargos pendientes
const effectiveBalance = pendingChargesTotal;
const hasFavorBalance = effectiveBalance < 0;
const hasDebt = effectiveBalance > 0;
const displayBalance = Math.abs(effectiveBalance);
const isUpToDate = effectiveBalance === 0 && hasAdvancePayments;
```

#### 3. Actualizar Card "Saldo Actual" (líneas 1057-1075)

```tsx
<Card className={`border-2 ${isUpToDate ? 'border-emerald-200 bg-emerald-50/50' : hasDebt ? 'border-red-200 bg-red-50/50' : ''}`}>
  <CardContent className="pt-4 pb-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Actual</span>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUpToDate ? 'bg-emerald-100' : hasDebt ? 'bg-red-100' : 'bg-muted'}`}>
        <CreditCard className={`h-5 w-5 ${isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-muted-foreground'}`} />
      </div>
    </div>
    <p className={`text-3xl font-bold ${isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : ''}`}>
      {formatCurrency(displayBalance)}
    </p>
    <p className="text-xs flex items-center gap-1 mt-1">
      <span className={`w-2 h-2 rounded-full ${isUpToDate ? 'bg-emerald-500' : hasDebt ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
      <span className={isUpToDate ? 'text-emerald-600' : hasDebt ? 'text-red-600' : 'text-emerald-600'}>
        {isUpToDate ? 'Pagado por adelantado' : hasDebt ? 'Con adeudo' : 'Cuenta al corriente'}
      </span>
    </p>
  </CardContent>
</Card>
```

#### 4. Actualizar Card "Próximo Vencimiento" (líneas 1077-1095)

```tsx
<Card className="border-2">
  <CardContent className="pt-4 pb-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximo Vencimiento</span>
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
        <Calendar className="h-5 w-5 text-amber-600" />
      </div>
    </div>
    <p className="text-2xl font-bold">
      {format(nextDueDate, 'dd MMM yyyy', { locale: es })}
    </p>
    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
      <span className={`w-2 h-2 rounded-full ${coveredUntil ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
      {coveredUntil 
        ? `Cubierto hasta ${coveredUntil}` 
        : pendingCharges.length > 0 
          ? `${pendingCharges.length} cargo(s) pendiente(s)` 
          : 'Sin cargos pendientes'}
    </p>
  </CardContent>
</Card>
```

---

## Resultado Esperado

### Antes:
- **Saldo Actual**: -$92,751.67 (Saldo a favor) 
- **Próximo Vencimiento**: 10 Feb 2026

### Después:
- **Saldo Actual**: $0.00 (Pagado por adelantado)
- **Próximo Vencimiento**: 10 Jul 2047 - "Cubierto hasta Junio 2047"

---

## Visualización Final

```text
+-------------------+  +-------------------+  +-------------------+
|  Tarifa Mensual   |  |   Saldo Actual    |  | Próximo Vencimiento|
|                   |  |                   |  |                   |
|     $350.00       |  |      $0.00        |  |   10 Jul 2047     |
|   Plan activo     |  | Pagado adelantado |  | Cubierto hasta    |
|                   |  |                   |  | Junio 2047        |
+-------------------+  +-------------------+  +-------------------+
```

---

## Beneficios

1. **Claridad**: El usuario ve claramente que está al corriente y hasta cuándo
2. **Precisión**: El saldo refleja la realidad (cargos pendientes reales)
3. **Información útil**: El próximo vencimiento indica cuándo realmente necesita pagar
4. **UX mejorada**: El mensaje "Pagado por adelantado" es más informativo que "Saldo a favor"
