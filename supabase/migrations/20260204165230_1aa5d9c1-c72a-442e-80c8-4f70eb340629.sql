-- Add fields for service completion details
ALTER TABLE public.scheduled_services
ADD COLUMN IF NOT EXISTS work_performed TEXT,
ADD COLUMN IF NOT EXISTS received_by_name TEXT,
ADD COLUMN IF NOT EXISTS service_acknowledged BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.scheduled_services.work_performed IS 'Description of what work was actually performed';
COMMENT ON COLUMN public.scheduled_services.received_by_name IS 'Name of person who received/acknowledged the completed service';
COMMENT ON COLUMN public.scheduled_services.service_acknowledged IS 'Whether the service was acknowledged/signed off by someone';