
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
