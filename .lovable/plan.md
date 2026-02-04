

# Plan: Corregir error de inicialización en Services.tsx

## Problema Identificado

El error "Cannot access 'getPersonName' before initialization" ocurre porque:
- En la línea 223, el `useMemo` de `filteredServices` usa la función `getPersonName`
- Pero `getPersonName` está definida en la línea 400, **después** del useMemo
- JavaScript no permite usar variables `const` antes de su declaración

## Solución

Mover las funciones `getPersonName` y `getAddress` **antes** del useMemo `filteredServices`.

## Cambios Técnicos

### Archivo: `src/pages/Services.tsx`

**Mover estas funciones (actualmente en líneas 400-416):**

```typescript
const getPersonName = (service: ScheduledService) => {
  if (service.clients) {
    return `${service.clients.first_name} ${service.clients.last_name_paterno}`;
  }
  if (service.prospects) {
    return `${service.prospects.first_name} ${service.prospects.last_name_paterno} (Prospecto)`;
  }
  return 'Sin asignar';
};

const getAddress = (service: ScheduledService) => {
  const person = service.clients || service.prospects;
  if (person) {
    return `${person.street} #${person.exterior_number}, ${person.neighborhood}`;
  }
  return '';
};
```

**Nueva ubicación:** Antes de la línea 218 (el useMemo de `filteredServices`), aproximadamente después de la línea 215 donde termina el query de `employees`.

## Resultado Esperado

- El buscador funcionará sin errores
- La pantalla no quedará en blanco al escribir en el filtro
- Todas las vistas (Tabla, Agenda, Calendario, Kanban) funcionarán correctamente

