import { z } from "zod";

export const PRIORIDADES_OS = ["baixa", "media", "alta", "urgente"] as const;
export type PrioridadeOS = (typeof PRIORIDADES_OS)[number];

export const STATUS_OS = ["aberta", "em_andamento", "aguardando_material", "concluida", "cancelada"] as const;
export type StatusOS = (typeof STATUS_OS)[number];

export const PRIORIDADE_LABEL: Record<PrioridadeOS, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const STATUS_LABEL: Record<StatusOS, string> = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  aguardando_material: "Aguardando Material",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ordemServicoSchema = z.object({
  titulo: z.string().trim().min(3, "O título deve ter no mínimo 3 caracteres"),
  descricao: z.string().trim().optional().or(z.literal("")),
  obra_id: z.string().uuid("Obra inválida").optional().nullable().or(z.literal("")),
  cliente_id: z.string().uuid("Cliente inválido").optional().nullable().or(z.literal("")),
  responsavel_id: z.string().uuid("Responsável inválido").optional().nullable().or(z.literal("")),
  responsavel_nome: z.string().trim().optional().or(z.literal("")),
  responsavel_telefone: z.string().trim().optional().or(z.literal("")),
  email_notificacao: z.string().trim().email("E-mail inválido").optional().nullable().or(z.literal("")),
  horario_lembrete: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, "Horário inválido (use HH:mm)").default("08:00"),
  data_previsao: z.string().min(1, "A data prevista é obrigatória"),
  prioridade: z.enum(PRIORIDADES_OS).default("media"),
  status: z.enum(STATUS_OS).default("aberta"),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

export type OrdemServicoFormValues = z.infer<typeof ordemServicoSchema>;

export interface OrdemServicoRow {
  id: string;
  numero: string;
  obra_id: string | null;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  email_notificacao: string | null;
  horario_lembrete: string | null;
  data_abertura: string;
  data_previsao: string;
  data_conclusao: string | null;
  prioridade: PrioridadeOS;
  status: StatusOS;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  obras?: { id: string; nome: string } | null;
  clientes?: { id: string; nome: string; telefone?: string | null } | null;
}

export interface StatusPrazoInfo {
  tipo: "concluida" | "cancelada" | "atrasada" | "vence_hoje" | "vence_amanha" | "vence_breve" | "no_prazo";
  label: string;
  diasDiferenca: number;
  classeBadge: string;
}

/**
 * Calcula o status visual do prazo estilo Trello
 */
export function calcularStatusPrazo(dataPrevisaoStr: string, status: StatusOS): StatusPrazoInfo {
  if (status === "concluida") {
    return {
      tipo: "concluida",
      label: "Concluída",
      diasDiferenca: 0,
      classeBadge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200",
    };
  }

  if (status === "cancelada") {
    return {
      tipo: "cancelada",
      label: "Cancelada",
      diasDiferenca: 0,
      classeBadge: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border-slate-200",
    };
  }

  if (!dataPrevisaoStr) {
    return {
      tipo: "no_prazo",
      label: "Sem prazo",
      diasDiferenca: 999,
      classeBadge: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  const [ano, mes, dia] = dataPrevisaoStr.split("-").map(Number);
  const dataPrevisao = new Date(ano, mes - 1, dia);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diffMs = dataPrevisao.getTime() - hoje.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    const absDias = Math.abs(diffDias);
    return {
      tipo: "atrasada",
      label: `Atrasada (${absDias}d)`,
      diasDiferenca: diffDias,
      classeBadge: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 animate-pulse font-medium",
    };
  }

  if (diffDias === 0) {
    return {
      tipo: "vence_hoje",
      label: "Vence Hoje!",
      diasDiferenca: 0,
      classeBadge: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 font-semibold",
    };
  }

  if (diffDias === 1) {
    return {
      tipo: "vence_amanha",
      label: "Vence Amanhã",
      diasDiferenca: 1,
      classeBadge: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200",
    };
  }

  if (diffDias <= 3) {
    return {
      tipo: "vence_breve",
      label: `Vence em ${diffDias} dias`,
      diasDiferenca: diffDias,
      classeBadge: "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200",
    };
  }

  return {
    tipo: "no_prazo",
    label: `Prazo: ${dataPrevisao.toLocaleDateString("pt-BR")}`,
    diasDiferenca: diffDias,
    classeBadge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
  };
}

/**
 * Gera URL de WhatsApp (wa.me) formatada e pré-preenchida
 */
export function gerarLinkWhatsApp(
  telefone: string | null | undefined,
  os: {
    numero: string;
    titulo: string;
    data_previsao: string;
    status: StatusOS;
    responsavel_nome?: string | null;
    obra_nome?: string | null;
  }
): string | null {
  if (!telefone) return null;

  // Manter apenas dígitos
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;

  // Garantir DDI do Brasil (55) se não vier com código de país
  const numeroCompleto = digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;

  const prazoInfo = calcularStatusPrazo(os.data_previsao, os.status);
  const dataFormatada = os.data_previsao ? new Date(os.data_previsao + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";

  let statusMsg = "";
  if (prazoInfo.tipo === "atrasada") {
    statusMsg = `⚠️ *ATENÇÃO: A OS ESTÁ ATRASADA!*`;
  } else if (prazoInfo.tipo === "vence_hoje") {
    statusMsg = `⏰ *LEMBRETE: O prazo vence HOJE!*`;
  } else if (prazoInfo.tipo === "vence_amanha") {
    statusMsg = `⏰ *LEMBRETE: O prazo vence AMANHÃ!*`;
  } else {
    statusMsg = `📌 *Status do prazo:* ${prazoInfo.label}`;
  }

  const saudacao = os.responsavel_nome ? `Olá, ${os.responsavel_nome}!` : `Olá!`;
  const obraTxt = os.obra_nome ? `\n🏗️ *Obra:* ${os.obra_nome}` : "";

  const texto = `${saudacao}\n\n*Aviso de Ordem de Serviço — ObrasFlow*\n\n📋 *${os.numero}* — ${os.titulo}${obraTxt}\n📅 *Previsão de Conclusão:* ${dataFormatada}\n${statusMsg}\n\nPor favor, confirme como está o andamento desta demanda.`;

  return `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(texto)}`;
}
