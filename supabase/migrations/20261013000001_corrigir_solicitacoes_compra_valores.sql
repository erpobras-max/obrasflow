-- Solicitações de compra: valor estimado por item e permissões do setor Compras.
-- Os valores desta tabela são armazenados em reais; pedidos de compra continuam em centavos.

ALTER TABLE public.solicitacao_itens
  ADD COLUMN IF NOT EXISTS valor_unit_estimado numeric(14,2) NOT NULL DEFAULT 0
    CHECK (valor_unit_estimado >= 0);

ALTER TABLE public.solicitacao_itens
  ADD COLUMN IF NOT EXISTS valor_total_estimado numeric(14,2)
    GENERATED ALWAYS AS (round(quantidade * valor_unit_estimado, 2)) STORED;

-- Quem registra compras também precisa criar a solicitação e seus itens.
DROP POLICY IF EXISTS "solicitacoes_insert" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_insert" ON public.solicitacoes_compra
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'compras') OR
    public.has_role(auth.uid(), 'engenharia')
  );

DROP POLICY IF EXISTS "solicitacao_itens_insert" ON public.solicitacao_itens;
CREATE POLICY "solicitacao_itens_insert" ON public.solicitacao_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'compras') OR
    public.has_role(auth.uid(), 'engenharia')
  );

NOTIFY pgrst, 'reload schema';

