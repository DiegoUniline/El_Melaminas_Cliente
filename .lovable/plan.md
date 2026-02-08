
# Plan: Sistema de Ciudades con Control de Acceso por Usuario

## Resumen

Implementar un sistema donde las ciudades sean un catálogo administrable y cada usuario tenga asignadas las ciudades que puede ver. Esto filtrara automaticamente todos los datos relacionados (clientes, prospectos, pagos, servicios, etc.).

## Arquitectura de la Solucion

```text
+------------------+       +---------------------+
|     cities       |       |    user_cities      |
+------------------+       +---------------------+
| id               |<------| city_id             |
| name             |       | user_id             |
| is_active        |       +---------------------+
+------------------+
         |
         v
+------------------+       +------------------+
|    prospects     |       |     clients      |
+------------------+       +------------------+
| city_id (FK)     |       | city_id (FK)     |
| city (backup)    |       | city (backup)    |
+------------------+       +------------------+
```

## Cambios en Base de Datos

### 1. Nueva tabla `cities` (catalogo de ciudades)
```sql
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2. Nueva tabla `user_cities` (ciudades asignadas a usuarios)
```sql
CREATE TABLE public.user_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, city_id)
);
```

### 3. Agregar columna `city_id` a `clients` y `prospects`
- Agregar `city_id uuid REFERENCES cities(id)`
- Mantener la columna `city` existente como texto para compatibilidad

### 4. Funcion helper para verificar acceso a ciudades
```sql
CREATE OR REPLACE FUNCTION public.user_can_access_city(user_uuid uuid, target_city_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Los admins ven todo
  IF is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Verificar si el usuario tiene la ciudad asignada
  RETURN EXISTS (
    SELECT 1 FROM public.user_cities
    WHERE user_id = user_uuid AND city_id = target_city_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 5. Migracion de datos existentes
- Insertar ciudades unicas en la tabla `cities`
- Actualizar `city_id` en clientes y prospectos basandose en el texto existente

### 6. Politicas RLS actualizadas
- `clients`: Solo mostrar donde `user_can_access_city(auth.uid(), city_id)` o admin
- `prospects`: Solo mostrar donde `user_can_access_city(auth.uid(), city_id)` o admin
- Datos relacionados (pagos, servicios, etc.) se filtran automaticamente via el `client_id`

## Cambios en el Frontend

### 1. Nuevo tab en Catalogos: "Ciudades"
- CRUD para administrar ciudades
- Similar a los otros catalogos existentes (bancos, planes, etc.)

### 2. Nueva seccion en Permisos: "Ciudades Asignadas"
- Al seleccionar un usuario, mostrar checkbox de ciudades disponibles
- Solo admins pueden asignar ciudades

### 3. Actualizar formularios de Cliente y Prospecto
- Cambiar el input de texto de ciudad por un selector del catalogo
- Usar `SearchableSelect` existente para busqueda rapida

### 4. Hook `useCities` para manejar ciudades asignadas
- Obtener ciudades disponibles para el usuario actual
- Usar para filtrar automaticamente las consultas

### 5. Actualizar queries de clientes/prospectos
- Agregar filtro por `city_id` basado en ciudades asignadas
- El backend (RLS) tambien filtra, pero el frontend debe mostrar solo las relevantes

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Catalogs.tsx` | Agregar tab de Ciudades |
| `src/pages/Permissions.tsx` | Agregar seccion de ciudades asignadas |
| `src/hooks/useCities.tsx` | Nuevo hook para ciudades |
| `src/components/prospects/ProspectFormDialog.tsx` | Cambiar input por selector |
| `src/components/prospects/EditProspectDialog.tsx` | Cambiar input por selector |
| `src/components/clients/ClientFormDialog.tsx` | Cambiar input por selector |
| `src/components/prospects/FinalizeProspectDialog.tsx` | Usar city_id |
| `src/types/database.ts` | Agregar tipos City y UserCity |

## Consideraciones Importantes

1. **Compatibilidad**: Se mantiene la columna `city` de texto para no romper funcionalidad existente durante la migracion

2. **Admins**: Los administradores siempre ven todos los datos de todas las ciudades

3. **Usuarios sin ciudades asignadas**: Si un usuario no tiene ciudades asignadas, no vera ningun cliente/prospecto

4. **Datos relacionados**: Pagos, servicios y otros datos se filtran automaticamente porque estan vinculados a clientes que ya estan filtrados por ciudad

## Secuencia de Implementacion

1. Crear tablas `cities` y `user_cities` con RLS
2. Migrar datos de ciudades existentes
3. Agregar `city_id` a `clients` y `prospects`
4. Crear funcion `user_can_access_city`
5. Actualizar politicas RLS de `clients` y `prospects`
6. Implementar CRUD de ciudades en Catalogos
7. Implementar asignacion de ciudades en Permisos
8. Crear hook `useCities`
9. Actualizar formularios para usar selector de ciudades
10. Probar el filtrado automatico
