-- ====================================================================
-- MIGRATION: segurança de cargos e separação financeira por origem
-- ====================================================================

-- Repete as definições críticas para bancos onde migrations anteriores
-- tenham sido aplicadas manualmente.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.perfis_usuarios
      WHERE user_id = _user_id AND perfil = _role AND ativo = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.perfis_usuarios pu ON pu.user_id = ur.user_id
      WHERE ur.user_id = _user_id AND ur.role = _role AND pu.ativo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- A política histórica permite ao usuário atualizar dados do próprio perfil.
-- Este gatilho preserva essa possibilidade, mas bloqueia a troca de cargo,
-- status ou proprietário quando a alteração não é feita por um administrador.
CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND (
       NEW.perfil IS DISTINCT FROM OLD.perfil
       OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
     ) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar cargos ou status de acesso';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_access_fields_trigger ON public.perfis_usuarios;
CREATE TRIGGER protect_profile_access_fields_trigger
  BEFORE UPDATE ON public.perfis_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_fields();

CREATE OR REPLACE FUNCTION public.can_access_real_estate(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'diretor')
    OR public.has_role(_user_id, 'imobiliaria')
    OR public.has_role(_user_id, 'financeiro_imobiliaria');
$$;

GRANT EXECUTE ON FUNCTION public.can_access_real_estate(UUID) TO authenticated;

-- Remove políticas permissivas antigas e aplica o isolamento da imobiliária.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'imobiliaria_clientes', 'imoveis', 'locacoes', 'imob_fiadores',
        'imob_vistorias', 'imob_vistorias_itens', 'imob_indices_reajuste'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END;
$$;

CREATE POLICY "imobiliaria_clientes_acesso_por_cargo" ON public.imobiliaria_clientes
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "imoveis_acesso_por_cargo" ON public.imoveis
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "locacoes_acesso_por_cargo" ON public.locacoes
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "imob_fiadores_acesso_por_cargo" ON public.imob_fiadores
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "imob_vistorias_acesso_por_cargo" ON public.imob_vistorias
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "imob_vistorias_itens_acesso_por_cargo" ON public.imob_vistorias_itens
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));
CREATE POLICY "imob_indices_reajuste_acesso_por_cargo" ON public.imob_indices_reajuste
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_access_financial_origin(_user_id UUID, _origin TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'diretor')
    OR (
      COALESCE(_origin, 'erp') = 'erp'
      AND (
        public.has_role(_user_id, 'financeiro_civil')
        OR public.has_role(_user_id, 'financeiro')
      )
    )
    OR (
      _origin = 'imobiliaria'
      AND public.has_role(_user_id, 'financeiro_imobiliaria')
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_financial_origin(UUID, TEXT) TO authenticated;

DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contas_receber', 'contas_pagar')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END;
$$;

CREATE POLICY "contas_receber_select_por_origem" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_receber_insert_por_origem" ON public.contas_receber
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_receber_update_por_origem" ON public.contas_receber
  FOR UPDATE TO authenticated
  USING (public.can_access_financial_origin(auth.uid(), origem))
  WITH CHECK (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_receber_delete_admin" ON public.contas_receber
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "contas_pagar_select_por_origem" ON public.contas_pagar
  FOR SELECT TO authenticated
  USING (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_pagar_insert_por_origem" ON public.contas_pagar
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_pagar_update_por_origem" ON public.contas_pagar
  FOR UPDATE TO authenticated
  USING (public.can_access_financial_origin(auth.uid(), origem))
  WITH CHECK (public.can_access_financial_origin(auth.uid(), origem));
CREATE POLICY "contas_pagar_delete_admin" ON public.contas_pagar
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

CREATE INDEX IF NOT EXISTS contas_receber_origem_idx ON public.contas_receber(origem);
CREATE INDEX IF NOT EXISTS contas_pagar_origem_idx ON public.contas_pagar(origem);
