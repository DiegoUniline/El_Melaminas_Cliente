

# Plan: Homologacion de Inputs y Correcciones del Sistema

## Resumen de Cambios

Se homologaran todos los inputs del sistema para mantener consistencia en:
- MAC addresses (formato XX:XX:XX:XX:XX:XX)
- Direcciones IP (validacion de formato)
- Telefonos (formato XXX-XXX-XXXX con selector de pais)
- Instalador/Tecnico (selector de catalogo de usuarios)
- Correccion del calculo de prorrateo

---

## 1. Crear Componente de IP Address

**Nuevo archivo:** `src/components/shared/IpAddressInput.tsx`

Componente que valida el formato de IP (XXX.XXX.XXX.XXX):
- Solo permite numeros y puntos
- Maximo 15 caracteres
- Validacion visual (borde ambar si incompleto)
- Acepta IPv4 estandar

```typescript
// Validacion: cada octeto 0-255, separado por puntos
const isValidIP = (ip: string) => {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every(n => parseInt(n) <= 255);
};
```

---

## 2. Correccion del Prorrateo

**Archivo:** `src/lib/billing.ts`

El problema actual es que cuando la instalacion es DESPUES del dia de corte, no se esta contando el dia de instalacion.

**Ejemplo:**
- Instalar dia 15, corte dia 10, mes de 31 dias
- Actual: 31-15=16 + 9 = 25 dias
- Correcto: debe ser 26 dias (15,16...31 = 17 dias + 1-9 = 9 dias)

**Cambio linea 27:**
```typescript
// ANTES:
const daysUntilEndOfMonth = lastDayOfMonth - installDay;

// DESPUES (incluir dia de instalacion):
const daysUntilEndOfMonth = lastDayOfMonth - installDay + 1;
```

---

## 3. Instalador como Catalogo de Usuarios

**Archivos a modificar:**
- `src/pages/ClientDetail.tsx` (lineas 1728-1732)
- `src/components/clients/ClientFormDialog.tsx`

Cambiar el campo `installer_name` de texto libre a un Select que traiga los usuarios de la tabla `profiles`:

```typescript
// Fetch de tecnicos
const { data: technicians } = useQuery({
  queryKey: ['technicians'],
  queryFn: async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    return data;
  },
});

// En el render (modo edicion):
<Select
  value={editedEquipment.installer_id || ''}
  onValueChange={(v) => setEditedEquipment({ 
    ...editedEquipment, 
    installer_id: v 
  })}
>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar tecnico" />
  </SelectTrigger>
  <SelectContent>
    {technicians?.map((t) => (
      <SelectItem key={t.user_id} value={t.user_id}>
        {t.full_name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Nota:** Se debera agregar el campo `installer_id` a la tabla `equipment` para almacenar el UUID del tecnico.

---

## 4. Telefono en Pagos con PhoneInput

**Archivo:** `src/components/payments/PaymentFormDialog.tsx` (lineas 546-558)

Cambiar el input de texto simple por el componente `PhoneInput`:

```typescript
// Agregar estado para pais del telefono
const [payerPhoneCountry, setPayerPhoneCountry] = useState<PhoneCountry>('MX');

// Reemplazar el FormField de payer_phone:
<FormField
  control={form.control}
  name="payer_phone"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Telefono del Pagador</FormLabel>
      <FormControl>
        <PhoneInput
          value={field.value || ''}
          onChange={field.onChange}
          country={payerPhoneCountry}
          onCountryChange={setPayerPhoneCountry}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 5. Aplicar IpAddressInput en ClientDetail

**Archivo:** `src/pages/ClientDetail.tsx`

Reemplazar inputs de IP (lineas 1569-1573 y 1669-1673):

```typescript
// Antena IP (linea 1571)
<IpAddressInput
  value={editedEquipment.antenna_ip || ''}
  onChange={(v) => setEditedEquipment({ ...editedEquipment, antenna_ip: v })}
/>

// Router IP (linea 1671)
<IpAddressInput
  value={editedEquipment.router_ip || ''}
  onChange={(v) => setEditedEquipment({ ...editedEquipment, router_ip: v })}
/>
```

---

## 6. Aplicar IpAddressInput en ClientFormDialog

**Archivo:** `src/components/clients/ClientFormDialog.tsx`

Mismos cambios para los campos:
- `router_ip`
- `antenna_ip`

---

## 7. Aplicar IpAddressInput en ProspectFormDialog y EditProspectDialog

**Archivos:**
- `src/components/prospects/ProspectFormDialog.tsx`
- `src/components/prospects/EditProspectDialog.tsx`

Cambiar el input de `antenna_ip` por `IpAddressInput`.

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| **NUEVO:** `src/components/shared/IpAddressInput.tsx` | Componente de validacion IP |
| `src/lib/billing.ts` | Correccion formula prorrateo |
| `src/pages/ClientDetail.tsx` | IP inputs + Instalador como Select |
| `src/components/clients/ClientFormDialog.tsx` | IP inputs + Instalador como Select |
| `src/components/payments/PaymentFormDialog.tsx` | PhoneInput para telefono pagador |
| `src/components/prospects/ProspectFormDialog.tsx` | IP input |
| `src/components/prospects/EditProspectDialog.tsx` | IP input |

---

## Seccion Tecnica

### Componente IpAddressInput

```typescript
interface IpAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function IpAddressInput({ value, onChange, ... }: IpAddressInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir numeros y puntos
    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
    // Evitar multiples puntos seguidos
    const normalized = cleaned.replace(/\.+/g, '.');
    onChange(normalized);
  };

  const isValid = isValidIPAddress(value);
  const isPartial = value.length > 0 && !isValid;

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder="192.168.1.1"
      maxLength={15}
      className={isPartial ? 'border-amber-500' : ''}
    />
  );
}
```

### Migracion de Base de Datos (Opcional)

Para soportar el instalador como referencia a usuarios, se puede agregar un campo `installer_id`:

```sql
ALTER TABLE equipment ADD COLUMN installer_id UUID REFERENCES profiles(user_id);
```

Sin embargo, si se prefiere mantener compatibilidad, se puede seguir usando `installer_name` y simplemente guardar el `full_name` del usuario seleccionado.

### Formula de Prorrateo Corregida

**Caso 2 - Instalacion despues del dia de corte:**
```typescript
// Dias restantes del mes INCLUYENDO el dia de instalacion
const daysUntilEndOfMonth = lastDayOfMonth - installDay + 1;
// Dias del siguiente mes hasta un dia ANTES del corte
daysCharged = daysUntilEndOfMonth + (billingDay - 1);
```

Ejemplo verificado:
- Dia instalacion: 15
- Dia corte: 10
- Mes: 31 dias
- Resultado: (31-15+1) + (10-1) = 17 + 9 = 26 dias

