ALTER TABLE public.imob_espacos
  ADD COLUMN IF NOT EXISTS cep text CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$');

CREATE OR REPLACE FUNCTION public.obter_espaco_publico(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', e.id,
    'codigo', e.codigo,
    'nome', e.nome,
    'descricao', e.descricao,
    'cep', e.cep,
    'endereco', e.endereco,
    'capacidade', e.capacidade,
    'valor_hora', e.valor_hora,
    'duracao_minima_minutos', e.duracao_minima_minutos,
    'horario_abertura', e.horario_abertura,
    'horario_fechamento', e.horario_fechamento,
    'comodidades', e.comodidades,
    'regras', e.regras,
    'fotos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('object_key', f.object_key, 'ordem', f.ordem) ORDER BY f.ordem)
      FROM public.imob_espaco_fotos f
      WHERE f.espaco_id = e.id
    ), '[]'::jsonb)
  )
  FROM public.imob_espacos e
  WHERE e.token_publico = _token
    AND e.status = 'publicado'
    AND e.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.obter_espaco_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_espaco_publico(uuid) TO anon, authenticated, service_role;
