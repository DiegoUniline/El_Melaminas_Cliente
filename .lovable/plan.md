
# Plan: Eliminar Redundancia de Editar y Mejorar Flujo de Conversión

## Problema Identificado

### 1. Redundancia del Botón Editar
Actualmente existen dos botones "Editar" para clientes:
- **En la tabla de clientes** (`Clients.tsx` líneas 265-267): Abre `ClientFormDialog` directamente
- **Dentro del modal de detalle** (`ClientDetailDialog.tsx` líneas 824-827): También abre `ClientFormDialog`

El usuario quiere eliminar el botón de editar de la tabla externa, dejando solo el que está dentro del detalle del cliente.

### 2. Flujo de Conversión Prospecto a Cliente
Cuando se convierte un prospecto a cliente (`FinalizeProspectDialog.tsx`):
- Se crea el cliente
- Se crea el registro de billing con valores en 0 (líneas 270-282)
- **No se piden los datos de facturación inicial** (mensualidad, instalación, prorrateo)

El usuario quiere que al convertir un prospecto se abra un formulario para registrar los cargos iniciales, o que exista un botón "Cargos Iniciales" si no se han configurado.

---

## Solución Propuesta

### Parte 1: Eliminar Botón Editar de la Tabla

**Archivo**: `src/pages/Clients.tsx`

Eliminar las líneas 265-267 de la columna de acciones:
```typescript
// ELIMINAR ESTO:
<Button variant="ghost" size="icon" onClick={() => handleEdit(client)} title="Editar">
  <Edit className="h-4 w-4" />
</Button>
```

El botón "Editar" dentro del modal de detalle (`ClientDetailDialog.tsx` línea 824-827) permanece intacto.

---

### Parte 2: Mejorar Flujo de Conversión con Facturación Inicial

**Archivo**: `src/components/prospects/FinalizeProspectDialog.tsx`

Agregar un tab adicional "Facturación" con los siguientes campos:
1. **Plan de servicio** (select de `service_plans`)
2. **Mensualidad** (pre-llenado del plan pero editable)
3. **Fecha de instalación** 
4. **Día de corte**
5. **Costo de instalación**
6. **Prorrateo** (calculado automático o editable)
7. **Cargos adicionales** (opcional)

Modificar el flujo de `handleFinalize`:
1. Guardar los datos de facturación con valores reales
2. Crear los cargos iniciales automáticamente en `client_charges`:
   - Cargo de instalación (si > 0)
   - Cargo de prorrateo (si > 0)
   - Cargos adicionales (si > 0)
3. Actualizar el balance del cliente con la suma de cargos

**Nuevos campos del schema**:
```typescript
// Agregar al schema de finalización:
plan_id: z.string().optional(),
monthly_fee: z.number().min(0),
installation_date: z.string(),
billing_day: z.number().min(1).max(28),
installation_cost: z.number().min(0),
prorated_amount: z.number().min(0),
additional_charges: z.number().min(0),
additional_charges_notes: z.string().optional(),
```

---

### Parte 3: Botón "Cargos Iniciales" para Clientes Sin Configurar

**Archivo**: `src/pages/ClientDetail.tsx`

En el header del cliente, agregar lógica para detectar si los cargos iniciales han sido configurados:
```typescript
const hasInitialBilling = billing && (
  billing.monthly_fee > 0 || 
  billing.installation_cost > 0 || 
  billing.prorated_amount > 0
);
```

Si `hasInitialBilling` es `false`, mostrar un botón prominente:
```typescript
{!hasInitialBilling && (
  <Button variant="default" onClick={() => setShowInitialBillingDialog(true)}>
    <DollarSign className="h-4 w-4 mr-2" />
    Configurar Cargos Iniciales
  </Button>
)}
```

**Crear nuevo componente**: `InitialBillingDialog.tsx`
- Similar al tab de facturación de `FinalizeProspectDialog`
- Permite configurar mensualidad, instalación, prorrateo
- Crea los cargos iniciales en `client_charges`
- Actualiza el balance

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Clients.tsx` | Eliminar botón Editar de acciones de tabla (líneas 265-267) |
| `src/components/prospects/FinalizeProspectDialog.tsx` | Agregar tab de Facturación con campos de cargos iniciales |
| `src/pages/ClientDetail.tsx` | Agregar botón "Cargos Iniciales" si no están configurados |
| `src/components/clients/InitialBillingDialog.tsx` | Nuevo componente para configurar facturación inicial |

---

## Flujo de Usuario Final

### Al Convertir Prospecto a Cliente:
1. Usuario hace clic en "Finalizar Prospecto"
2. Se muestran 4 tabs: Personal, Dirección, Técnico, **Facturación**
3. En tab Facturación se configuran: plan, mensualidad, instalación, prorrateo
4. Al finalizar, se crean automáticamente los cargos y se actualiza el balance

### Cliente Existente Sin Cargos Iniciales:
1. Al abrir detalle del cliente, se muestra botón "Configurar Cargos Iniciales"
2. Al hacer clic, se abre diálogo para configurar la facturación
3. Una vez configurado, el botón desaparece y la información se muestra en Estado de Cuenta

### Editar Cliente:
1. Usuario va a la tabla de clientes
2. Hace clic en "Ver" (ojo) para abrir el detalle
3. Dentro del detalle hace clic en "Editar"
4. Se abre el formulario completo de edición

---

## Resumen de Cambios

1. **Eliminar** botón Editar de la tabla de clientes
2. **Agregar** tab de Facturación en FinalizeProspectDialog
3. **Crear** cargos iniciales automáticamente al convertir prospecto
4. **Agregar** botón "Cargos Iniciales" en ClientDetail para clientes sin configurar
5. **Crear** nuevo componente InitialBillingDialog para configuración posterior
