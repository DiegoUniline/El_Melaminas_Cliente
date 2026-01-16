-- =============================================
-- SISTEMA DE GESTIÓN ISP - ESTRUCTURA COMPLETA
-- =============================================

-- 1. ENUM PARA ROLES DE USUARIO
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- 2. ENUM PARA ESTATUS DE PROSPECTO
CREATE TYPE public.prospect_status AS ENUM ('pending', 'finalized', 'cancelled');

-- 3. ENUM PARA ESTATUS DE CLIENTE
CREATE TYPE public.client_status AS ENUM ('active', 'cancelled');

-- 4. TABLA DE ROLES DE USUARIO
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 5. TABLA DE PERFILES DE USUARIO
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABLA DE PROSPECTOS
CREATE TABLE public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos personales
    first_name TEXT NOT NULL,
    last_name_paterno TEXT NOT NULL,
    last_name_materno TEXT,
    
    -- Teléfonos
    phone1 TEXT NOT NULL,
    phone2 TEXT,
    phone3_signer TEXT, -- Teléfono de quien firmará
    
    -- Dirección
    street TEXT NOT NULL,
    exterior_number TEXT NOT NULL,
    interior_number TEXT,
    neighborhood TEXT NOT NULL, -- Colonia
    city TEXT NOT NULL,
    postal_code TEXT,
    
    -- Trabajo
    work_type TEXT,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_date DATE,
    
    -- Técnico
    ssid TEXT,
    antenna_ip TEXT,
    
    -- Notas y estado
    notes TEXT,
    status prospect_status NOT NULL DEFAULT 'pending',
    finalized_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. TABLA DE CLIENTES
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos personales
    first_name TEXT NOT NULL,
    last_name_paterno TEXT NOT NULL,
    last_name_materno TEXT,
    
    -- Teléfonos
    phone1 TEXT NOT NULL,
    phone2 TEXT,
    phone3 TEXT,
    
    -- Dirección
    street TEXT NOT NULL,
    exterior_number TEXT NOT NULL,
    interior_number TEXT,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT,
    
    -- Estado del servicio
    status client_status NOT NULL DEFAULT 'active',
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Documentos (URLs de Storage)
    ine_subscriber_front TEXT,
    ine_subscriber_back TEXT,
    ine_other_front TEXT,
    ine_other_back TEXT,
    contract_page1 TEXT,
    contract_page2 TEXT,
    
    -- Relación con prospecto (si vino de uno)
    prospect_id UUID REFERENCES public.prospects(id),
    
    -- Auditoría
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. TABLA DE EQUIPOS
CREATE TABLE public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    
    -- Antena
    antenna_mac TEXT,
    antenna_brand TEXT,
    antenna_model TEXT,
    antenna_ip TEXT,
    antenna_ssid TEXT,
    
    -- Router
    router_mac TEXT,
    router_brand TEXT,
    router_model TEXT,
    router_ip TEXT,
    router_serial TEXT,
    router_network_name TEXT,
    router_password TEXT,
    
    -- Instalación
    installer_name TEXT,
    installation_date DATE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. TABLA DE CONFIGURACIÓN DE PAGO POR CLIENTE
CREATE TABLE public.client_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Costos
    installation_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    monthly_fee DECIMAL(10,2) NOT NULL,
    
    -- Fechas
    installation_date DATE NOT NULL,
    first_billing_date DATE NOT NULL, -- Fecha del primer corte (día 10)
    
    -- Saldos
    balance DECIMAL(10,2) NOT NULL DEFAULT 0, -- Positivo = a favor, Negativo = adeudo
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. TABLA DE PAGOS
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    
    -- Información del pago
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_type TEXT NOT NULL, -- instalacion, mensualidad
    
    -- Período cubierto (para mensualidades)
    period_month INTEGER, -- 1-12
    period_year INTEGER,
    
    -- Quién pagó
    payer_name TEXT,
    payer_phone TEXT,
    
    -- Recibo y banco
    receipt_number TEXT,
    bank_type TEXT, -- OXXO, Bancomer, HSBC, etc.
    
    -- Notas
    notes TEXT,
    
    -- Auditoría
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FUNCIONES DE SEGURIDAD
-- =============================================

-- Función para verificar rol (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Función para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
$$;

-- =============================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS
-- =============================================

-- USER_ROLES: Solo admins pueden ver/modificar roles
CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- PROFILES: Usuarios ven su perfil, admins ven todos
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- PROSPECTS: Todos los autenticados pueden ver, solo admins pueden editar/eliminar
CREATE POLICY "Authenticated users can view prospects"
    ON public.prospects FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert prospects"
    ON public.prospects FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Only admins can update prospects"
    ON public.prospects FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete prospects"
    ON public.prospects FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- CLIENTS: Todos los autenticados pueden ver, solo admins pueden editar/eliminar
CREATE POLICY "Authenticated users can view clients"
    ON public.clients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert clients"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Only admins can update clients"
    ON public.clients FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete clients"
    ON public.clients FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- EQUIPMENT: Similar a clients
CREATE POLICY "Authenticated users can view equipment"
    ON public.equipment FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert equipment"
    ON public.equipment FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Only admins can update equipment"
    ON public.equipment FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete equipment"
    ON public.equipment FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- CLIENT_BILLING: Similar a clients
CREATE POLICY "Authenticated users can view billing"
    ON public.client_billing FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert billing"
    ON public.client_billing FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Only admins can update billing"
    ON public.client_billing FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete billing"
    ON public.client_billing FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- PAYMENTS: Todos pueden ver e insertar, solo admins pueden editar/eliminar
CREATE POLICY "Authenticated users can view payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Only admins can update payments"
    ON public.payments FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete payments"
    ON public.payments FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
    BEFORE UPDATE ON public.prospects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_updated_at
    BEFORE UPDATE ON public.client_billing
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STORAGE BUCKET PARA DOCUMENTOS
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false);

-- Políticas de storage
CREATE POLICY "Authenticated users can upload documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can view documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'client-documents');

CREATE POLICY "Only admins can delete documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'client-documents' AND public.is_admin(auth.uid()));