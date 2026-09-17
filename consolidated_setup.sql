
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','diretor','financeiro','compras','engenharia','almoxarifado','rh','cliente');
  END IF;
END$$;

CREATE TABLE public.perfis_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  perfil public.app_role NOT NULL DEFAULT 'cliente',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.perfis_usuarios TO authenticated;
GRANT ALL ON public.perfis_usuarios TO service_role;

ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis_usuarios WHERE user_id = _user_id AND perfil = _role);
$$;

CREATE POLICY "Users view own profile" ON public.perfis_usuarios FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.perfis_usuarios FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert" ON public.perfis_usuarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_perfis_updated BEFORE UPDATE ON public.perfis_usuarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis_usuarios (user_id, nome, email, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'cliente')
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


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



-- Revogar execução pública das funções SECURITY DEFINER novas
REVOKE EXECUTE ON FUNCTION public.audit_clientes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_cpf_cnpj(text) FROM PUBLIC, anon;

-- Substituir policy de insert do audit log (sem WITH CHECK (true))
DROP POLICY IF EXISTS "Sistema pode inserir audit log" ON public.clientes_audit_log;
CREATE POLICY "Sistema pode inserir audit log" ON public.clientes_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor')
  );



REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;



-- Enums
CREATE TYPE public.status_proposta AS ENUM ('rascunho','enviada','aceita','rejeitada','expirada');
CREATE TYPE public.status_contrato AS ENUM ('ativo','concluido','cancelado','suspenso');

-- Sequences for human-readable numbers
CREATE SEQUENCE IF NOT EXISTS public.propostas_numero_seq;
CREATE SEQUENCE IF NOT EXISTS public.contratos_numero_seq;

-- PROPOSTAS
CREATE TABLE public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status public.status_proposta NOT NULL DEFAULT 'rascunho',
  validade date,
  data_envio date,
  condicoes_pagamento text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Propostas visiveis" ON public.propostas FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Propostas insert" ON public.propostas FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Propostas update" ON public.propostas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Propostas delete" ON public.propostas FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') );

-- PROPOSTAS ITENS
CREATE TABLE public.propostas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total numeric(14,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas_itens TO authenticated;
GRANT ALL ON public.propostas_itens TO service_role;
ALTER TABLE public.propostas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Itens visiveis" ON public.propostas_itens FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Itens insert" ON public.propostas_itens FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Itens update" ON public.propostas_itens FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Itens delete" ON public.propostas_itens FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);

-- CONTRATOS
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  objeto text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status public.status_contrato NOT NULL DEFAULT 'ativo',
  data_inicio date,
  data_fim date,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contratos visiveis" ON public.contratos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Contratos insert" ON public.contratos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Contratos update" ON public.contratos FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Contratos delete" ON public.contratos FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') );

-- updated_at triggers
CREATE TRIGGER trg_propostas_updated_at BEFORE UPDATE ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-numbering
CREATE OR REPLACE FUNCTION public.gerar_numero_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'PROP-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.propostas_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_proposta() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gerar_numero_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'CTR-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.contratos_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_contrato() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_propostas_numero BEFORE INSERT ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_proposta();
CREATE TRIGGER trg_contratos_numero BEFORE INSERT ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_contrato();

-- Recalc proposta.valor_total from itens
CREATE OR REPLACE FUNCTION public.recalc_proposta_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.proposta_id, OLD.proposta_id);
  UPDATE public.propostas
    SET valor_total = COALESCE((
      SELECT SUM(valor_total) FROM public.propostas_itens WHERE proposta_id = pid
    ), 0)
    WHERE id = pid;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalc_proposta_total() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_itens_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.propostas_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_proposta_total();



CREATE TYPE public.status_obra AS ENUM ('planejamento','em_andamento','pausada','concluida','cancelada');

CREATE SEQUENCE IF NOT EXISTS public.obras_numero_seq;

CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.status_obra NOT NULL DEFAULT 'planejamento',
  orcamento numeric(14,2) NOT NULL DEFAULT 0,
  valor_executado numeric(14,2) NOT NULL DEFAULT 0,
  progresso int NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  data_inicio_prevista date,
  data_fim_prevista date,
  data_inicio_real date,
  data_fim_real date,
  cep text,
  logradouro text,
  numero_endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Obras visiveis" ON public.obras FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
  OR public.has_role(auth.uid(),'almoxarifado')
);
CREATE POLICY "Obras insert" ON public.obras FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Obras update" ON public.obras FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Obras delete" ON public.obras FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') );

-- Equipe da obra
CREATE TABLE public.obras_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funcao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obra_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras_equipe TO authenticated;
GRANT ALL ON public.obras_equipe TO service_role;
ALTER TABLE public.obras_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe visivel" ON public.obras_equipe FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Equipe insert" ON public.obras_equipe FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Equipe delete" ON public.obras_equipe FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);

CREATE TRIGGER trg_obras_updated_at BEFORE UPDATE ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gerar_numero_obra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'OBRA-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.obras_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_obra() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_obras_numero BEFORE INSERT ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_obra();



-- ============================================
-- DIÁRIO DE OBRA
-- ============================================
CREATE TABLE public.diarios_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima TEXT,
  temperatura NUMERIC(5,2),
  efetivo JSONB NOT NULL DEFAULT '[]'::jsonb,
  atividades TEXT,
  ocorrencias TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diarios_obra_obra ON public.diarios_obra(obra_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra TO authenticated;
GRANT ALL ON public.diarios_obra TO service_role;
ALTER TABLE public.diarios_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarios_select" ON public.diarios_obra FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "diarios_insert" ON public.diarios_obra FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_update" ON public.diarios_obra FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_delete" ON public.diarios_obra FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_diarios_obra_updated BEFORE UPDATE ON public.diarios_obra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fotos do diário
CREATE TABLE public.diarios_obra_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id UUID NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diarios_fotos_diario ON public.diarios_obra_fotos(diario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra_fotos TO authenticated;
GRANT ALL ON public.diarios_obra_fotos TO service_role;
ALTER TABLE public.diarios_obra_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarios_fotos_select" ON public.diarios_obra_fotos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "diarios_fotos_insert" ON public.diarios_obra_fotos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_fotos_delete" ON public.diarios_obra_fotos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));

-- ============================================
-- MEDIÇÕES
-- ============================================
CREATE SEQUENCE IF NOT EXISTS public.medicoes_numero_seq START 1;

CREATE TABLE public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  percentual_total NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicoes_obra ON public.medicoes(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated;
GRANT ALL ON public.medicoes TO service_role;
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes_select" ON public.medicoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_insert" ON public.medicoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "medicoes_update" ON public.medicoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_delete" ON public.medicoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE OR REPLACE FUNCTION public.gerar_numero_medicao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'MED-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.medicoes_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_medicoes_numero BEFORE INSERT ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_medicao();

CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens de medição
CREATE TABLE public.medicoes_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT,
  qtd_contratada NUMERIC(14,4) NOT NULL DEFAULT 0,
  qtd_executada NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicoes_itens_medicao ON public.medicoes_itens(medicao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes_itens TO authenticated;
GRANT ALL ON public.medicoes_itens TO service_role;
ALTER TABLE public.medicoes_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes_itens_select" ON public.medicoes_itens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_itens_mod" ON public.medicoes_itens FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));

-- Recalcula total da medição
CREATE OR REPLACE FUNCTION public.recalc_medicao_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid;
BEGIN
  mid := COALESCE(NEW.medicao_id, OLD.medicao_id);
  UPDATE public.medicoes
    SET valor_total = COALESCE((SELECT SUM(valor_total) FROM public.medicoes_itens WHERE medicao_id = mid), 0)
    WHERE id = mid;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_medicoes_itens_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.medicoes_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_medicao_total();

-- ============================================
-- FINANCEIRO
-- ============================================
CREATE TABLE public.lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lanc_venc ON public.lancamentos_financeiros(data_vencimento);
CREATE INDEX idx_lanc_status ON public.lancamentos_financeiros(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_financeiros TO authenticated;
GRANT ALL ON public.lancamentos_financeiros TO service_role;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lanc_select" ON public.lancamentos_financeiros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_insert" ON public.lancamentos_financeiros FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_update" ON public.lancamentos_financeiros FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_delete" ON public.lancamentos_financeiros FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



REVOKE EXECUTE ON FUNCTION public.gerar_numero_medicao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_medicao_total() FROM PUBLIC, anon, authenticated;



CREATE POLICY "diario_fotos_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
));
CREATE POLICY "diario_fotos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
));
CREATE POLICY "diario_fotos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
));





-- ==========================================
-- 12. MODULO DE DOCUMENTOS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL, -- 'CONTRATO', 'ART', 'PROJETO', 'LICENCA', 'CERTIDAO', 'FISCAL', 'OUTRO'
    obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documentos_versoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID REFERENCES public.documentos(id) ON DELETE CASCADE NOT NULL,
    versao INTEGER NOT NULL DEFAULT 1,
    arquivo_path TEXT NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    tipo_arquivo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de documentos para usuarios autenticados" ON public.documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insercao de documentos para usuarios autenticados" ON public.documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de documentos para usuarios autenticados" ON public.documentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir exclusao de documentos para usuarios autenticados" ON public.documentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Permitir leitura de versoes para usuarios autenticados" ON public.documentos_versoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insercao de versoes para usuarios autenticados" ON public.documentos_versoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de versoes para usuarios autenticados" ON public.documentos_versoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir exclusao de versoes para usuarios autenticados" ON public.documentos_versoes FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Permitir leitura de objetos para usuarios autenticados" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "Permitir insercao de objetos para usuarios autenticados" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "Permitir atualizacao de objetos para usuarios autenticados" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "Permitir exclusao de objetos para usuarios autenticados" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos');
