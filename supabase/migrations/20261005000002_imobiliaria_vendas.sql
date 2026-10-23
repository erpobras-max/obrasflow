-- Vendas de imóveis, contrato de compra e venda e documentos anexos.

CREATE TABLE IF NOT EXISTS public.imob_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE RESTRICT,
  comprador_id UUID NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE RESTRICT,
  data_proposta DATE NOT NULL DEFAULT CURRENT_DATE,
  data_contrato DATE,
  data_fechamento DATE,
  valor_venda NUMERIC(14,2) NOT NULL CHECK (valor_venda > 0),
  entrada_valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (entrada_valor >= 0),
  forma_pagamento TEXT NOT NULL DEFAULT 'avista' CHECK (forma_pagamento IN ('avista', 'financiamento', 'parcelado', 'permuta', 'outro')),
  parcelas INTEGER NOT NULL DEFAULT 1 CHECK (parcelas >= 1 AND parcelas <= 360),
  comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (comissao_percentual >= 0 AND comissao_percentual <= 100),
  status TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN ('rascunho', 'proposta', 'contratada', 'efetivada', 'cancelada')),
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS imob_vendas_numero_ativo_uniq
  ON public.imob_vendas(numero) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS imob_vendas_imovel_idx ON public.imob_vendas(imovel_id);
CREATE INDEX IF NOT EXISTS imob_vendas_comprador_idx ON public.imob_vendas(comprador_id);
CREATE INDEX IF NOT EXISTS imob_vendas_status_idx ON public.imob_vendas(status);

CREATE TABLE IF NOT EXISTS public.imob_venda_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.imob_vendas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outro' CHECK (categoria IN ('proposta', 'documento_comprador', 'documento_proprietario', 'contrato', 'contrato_assinado', 'financiamento', 'certidao', 'outro')),
  object_key TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imob_venda_documentos_venda_idx ON public.imob_venda_documentos(venda_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_vendas, public.imob_venda_documentos TO authenticated;
GRANT ALL ON public.imob_vendas, public.imob_venda_documentos TO service_role;

ALTER TABLE public.imob_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imob_venda_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_vendas_acesso" ON public.imob_vendas;
CREATE POLICY "imob_vendas_acesso" ON public.imob_vendas
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

DROP POLICY IF EXISTS "imob_venda_documentos_acesso" ON public.imob_venda_documentos;
CREATE POLICY "imob_venda_documentos_acesso" ON public.imob_venda_documentos
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

CREATE OR REPLACE FUNCTION public.imob_venda_atualiza_status_imovel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status = 'efetivada' AND NEW.deleted_at IS NULL THEN
    UPDATE public.imoveis SET status = 'vendido', updated_at = now() WHERE id = NEW.imovel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imob_venda_status_imovel ON public.imob_vendas;
CREATE TRIGGER trg_imob_venda_status_imovel
  AFTER INSERT OR UPDATE OF status ON public.imob_vendas
  FOR EACH ROW EXECUTE FUNCTION public.imob_venda_atualiza_status_imovel();

DROP TRIGGER IF EXISTS trg_imob_vendas_updated_at ON public.imob_vendas;
CREATE TRIGGER trg_imob_vendas_updated_at
  BEFORE UPDATE ON public.imob_vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';

