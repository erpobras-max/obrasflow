-- Portal do cliente: acesso unificado e contratos próprios com assinatura autenticada.

ALTER TABLE public.imobiliaria_clientes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_auth_user_id_uniq
  ON public.clientes(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS imob_clientes_auth_user_id_uniq
  ON public.imobiliaria_clientes(auth_user_id) WHERE auth_user_id IS NOT NULL;

DROP POLICY IF EXISTS "cliente_imobiliaria_ver_proprio" ON public.imobiliaria_clientes;
CREATE POLICY "cliente_imobiliaria_ver_proprio"
  ON public.imobiliaria_clientes FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.listar_contratos_portal()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH empresa AS (
    SELECT jsonb_build_object(
      'razao_social', razao_social,
      'nome_fantasia', nome_fantasia,
      'cnpj', cnpj,
      'endereco', endereco,
      'logradouro', logradouro,
      'numero', numero,
      'complemento', complemento,
      'bairro', bairro,
      'cidade', cidade,
      'uf', uf,
      'cep', cep,
      'email', email,
      'telefone', telefone
    ) AS dados
    FROM public.configuracoes_empresa
    WHERE id = 1
  ), documentos AS (
    SELECT ctr.created_at, jsonb_build_object(
      'tipo', 'civil',
      'id', ctr.id,
      'numero', ctr.numero,
      'titulo', ctr.titulo,
      'objeto', ctr.objeto,
      'status', ctr.status,
      'valor', ctr.valor_total,
      'data_inicio', ctr.data_inicio,
      'data_fim', ctr.data_fim,
      'observacoes', ctr.observacoes,
      'cliente', jsonb_build_object(
        'nome', cli.nome, 'documento', cli.cpf_cnpj, 'email', cli.email,
        'telefone', coalesce(cli.celular, cli.telefone), 'logradouro', cli.logradouro,
        'numero', cli.numero, 'complemento', cli.complemento, 'bairro', cli.bairro,
        'cidade', cli.cidade, 'uf', cli.uf, 'cep', cli.cep
      ),
      'empresa', (SELECT dados FROM empresa LIMIT 1),
      'assinado', EXISTS (
        SELECT 1 FROM public.contrato_assinaturas a
        WHERE a.contrato_id = ctr.id AND a.papel = 'contratante' AND a.deleted_at IS NULL
      ),
      'assinado_em', (
        SELECT a.assinado_em FROM public.contrato_assinaturas a
        WHERE a.contrato_id = ctr.id AND a.papel = 'contratante' AND a.deleted_at IS NULL
        LIMIT 1
      )
    ) AS documento
    FROM public.contratos ctr
    JOIN public.clientes cli ON cli.id = ctr.cliente_id
    WHERE cli.auth_user_id = auth.uid() AND cli.deleted_at IS NULL

    UNION ALL

    SELECT loc.created_at, jsonb_build_object(
      'tipo', 'locacao',
      'id', loc.id,
      'numero', loc.contrato_numero,
      'titulo', concat('Locação — ', imo.titulo),
      'objeto', concat_ws(', ', imo.logradouro, imo.numero, imo.complemento, imo.bairro, concat_ws('/', imo.cidade, imo.uf)),
      'status', loc.status,
      'valor', loc.valor_aluguel,
      'data_inicio', loc.data_inicio,
      'data_fim', loc.data_fim,
      'observacoes', loc.observacoes,
      'dia_vencimento', loc.dia_vencimento,
      'garantia_tipo', loc.garantia_tipo,
      'garantia_valor', loc.garantia_valor,
      'cliente', jsonb_build_object(
        'nome', inq.nome, 'documento', inq.cpf_cnpj, 'email', inq.email,
        'telefone', coalesce(inq.celular, inq.telefone), 'logradouro', inq.logradouro,
        'numero', inq.numero, 'complemento', inq.complemento, 'bairro', inq.bairro,
        'cidade', inq.cidade, 'uf', inq.uf, 'cep', inq.cep
      ),
      'locador', jsonb_build_object('nome', prop.nome, 'documento', prop.cpf_cnpj),
      'imovel', jsonb_build_object(
        'titulo', imo.titulo, 'codigo', imo.codigo, 'logradouro', imo.logradouro,
        'numero', imo.numero, 'complemento', imo.complemento, 'bairro', imo.bairro,
        'cidade', imo.cidade, 'uf', imo.uf, 'cep', imo.cep
      ),
      'empresa', (SELECT dados FROM empresa LIMIT 1),
      'assinado', EXISTS (
        SELECT 1 FROM public.contrato_assinaturas a
        WHERE a.locacao_id = loc.id AND a.papel = 'locatario' AND a.deleted_at IS NULL
      ),
      'assinado_em', (
        SELECT a.assinado_em FROM public.contrato_assinaturas a
        WHERE a.locacao_id = loc.id AND a.papel = 'locatario' AND a.deleted_at IS NULL
        LIMIT 1
      )
    ) AS documento
    FROM public.locacoes loc
    JOIN public.imobiliaria_clientes inq ON inq.id = loc.locatario_id
    JOIN public.imoveis imo ON imo.id = loc.imovel_id
    JOIN public.imobiliaria_clientes prop ON prop.id = imo.proprietario_id
    WHERE inq.auth_user_id = auth.uid() AND inq.deleted_at IS NULL
  )
  SELECT coalesce(jsonb_agg(documento ORDER BY created_at DESC), '[]'::jsonb)
  FROM documentos;
$$;

CREATE OR REPLACE FUNCTION public.assinar_contrato_portal(
  _tipo TEXT,
  _documento_id UUID,
  _assinatura_data_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nome TEXT;
  _documento TEXT;
  _papel TEXT;
  _contrato_id UUID;
  _locacao_id UUID;
  _assinatura_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF _assinatura_data_url NOT LIKE 'data:image/png;base64,%'
     OR octet_length(_assinatura_data_url) > 1048576 THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;

  IF _tipo = 'civil' THEN
    SELECT cli.nome, cli.cpf_cnpj, ctr.id
      INTO _nome, _documento, _contrato_id
    FROM public.contratos ctr
    JOIN public.clientes cli ON cli.id = ctr.cliente_id
    WHERE ctr.id = _documento_id
      AND cli.auth_user_id = auth.uid()
      AND cli.deleted_at IS NULL;
    _papel := 'contratante';
  ELSIF _tipo = 'locacao' THEN
    SELECT cli.nome, cli.cpf_cnpj, loc.id
      INTO _nome, _documento, _locacao_id
    FROM public.locacoes loc
    JOIN public.imobiliaria_clientes cli ON cli.id = loc.locatario_id
    WHERE loc.id = _documento_id
      AND cli.auth_user_id = auth.uid()
      AND cli.deleted_at IS NULL;
    _papel := 'locatario';
  ELSE
    RAISE EXCEPTION 'Tipo de contrato inválido';
  END IF;

  IF _nome IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado para este cliente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contrato_assinaturas a
    WHERE ((_contrato_id IS NOT NULL AND a.contrato_id = _contrato_id)
       OR (_locacao_id IS NOT NULL AND a.locacao_id = _locacao_id))
      AND a.papel = _papel AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Este contrato já foi assinado';
  END IF;

  INSERT INTO public.contrato_assinaturas (
    contrato_id, locacao_id, papel, nome_assinante, documento_assinante,
    assinatura_data_url, assinado_por, assinado_em
  ) VALUES (
    _contrato_id, _locacao_id, _papel, _nome, _documento,
    _assinatura_data_url, auth.uid(), now()
  ) RETURNING id INTO _assinatura_id;

  RETURN jsonb_build_object('ok', true, 'assinatura_id', _assinatura_id);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_contratos_portal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assinar_contrato_portal(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_contratos_portal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_portal(TEXT, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
