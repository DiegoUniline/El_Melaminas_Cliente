-- Create service types enum for scheduled services
CREATE TYPE service_type AS ENUM ('installation', 'maintenance', 'equipment_change', 'relocation', 'repair', 'disconnection', 'other');

-- Create service status enum
CREATE TYPE service_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Create scheduled services table
CREATE TABLE public.scheduled_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  service_type service_type NOT NULL DEFAULT 'other',
  status service_status NOT NULL DEFAULT 'scheduled',
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  estimated_duration INTEGER DEFAULT 60,
  charge_id UUID REFERENCES public.client_charges(id) ON DELETE SET NULL,
  charge_amount NUMERIC DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT client_or_prospect CHECK (client_id IS NOT NULL OR prospect_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.scheduled_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assigned services or all if admin"
ON public.scheduled_services
FOR SELECT
USING (assigned_to = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Admins can insert services"
ON public.scheduled_services
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update services"
ON public.scheduled_services
FOR UPDATE
USING (is_admin(auth.uid()) OR assigned_to = auth.uid());

CREATE POLICY "Admins can delete services"
ON public.scheduled_services
FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_services_updated_at
BEFORE UPDATE ON public.scheduled_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();