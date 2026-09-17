
-- ============================================
-- FASE 2 — MÓDULO COMERCIAL
-- ============================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.tipo_cliente AS ENUM ('pf', 'pj');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_cliente AS ENUM ('ativo', 'inativo', 'prospect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_oportunidade AS ENUM ('novo','qualificacao','proposta','negociacao','ganho','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- Função: validar CPF/CNPJ
-- ============================================
CREATE OR REPLACE FUNCTION public.validar_cpf_cnpj(doc text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text;
  i int;
  soma int;
  resto int;
  dig1 int;
  dig2 int;
  pesos1 int[];
  pesos2 int[];
BEGIN
  d := regexp_replace(COALESCE(doc, ''), '\D', '', 'g');

  IF length(d) = 11 THEN
    IF d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
    soma := 0;
    FOR i IN 1..9 LOOP soma := soma + substring(d, i, 1)::int * (11 - i); END LOOP;
    resto := (soma * 10) % 11;
    IF resto = 10 THEN resto := 0; END IF;
    IF resto <> substring(d, 10, 1)::int THEN RETURN false; END IF;
    soma := 0;
    FOR i IN 1..10 LOOP soma := soma + substring(d, i, 1)::int * (12 - i); END LOOP;
    resto := (soma * 10) % 11;
    IF resto = 10 THEN resto := 0; END IF;
    RETURN resto = substring(d, 11, 1)::int;
  ELSIF length(d) = 14 THEN
    IF d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
    pesos1 := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
    pesos2 := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
    soma := 0;
    FOR i IN 1..12 LOOP soma := soma + substring(d, i, 1)::int * pesos1[i]; END LOOP;
    resto := soma % 11;
    dig1 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;
    IF dig1 <> substring(d, 13, 1)::int THEN RETURN false; END IF;
    soma := 0;
    FOR i IN 1..13 LOOP soma := soma + substring(d, i, 1)::int * pesos2[i]; END LOOP;
    resto := soma % 11;
    dig2 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;
    RETURN dig2 = substring(d, 14, 1)::int;
  END IF;
  RETURN false;
END;
$$;

-- ============================================
-- Tabela: clientes
-- ============================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_cliente NOT NULL,
  status public.status_cliente NOT NULL DEFAULT 'ativo',
  nome text NOT NULL,
  nome_fantasia text,
  cpf_cnpj text NOT NULL,
  rg_ie text,
  inscricao_municipal text,
  data_nascimento date,
  data_fundacao date,
  email text,
  telefone text,
  celular text,
  website text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  observacoes text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_cpf_cnpj_valido CHECK (public.validar_cpf_cnpj(cpf_cnpj))
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpf_cnpj_unique
  ON public.clientes (cpf_cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS clientes_nome_idx ON public.clientes (nome);
CREATE INDEX IF NOT EXISTS clientes_status_idx ON public.clientes (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comercial pode ver clientes" ON public.clientes;
CREATE POLICY "Comercial pode ver clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro') OR
    public.has_role(auth.uid(), 'engenharia')
  );

DROP POLICY IF EXISTS "Comercial pode criar clientes" ON public.clientes;
CREATE POLICY "Comercial pode criar clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP POLICY IF EXISTS "Comercial pode editar clientes" ON public.clientes;
CREATE POLICY "Comercial pode editar clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP POLICY IF EXISTS "Admin pode excluir clientes" ON public.clientes;
CREATE POLICY "Admin pode excluir clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tabela: oportunidades
-- ============================================
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  valor_estimado numeric(14,2),
  status public.status_oportunidade NOT NULL DEFAULT 'novo',
  probabilidade int NOT NULL DEFAULT 0 CHECK (probabilidade BETWEEN 0 AND 100),
  data_prevista date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oportunidades_cliente_idx ON public.oportunidades (cliente_id);
CREATE INDEX IF NOT EXISTS oportunidades_status_idx ON public.oportunidades (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comercial pode ver oportunidades" ON public.oportunidades;
CREATE POLICY "Comercial pode ver oportunidades" ON public.oportunidades
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro') OR
    public.has_role(auth.uid(), 'engenharia')
  );

DROP POLICY IF EXISTS "Comercial pode criar oportunidades" ON public.oportunidades;
CREATE POLICY "Comercial pode criar oportunidades" ON public.oportunidades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP POLICY IF EXISTS "Comercial pode editar oportunidades" ON public.oportunidades;
CREATE POLICY "Comercial pode editar oportunidades" ON public.oportunidades
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP POLICY IF EXISTS "Admin pode excluir oportunidades" ON public.oportunidades;
CREATE POLICY "Admin pode excluir oportunidades" ON public.oportunidades
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );

DROP TRIGGER IF EXISTS update_oportunidades_updated_at ON public.oportunidades;
CREATE TRIGGER update_oportunidades_updated_at
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tabela: clientes_audit_log
-- ============================================
CREATE TABLE IF NOT EXISTS public.clientes_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  acao text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_audit_cliente_idx ON public.clientes_audit_log (cliente_id);

GRANT SELECT, INSERT ON public.clientes_audit_log TO authenticated;
GRANT ALL ON public.clientes_audit_log TO service_role;

ALTER TABLE public.clientes_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin pode ver audit log" ON public.clientes_audit_log;
CREATE POLICY "Admin pode ver audit log" ON public.clientes_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Sistema pode inserir audit log" ON public.clientes_audit_log;
CREATE POLICY "Sistema pode inserir audit log" ON public.clientes_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_clientes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.clientes_audit_log (cliente_id, acao, dados_depois, user_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.clientes_audit_log (cliente_id, acao, dados_antes, dados_depois, user_id)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.clientes_audit_log (cliente_id, acao, dados_antes, user_id)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_clientes_trigger ON public.clientes;
CREATE TRIGGER audit_clientes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.audit_clientes();
