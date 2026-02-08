-- 1. Crear tabla cities (catálogo de ciudades)
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cities
CREATE POLICY "Authenticated users can view active cities"
ON public.cities FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert cities"
ON public.cities FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update cities"
ON public.cities FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete cities"
ON public.cities FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_cities_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Crear tabla user_cities (ciudades asignadas a usuarios)
CREATE TABLE public.user_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, city_id)
);

-- Habilitar RLS
ALTER TABLE public.user_cities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_cities
CREATE POLICY "Users can view own city assignments"
ON public.user_cities FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Only admins can manage user cities"
ON public.user_cities FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- 3. Función helper para verificar acceso a ciudades
CREATE OR REPLACE FUNCTION public.user_can_access_city(user_uuid uuid, target_city_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Los admins ven todo
  IF is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Si city_id es NULL, permitir (para compatibilidad durante migración)
  IF target_city_id IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar si el usuario tiene la ciudad asignada
  RETURN EXISTS (
    SELECT 1 FROM public.user_cities
    WHERE user_id = user_uuid AND city_id = target_city_id
  );
END;
$$;

-- 4. Agregar columna city_id a clients
ALTER TABLE public.clients 
ADD COLUMN city_id uuid REFERENCES public.cities(id);

-- 5. Agregar columna city_id a prospects
ALTER TABLE public.prospects 
ADD COLUMN city_id uuid REFERENCES public.cities(id);

-- 6. Migrar datos existentes: insertar ciudades únicas
INSERT INTO public.cities (name)
SELECT DISTINCT city FROM public.clients WHERE city IS NOT NULL AND city != ''
UNION
SELECT DISTINCT city FROM public.prospects WHERE city IS NOT NULL AND city != ''
ON CONFLICT (name) DO NOTHING;

-- 7. Actualizar city_id en clients basándose en el texto
UPDATE public.clients c
SET city_id = (SELECT id FROM public.cities WHERE name = c.city)
WHERE c.city IS NOT NULL AND c.city != '';

-- 8. Actualizar city_id en prospects basándose en el texto
UPDATE public.prospects p
SET city_id = (SELECT id FROM public.cities WHERE name = p.city)
WHERE p.city IS NOT NULL AND p.city != '';

-- 9. Actualizar políticas RLS de clients para filtrar por ciudad
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Users can view clients in their assigned cities"
ON public.clients FOR SELECT
TO authenticated
USING (user_can_access_city(auth.uid(), city_id));

-- 10. Actualizar políticas RLS de prospects para filtrar por ciudad
DROP POLICY IF EXISTS "Authenticated users can view prospects" ON public.prospects;
CREATE POLICY "Users can view prospects in their assigned cities"
ON public.prospects FOR SELECT
TO authenticated
USING (user_can_access_city(auth.uid(), city_id));