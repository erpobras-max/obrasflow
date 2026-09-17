
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
