

# Plan: Validaciones Obligatorias y Corrección de Datos Prospecto→Cliente

## Resumen

Se implementarán validaciones que **bloqueen el guardado** cuando haya errores en MAC, IP o teléfono, y se corregirá el flujo de conversión prospecto→cliente para que la fecha de instalación y el técnico instalador se transfieran correctamente.

---

## 1. Exportar Funciones de Validación

**Archivos a modificar:**
- `src/lib/formatUtils.ts` - Agregar validación de IP
- `src/lib/phoneUtils.ts` - Agregar validación de teléfono completo

Se exportarán las funciones para reutilizarlas:

```typescript
// formatUtils.ts - Agregar:
export function isValidIPAddress(ip: string): boolean {
  if (!ip) return true; // Vacío es válido (campo opcional)
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every(n => parseInt(n) <= 255);
}

// phoneUtils.ts - Agregar:
export function isPhoneComplete(phone: string): boolean {
  if (!phone) return true; // Vacío es válido para campos opcionales
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
}
```

---

## 2. Bloquear Guardado con Errores en ClientDetail

**Archivo:** `src/pages/ClientDetail.tsx`

Agregar validación al inicio de `handleSave` (línea ~923):

```typescript
const handleSave = async () => {
  if (!client || !clientId) return;
  
  // VALIDACIONES OBLIGATORIAS
  const errors: string[] = [];
  
  // Validar teléfonos
  if (!isPhoneComplete(editedClient.phone1)) {
    errors.push('Teléfono 1 debe tener 10 dígitos');
  }
  if (editedClient.phone2 && !isPhoneComplete(editedClient.phone2)) {
    errors.push('Teléfono 2 debe tener 10 dígitos');
  }
  if (editedClient.phone3 && !isPhoneComplete(editedClient.phone3)) {
    errors.push('Teléfono 3 debe tener 10 dígitos');
  }
  
  // Validar MACs (si tienen valor, deben estar completas)
  if (editedEquipment.antenna_mac && !isMacAddressComplete(editedEquipment.antenna_mac)) {
    errors.push('MAC Antena debe tener 12 caracteres hexadecimales');
  }
  if (editedEquipment.router_mac && !isMacAddressComplete(editedEquipment.router_mac)) {
    errors.push('MAC Router debe tener 12 caracteres hexadecimales');
  }
  
  // Validar IPs (si tienen valor, deben ser válidas)
  if (editedEquipment.antenna_ip && !isValidIPAddress(editedEquipment.antenna_ip)) {
    errors.push('IP Antena no tiene formato válido (ej: 192.168.1.1)');
  }
  if (editedEquipment.router_ip && !isValidIPAddress(editedEquipment.router_ip)) {
    errors.push('IP Router no tiene formato válido');
  }
  
  if (errors.length > 0) {
    toast.error(errors.join('\n'));
    return; // NO GUARDAR
  }
  
  // ... resto del código de guardado
};
```

---

## 3. Corregir FinalizeProspectDialog - Transferir Datos del Prospecto

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

### 3.1 Obtener nombre del técnico asignado

Agregar query para obtener el nombre del técnico (después de línea ~118):

```typescript
// Fetch assigned technician name
const { data: assignedTechnician } = useQuery({
  queryKey: ['assigned-technician', prospect?.assigned_to],
  queryFn: async () => {
    if (!prospect?.assigned_to) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', prospect.assigned_to)
      .maybeSingle();
    if (error) throw error;
    return data?.full_name || null;
  },
  enabled: !!prospect?.assigned_to,
});
```

### 3.2 Modificar creación de equipment (líneas 401-413)

Cambiar de:
```typescript
const { error: equipmentError } = await supabase
  .from('equipment')
  .insert({
    client_id: clientData.id,
    antenna_ssid: data.ssid || null,
    antenna_ip: data.antenna_ip || null,
  });
```

A:
```typescript
const { error: equipmentError } = await supabase
  .from('equipment')
  .insert({
    client_id: clientData.id,
    antenna_ssid: data.ssid || null,
    antenna_ip: data.antenna_ip || null,
    installation_date: data.installation_date,  // NUEVO
    installer_name: assignedTechnician || null, // NUEVO - desde prospecto
  });
```

---

## 4. Actualizar Datos del Cliente Actual en BD

Se ejecutará una actualización SQL para corregir el cliente que actualmente tiene fecha de instalación vacía:

```sql
-- Actualizar equipment con fecha de instalación desde client_billing
UPDATE equipment e
SET 
  installation_date = cb.installation_date,
  installer_name = pr.full_name
FROM clients c
JOIN client_billing cb ON cb.client_id = c.id
JOIN prospects p ON p.id = c.prospect_id
LEFT JOIN profiles pr ON pr.user_id = p.assigned_to
WHERE e.client_id = c.id
AND c.id = 'bde7ab1d-7c6f-4e75-ab61-5736f2a66793';
```

---

## 5. Aplicar Validaciones en Otros Formularios

Se aplicarán las mismas validaciones obligatorias en:

| Archivo | Campos a Validar |
|---------|------------------|
| `ClientFormDialog.tsx` | Teléfonos, MAC, IP |
| `ProspectFormDialog.tsx` | Teléfonos, IP antena |
| `EditProspectDialog.tsx` | Teléfonos, IP antena |
| `PaymentFormDialog.tsx` | Teléfono pagador |

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/formatUtils.ts` | Exportar `isValidIPAddress`, `isValidMacAddress` |
| `src/lib/phoneUtils.ts` | Agregar y exportar `isPhoneComplete` |
| `src/pages/ClientDetail.tsx` | Validaciones antes de guardar |
| `src/components/prospects/FinalizeProspectDialog.tsx` | Pasar installation_date e installer_name desde prospecto |
| `src/components/clients/ClientFormDialog.tsx` | Validaciones antes de guardar |
| `src/components/prospects/ProspectFormDialog.tsx` | Validaciones antes de guardar |
| `src/components/prospects/EditProspectDialog.tsx` | Validaciones antes de guardar |
| `src/components/payments/PaymentFormDialog.tsx` | Validación teléfono pagador |

---

## Sección Técnica

### Función de Validación Completa

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateClientData(
  client: EditedClientData, 
  equipment: EditedEquipmentData
): ValidationResult {
  const errors: string[] = [];
  
  // Teléfono 1 obligatorio y completo
  if (!client.phone1 || !isPhoneComplete(client.phone1)) {
    errors.push('Teléfono 1 debe tener 10 dígitos');
  }
  
  // Teléfonos opcionales pero si tienen valor, deben estar completos
  if (client.phone2 && !isPhoneComplete(client.phone2)) {
    errors.push('Teléfono 2 incompleto');
  }
  
  // MACs opcionales pero si tienen valor, deben ser válidas
  if (equipment.antenna_mac && !isMacAddressComplete(equipment.antenna_mac)) {
    errors.push('MAC Antena incompleta (requiere 12 caracteres hex)');
  }
  
  // IPs opcionales pero si tienen valor, deben ser válidas
  if (equipment.antenna_ip && !isValidIPAddress(equipment.antenna_ip)) {
    errors.push('IP Antena inválida');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### SQL para Actualizar Cliente Existente

```sql
-- Primero verificar los datos
SELECT 
  c.id as client_id,
  c.first_name,
  e.installation_date as equip_install_date,
  cb.installation_date as billing_install_date,
  e.installer_name as current_installer,
  pr.full_name as prospect_technician
FROM clients c
JOIN equipment e ON e.client_id = c.id
JOIN client_billing cb ON cb.client_id = c.id
JOIN prospects p ON p.id = c.prospect_id
LEFT JOIN profiles pr ON pr.user_id = p.assigned_to
WHERE c.id = 'bde7ab1d-7c6f-4e75-ab61-5736f2a66793';

-- Actualizar
UPDATE equipment 
SET 
  installation_date = '2026-01-28',
  installer_name = 'Raul Michel'
WHERE client_id = 'bde7ab1d-7c6f-4e75-ab61-5736f2a66793';
```

