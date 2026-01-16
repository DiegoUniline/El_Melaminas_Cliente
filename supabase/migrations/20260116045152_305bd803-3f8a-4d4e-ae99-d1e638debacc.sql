-- Catálogo de métodos de pago
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment methods"
  ON public.payment_methods FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert payment methods"
  ON public.payment_methods FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can update payment methods"
  ON public.payment_methods FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete payment methods"
  ON public.payment_methods FOR DELETE USING (is_admin(auth.uid()));

-- Insertar métodos de pago comunes
INSERT INTO public.payment_methods (name, description) VALUES
  ('Efectivo', 'Pago en efectivo'),
  ('Transferencia', 'Transferencia bancaria'),
  ('Depósito', 'Depósito bancario'),
  ('Tarjeta de débito', 'Pago con tarjeta de débito'),
  ('Tarjeta de crédito', 'Pago con tarjeta de crédito'),
  ('OXXO', 'Pago en tienda OXXO'),
  ('PayPal', 'Pago por PayPal');

-- Catálogo de bancos
CREATE TABLE public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_banks_updated_at
  BEFORE UPDATE ON public.banks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para banks
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view banks"
  ON public.banks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert banks"
  ON public.banks FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can update banks"
  ON public.banks FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete banks"
  ON public.banks FOR DELETE USING (is_admin(auth.uid()));

-- Insertar bancos mexicanos comunes
INSERT INTO public.banks (name, short_name) VALUES
  ('BBVA México', 'BBVA'),
  ('Santander', 'Santander'),
  ('Banorte', 'Banorte'),
  ('HSBC', 'HSBC'),
  ('Scotiabank', 'Scotiabank'),
  ('Citibanamex', 'Banamex'),
  ('Banco Azteca', 'Azteca'),
  ('BanCoppel', 'Coppel'),
  ('Inbursa', 'Inbursa'),
  ('Banregio', 'Banregio'),
  ('Afirme', 'Afirme');