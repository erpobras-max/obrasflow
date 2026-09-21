-- Permite que clientes consultem somente os próprios lançamentos no portal.
-- A política é exclusivamente de leitura; alterações continuam restritas à equipe.

DROP POLICY IF EXISTS "portal_cliente_contas_receber_select" ON public.contas_receber;
CREATE POLICY "portal_cliente_contas_receber_select" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (
    (cliente_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = contas_receber.cliente_id
        AND c.auth_user_id = auth.uid()
        AND c.deleted_at IS NULL
    ))
    OR (imob_cliente_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.imobiliaria_clientes c
      WHERE c.id = contas_receber.imob_cliente_id
        AND c.auth_user_id = auth.uid()
        AND c.deleted_at IS NULL
    ))
  );

CREATE INDEX IF NOT EXISTS contas_receber_imob_cliente_idx
  ON public.contas_receber(imob_cliente_id, data_vencimento);
