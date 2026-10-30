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
  tituloProposta: string
  textoApresentacao: string
  textoEncerramento: string
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
  tituloProposta: 'Proposta Comercial para Execução de Obra',
  textoApresentacao:
    'Apresentamos nossa proposta técnica e comercial para a execução dos serviços de engenharia civil discriminados abaixo, em conformidade com as normas ABNT e projetos aprovados.',
  textoEncerramento:
    'Permanecemos à disposição para prestar quaisquer esclarecimentos necessários e alinhar o início das atividades.',
  prazoExecucaoTexto: '120 (cento e vinte) dias úteis a contar da mobilização inicial',
  validadeTexto: '15 (quinze) dias corridos a partir da data de emissão',
  condicoesPagamentoTexto:
    '• 15% de adiantamento na assinatura para mobilização e aquisição inicial.\n• Saldo em medições quinzenais de serviços efetivamente executados.\n• Retenção contratual técnica de 5% sobre cada medição liberada após vistoria final.',
  descricoesComerciais: {},
  etapasOcultas: [],
  atividadesOcultas: [],
  observacoesEtapa: {},
})

const registroTexto = (valor: unknown): Record<string, string> => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .filter(([, item]) => typeof item === 'string')
      .map(([chave, item]) => [chave, item as string]),
  )
}

export function normalizarConfiguracaoProposta(
  valor?: Partial<ConfiguracaoPropostaComercial> | null,
): ConfiguracaoPropostaComercial {
  const origem = valor && typeof valor === 'object' ? valor : {}
  const base = configuracaoPropostaComercialPadrao
  const booleano = (chave: keyof ConfiguracaoPropostaComercial) =>
    typeof origem[chave] === 'boolean' ? (origem[chave] as boolean) : (base[chave] as boolean)
  const texto = (chave: keyof ConfiguracaoPropostaComercial) =>
    typeof origem[chave] === 'string' ? (origem[chave] as string) : (base[chave] as string)
  const lista = (chave: 'etapasOcultas' | 'atividadesOcultas') =>
    Array.isArray(origem[chave]) ? origem[chave].filter((item): item is string => typeof item === 'string') : []

  return {
    mostrarEtapas: booleano('mostrarEtapas'),
    mostrarAtividades: booleano('mostrarAtividades'),
    mostrarQuantidades: booleano('mostrarQuantidades'),
    mostrarUnidades: booleano('mostrarUnidades'),
    mostrarPrecoUnitario: booleano('mostrarPrecoUnitario'),
    mostrarComposicoes: booleano('mostrarComposicoes'),
    mostrarCustosInternos: booleano('mostrarCustosInternos'),
    mostrarBdi: booleano('mostrarBdi'),
    mostrarCapa: booleano('mostrarCapa'),
    mostrarLogo: booleano('mostrarLogo'),
    mostrarDadosEmpresa: booleano('mostrarDadosEmpresa'),
    mostrarDadosCliente: booleano('mostrarDadosCliente'),
    mostrarDadosObra: booleano('mostrarDadosObra'),
    mostrarApenasEtapa: booleano('mostrarApenasEtapa'),
    mostrarCondicoesPagamento: booleano('mostrarCondicoesPagamento'),
    mostrarPrazoExecucao: booleano('mostrarPrazoExecucao'),
    mostrarValidade: booleano('mostrarValidade'),
    mostrarObservacoes: booleano('mostrarObservacoes'),
    mostrarAssinaturas: booleano('mostrarAssinaturas'),
    tituloProposta: texto('tituloProposta'),
    textoApresentacao: texto('textoApresentacao'),
    textoEncerramento: texto('textoEncerramento'),
    prazoExecucaoTexto: texto('prazoExecucaoTexto'),
    validadeTexto: texto('validadeTexto'),
    condicoesPagamentoTexto: texto('condicoesPagamentoTexto'),
    descricoesComerciais: registroTexto(origem.descricoesComerciais),
    etapasOcultas: lista('etapasOcultas'),
    atividadesOcultas: lista('atividadesOcultas'),
    observacoesEtapa: registroTexto(origem.observacoesEtapa),
  }
}

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
  configuracao: Partial<ConfiguracaoPropostaComercial> = configuracaoPropostaComercialPadrao
) {
  const config = normalizarConfiguracaoProposta(configuracao)
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
