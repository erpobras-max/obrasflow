-- View para o dashboard operacional
CREATE OR REPLACE VIEW public.vw_dashboard_operacional AS
SELECT
  COUNT(*) FILTER (WHERE status = 'em_andamento')  AS obras_ativas,
  COUNT(*) FILTER (WHERE status = 'concluida')    AS obras_concluidas,
  COUNT(*) FILTER (
    WHERE status = 'em_andamento'
    AND data_fim_prevista < CURRENT_DATE
  ) AS obras_atrasadas,
  ROUND(COALESCE(AVG(
    CASE WHEN status = 'em_andamento' THEN COALESCE(progresso, 0) END
  ), 0), 1) AS percentual_medio
FROM public.obras;

-- View para o dashboard financeiro
CREATE OR REPLACE VIEW public.vw_dashboard_financeiro AS
SELECT
  COALESCE(SUM(valor_total) FILTER (
    WHERE status IN ('aberta','atrasada')
    AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR  FROM data_vencimento) = EXTRACT(YEAR  FROM CURRENT_DATE)
  ), 0) AS receita_prevista_mes,
  COALESCE(SUM(valor_recebido) FILTER (
    WHERE status = 'recebida'
    AND EXTRACT(MONTH FROM data_recebimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR  FROM data_recebimento) = EXTRACT(YEAR  FROM CURRENT_DATE)
  ), 0) AS receita_realizada_mes,
  COALESCE(SUM(valor_total) FILTER (WHERE status = 'atrasada'), 0) AS total_inadimplente,
  COUNT(*) FILTER (WHERE status = 'atrasada') AS qtd_inadimplente
FROM public.contas_receber;

-- Permissões de Leitura nas Views
GRANT SELECT ON public.vw_dashboard_operacional TO authenticated;
GRANT SELECT ON public.vw_dashboard_financeiro TO authenticated;
