-- O dashboard principal representa somente a operação da construção civil.
CREATE OR REPLACE VIEW public.vw_dashboard_financeiro AS
SELECT
  COALESCE(SUM(valor_total) FILTER (
    WHERE status IN ('aberta','atrasada')
    AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
  ), 0) AS receita_prevista_mes,
  COALESCE(SUM(valor_recebido) FILTER (
    WHERE status = 'recebida'
    AND EXTRACT(MONTH FROM data_recebimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_recebimento) = EXTRACT(YEAR FROM CURRENT_DATE)
  ), 0) AS receita_realizada_mes,
  COALESCE(SUM(valor_total) FILTER (WHERE status = 'atrasada'), 0) AS total_inadimplente,
  COUNT(*) FILTER (WHERE status = 'atrasada') AS qtd_inadimplente
FROM public.contas_receber
WHERE COALESCE(origem, 'erp') <> 'imobiliaria';

GRANT SELECT ON public.vw_dashboard_financeiro TO authenticated;
NOTIFY pgrst, 'reload schema';
