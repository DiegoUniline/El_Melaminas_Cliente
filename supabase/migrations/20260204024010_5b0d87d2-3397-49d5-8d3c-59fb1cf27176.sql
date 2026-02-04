-- Add fields to track visit start with GPS coordinates
ALTER TABLE public.scheduled_services
ADD COLUMN visit_started_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN visit_latitude DECIMAL(10, 8) NULL,
ADD COLUMN visit_longitude DECIMAL(11, 8) NULL;