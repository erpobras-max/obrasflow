export interface EtapaCronograma {
  id: string;
  obra_id: string;
  nome: string;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  progresso: number;
  meta_percentual: number;
  etapa_origem_key: string | null;
  updated_at: string;
}

export function situacaoEtapa(etapa: Pick<EtapaCronograma, "data_inicio" | "data_fim" | "meta_percentual" | "progresso">, hoje: string) {
  if (!etapa.data_inicio || !etapa.data_fim) return "Prazo a definir";
  if (Number(etapa.progresso) >= Number(etapa.meta_percentual)) return "Meta atingida";
  if (hoje > etapa.data_fim) return "Prazo vencido";
  if (hoje < etapa.data_inicio) return "Programada";
  return "Dentro do período previsto";
}

export function validarLancamentoCronograma(inicio: string, fim: string, meta: string, realizado: string) {
  const metaNumero = Number(meta.replace(",", "."));
  const realizadoNumero = Number(realizado.replace(",", "."));
  if (!inicio || !fim) throw new Error("Informe início e fim previstos da etapa.");
  if (inicio > fim) throw new Error("O fim previsto não pode ser anterior ao início.");
  if (!meta.trim() || !Number.isFinite(metaNumero) || metaNumero <= 0 || metaNumero > 100) {
    throw new Error("A meta da etapa deve ser maior que 0 e até 100%.");
  }
  if (!realizado.trim() || !Number.isFinite(realizadoNumero) || realizadoNumero < 0 || realizadoNumero > 100) {
    throw new Error("O realizado deve estar entre 0 e 100%.");
  }
  return { data_inicio: inicio, data_fim: fim, meta_percentual: metaNumero, progresso: realizadoNumero };
}
