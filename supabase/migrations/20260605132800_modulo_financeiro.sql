CREATE TABLE IF NOT EXISTS public.contas_receber (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  cliente_id      uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  descricao       text NOT NULL,
  valor_total     bigint NOT NULL, -- Valor em centavos
  data_vencimento date NOT NULL,
  status          text NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','recebida','atrasada','cancelada')),
  data_recebimento date,
  valor_recebido  bigint, -- Valor em centavos
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  fornecedor_id   uuid REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  pedido_id       uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  descricao       text NOT NULL,
  valor_total     bigint NOT NULL, -- Valor em centavos
  data_vencimento date NOT NULL,
  status          text NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','paga','atrasada','cancelada')),
  data_pagamento  date,
  valor_pago      bigint, -- Valor em centavos
  comprovante_url text, -- Link/caminho para o recibo enviado ao Storage
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_obra       ON public.contas_receber(obra_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status     ON public.contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_cp_obra       ON public.contas_pagar(obra_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_status     ON public.contas_pagar(status);

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_cr_all" ON public.contas_receber FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.perfis_usuarios WHERE user_id = auth.uid() AND perfil IN ('admin','diretor','financeiro'))
);
CREATE POLICY "engenharia_cr_select" ON public.contas_receber FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.perfis_usuarios WHERE user_id = auth.uid() AND perfil = 'engenharia')
);
CREATE POLICY "financeiro_cp_all" ON public.contas_pagar FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.perfis_usuarios WHERE user_id = auth.uid() AND perfil IN ('admin','diretor','financeiro'))
);

-- Triggers de updated_at
CREATE TRIGGER trg_cr_updated BEFORE UPDATE ON public.contas_receber
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para Comprovantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes-pagamento', 'comprovantes-pagamento', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Permitir leitura de comprovantes para autenticados" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'comprovantes-pagamento');
CREATE POLICY "Permitir insercao de comprovantes para autenticados" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovantes-pagamento');
CREATE POLICY "Permitir exclusao de comprovantes para autenticados" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'comprovantes-pagamento');
