CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.imob_espacos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_publico uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  codigo text NOT NULL UNIQUE CHECK (char_length(codigo) BETWEEN 1 AND 40),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 120),
  descricao text CHECK (char_length(descricao) <= 4000),
  endereco text CHECK (char_length(endereco) <= 500),
  capacidade integer NOT NULL CHECK (capacidade > 0),
  valor_hora numeric(12, 2) NOT NULL CHECK (valor_hora > 0),
  duracao_minima_minutos integer NOT NULL DEFAULT 60 CHECK (duracao_minima_minutos > 0),
  horario_abertura time NOT NULL DEFAULT '08:00',
  horario_fechamento time NOT NULL DEFAULT '18:00',
  comodidades text[] NOT NULL DEFAULT '{}' CHECK (cardinality(comodidades) <= 20),
  regras text CHECK (char_length(regras) <= 4000),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'publicado', 'inativo')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (horario_fechamento > horario_abertura)
);

CREATE TABLE IF NOT EXISTS public.imob_espaco_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espaco_id uuid NOT NULL REFERENCES public.imob_espacos(id) ON DELETE CASCADE,
  object_key text NOT NULL CHECK (
    object_key ~ '^imobiliaria/espacos/[a-f0-9-]+\.(jpg|png|webp)$'
  ),
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (espaco_id, object_key)
);

CREATE TABLE IF NOT EXISTS public.imob_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espaco_id uuid NOT NULL REFERENCES public.imob_espacos(id) ON DELETE RESTRICT,
  cliente_nome text NOT NULL CHECK (char_length(cliente_nome) BETWEEN 3 AND 120),
  cliente_cpf text NOT NULL CHECK (cliente_cpf ~ '^[0-9]{11}$'),
  cliente_email text NOT NULL CHECK (char_length(cliente_email) <= 254),
  cliente_telefone text NOT NULL CHECK (char_length(cliente_telefone) BETWEEN 10 AND 20),
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  valor_total numeric(12, 2) NOT NULL CHECK (valor_total > 0),
  status text NOT NULL DEFAULT 'solicitada'
    CHECK (status IN ('solicitada', 'aguardando_pagamento', 'paga', 'confirmada', 'cancelada', 'expirada', 'finalizada')),
  pagamento_status text NOT NULL DEFAULT 'pendente'
    CHECK (pagamento_status IN ('pendente', 'pago', 'estornado', 'falhou')),
  acesso_status text NOT NULL DEFAULT 'pendente'
    CHECK (acesso_status IN ('pendente', 'liberado', 'revogado', 'falhou')),
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_imob_espacos_status
  ON public.imob_espacos (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_imob_espaco_fotos_espaco_ordem
  ON public.imob_espaco_fotos (espaco_id, ordem);
CREATE INDEX IF NOT EXISTS idx_imob_reservas_espaco_inicio
  ON public.imob_reservas (espaco_id, inicio);
CREATE INDEX IF NOT EXISTS idx_imob_reservas_status
  ON public.imob_reservas (status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imob_reservas_sem_sobreposicao'
  ) THEN
    ALTER TABLE public.imob_reservas
      ADD CONSTRAINT imob_reservas_sem_sobreposicao
      EXCLUDE USING gist (
        espaco_id WITH =,
        tstzrange(inicio, fim, '[)') WITH &&
      )
      WHERE (status IN ('solicitada', 'aguardando_pagamento', 'paga', 'confirmada'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_imob_espacos_updated_at ON public.imob_espacos;
CREATE TRIGGER update_imob_espacos_updated_at
  BEFORE UPDATE ON public.imob_espacos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_imob_reservas_updated_at ON public.imob_reservas;
CREATE TRIGGER update_imob_reservas_updated_at
  BEFORE UPDATE ON public.imob_reservas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.imob_espacos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imob_espaco_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imob_reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Imobiliaria gerencia espacos" ON public.imob_espacos;
CREATE POLICY "Imobiliaria gerencia espacos" ON public.imob_espacos
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

DROP POLICY IF EXISTS "Imobiliaria gerencia fotos dos espacos" ON public.imob_espaco_fotos;
CREATE POLICY "Imobiliaria gerencia fotos dos espacos" ON public.imob_espaco_fotos
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

DROP POLICY IF EXISTS "Imobiliaria gerencia reservas dos espacos" ON public.imob_reservas;
CREATE POLICY "Imobiliaria gerencia reservas dos espacos" ON public.imob_reservas
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

REVOKE ALL ON public.imob_espacos, public.imob_espaco_fotos, public.imob_reservas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_espacos, public.imob_espaco_fotos, public.imob_reservas TO authenticated;
GRANT ALL ON public.imob_espacos, public.imob_espaco_fotos, public.imob_reservas TO service_role;

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

CREATE OR REPLACE FUNCTION public.consultar_disponibilidade_espaco(
  _token uuid,
  _inicio timestamptz,
  _fim timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_espaco public.imob_espacos%ROWTYPE;
  v_inicio_local timestamp;
  v_fim_local timestamp;
BEGIN
  SELECT * INTO v_espaco
  FROM public.imob_espacos
  WHERE token_publico = _token AND status = 'publicado' AND deleted_at IS NULL;

  IF NOT FOUND OR _inicio <= now() OR _fim <= _inicio THEN
    RETURN false;
  END IF;

  v_inicio_local := timezone('America/Sao_Paulo', _inicio);
  v_fim_local := timezone('America/Sao_Paulo', _fim);

  IF v_inicio_local::date <> v_fim_local::date
     OR v_inicio_local::time < v_espaco.horario_abertura
     OR v_fim_local::time > v_espaco.horario_fechamento
     OR extract(epoch FROM (_fim - _inicio)) / 60 < v_espaco.duracao_minima_minutos THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.imob_reservas r
    WHERE r.espaco_id = v_espaco.id
      AND r.status IN ('solicitada', 'aguardando_pagamento', 'paga', 'confirmada')
      AND tstzrange(r.inicio, r.fim, '[)') && tstzrange(_inicio, _fim, '[)')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_reserva_espaco(
  _token uuid,
  _cliente_nome text,
  _cliente_cpf text,
  _cliente_email text,
  _cliente_telefone text,
  _inicio timestamptz,
  _fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_espaco public.imob_espacos%ROWTYPE;
  v_reserva public.imob_reservas%ROWTYPE;
  v_cpf text := regexp_replace(COALESCE(_cliente_cpf, ''), '\D', '', 'g');
  v_telefone text := regexp_replace(COALESCE(_cliente_telefone, ''), '\D', '', 'g');
  v_horas integer;
BEGIN
  SELECT * INTO v_espaco
  FROM public.imob_espacos
  WHERE token_publico = _token AND status = 'publicado' AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sala indisponível.'; END IF;
  IF length(trim(COALESCE(_cliente_nome, ''))) < 3 THEN RAISE EXCEPTION 'Informe o nome completo.'; END IF;
  IF NOT public.validar_cpf_cnpj(v_cpf) OR length(v_cpf) <> 11 THEN RAISE EXCEPTION 'Informe um CPF válido.'; END IF;
  IF trim(COALESCE(_cliente_email, '')) !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;
  IF length(v_telefone) < 10 THEN RAISE EXCEPTION 'Informe um telefone válido.'; END IF;
  IF NOT public.consultar_disponibilidade_espaco(_token, _inicio, _fim) THEN
    RAISE EXCEPTION 'Este horário não está disponível.';
  END IF;

  v_horas := ceil(extract(epoch FROM (_fim - _inicio)) / 3600.0);

  INSERT INTO public.imob_reservas (
    espaco_id, cliente_nome, cliente_cpf, cliente_email, cliente_telefone,
    inicio, fim, valor_total
  ) VALUES (
    v_espaco.id, trim(_cliente_nome), v_cpf, lower(trim(_cliente_email)), v_telefone,
    _inicio, _fim, v_horas * v_espaco.valor_hora
  ) RETURNING * INTO v_reserva;

  RETURN jsonb_build_object(
    'id', v_reserva.id,
    'status', v_reserva.status,
    'valor_total', v_reserva.valor_total,
    'inicio', v_reserva.inicio,
    'fim', v_reserva.fim
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado por outra pessoa.';
END;
$$;

REVOKE ALL ON FUNCTION public.obter_espaco_publico(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consultar_disponibilidade_espaco(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_reserva_espaco(uuid, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_espaco_publico(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_disponibilidade_espaco(uuid, timestamptz, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_reserva_espaco(uuid, text, text, text, text, timestamptz, timestamptz) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
