export type EspacoFoto = { id?: string; object_key: string; ordem: number };

export type Espaco = {
  id: string;
  token_publico: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cep: string | null;
  endereco: string | null;
  capacidade: number;
  valor_hora: number;
  duracao_minima_minutos: number;
  horario_abertura: string;
  horario_fechamento: string;
  comodidades: string[];
  regras: string | null;
  status: "rascunho" | "publicado" | "inativo";
  fotos?: EspacoFoto[];
};

export type ReservaEspaco = {
  id: string;
  espaco_id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  inicio: string;
  fim: string;
  valor_total: number;
  status:
    | "solicitada"
    | "aguardando_pagamento"
    | "paga"
    | "confirmada"
    | "cancelada"
    | "expirada"
    | "finalizada";
  pagamento_status: "pendente" | "pago" | "estornado" | "falhou";
  acesso_status: "pendente" | "liberado" | "revogado" | "falhou";
  espaco?: Pick<Espaco, "nome" | "codigo"> | null;
};

export const statusReservaLabel: Record<ReservaEspaco["status"], string> = {
  solicitada: "Solicitada",
  aguardando_pagamento: "Aguardando pagamento",
  paga: "Paga",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  expirada: "Expirada",
  finalizada: "Finalizada",
};

export function combinarComodidades(selecionadas: string[], outras: string) {
  return [
    ...new Set([
      ...selecionadas,
      ...outras
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ]),
  ].slice(0, 20);
}

export function separarComodidades(comodidades: string[], padrao: readonly string[]) {
  const conhecidas = new Set(padrao);
  return {
    selecionadas: comodidades.filter((item) => conhecidas.has(item)),
    outras: comodidades.filter((item) => !conhecidas.has(item)).join(", "),
  };
}

export function calcularValorReserva(valorHora: number, inicio: Date, fim: Date) {
  const duracao = fim.getTime() - inicio.getTime();
  if (!Number.isFinite(valorHora) || valorHora <= 0 || duracao <= 0) return 0;
  return Math.ceil(duracao / 3_600_000) * valorHora;
}
