// Tipos e helpers da estrutura hierárquica de propostas:
// Etapa > Item > Subitem (catálogo padrão + orçamento da proposta)

export interface CatalogoEtapa {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface CatalogoItem {
  id: string;
  etapa_id: string;
  codigo: string | null;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface CatalogoSubitem {
  id: string;
  item_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  valor_unitario: number;
  ordem: number;
  ativo: boolean;
}

/** Nó folha do orçamento (subitem) */
export interface SubitemDraft {
  key: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  observacoes: string;
}

/** Item do orçamento — pode ter subitens ou valor próprio */
export interface ItemDraft {
  key: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  observacoes: string;
  subitens: SubitemDraft[];
}

/** Etapa do orçamento da proposta */
export interface EtapaDraft {
  key: string;
  catalogo_etapa_id: string | null;
  nome: string;
  observacoes: string;
  itens: ItemDraft[];
}

export const novaKey = () =>
  `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function totalSubitem(s: SubitemDraft): number {
  return Number(s.quantidade || 0) * Number(s.valor_unitario || 0);
}

export function totalItem(i: ItemDraft): number {
  if (i.subitens.length > 0) {
    return i.subitens.reduce((sum, s) => sum + totalSubitem(s), 0);
  }
  return Number(i.quantidade || 0) * Number(i.valor_unitario || 0);
}

export function totalEtapa(e: EtapaDraft): number {
  return e.itens.reduce((sum, i) => sum + totalItem(i), 0);
}

export function totalProposta(etapas: EtapaDraft[]): number {
  return etapas.reduce((sum, e) => sum + totalEtapa(e), 0);
}

export const itemVazio = (codigo = ""): ItemDraft => ({
  key: novaKey(),
  codigo,
  descricao: "",
  unidade: "vb",
  quantidade: 1,
  valor_unitario: 0,
  observacoes: "",
  subitens: [],
});

export const subitemVazio = (codigo = ""): SubitemDraft => ({
  key: novaKey(),
  codigo,
  descricao: "",
  unidade: "vb",
  quantidade: 1,
  valor_unitario: 0,
  observacoes: "",
});

export const etapaVazia = (nome = ""): EtapaDraft => ({
  key: novaKey(),
  catalogo_etapa_id: null,
  nome,
  observacoes: "",
  itens: [itemVazio()],
});

/** Numeração automática 1, 1.1, 1.1.1 conforme posição na árvore */
export function numeracao(etapaIdx: number, itemIdx?: number, subIdx?: number): string {
  const parts = [etapaIdx + 1];
  if (itemIdx !== undefined) parts.push(itemIdx + 1);
  if (subIdx !== undefined) parts.push(subIdx + 1);
  return parts.join(".");
}
