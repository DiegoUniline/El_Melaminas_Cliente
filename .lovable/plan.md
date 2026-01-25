
# Plan: Eliminar Valores Iniciales de "0" en Todos los Formularios del Sistema

## Problema Identificado

El campo de monto en "Registrar Pago" muestra un "0" que no se puede borrar porque:
1. El `defaultValue` es `0` cuando no hay tarifa mensual
2. El `onChange` convierte valores vacíos a `0` con `parseFloat(e.target.value) || 0`

Este patrón se repite en múltiples formularios del sistema.

---

## Archivos Afectados

### 1. PaymentFormDialog.tsx (Problema Principal)
- **Línea 121**: `amount: client?.client_billing?.monthly_fee || 0`
- **Línea 438**: `onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}`

### 2. InitialBillingDialog.tsx
- **Líneas 87, 90, 91**: `monthly_fee: 0`, `installation_cost: 0`, `prorated_amount: 0`
- **Línea 89**: `billing_day: 10` (este valor sí es apropiado como default)

### 3. ClientFormDialog.tsx
- **Líneas 137-138**: `monthly_fee: 0`, `installation_cost: 0`
- **Línea 801**: `onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}`

### 4. ClientDetail.tsx (Formulario de Servicios)
- **Línea 235**: `charge_amount: 0`

### 5. Services.tsx
- **Línea 104**: `charge_amount: 0`

### 6. Catalogs.tsx
- **Línea 96**: `chargeForm.default_amount: ''` (ya usa string vacío, está bien)
- **Línea 103**: `planForm.monthly_fee: ''` (ya usa string vacío, está bien)

### 7. RelocationDialog.tsx y ChangeEquipmentDialog.tsx
- Usan `chargeAmount` como `useState('')` que está correcto

---

## Solución

### Estrategia General

Para cada campo numérico:
1. Cambiar `defaultValue` de `0` a `undefined` o `''`
2. Cambiar el `onChange` para manejar strings vacíos como `undefined`
3. Usar `value={field.value ?? ''}` para mostrar campo vacío en lugar de 0

### Cambio 1: PaymentFormDialog.tsx

```typescript
// Antes (línea 121):
amount: client?.client_billing?.monthly_fee || 0,

// Después:
amount: client?.client_billing?.monthly_fee || undefined,

// Antes (línea 438):
onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}

// Después:
value={field.value ?? ''}
onChange={(e) => {
  const val = e.target.value;
  field.onChange(val === '' ? undefined : parseFloat(val));
}}

// También actualizar el schema (línea 44):
amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),

// Después:
amount: z.number().min(0, 'El monto debe ser mayor o igual a 0').optional(),
```

### Cambio 2: InitialBillingDialog.tsx

```typescript
// Antes (líneas 87, 90, 91):
monthly_fee: 0,
installation_cost: 0,
prorated_amount: 0,

// Después:
monthly_fee: undefined,
installation_cost: undefined,
prorated_amount: undefined,

// Actualizar cada Input con:
value={field.value ?? ''}
onChange={(e) => {
  const val = e.target.value;
  field.onChange(val === '' ? undefined : parseFloat(val));
}}
```

### Cambio 3: ClientFormDialog.tsx

```typescript
// Antes (líneas 137-138):
monthly_fee: 0,
installation_cost: 0,

// Después:
monthly_fee: undefined,
installation_cost: undefined,

// Actualizar onChange (línea 801):
// De: onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
// A:
value={field.value ?? ''}
onChange={(e) => {
  const val = e.target.value;
  field.onChange(val === '' ? undefined : parseFloat(val));
}}
```

### Cambio 4: ClientDetail.tsx (Formulario de Servicios)

```typescript
// Antes (línea 235):
charge_amount: 0,

// Después:
charge_amount: '',

// Y en el Input correspondiente:
value={newServiceRequest.charge_amount || ''}
onChange={(e) => setNewServiceRequest(prev => ({
  ...prev,
  charge_amount: e.target.value === '' ? '' : parseFloat(e.target.value) || ''
}))}
```

### Cambio 5: Services.tsx

```typescript
// Antes (línea 104):
charge_amount: 0,

// Después:
charge_amount: '',

// Y actualizar el Input:
value={newForm.charge_amount || ''}
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/payments/PaymentFormDialog.tsx` | Schema, defaultValues, onChange |
| `src/components/clients/InitialBillingDialog.tsx` | defaultValues, onChange de 3 campos |
| `src/components/clients/ClientFormDialog.tsx` | defaultValues, onChange de 2 campos |
| `src/pages/ClientDetail.tsx` | Estado inicial de charge_amount |
| `src/pages/Services.tsx` | Estado inicial de charge_amount |

---

## Validación

La validación en submit debe considerar que campos numéricos opcionales pueden ser `undefined`:

```typescript
// En onSubmit de PaymentFormDialog:
const cashAmount = data.amount || 0; // Tratar undefined como 0
```

---

## Resultado Esperado

- Todos los campos numéricos en formularios mostrarán un placeholder vacío en lugar de "0"
- El usuario podrá escribir directamente sin necesidad de borrar el "0"
- La validación seguirá funcionando correctamente
- Los valores se guardarán como números cuando se ingresen
