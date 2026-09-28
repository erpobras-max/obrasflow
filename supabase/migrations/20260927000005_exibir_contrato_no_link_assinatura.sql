-- O detentor de um link de assinatura precisa poder ler o documento
-- correspondente antes de registrar a assinatura manuscrita.
CREATE OR REPLACE FUNCTION public.obter_link_assinatura(_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH link AS (
    SELECT *
    FROM public.contrato_links_assinatura
    WHERE token = _token AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > now()
  ), empresa AS (
    SELECT jsonb_build_object(
      'razao_social', razao_social, 'nome_fantasia', nome_fantasia, 'cnpj', cnpj,
      'logradouro', logradouro, 'numero', numero, 'complemento', complemento,
      'bairro', bairro, 'cidade', cidade, 'uf', uf, 'cep', cep
    ) AS dados
    FROM public.configuracoes_empresa WHERE id = 1
  )
  SELECT jsonb_build_object(
    'papel', l.papel,
    'papel_label', l.papel_label,
    'nome_esperado', l.nome_esperado,
    'documento_esperado', l.documento_esperado,
    'documento_titulo', l.documento_titulo,
    'documento_resumo', l.documento_resumo,
    'expira_em', l.expira_em,
    'documento', CASE
      WHEN l.contrato_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'tipo', 'civil', 'numero', c.numero, 'titulo', c.titulo,
          'objeto', c.objeto, 'valor_total', c.valor_total,
          'data_inicio', c.data_inicio, 'data_fim', c.data_fim,
          'observacoes', c.observacoes,
          'contratante', jsonb_build_object(
            'nome', cli.nome, 'documento', cli.cpf_cnpj, 'logradouro', cli.logradouro,
            'numero', cli.numero, 'complemento', cli.complemento, 'bairro', cli.bairro,
            'cidade', cli.cidade, 'uf', cli.uf, 'cep', cli.cep
          ),
          'contratada', (SELECT dados FROM empresa LIMIT 1)
        )
        FROM public.contratos c
        JOIN public.clientes cli ON cli.id = c.cliente_id
        WHERE c.id = l.contrato_id AND cli.deleted_at IS NULL
      )
      ELSE (
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
      )
    END
  )
  FROM link l;
$$;

REVOKE ALL ON FUNCTION public.obter_link_assinatura(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_link_assinatura(UUID) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
