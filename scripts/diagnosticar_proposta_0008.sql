-- Diagnóstico somente leitura. Não altera nem exclui dados.
WITH alvo AS (
  SELECT * FROM public.propostas WHERE numero = 'PROP-2026-0008'
)
SELECT 'proposta' AS origem, to_jsonb(alvo.*) AS dados FROM alvo
UNION ALL
SELECT 'revisao', to_jsonb(revisao.*)
  FROM public.proposta_revisoes revisao JOIN alvo ON alvo.id = revisao.proposta_id
UNION ALL
SELECT 'obra', to_jsonb(obra.*)
  FROM public.obras obra JOIN alvo ON obra.proposta_id = alvo.id
UNION ALL
SELECT 'contrato', to_jsonb(contrato.*)
  FROM public.contratos contrato JOIN alvo ON contrato.proposta_id = alvo.id
UNION ALL
SELECT 'cronograma', to_jsonb(cronograma.*)
  FROM public.obras_cronogramas cronograma JOIN alvo ON cronograma.proposta_id = alvo.id;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('propostas','proposta_revisoes','obras','contratos','obras_cronogramas')
 ORDER BY tablename, policyname;
