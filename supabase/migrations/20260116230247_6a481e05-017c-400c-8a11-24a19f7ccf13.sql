-- Agregar columnas de país para teléfonos en prospects
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS phone1_country text DEFAULT 'MX',
ADD COLUMN IF NOT EXISTS phone2_country text DEFAULT 'MX',
ADD COLUMN IF NOT EXISTS phone3_country text DEFAULT 'MX';

-- Agregar columnas de país para teléfonos en clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS phone1_country text DEFAULT 'MX',
ADD COLUMN IF NOT EXISTS phone2_country text DEFAULT 'MX',
ADD COLUMN IF NOT EXISTS phone3_country text DEFAULT 'MX';

-- Crear tabla de historial de cambios de prospectos
CREATE TABLE public.prospect_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.prospect_change_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view prospect history" 
ON public.prospect_change_history 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert prospect history" 
ON public.prospect_change_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Only admins can update prospect history" 
ON public.prospect_change_history 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete prospect history" 
ON public.prospect_change_history 
FOR DELETE 
USING (is_admin(auth.uid()));