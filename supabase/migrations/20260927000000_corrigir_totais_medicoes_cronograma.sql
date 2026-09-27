-- Mantém o valor contratado da obra sincronizado com a proposta e usa essa
-- base para calcular automaticamente o percentual financeiro das medições.

CREATE OR REPLACE FUNCTION public.recalcular_medicao_financeira(p_medicao_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total numeric(14,2);
  v_contratado numeric(14,2);
  v_percentual numeric(5,2);
BEGIN
  SELECT COALESCE(SUM(valor_total), 0)
    INTO v_total
    FROM public.medicoes_itens
   WHERE medicao_id = p_medicao_id;

  SELECT COALESCE(
           NULLIF(o.orcamento, 0),
           NULLIF(p.valor_total, 0),
           NULLIF((
             SELECT SUM(mi.qtd_contratada * mi.valor_unitario)
               FROM public.medicoes_itens mi
              WHERE mi.medicao_id = p_medicao_id
           ), 0),
           0
         )
    INTO v_contratado
    FROM public.medicoes m
    JOIN public.obras o ON o.id = m.obra_id
    LEFT JOIN public.propostas p ON p.id = o.proposta_id
   WHERE m.id = p_medicao_id;

  v_percentual := CASE
    WHEN COALESCE(v_contratado, 0) > 0
      THEN ROUND((v_total / v_contratado) * 100, 2)
    ELSE 0
  END;

  UPDATE public.medicoes
     SET valor_total = v_total,
         percentual_total = v_percentual,
         updated_at = now()
   WHERE id = p_medicao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_orcamento_obra_proposta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_medicao record;
BEGIN
  UPDATE public.obras
     SET orcamento = COALESCE(NEW.valor_total, 0),
         updated_at = now()
   WHERE proposta_id = NEW.id
   RETURNING id INTO v_obra_id;

  IF v_obra_id IS NOT NULL THEN
    FOR v_medicao IN
      SELECT id FROM public.medicoes WHERE obra_id = v_obra_id ORDER BY periodo_fim, created_at
    LOOP
      PERFORM public.recalcular_medicao_financeira(v_medicao.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propostas_sincronizar_orcamento_obra ON public.propostas;
CREATE TRIGGER propostas_sincronizar_orcamento_obra
AFTER INSERT OR UPDATE OF valor_total ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_orcamento_obra_proposta();

-- Corrige obras e medições que já foram criadas com valor contratado zerado.
UPDATE public.obras o
   SET orcamento = COALESCE(p.valor_total, 0),
       updated_at = now()
  FROM public.propostas p
 WHERE p.id = o.proposta_id
   AND o.orcamento IS DISTINCT FROM COALESCE(p.valor_total, 0);

DO $$
DECLARE
  v_medicao record;
BEGIN
  FOR v_medicao IN
    SELECT id FROM public.medicoes ORDER BY obra_id, periodo_fim, created_at
  LOOP
    PERFORM public.recalcular_medicao_financeira(v_medicao.id);
  END LOOP;
END;
$$;
