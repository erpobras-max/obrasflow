
-- Renomeia tabelas do imobiliário para nomes usados no código
ALTER TABLE IF EXISTS public.imobiliaria_imoveis RENAME TO imoveis;
ALTER TABLE IF EXISTS public.imobiliaria_locacoes RENAME TO locacoes;

-- ============ FORNECEDORES ============
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
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
  ativo boolean NOT NULL DEFAULT true,
  codigo_externo text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fornecedores_razao_idx ON public.fornecedores(razao_social);
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_cnpj_uniq ON public.fornecedores(cnpj) WHERE deleted_at IS NULL AND cnpj IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forn_select" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "forn_write" ON public.fornecedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_forn_upd BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ajusta FK dos pedidos de compra para apontar para fornecedores (novo)
ALTER TABLE public.pedidos_compra
  DROP CONSTRAINT IF EXISTS pedidos_compra_fornecedor_id_fkey,
  ADD CONSTRAINT pedidos_compra_fornecedor_id_fkey
    FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE RESTRICT;

-- ============ CONTAS RECEBER ============
DO $$ BEGIN CREATE TYPE public.status_conta_receber AS ENUM ('aberta','recebida','atrasada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor_total bigint NOT NULL,
  data_vencimento date NOT NULL,
  data_recebimento date,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  imob_cliente_id uuid REFERENCES public.imobiliaria_clientes(id) ON DELETE SET NULL,
  imob_locacao_id uuid REFERENCES public.locacoes(id) ON DELETE SET NULL,
  pedido_venda_id uuid REFERENCES public.pedidos_venda(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  status public.status_conta_receber NOT NULL DEFAULT 'aberta',
  origem text,
  numero_documento text,
  forma_pagamento text,
  observacoes text,
  codigo_externo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cr_status_idx ON public.contas_receber(status);
CREATE INDEX IF NOT EXISTS cr_vencto_idx ON public.contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS cr_cliente_idx ON public.contas_receber(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber TO authenticated;
GRANT ALL ON public.contas_receber TO service_role;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_select" ON public.contas_receber FOR SELECT TO authenticated USING (true);
CREATE POLICY "cr_write" ON public.contas_receber FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_cr_upd BEFORE UPDATE ON public.contas_receber
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONTAS PAGAR ============
DO $$ BEGIN CREATE TYPE public.status_conta_pagar AS ENUM ('aberta','paga','atrasada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor_total bigint NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  imob_cliente_id uuid REFERENCES public.imobiliaria_clientes(id) ON DELETE SET NULL,
  imob_locacao_id uuid REFERENCES public.locacoes(id) ON DELETE SET NULL,
  pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  status public.status_conta_pagar NOT NULL DEFAULT 'aberta',
  origem text,
  numero_documento text,
  forma_pagamento text,
  observacoes text,
  codigo_externo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cp_status_idx ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS cp_vencto_idx ON public.contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS cp_forn_idx ON public.contas_pagar(fornecedor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON public.contas_pagar FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_write" ON public.contas_pagar FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_cp_upd BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VISTORIAS IMOBILIÁRIA ============
DO $$ BEGIN CREATE TYPE public.tipo_vistoria AS ENUM ('entrada','saida','periodica'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.status_vistoria AS ENUM ('agendada','realizada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.imob_vistorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locacao_id uuid REFERENCES public.locacoes(id) ON DELETE SET NULL,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE RESTRICT,
  tipo public.tipo_vistoria NOT NULL,
  status public.status_vistoria NOT NULL DEFAULT 'agendada',
  data_vistoria date NOT NULL,
  responsavel text NOT NULL,
  parecer_geral text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vist_locacao_idx ON public.imob_vistorias(locacao_id);
CREATE INDEX IF NOT EXISTS vist_imovel_idx ON public.imob_vistorias(imovel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_vistorias TO authenticated;
GRANT ALL ON public.imob_vistorias TO service_role;
ALTER TABLE public.imob_vistorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vist_select" ON public.imob_vistorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "vist_write" ON public.imob_vistorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_vist_upd BEFORE UPDATE ON public.imob_vistorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
