
-- Enums
DO $$ BEGIN CREATE TYPE public.imob_tipo_cliente AS ENUM ('pf','pj'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.imob_status_cliente AS ENUM ('ativo','inativo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.imob_tipo_imovel AS ENUM ('apartamento','casa','comercial','terreno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.imob_status_imovel AS ENUM ('disponivel','alugado','vendido','inativo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.imob_garantia AS ENUM ('caucao','fiador','seguro_fianca','sem_garantia'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.imob_status_locacao AS ENUM ('ativo','finalizado','rescindido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ IMOBILIARIA_CLIENTES ============
CREATE TABLE IF NOT EXISTS public.imobiliaria_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.imob_tipo_cliente NOT NULL DEFAULT 'pf',
  status public.imob_status_cliente NOT NULL DEFAULT 'ativo',
  nome text NOT NULL,
  nome_fantasia text,
  cpf_cnpj text NOT NULL,
  rg_ie text,
  email text,
  telefone text,
  celular text,
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS imob_clientes_cpf_uniq ON public.imobiliaria_clientes(cpf_cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS imob_clientes_nome_idx ON public.imobiliaria_clientes(nome);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imobiliaria_clientes TO authenticated;
GRANT ALL ON public.imobiliaria_clientes TO service_role;
ALTER TABLE public.imobiliaria_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imob_cli_select" ON public.imobiliaria_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "imob_cli_write" ON public.imobiliaria_clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_imob_cli_upd BEFORE UPDATE ON public.imobiliaria_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ IMOBILIARIA_IMOVEIS ============
CREATE TABLE IF NOT EXISTS public.imobiliaria_imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  tipo public.imob_tipo_imovel NOT NULL,
  status public.imob_status_imovel NOT NULL DEFAULT 'disponivel',
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  quartos int NOT NULL DEFAULT 0,
  banheiros int NOT NULL DEFAULT 0,
  suites int NOT NULL DEFAULT 0,
  vagas int NOT NULL DEFAULT 0,
  area_privativa numeric(14,2),
  area_total numeric(14,2),
  valor_locacao numeric(14,2),
  valor_venda numeric(14,2),
  valor_condominio numeric(14,2),
  valor_iptu numeric(14,2),
  proprietario_id uuid NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE RESTRICT,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imob_imoveis_status_idx ON public.imobiliaria_imoveis(status);
CREATE INDEX IF NOT EXISTS imob_imoveis_proprietario_idx ON public.imobiliaria_imoveis(proprietario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imobiliaria_imoveis TO authenticated;
GRANT ALL ON public.imobiliaria_imoveis TO service_role;
ALTER TABLE public.imobiliaria_imoveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imob_imo_select" ON public.imobiliaria_imoveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "imob_imo_write" ON public.imobiliaria_imoveis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_imob_imo_upd BEFORE UPDATE ON public.imobiliaria_imoveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ IMOBILIARIA_LOCACOES ============
CREATE TABLE IF NOT EXISTS public.imobiliaria_locacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_numero text NOT NULL UNIQUE,
  imovel_id uuid NOT NULL REFERENCES public.imobiliaria_imoveis(id) ON DELETE RESTRICT,
  locatario_id uuid NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE RESTRICT,
  data_inicio date NOT NULL,
  data_fim date,
  dia_vencimento int NOT NULL,
  valor_aluguel numeric(14,2) NOT NULL,
  taxa_administracao_percentual numeric(5,2) NOT NULL DEFAULT 0,
  garantia_tipo public.imob_garantia NOT NULL,
  garantia_valor numeric(14,2),
  status public.imob_status_locacao NOT NULL DEFAULT 'ativo',
  observacoes text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imob_loc_status_idx ON public.imobiliaria_locacoes(status);
CREATE INDEX IF NOT EXISTS imob_loc_imovel_idx ON public.imobiliaria_locacoes(imovel_id);
CREATE INDEX IF NOT EXISTS imob_loc_locatario_idx ON public.imobiliaria_locacoes(locatario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imobiliaria_locacoes TO authenticated;
GRANT ALL ON public.imobiliaria_locacoes TO service_role;
ALTER TABLE public.imobiliaria_locacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imob_loc_select" ON public.imobiliaria_locacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "imob_loc_write" ON public.imobiliaria_locacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_imob_loc_upd BEFORE UPDATE ON public.imobiliaria_locacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
