ALTER TABLE public.perfis_usuarios ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

DROP TRIGGER IF EXISTS update_perfis_usuarios_updated_at ON public.perfis_usuarios;
CREATE TRIGGER update_perfis_usuarios_updated_at
BEFORE UPDATE ON public.perfis_usuarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow admins to list/manage all users
DROP POLICY IF EXISTS "Admins view all profiles" ON public.perfis_usuarios;
CREATE POLICY "Admins view all profiles" ON public.perfis_usuarios
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.perfis_usuarios;
CREATE POLICY "Admins update all profiles" ON public.perfis_usuarios
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));