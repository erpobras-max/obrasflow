export interface ConfiguracaoPropostaBase {
  mostrarEtapas: boolean
  mostrarAtividades: boolean
  mostrarQuantidades: boolean
  mostrarUnidades: boolean
  mostrarPrecoUnitario: boolean
  mostrarComposicoes: boolean
  mostrarCustosInternos: boolean
  mostrarBdi: boolean
}

export const configuracaoPropostaPadrao: ConfiguracaoPropostaBase = Object.freeze({
  mostrarEtapas: true,
  mostrarAtividades: true,
  mostrarQuantidades: true,
  mostrarUnidades: true,
  mostrarPrecoUnitario: false,
  mostrarComposicoes: false,
  mostrarCustosInternos: false,
  mostrarBdi: false,
})

export type ConfiguracaoProposta = ConfiguracaoPropostaBase

export interface ConfiguracaoPropostaComercial extends ConfiguracaoPropostaBase {
  mostrarCapa: boolean
  mostrarLogo: boolean
  mostrarDadosEmpresa: boolean
  mostrarDadosCliente: boolean
  mostrarDadosObra: boolean
  mostrarApenasEtapa: boolean
  mostrarCondicoesPagamento: boolean
  mostrarPrazoExecucao: boolean
  mostrarValidade: boolean
  mostrarObservacoes: boolean
  mostrarAssinaturas: boolean
  mostrarContrato: boolean
  tituloProposta: string
  textoApresentacao: string
  textoEncerramento: string
  textoContrato: string
  prazoExecucaoTexto: string
  validadeTexto: string
  condicoesPagamentoTexto: string
  descricoesComerciais: Record<string, string>
  etapasOcultas: string[]
  atividadesOcultas: string[]
  observacoesEtapa: Record<string, string>
}

export const configuracaoPropostaComercialPadrao: ConfiguracaoPropostaComercial = Object.freeze({
  ...configuracaoPropostaPadrao,
  mostrarCapa: false,
  mostrarLogo: true,
  mostrarDadosEmpresa: true,
  mostrarDadosCliente: true,
  mostrarDadosObra: true,
  mostrarApenasEtapa: false,
  mostrarCondicoesPagamento: true,
  mostrarPrazoExecucao: true,
  mostrarValidade: true,
  mostrarObservacoes: true,
  mostrarAssinaturas: true,
  mostrarContrato: true,
  tituloProposta: 'Proposta Comercial para Execução de Obra',
  textoApresentacao:
    'Apresentamos nossa proposta técnica e comercial para a execução dos serviços de engenharia civil discriminados abaixo, em conformidade com as normas ABNT e projetos aprovados.',
  textoEncerramento:
    'Permanecemos à disposição para prestar quaisquer esclarecimentos necessários e alinhar o início das atividades.',
  textoContrato:
    'CLÁUSULA 1ª - DO OBJETO: O presente instrumento tem por objeto a prestação dos serviços técnicos e execução de obras civis descritas na planilha orçamentária anexa.\n\nCLÁUSULA 2ª - DOS PRAZOS: Os serviços serão iniciados após a aprovação formal e mobilização inicial, com prazo de conclusão estimado conforme discriminado neste documento.\n\nCLÁUSULA 3ª - DO PREÇO E MEDIÇÕES: Os pagamentos serão efetuados de acordo com as condições comerciais acordadas, mediante emissão de boletins de medição dos serviços efetivamente executados e aprovados pela fiscalização.\n\nCLÁUSULA 4ª - DAS OBRIGAÇÕES: A CONTRATADA compromete-se a empregar mão de obra qualificada e respeitar as normas de segurança e meio ambiente vigentes. O CONTRATANTE fornecerá acesso ao local da obra e os subsídios necessários.\n\nCLÁUSULA 5ª - DO FORO: As partes elegem o foro da comarca da localização da obra para dirimir eventuais dúvidas decorrentes deste instrumento.',
  prazoExecucaoTexto: '120 (cento e vinte) dias úteis a contar da mobilização inicial',
  validadeTexto: '15 (quinze) dias corridos a partir da data de emissão',
  condicoesPagamentoTexto:
    '• 15% de adiantamento na assinatura para mobilização e aquisição inicial.\n• Saldo em medições quinzenais de serviços efetivamente executados.\n• Retenção contratual técnica de 5% sobre cada medição liberada após vistoria final.',
  descricoesComerciais: {},
  etapasOcultas: [],
  atividadesOcultas: [],
  observacoesEtapa: {},
})

function sanitizarComercial(valor: unknown): any {
  if (Array.isArray(valor)) return valor.map(sanitizarComercial)
  if (!valor || typeof valor !== 'object') return valor
  const bloqueados = /^(custo|bdi|insumos?|composi(cao|ções)|coeficiente|precoUnitarioCentavos|precoManual)/i
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .filter(([chave]) => !bloqueados.test(chave))
      .map(([chave, item]) => [chave, sanitizarComercial(item)])
  )
}

export function criarFotografiaProposta(
  revisao: { id: string; numero: number; fotografia: Record<string, any> },
  configuracao: Partial<ConfiguracaoPropostaComercial> = configuracaoPropostaPadrao
) {
  const config = {
    ...configuracaoPropostaComercialPadrao,
    ...configuracao,
  }
  const origem = sanitizarComercial(structuredClone(revisao.fotografia))

  const etapasFiltradas = (origem.etapas ?? [])
    .filter((e: any) => !config.etapasOcultas?.includes(e.id) && !config.etapasOcultas?.includes(e.codigo))
    .map((e: any) => ({
      ...e,
      observacaoComercial: config.observacoesEtapa?.[e.id] ?? config.observacoesEtapa?.[e.codigo],
      atividades: config.mostrarApenasEtapa
        ? []
        : (e.atividades ?? [])
            .filter((a: any) => !config.atividadesOcultas?.includes(a.id) && !config.atividadesOcultas?.includes(a.codigo))
            .map((a: any) => ({
              ...a,
              descricaoComercial:
                config.descricoesComerciais?.[a.id] ??
                config.descricoesComerciais?.[a.codigo] ??
                a.descricao,
            })),
    }))

  return {
    orcamentoRevisaoId: revisao.id,
    orcamentoRevisaoNumero: revisao.numero,
    configuracao: structuredClone(config),
    etapas: etapasFiltradas,
    atividades: config.mostrarAtividades ? (origem.atividades ?? []) : [],
    totalPrecoCentavos: origem.totalPrecoCentavos ?? 0,
  }
}

export function proximaRevisaoProposta(revisoes: Array<{ numero: number; status: string }>) {
  if (revisoes.some((r) => r.status === 'aceita')) {
    throw new Error('A proposta aceita está bloqueada; duplique para criar uma nova negociação')
  }
  return Math.max(0, ...revisoes.map((r) => r.numero)) + 1
}
