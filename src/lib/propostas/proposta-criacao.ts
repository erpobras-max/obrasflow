export interface SelecaoNovaProposta {
  obraId?: string
  orcamentoId?: string
  revisaoId?: string
  duplicar?: boolean
}

export type ResultadoSelecao =
  | { ok: false; mensagem: string }
  | { ok: true; obraId: string; orcamentoId: string; revisaoId: string; duplicar: boolean }

export function validarSelecaoNovaProposta(selecao: SelecaoNovaProposta): ResultadoSelecao {
  if (!selecao.obraId) return { ok: false, mensagem: 'Selecione uma obra.' }
  if (!selecao.orcamentoId) return { ok: false, mensagem: 'A obra não possui orçamento selecionado.' }
  if (!selecao.revisaoId) return { ok: false, mensagem: 'Selecione uma revisão do orçamento.' }
  return {
    ok: true,
    obraId: selecao.obraId,
    orcamentoId: selecao.orcamentoId,
    revisaoId: selecao.revisaoId,
    duplicar: selecao.duplicar === true,
  }
}
