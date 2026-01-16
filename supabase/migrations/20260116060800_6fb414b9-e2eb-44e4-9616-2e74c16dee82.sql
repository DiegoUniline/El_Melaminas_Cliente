-- Create permissions table for granular access control
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL, -- 'dashboard', 'prospects', 'clients', 'payments', etc.
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (is_admin(auth.uid()));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_module ON public.user_permissions(module);

-- Create function to check user permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _module TEXT,
  _action TEXT -- 'view', 'create', 'edit', 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result BOOLEAN;
BEGIN
  -- Admins have all permissions
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Check specific permission
  SELECT 
    CASE _action
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO _result
  FROM public.user_permissions
  WHERE user_id = _user_id AND module = _module;

  RETURN COALESCE(_result, false);
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();