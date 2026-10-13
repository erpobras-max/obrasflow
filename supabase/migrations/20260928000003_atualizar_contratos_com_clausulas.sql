-- Atualiza as funções públicas para devolver as cláusulas personalizadas do contrato.
-- Esta migration é necessária porque as funções originais já podem estar aplicadas.

-- Mantém esta migration segura mesmo quando executada manualmente sozinha.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS clausulas JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_clausulas_array_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_clausulas_array_check
  CHECK (jsonb_typeof(clausulas) = 'array');

CREATE OR REPLACE FUNCTION public.obter_link_assinatura(_token UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH link AS (
    SELECT * FROM public.contrato_links_assinatura
    WHERE token = _token AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > now()
  ), empresa AS (
    SELECT jsonb_build_object(
      'razao_social', razao_social, 'nome_fantasia', nome_fantasia, 'cnpj', cnpj,
      'logradouro', logradouro, 'numero', numero, 'complemento', complemento,
      'bairro', bairro, 'cidade', cidade, 'uf', uf, 'cep', cep
    ) AS dados FROM public.configuracoes_empresa WHERE id = 1
  )
  SELECT jsonb_build_object(
    'papel', l.papel, 'papel_label', l.papel_label,
    'nome_esperado', l.nome_esperado, 'documento_esperado', l.documento_esperado,
    'documento_titulo', l.documento_titulo, 'documento_resumo', l.documento_resumo,
    'expira_em', l.expira_em,
    'documento', CASE WHEN l.contrato_id IS NOT NULL THEN (
      SELECT jsonb_build_object(
        'tipo', 'civil', 'numero', c.numero, 'titulo', c.titulo,
        'objeto', c.objeto, 'valor_total', c.valor_total,
        'data_inicio', c.data_inicio, 'data_fim', c.data_fim,
        'observacoes', c.observacoes, 'clausulas', c.clausulas,
        'contratante', jsonb_build_object(
          'nome', cli.nome, 'documento', cli.cpf_cnpj, 'logradouro', cli.logradouro,
          'numero', cli.numero, 'complemento', cli.complemento, 'bairro', cli.bairro,
          'cidade', cli.cidade, 'uf', cli.uf, 'cep', cli.cep
        ),
        'contratada', (SELECT dados FROM empresa LIMIT 1)
      )
      FROM public.contratos c JOIN public.clientes cli ON cli.id = c.cliente_id
      WHERE c.id = l.contrato_id AND cli.deleted_at IS NULL
    ) ELSE (
      SELECT jsonb_build_object(
        'tipo', 'locacao', 'numero', loc.contrato_numero,
        'titulo', concat('Locação — ', imo.titulo),
        'objeto', concat_ws(', ', imo.logradouro, imo.numero, imo.complemento, imo.bairro, concat_ws('/', imo.cidade, imo.uf)),
        'valor_total', loc.valor_aluguel, 'data_inicio', loc.data_inicio,
        'data_fim', loc.data_fim, 'observacoes', loc.observacoes,
        'contratante', jsonb_build_object('nome', inq.nome, 'documento', inq.cpf_cnpj),
        'contratada', jsonb_build_object('razao_social', prop.nome, 'cnpj', prop.cpf_cnpj)
      )
      FROM public.locacoes loc
      JOIN public.imoveis imo ON imo.id = loc.imovel_id
      JOIN public.imobiliaria_clientes inq ON inq.id = loc.locatario_id
      JOIN public.imobiliaria_clientes prop ON prop.id = imo.proprietario_id
      WHERE loc.id = l.locacao_id AND inq.deleted_at IS NULL
    ) END
  ) FROM link l;
$$;

CREATE OR REPLACE FUNCTION public.listar_contratos_portal()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH empresa AS (
    SELECT jsonb_build_object(
      'razao_social', razao_social, 'nome_fantasia', nome_fantasia, 'cnpj', cnpj,
      'endereco', endereco, 'logradouro', logradouro, 'numero', numero,
      'complemento', complemento, 'bairro', bairro, 'cidade', cidade, 'uf', uf,
      'cep', cep, 'email', email, 'telefone', telefone
    ) AS dados FROM public.configuracoes_empresa WHERE id = 1
  ), documentos AS (
    SELECT ctr.created_at, jsonb_build_object(
      'tipo', 'civil', 'id', ctr.id, 'numero', ctr.numero, 'titulo', ctr.titulo,
      'objeto', ctr.objeto, 'status', ctr.status, 'valor', ctr.valor_total,
      'data_inicio', ctr.data_inicio, 'data_fim', ctr.data_fim,
      'observacoes', ctr.observacoes, 'clausulas', ctr.clausulas,
      'cliente', jsonb_build_object(
        'nome', cli.nome, 'documento', cli.cpf_cnpj, 'email', cli.email,
        'telefone', coalesce(cli.celular, cli.telefone), 'logradouro', cli.logradouro,
        'numero', cli.numero, 'complemento', cli.complemento, 'bairro', cli.bairro,
        'cidade', cli.cidade, 'uf', cli.uf, 'cep', cli.cep
      ),
      'empresa', (SELECT dados FROM empresa LIMIT 1),
      'assinado', EXISTS (SELECT 1 FROM public.contrato_assinaturas a WHERE a.contrato_id = ctr.id AND a.papel = 'contratante' AND a.deleted_at IS NULL),
      'assinado_em', (SELECT a.assinado_em FROM public.contrato_assinaturas a WHERE a.contrato_id = ctr.id AND a.papel = 'contratante' AND a.deleted_at IS NULL LIMIT 1)
    ) AS documento
    FROM public.contratos ctr JOIN public.clientes cli ON cli.id = ctr.cliente_id
    WHERE cli.auth_user_id = auth.uid() AND cli.deleted_at IS NULL
    UNION ALL
    SELECT loc.created_at, jsonb_build_object(
      'tipo', 'locacao', 'id', loc.id, 'numero', loc.contrato_numero,
      'titulo', concat('Locação — ', imo.titulo),
      'objeto', concat_ws(', ', imo.logradouro, imo.numero, imo.complemento, imo.bairro, concat_ws('/', imo.cidade, imo.uf)),
      'status', loc.status, 'valor', loc.valor_aluguel, 'data_inicio', loc.data_inicio,
      'data_fim', loc.data_fim, 'observacoes', loc.observacoes,
      'dia_vencimento', loc.dia_vencimento, 'garantia_tipo', loc.garantia_tipo,
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
      'assinado', EXISTS (SELECT 1 FROM public.contrato_assinaturas a WHERE a.locacao_id = loc.id AND a.papel = 'locatario' AND a.deleted_at IS NULL),
      'assinado_em', (SELECT a.assinado_em FROM public.contrato_assinaturas a WHERE a.locacao_id = loc.id AND a.papel = 'locatario' AND a.deleted_at IS NULL LIMIT 1)
    ) AS documento
    FROM public.locacoes loc
    JOIN public.imobiliaria_clientes inq ON inq.id = loc.locatario_id
    JOIN public.imoveis imo ON imo.id = loc.imovel_id
    JOIN public.imobiliaria_clientes prop ON prop.id = imo.proprietario_id
    WHERE inq.auth_user_id = auth.uid() AND inq.deleted_at IS NULL
  )
  SELECT coalesce(jsonb_agg(documento ORDER BY created_at DESC), '[]'::jsonb) FROM documentos;
$$;

REVOKE ALL ON FUNCTION public.obter_link_assinatura(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_link_assinatura(UUID) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_contratos_portal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_contratos_portal() TO authenticated;
NOTIFY pgrst, 'reload schema';

