import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  UserCheck, Plus, Search, Pencil, Trash2, Clock, Calendar,
  FileText, Upload, Download, AlertTriangle, ChevronLeft, ChevronRight,
  CheckCircle2, Users, Loader2, DollarSign, Heart, Shield,
  Building2, Briefcase, X, Eye, MoreVertical, Phone, Mail,
  CreditCard, User, Star, Banknote, RefreshCw,
} from "lucide-react";
import { format, parseISO, differenceInDays, addYears, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { UFS } from "@/lib/clientes.schema";
import { cn, formatBRLInput } from "@/lib/utils";
import { uploadR2, getR2Url, openR2File } from "@/lib/r2";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/rh")({
  component: RhPage,
});

// ─────────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────────
interface FuncionarioRow {
  id: string;
  nome: string;
  cpf: string;
  rg: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  nacionalidade: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cep: string | null;
  logradouro: string | null;
  numero_end: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  matricula: string | null;
  cargo: string;
  departamento: string | null;
  obra_id: string | null;
  data_admissao: string;
  data_demissao: string | null;
  motivo_demissao: string | null;
  tipo_contrato: string;
  carga_horaria_semanal: number;
  salario_base: number;
  status: "ativo" | "afastado" | "demitido" | "ferias";
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix: string | null;
  pis: string | null;
  ctps_numero: string | null;
  ctps_serie: string | null;
  foto_url: string | null;
  observacoes: string | null;
  created_at: string;
}

interface RegistroPontoRow {
  id: string;
  funcionario_id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_retorno_almoco: string | null;
  hora_saida: string | null;
  horas_trabalhadas: number | null;
  tipo_dia: string;
  observacoes: string | null;
  fonte: string;
  created_at: string;
}

interface SolicitacaoAjustePontoRow {
  id: string;
  funcionario_id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_retorno_almoco: string | null;
  hora_saida: string | null;
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  resposta: string | null;
  created_at: string;
}

interface FeriasRow {
  id: string;
  funcionario_id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  dias_direito: number;
  dias_gozados: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  data_retorno: string | null;
  abono_pecuniario: number;
  status: string;
  observacoes: string | null;
  created_at: string;
}

interface AfastamentoRow {
  id: string;
  funcionario_id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  dias: number | null;
  cid: string | null;
  medico: string | null;
  crm: string | null;
  arquivo_url: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
}

interface DocumentoRhRow {
  id: string;
  funcionario_id: string;
  tipo: string;
  descricao: string | null;
  arquivo_url: string;
  data_documento: string | null;
  validade: string | null;
  created_at: string;
}

interface EventoFolhaRow {
  id: string;
  funcionario_id: string;
  competencia: string;
  tipo: string;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  natureza: "provento" | "desconto";
  created_at: string;
}

// ─────────────────────────────────────────────
// Constants / Helpers
// ─────────────────────────────────────────────
const fmtBRL = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T00:00").toLocaleDateString("pt-BR") : "—";
const fmtTime = (t: string | null) => t ? t.slice(0, 5) : "—";

function getEaster(year: number): Date {
  const f = Math.floor;
  const a = year % 19;
  const b = f(year / 100);
  const c = year % 100;
  const d = f(b / 4);
  const e = b % 4;
  const g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 19 * l) / 433);
  const month = f((h + l - 7 * m + 90) / 25);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(year, month - 1, day);
}

function getFeriadosNacionais(year: number): Record<string, string> {
  const formatKey = (m: number, d: number) => {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  const feriados: Record<string, string> = {
    [formatKey(1, 1)]: "Confraternização Universal",
    [formatKey(4, 21)]: "Tiradentes",
    [formatKey(5, 1)]: "Dia do Trabalho",
    [formatKey(9, 7)]: "Independência do Brasil",
    [formatKey(10, 12)]: "Nossa Senhora Aparecida",
    [formatKey(11, 2)]: "Finados",
    [formatKey(11, 15)]: "Proclamação da República",
    [formatKey(11, 20)]: "Dia de Zumbi e da Consciência Negra",
    [formatKey(12, 25)]: "Natal"
  };

  const easter = getEaster(year);
  
  const addDaysStr = (date: Date, days: number): string => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return format(result, "yyyy-MM-dd");
  };

  feriados[addDaysStr(easter, -47)] = "Carnaval"; // Terça-feira de Carnaval
  feriados[addDaysStr(easter, -2)] = "Sexta-feira Santa"; // Paixão de Cristo
  feriados[addDaysStr(easter, 60)] = "Corpus Christi";

  return feriados;
}

function calcularHorasTrabalhadas(entrada: string | null, saidaAlmoco: string | null, retornoAlmoco: string | null, saida: string | null): number {
  if (!entrada || !saida) return 0;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const entMin = toMinutes(entrada);
  const saiMin = toMinutes(saida);
  const almMin = saidaAlmoco && retornoAlmoco
    ? toMinutes(retornoAlmoco) - toMinutes(saidaAlmoco)
    : 60; // default 1h almoco
  return Math.max(0, (saiMin - entMin - almMin) / 60);
}

// Tabela INSS 2024 (progressiva)
function calcularINSS(salarioBruto: number): number {
  const faixas = [
    { teto: 1412.00, aliq: 0.075 },
    { teto: 2666.68, aliq: 0.09 },
    { teto: 4000.03, aliq: 0.12 },
    { teto: 7786.02, aliq: 0.14 },
  ];
  let inss = 0;
  let anterior = 0;
  for (const faixa of faixas) {
    if (salarioBruto <= 0) break;
    const base = Math.min(salarioBruto, faixa.teto) - anterior;
    inss += Math.max(0, base) * faixa.aliq;
    anterior = faixa.teto;
    if (salarioBruto <= faixa.teto) break;
  }
  return Math.round(Math.min(inss, 908.86) * 100) / 100;
}

// Tabela IRRF 2024
function calcularIRRF(baseCalculo: number, numDependentes = 0): number {
  const baseApos = baseCalculo - numDependentes * 189.59;
  if (baseApos <= 2112.00) return 0;
  if (baseApos <= 2826.65) return Math.max(0, baseApos * 0.075 - 158.40);
  if (baseApos <= 3751.05) return Math.max(0, baseApos * 0.15 - 370.40);
  if (baseApos <= 4664.68) return Math.max(0, baseApos * 0.225 - 651.73);
  return Math.max(0, baseApos * 0.275 - 884.96);
}

const STATUS_FUNC_LABEL: Record<string, string> = {
  ativo: "Ativo", afastado: "Afastado", demitido: "Demitido", ferias: "Férias",
};
const STATUS_FUNC_BADGE: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800",
  afastado: "bg-amber-100 text-amber-800",
  demitido: "bg-red-100 text-red-800",
  ferias: "bg-blue-100 text-blue-800",
};

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  clt: "CLT", pj: "PJ", estagiario: "Estágio", temporario: "Temporário", autonomo: "Autônomo",
};

const TIPO_AFASTAMENTO_LABEL: Record<string, string> = {
  atestado_medico: "Atestado Médico",
  licenca_maternidade: "Lic. Maternidade",
  licenca_paternidade: "Lic. Paternidade",
  inss: "INSS / Previdência",
  acidente_trabalho: "Acidente de Trabalho",
  licenca_nao_remunerada: "Lic. Não Remunerada",
  outros: "Outros",
};

const TIPO_DOC_LABEL: Record<string, string> = {
  contrato: "Contrato de Trabalho",
  ctps: "CTPS",
  rg: "RG",
  cpf: "CPF",
  admissao: "Documentos de Admissão",
  demissao: "Documentos de Demissão",
  declaracao: "Declaração",
  outros: "Outros",
};

const TIPO_EVENTO_LABEL: Record<string, string> = {
  hora_extra_50: "Hora Extra 50%",
  hora_extra_100: "Hora Extra 100%",
  adicional_noturno: "Adicional Noturno",
  adicional_insalubridade: "Insalubridade",
  adicional_periculosidade: "Periculosidade",
  vale_transporte: "Vale Transporte",
  vale_refeicao: "Vale Refeição",
  desconto_falta: "Desconto Falta",
  desconto_atraso: "Desconto Atraso",
  adiantamento: "Adiantamento",
  outros_proventos: "Outros Proventos",
  outros_descontos: "Outros Descontos",
};

const TIPO_DIA_LABEL: Record<string, string> = {
  normal: "Normal", folga: "Folga", feriado: "Feriado",
  falta: "Falta", meio_periodo: "Meio Período", afastamento: "Afastamento",
};

const TIPO_DIA_BADGE: Record<string, string> = {
  normal: "bg-emerald-100 text-emerald-800",
  folga: "bg-slate-100 text-slate-600",
  feriado: "bg-purple-100 text-purple-800",
  falta: "bg-red-100 text-red-800",
  meio_periodo: "bg-amber-100 text-amber-800",
  afastamento: "bg-blue-100 text-blue-800",
};

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────
const funcionarioSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório"),
  cpf: z.string().trim().min(11, "CPF obrigatório"),
  rg: z.string().optional().or(z.literal("")),
  data_nascimento: z.string().optional().or(z.literal("")),
  sexo: z.string().optional().or(z.literal("")),
  estado_civil: z.string().optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional().or(z.literal("")),
  celular: z.string().optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  logradouro: z.string().optional().or(z.literal("")),
  numero_end: z.string().optional().or(z.literal("")),
  complemento: z.string().optional().or(z.literal("")),
  bairro: z.string().optional().or(z.literal("")),
  cidade: z.string().optional().or(z.literal("")),
  uf: z.string().optional().or(z.literal("")),
  matricula: z.string().optional().or(z.literal("")),
  cargo: z.string().trim().min(2, "Cargo obrigatório"),
  departamento: z.string().optional().or(z.literal("")),
  obra_id: z.string().uuid().optional().or(z.literal("")),
  data_admissao: z.string().min(1, "Data de admissão obrigatória"),
  data_demissao: z.string().optional().or(z.literal("")),
  motivo_demissao: z.string().optional().or(z.literal("")),
  tipo_contrato: z.enum(["clt","pj","estagiario","temporario","autonomo"]),
  carga_horaria_semanal: z.coerce.number().int().min(1).max(48).default(44),
  salario_base: z.coerce.number().min(0, "Salário inválido"),
  status: z.enum(["ativo","afastado","demitido","ferias"]),
  banco: z.string().optional().or(z.literal("")),
  agencia: z.string().optional().or(z.literal("")),
  conta: z.string().optional().or(z.literal("")),
  tipo_conta: z.string().optional().or(z.literal("")),
  pix: z.string().optional().or(z.literal("")),
  pis: z.string().optional().or(z.literal("")),
  ctps_numero: z.string().optional().or(z.literal("")),
  ctps_serie: z.string().optional().or(z.literal("")),
  observacoes: z.string().optional().or(z.literal("")),
});
type FuncionarioForm = z.infer<typeof funcionarioSchema>;

const pontoSchema = z.object({
  data: z.string().min(1, "Data obrigatória"),
  hora_entrada: z.string().optional().or(z.literal("")),
  hora_saida_almoco: z.string().optional().or(z.literal("")),
  hora_retorno_almoco: z.string().optional().or(z.literal("")),
  hora_saida: z.string().optional().or(z.literal("")),
  tipo_dia: z.enum(["normal","folga","feriado","falta","meio_periodo","afastamento"]),
  observacoes: z.string().optional().or(z.literal("")),
});
type PontoForm = z.infer<typeof pontoSchema>;

const feriasSchema = z.object({
  periodo_aquisitivo_inicio: z.string().min(1, "Obrigatório"),
  periodo_aquisitivo_fim: z.string().min(1, "Obrigatório"),
  dias_direito: z.coerce.number().int().min(1).max(30).default(30),
  data_inicio_gozo: z.string().optional().or(z.literal("")),
  data_fim_gozo: z.string().optional().or(z.literal("")),
  data_retorno: z.string().optional().or(z.literal("")),
  abono_pecuniario: z.coerce.number().int().min(0).max(10).default(0),
  status: z.enum(["aquisitivo","programado","gozando","concluido","vencido"]),
  observacoes: z.string().optional().or(z.literal("")),
});
type FeriasForm = z.infer<typeof feriasSchema>;

const afastamentoSchema = z.object({
  tipo: z.enum(["atestado_medico","licenca_maternidade","licenca_paternidade","inss","acidente_trabalho","licenca_nao_remunerada","outros"]),
  data_inicio: z.string().min(1, "Data início obrigatória"),
  data_fim: z.string().optional().or(z.literal("")),
  cid: z.string().optional().or(z.literal("")),
  medico: z.string().optional().or(z.literal("")),
  crm: z.string().optional().or(z.literal("")),
  observacoes: z.string().optional().or(z.literal("")),
  status: z.enum(["pendente","aprovado","reprovado"]),
});
type AfastamentoForm = z.infer<typeof afastamentoSchema>;

const eventoFolhaSchema = z.object({
  tipo: z.string().min(1, "Tipo obrigatório"),
  descricao: z.string().optional().or(z.literal("")),
  quantidade: z.coerce.number().min(0.01),
  valor_unitario: z.coerce.number().min(0),
  natureza: z.enum(["provento","desconto"]),
});
type EventoFolhaForm = z.infer<typeof eventoFolhaSchema>;

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
function RhPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEscrever = perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "rh";

  const [activeTab, setActiveTab] = useState("funcionarios");

  // Modals
  const [funcModal, setFuncModal] = useState<FuncionarioRow | null | "new">(null);
  const [deleteFunc, setDeleteFunc] = useState<FuncionarioRow | null>(null);
  const [pontoModal, setPontoModal] = useState<{ func: FuncionarioRow; registro: RegistroPontoRow | null; defaultDate?: string } | null>(null);
  const [feriasModal, setFeriasModal] = useState<{ func: FuncionarioRow; ferias: FeriasRow | null } | null>(null);
  const [afastamentoModal, setAfastamentoModal] = useState<{ func: FuncionarioRow; afastamento: AfastamentoRow | null } | null>(null);
  const [eventoModal, setEventoModal] = useState<{ func: FuncionarioRow; evento: EventoFolhaRow | null } | null>(null);

  // Filters
  const [searchFunc, setSearchFunc] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Ponto state
  const [pontoFuncId, setPontoFuncId] = useState<string>("");
  const [pontoMes, setPontoMes] = useState(() => format(new Date(), "yyyy-MM"));

  // Folha state
  const [folhaFuncId, setFolhaFuncId] = useState<string>("");
  const [folhaCompetencia, setFolhaCompetencia] = useState(() => format(new Date(), "yyyy-MM"));

  // Atestados filter
  const [atestadoFuncId, setAtestadoFuncId] = useState("all");

  // Docs filter
  const [docsFuncId, setDocsFuncId] = useState<string>("");

  // ─── Queries ───
  const { data: funcionarios, isLoading: loadingFunc } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("funcionarios").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as FuncionarioRow[];
    },
  });

  const { data: obras } = useQuery({
    queryKey: ["obras-rh"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("obras").select("id,numero,nome").order("nome");
      return (data ?? []) as { id: string; numero: string; nome: string }[];
    },
  });

  const { data: registrosPonto, isLoading: loadingPonto } = useQuery({
    queryKey: ["ponto", pontoFuncId, pontoMes],
    queryFn: async () => {
      if (!pontoFuncId) return [];
      const inicio = pontoMes + "-01";
      const endDate = endOfMonth(parseISO(inicio));
      const fim = format(endDate, "yyyy-MM-dd");
      const { data, error } = await (supabase as any)
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", pontoFuncId)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data");
      if (error) throw error;
      return (data ?? []) as RegistroPontoRow[];
    },
    enabled: !!pontoFuncId,
  });

  const { data: solicitacoesAjuste = [] } = useQuery({
    queryKey: ["solicitacoes-ajuste-ponto"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solicitacoes_ajuste_ponto")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolicitacaoAjustePontoRow[];
    },
  });

  const { data: todasFerias } = useQuery({
    queryKey: ["ferias"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ferias").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeriasRow[];
    },
  });

  const { data: afastamentos } = useQuery({
    queryKey: ["afastamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("afastamentos").select("*").order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AfastamentoRow[];
    },
  });

  const { data: documentosRh } = useQuery({
    queryKey: ["documentos_rh", docsFuncId],
    queryFn: async () => {
      let q = (supabase as any).from("documentos_rh").select("*").order("created_at", { ascending: false });
      if (docsFuncId) q = q.eq("funcionario_id", docsFuncId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DocumentoRhRow[];
    },
    enabled: !!docsFuncId,
  });

  const { data: eventosFolha } = useQuery({
    queryKey: ["eventos_folha", folhaFuncId, folhaCompetencia],
    queryFn: async () => {
      if (!folhaFuncId) return [];
      const { data, error } = await (supabase as any)
        .from("eventos_folha")
        .select("*")
        .eq("funcionario_id", folhaFuncId)
        .eq("competencia", folhaCompetencia)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as EventoFolhaRow[];
    },
    enabled: !!folhaFuncId,
  });

  // ─── KPIs ───
  const kpis = useMemo(() => {
    const f = funcionarios ?? [];
    return {
      total: f.length,
      ativos: f.filter(x => x.status === "ativo").length,
      afastados: f.filter(x => x.status === "afastado").length,
      ferias: f.filter(x => x.status === "ferias").length,
      demitidos: f.filter(x => x.status === "demitido").length,
    };
  }, [funcionarios]);

  // ─── Filtered funcionários ───
  const filteredFuncionarios = useMemo(() => {
    let list = funcionarios ?? [];
    if (filterStatus !== "all") list = list.filter(f => f.status === filterStatus);
    if (searchFunc.trim()) {
      const s = searchFunc.toLowerCase();
      list = list.filter(f =>
        f.nome.toLowerCase().includes(s) ||
        f.cpf.includes(s) ||
        (f.cargo ?? "").toLowerCase().includes(s) ||
        (f.departamento ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [funcionarios, filterStatus, searchFunc]);

  // ─── Ponto: build calendar rows ───
  const pontoRows = useMemo(() => {
    if (!pontoFuncId || !pontoMes) return [];
    const inicio = parseISO(pontoMes + "-01");
    const fim = endOfMonth(inicio);
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    const year = inicio.getFullYear();
    const feriados = getFeriadosNacionais(year);
    return dias.map(dia => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const reg = registrosPonto?.find(r => r.data === dataStr) ?? null;
      const weekend = isWeekend(dia);
      const feriadoNome = feriados[dataStr] || null;
      return { dia, dataStr, reg, weekend, feriadoNome };
    });
  }, [pontoFuncId, pontoMes, registrosPonto]);

  const pontoSummary = useMemo(() => {
    const rows = pontoRows.filter(r => !r.weekend && !r.feriadoNome);
    const totalTrabalhados = pontoRows.filter(r => r.reg && (r.reg.tipo_dia === "normal" || r.reg.tipo_dia === "meio_periodo")).length;
    const faltas = rows.filter(r => r.reg?.tipo_dia === "falta").length;
    const totalH = pontoRows.reduce((s, r) => {
      if (!r.reg) return s;
      return s + (r.reg.horas_trabalhadas ?? calcularHorasTrabalhadas(r.reg.hora_entrada, r.reg.hora_saida_almoco, r.reg.hora_retorno_almoco, r.reg.hora_saida));
    }, 0);
    const esperadas = rows.length * 8;
    const extras = Math.max(0, totalH - esperadas);
    return { trabalhados: totalTrabalhados, faltas, totalH: totalH.toFixed(1), extras: extras.toFixed(1) };
  }, [pontoRows]);

  // ─── Férias: calcular saldo e vencimentos ───
  const feriasData = useMemo(() => {
    return (funcionarios ?? []).map(func => {
      const fs = (todasFerias ?? []).filter(f => f.funcionario_id === func.id);
      const diasGozados = fs.reduce((s, f) => s + f.dias_gozados, 0);
      const admissao = parseISO(func.data_admissao);
      const hoje = new Date();
      const anosEmpresa = Math.floor(differenceInDays(hoje, admissao) / 365);
      const diasDireito = Math.max(0, anosEmpresa * 30);
      const saldo = diasDireito - diasGozados;
      const proximoVencimento = addYears(admissao, Math.max(1, anosEmpresa + 1));
      const diasParaVencer = differenceInDays(proximoVencimento, hoje);
      const vencida = diasParaVencer < 0;
      return { func, diasDireito, diasGozados, saldo, proximoVencimento, diasParaVencer, vencida };
    }).filter(x => x.func.status !== "demitido");
  }, [funcionarios, todasFerias]);

  const feriasVencidas = useMemo(() => feriasData.filter(f => f.vencida).length, [feriasData]);

  // ─── Folha de pagamento ───
  const resumoFolha = useMemo(() => {
    if (!folhaFuncId) return null;
    const func = funcionarios?.find(f => f.id === folhaFuncId);
    if (!func) return null;
    const salarioBase = func.salario_base / 100;
    const eventos = eventosFolha ?? [];
    const proventos = eventos.filter(e => e.natureza === "provento");
    const descontos = eventos.filter(e => e.natureza === "desconto");
    const outrosProventos = proventos.reduce((s, e) => s + e.valor_total / 100, 0);
    const outrosDescontos = descontos.reduce((s, e) => s + e.valor_total / 100, 0);
    const totalBruto = salarioBase + outrosProventos;
    const inss = calcularINSS(totalBruto);
    const irrf = Math.round(Math.max(0, calcularIRRF(totalBruto - inss)) * 100) / 100;
    const totalDescontos = inss + irrf + outrosDescontos;
    const liquido = totalBruto - totalDescontos;
    return { func, salarioBase, outrosProventos, totalBruto, inss, irrf, outrosDescontos, totalDescontos, liquido, proventos, descontos };
  }, [folhaFuncId, funcionarios, eventosFolha]);

  // ─── Mutations ───
  const funcMutation = useMutation({
    mutationFn: async ({ values, target }: { values: FuncionarioForm; target: FuncionarioRow | null }) => {
      const payload = {
        nome: values.nome,
        cpf: values.cpf.replace(/\D/g, ""),
        rg: values.rg || null,
        data_nascimento: values.data_nascimento || null,
        sexo: values.sexo || null,
        estado_civil: values.estado_civil || null,
        email: values.email || null,
        telefone: values.telefone || null,
        celular: values.celular || null,
        cep: values.cep || null,
        logradouro: values.logradouro || null,
        numero_end: values.numero_end || null,
        complemento: values.complemento || null,
        bairro: values.bairro || null,
        cidade: values.cidade || null,
        uf: values.uf || null,
        matricula: values.matricula || null,
        cargo: values.cargo,
        departamento: values.departamento || null,
        obra_id: values.obra_id || null,
        data_admissao: values.data_admissao,
        data_demissao: values.data_demissao || null,
        motivo_demissao: values.motivo_demissao || null,
        tipo_contrato: values.tipo_contrato,
        carga_horaria_semanal: values.carga_horaria_semanal,
        salario_base: Math.round(values.salario_base * 100),
        status: values.status,
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        tipo_conta: values.tipo_conta || null,
        pix: values.pix || null,
        pis: values.pis || null,
        ctps_numero: values.ctps_numero || null,
        ctps_serie: values.ctps_serie || null,
        observacoes: values.observacoes || null,
      };
      if (target) {
        const { error } = await (supabase as any).from("funcionarios").update(payload).eq("id", target.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("funcionarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Funcionário salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      setFuncModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFuncMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funcionário removido");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      setDeleteFunc(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pontoMutation = useMutation({
    mutationFn: async ({ values, funcId, existingId }: { values: PontoForm; funcId: string; existingId: string | null }) => {
      const horas = calcularHorasTrabalhadas(values.hora_entrada || null, values.hora_saida_almoco || null, values.hora_retorno_almoco || null, values.hora_saida || null);
      const payload = {
        funcionario_id: funcId,
        data: values.data,
        hora_entrada: values.hora_entrada || null,
        hora_saida_almoco: values.hora_saida_almoco || null,
        hora_retorno_almoco: values.hora_retorno_almoco || null,
        hora_saida: values.hora_saida || null,
        horas_trabalhadas: horas > 0 ? horas : null,
        tipo_dia: values.tipo_dia,
        observacoes: values.observacoes || null,
      };
      if (existingId) {
        const { error } = await (supabase as any).from("registros_ponto").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("registros_ponto").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Ponto registrado");
      qc.invalidateQueries({ queryKey: ["ponto"] });
      setPontoModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revisarAjusteMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "rejeitado" }) => {
      const { error } = await (supabase as any).rpc("revisar_solicitacao_ajuste_ponto", {
        p_solicitacao_id: id,
        p_status: status,
        p_resposta: status === "aprovado" ? "Ajuste conferido e aplicado pelo RH." : "Solicitação rejeitada pelo RH.",
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === "aprovado" ? "Ajuste aprovado e aplicado" : "Solicitação rejeitada");
      qc.invalidateQueries({ queryKey: ["solicitacoes-ajuste-ponto"] });
      qc.invalidateQueries({ queryKey: ["ponto"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feriasMutation = useMutation({
    mutationFn: async ({ values, funcId, existingId }: { values: FeriasForm; funcId: string; existingId: string | null }) => {
      const gozados = values.data_inicio_gozo && values.data_fim_gozo
        ? differenceInDays(parseISO(values.data_fim_gozo), parseISO(values.data_inicio_gozo)) + 1
        : 0;
      const payload = {
        funcionario_id: funcId,
        periodo_aquisitivo_inicio: values.periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim: values.periodo_aquisitivo_fim,
        dias_direito: values.dias_direito,
        dias_gozados: gozados,
        data_inicio_gozo: values.data_inicio_gozo || null,
        data_fim_gozo: values.data_fim_gozo || null,
        data_retorno: values.data_retorno || null,
        abono_pecuniario: values.abono_pecuniario,
        status: values.status,
        observacoes: values.observacoes || null,
      };
      if (existingId) {
        const { error } = await (supabase as any).from("ferias").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("ferias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Férias salvas com sucesso");
      qc.invalidateQueries({ queryKey: ["ferias"] });
      setFeriasModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const afastamentoMutation = useMutation({
    mutationFn: async ({ values, funcId, file, existingId }: { values: AfastamentoForm; funcId: string; file: File | null; existingId: string | null }) => {
      let arquivo_url = null;
      if (file) {
        arquivo_url = await uploadR2(file, "rh/atestados");
      }
      const dias = values.data_fim
        ? differenceInDays(parseISO(values.data_fim), parseISO(values.data_inicio)) + 1
        : null;
      const payload: any = {
        funcionario_id: funcId,
        tipo: values.tipo,
        data_inicio: values.data_inicio,
        data_fim: values.data_fim || null,
        dias,
        cid: values.cid || null,
        medico: values.medico || null,
        crm: values.crm || null,
        observacoes: values.observacoes || null,
        status: values.status,
      };
      if (arquivo_url) payload.arquivo_url = arquivo_url;
      if (existingId) {
        const { error } = await (supabase as any).from("afastamentos").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("afastamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Afastamento registrado");
      qc.invalidateQueries({ queryKey: ["afastamentos"] });
      setAfastamentoModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eventoMutation = useMutation({
    mutationFn: async ({ values, funcId, existingId }: { values: EventoFolhaForm; funcId: string; existingId: string | null }) => {
      const vUnit = Math.round(values.valor_unitario * 100);
      const vTotal = Math.round(values.quantidade * values.valor_unitario * 100);
      const payload = {
        funcionario_id: funcId,
        competencia: folhaCompetencia,
        tipo: values.tipo,
        descricao: values.descricao || null,
        quantidade: values.quantidade,
        valor_unitario: vUnit,
        valor_total: vTotal,
        natureza: values.natureza,
      };
      if (existingId) {
        const { error } = await (supabase as any).from("eventos_folha").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("eventos_folha").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Evento adicionado à folha");
      qc.invalidateQueries({ queryKey: ["eventos_folha"] });
      setEventoModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEventoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("eventos_folha").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["eventos_folha"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Export helpers ───
  const exportarFolhaPonto = () => {
    if (!pontoFuncId || pontoRows.length === 0) return;
    const func = funcionarios?.find(f => f.id === pontoFuncId);
    const rows = pontoRows.map(r => ({
      "Data": fmtDate(r.dataStr),
      "Dia": format(r.dia, "EEEE", { locale: ptBR }),
      "Tipo": TIPO_DIA_LABEL[r.reg?.tipo_dia ?? (r.weekend ? "folga" : "")],
      "Entrada": r.reg?.hora_entrada ? fmtTime(r.reg.hora_entrada) : "",
      "Saída Almoço": r.reg?.hora_saida_almoco ? fmtTime(r.reg.hora_saida_almoco) : "",
      "Retorno": r.reg?.hora_retorno_almoco ? fmtTime(r.reg.hora_retorno_almoco) : "",
      "Saída": r.reg?.hora_saida ? fmtTime(r.reg.hora_saida) : "",
      "Horas": (() => {
        if (!r.reg) return "";
        const h = r.reg.horas_trabalhadas ?? calcularHorasTrabalhadas(r.reg.hora_entrada, r.reg.hora_saida_almoco, r.reg.hora_retorno_almoco, r.reg.hora_saida);
        return h > 0 ? h.toFixed(1) : "";
      })(),
      "Obs": r.reg?.observacoes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ponto");
    XLSX.writeFile(wb, `ponto-${func?.nome ?? "funcionario"}-${pontoMes}.xlsx`);
  };

  const exportarHolerite = async () => {
    if (!resumoFolha) return;

    // Busca dados da empresa empregadora
    const { data: empresaData } = await supabase
      .from("configuracoes_empresa")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const empNome = empresaData?.razao_social ?? "Minha Empresa Empregadora Ltda";
    const empCnpj = empresaData?.cnpj ?? "00.000.000/0001-00";
    const empEnd = empresaData?.endereco ?? "Av. Brasil, 1000 - Centro";

    const func = resumoFolha.func;
    const mesReferencia = folhaCompetencia; // ex: "2024-06"
    let refStr = mesReferencia;
    try {
      const [ano, mes] = mesReferencia.split("-");
      const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      refStr = `${meses[parseInt(mes) - 1]} / ${ano}`;
    } catch (e) {}

    // Preparar eventos do holerite
    const proventosRows = [
      { cod: "001", descricao: "SALÁRIO BASE", ref: "220:00", provento: resumoFolha.salarioBase, desconto: 0 },
      ...resumoFolha.proventos.map((e, index) => ({
        cod: String(100 + index).padStart(3, "0"),
        descricao: TIPO_EVENTO_LABEL[e.tipo] + (e.descricao ? ` — ${e.descricao}` : ""),
        ref: "",
        provento: e.valor_total / 100,
        desconto: 0
      }))
    ];

    const descontosRows = [
      { cod: "901", descricao: "INSS", ref: "", provento: 0, desconto: resumoFolha.inss },
      ...(resumoFolha.irrf > 0 ? [{ cod: "903", descricao: "IRRF", ref: "", provento: 0, desconto: resumoFolha.irrf }] : []),
      ...resumoFolha.descontos.map((e, index) => ({
        cod: String(500 + index).padStart(3, "0"),
        descricao: TIPO_EVENTO_LABEL[e.tipo] + (e.descricao ? ` — ${e.descricao}` : ""),
        ref: "",
        provento: 0,
        desconto: e.valor_total / 100
      }))
    ];

    const allEvents = [...proventosRows, ...descontosRows];

    // Totalizadores
    const totalProventos = proventosRows.reduce((acc, curr) => acc + curr.provento, 0);
    const totalDescontos = descontosRows.reduce((acc, curr) => acc + curr.desconto, 0);
    const valorLiquido = totalProventos - totalDescontos;

    const baseInss = totalProventos;
    const baseFgts = totalProventos;
    const fgtsMes = baseFgts * 0.08;
    const baseIrrf = Math.max(0, baseInss - resumoFolha.inss);

    // Função para gerar o HTML de uma via
    const gerarViaHTML = (viaLabel: string) => `
      <div class="holerite-via">
        <div class="holerite-container">
          <div class="main-body">
            <!-- Top Box -->
            <div class="row header-row" style="display: flex; border-bottom: 1px solid #475569; min-height: 70px; height: auto;">
              <div class="col col-emp" style="width: 60%; border-right: 1px solid #475569; padding: 6px 10px; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start;">
                <strong style="font-size: 7px; color: #475569; text-transform: uppercase;">EMPREGADOR</strong>
                <span class="val font-bold" style="font-size: 10px; line-height: 1.1; margin-top: 2px; display: block; font-weight: 700;">${empNome}</span>
                <span class="val" style="font-size: 8px; line-height: 1.1; margin-top: 2px; display: block;">${empEnd}</span>
                <span class="val" style="font-size: 8px; line-height: 1.1; margin-top: 2px; display: block; font-weight: 600;">CNPJ: ${empCnpj}</span>
              </div>
              <div class="col col-title" style="width: 40%; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <h2 style="font-size: 10.5px; font-weight: 700; color: #0f172a; text-transform: uppercase; line-height: 1.1; margin: 0;">Recibo de Pagamento de Salário</h2>
                <div class="ref-date" style="margin-top: 4px; font-size: 8.5px; white-space: nowrap;">Referente ao Mês / Ano: <strong style="font-size: 9px;">${refStr}</strong></div>
              </div>
            </div>

            <!-- Colaborador Box -->
            <div class="row info-row" style="display: flex; border-bottom: 1px solid #475569; min-height: 38px; height: auto;">
              <div class="col" style="width: 15%; border-right: 1px solid #475569; padding: 4px 8px; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 7px;">CÓDIGO</strong>
                <span class="val font-mono" style="font-size: 9.5px; font-weight: 600; margin-top: 1px;">${func.matricula || func.cpf.replace(/\D/g, "").slice(0, 5)}</span>
              </div>
              <div class="col" style="width: 50%; border-right: 1px solid #475569; padding: 4px 8px; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 7px;">NOME DO FUNCIONÁRIO</strong>
                <span class="val font-bold" style="font-size: 9.5px; margin-top: 1px;">${func.nome}</span>
              </div>
              <div class="col" style="width: 15%; border-right: 1px solid #475569; padding: 4px 8px; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 7px;">CBO</strong>
                <span class="val font-mono" style="font-size: 9px; margin-top: 1px;">${func.pis || "—"}</span>
              </div>
              <div class="col" style="width: 20%; padding: 4px 8px; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 7px;">FUNÇÃO</strong>
                <span class="val font-bold" style="font-size: 8px; line-height: 1.1; margin-top: 1px; display: block; white-space: normal; word-break: break-word;">${func.cargo || "COLABORADOR"}</span>
              </div>
            </div>

            <!-- Tabela de Lançamentos -->
            <div class="table-container">
              <table class="holerite-table">
                <thead>
                  <tr>
                    <th style="width: 8%;">Cód.</th>
                    <th style="width: 52%;">Descrição</th>
                    <th style="width: 12%; text-align: right;">Referência</th>
                    <th style="width: 14%; text-align: right;">Proventos</th>
                    <th style="width: 14%; text-align: right;">Descontos</th>
                  </tr>
                </thead>
                <tbody>
                  ${allEvents.map(e => `
                    <tr>
                      <td class="font-mono text-center">${e.cod}</td>
                      <td>${e.descricao}</td>
                      <td class="text-right font-mono">${e.ref || "—"}</td>
                      <td class="text-right font-mono">${e.provento > 0 ? e.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                      <td class="text-right font-mono">${e.desconto > 0 ? e.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    </tr>
                  `).join('')}
                  <!-- Espaçamento para tabela ter tamanho fixo -->
                  ${Array.from({ length: Math.max(0, 8 - allEvents.length) }).map(() => `
                    <tr class="empty-row">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Footer Totais -->
            <div class="row message-row" style="display: flex; border-bottom: 1px solid #475569; min-height: 60px; height: auto;">
              <div class="col col-msg" style="width: 60%; border-right: 1px solid #475569; padding: 6px 8px; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 7px;">MENSAGENS</strong>
                <span class="val text-sm" style="font-size: 8.5px; margin-top: 1px;">Agradecemos o seu trabalho e dedicação!</span>
              </div>
              <div class="col col-tot" style="width: 40%; padding: 0; display: flex; flex-direction: column; justify-content: stretch;">
                <div class="sub-row border-b" style="display: flex; border-bottom: 1px solid #475569; min-height: 38px; height: auto;">
                  <div class="half" style="width: 50%; padding: 3px 6px; border-right: 1px solid #475569; display: flex; flex-direction: column; justify-content: center;">
                    <strong style="font-size: 6.5px; display: block; line-height: 1.1; color: #475569;">TOTAL VENCIMENTOS</strong>
                    <span class="val font-mono" style="display: block; text-align: right; font-size: 9.5px; font-weight: 600; line-height: 1.1; margin-top: 1px;">${totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div class="half" style="width: 50%; padding: 3px 6px; display: flex; flex-direction: column; justify-content: center;">
                    <strong style="font-size: 6.5px; display: block; line-height: 1.1; color: #475569;">TOTAL DESCONTOS</strong>
                    <span class="val font-mono" style="display: block; text-align: right; font-size: 9.5px; font-weight: 600; line-height: 1.1; margin-top: 1px;">${totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div class="sub-row" style="display: flex; background: #f8fafc; min-height: 28px; height: auto; align-items: center; flex: 1; padding: 4px 8px;">
                  <div class="full flex-between" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 7.5px; text-transform: uppercase;">Líquido a Receber &rarr;</strong>
                    <span class="val font-bold font-mono" style="font-size: 11.5px; color: #1e3a5f; font-weight: 700;">${valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rodapé Bases -->
            <div class="row base-row" style="display: flex; border-bottom: none; height: 40px;">
              <div class="col" style="width: 16.66%; border-right: 1px solid #475569; padding: 3px 6px;">
                <strong>Salário Base</strong><br>
                <span class="val font-mono">${(func.salario_base / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="col" style="width: 16.66%; border-right: 1px solid #475569; padding: 3px 6px;">
                <strong>Base Cálc. INSS</strong><br>
                <span class="val font-mono">${baseInss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="col" style="width: 16.66%; border-right: 1px solid #475569; padding: 3px 6px;">
                <strong>Base Cálc. FGTS</strong><br>
                <span class="val font-mono">${baseFgts.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="col" style="width: 16.66%; border-right: 1px solid #475569; padding: 3px 6px;">
                <strong>FGTS do Mês</strong><br>
                <span class="val font-mono">${fgtsMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="col" style="width: 16.66%; border-right: 1px solid #475569; padding: 3px 6px;">
                <strong>Base Cálc. IRRF</strong><br>
                <span class="val font-mono">${baseIrrf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="col" style="width: 16.66%; padding: 3px 6px;">
                <strong>Faixa IRRF</strong><br>
                <span class="val font-mono">${resumoFolha.irrf > 0 ? "7.5%" : "Isento"}</span>
              </div>
            </div>
            <div class="via-indicator" style="background: #475569; color: #fff; padding: 2px 8px; font-size: 8px; text-transform: uppercase; font-weight: 600; width: fit-content; border-radius: 0 4px 0 0; margin-top: auto;">${viaLabel}</div>
          </div>

          <!-- Lateral de Assinatura Vertical (2 Colunas Paralelas conforme Foto 2) -->
          <div class="signature-column" style="width: 15%; display: flex; flex-direction: row; border-left: none; background: #fafafa; padding: 0;">
            
            <!-- Sub-coluna da Esquerda: Declaração e Data -->
            <div style="width: 50%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; border-right: 1px solid #475569; padding: 15px 2px;">
              <div class="sig-vertical-text" style="font-size: 7.5px; font-weight: 600; color: #475569; writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; height: 200px; display: flex; justify-content: center; align-items: center; margin: 0 auto;">
                DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO.
              </div>
              <div style="writing-mode: vertical-rl; transform: rotate(180deg); display: flex; flex-direction: row-reverse; align-items: center; justify-content: center; gap: 4px; font-size: 9px; color: #0f172a; margin: 10px auto 0 auto; height: 80px;">
                <span style="font-size: 6px; color: #64748b; font-weight: 600; text-transform: uppercase; white-space: nowrap;">DATA</span>
                <span style="font-family: monospace; letter-spacing: 1px;">____/____/______</span>
              </div>
            </div>

            <!-- Sub-coluna da Direita: Linha de Assinatura e Texto -->
            <div style="width: 50%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding: 15px 2px;">
              <div style="writing-mode: vertical-rl; transform: rotate(180deg); display: flex; flex-direction: row-reverse; align-items: center; justify-content: center; gap: 6px; margin: 0 auto; height: 300px; width: 100%;">
                <span style="font-size: 6px; font-weight: 600; color: #475569; text-transform: uppercase; white-space: nowrap;">ASSINATURA DO FUNCIONÁRIO</span>
                <div style="border-left: 1px solid #475569; height: 200px; min-height: 180px;"></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Pagamento - ${func.nome} (${folhaCompetencia})</title>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            background: #fff;
            color: #1e293b;
            padding: 20px;
            font-size: 10px;
            line-height: 1.2;
          }

          .holerite-via {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
            background: #fff;
            border-bottom: 2px dashed #94a3b8;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .holerite-via:last-child {
            border-bottom: none;
            padding-bottom: 0;
            margin-bottom: 0;
            margin-top: 30px;
          }

          .holerite-container {
            display: flex;
            border: 1px solid #475569;
            width: 100%;
            height: 400px;
          }

          .main-body {
            width: 85%;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #475569;
          }

          .row {
            display: flex;
            border-bottom: 1px solid #475569;
            width: 100%;
          }

          .col {
            padding: 6px 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .col strong {
            font-size: 7px;
            text-transform: uppercase;
            color: #475569;
            margin-bottom: 2px;
          }

          .col .val {
            font-size: 9px;
            color: #0f172a;
          }

          .font-bold {
            font-weight: 700;
          }

          .font-mono {
            font-family: monospace;
          }

           .header-row {
            min-height: 70px;
            height: auto;
          }

          .col-emp {
            width: 60%;
            border-right: 1px solid #475569;
          }

          .col-title {
            width: 40%;
            align-items: center;
            text-align: center;
            justify-content: center;
          }

          .col-title h2 {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
          }

          .ref-date {
            margin-top: 4px;
            font-size: 8px;
          }

          .info-row {
            min-height: 38px;
            height: auto;
          }

          .table-container {
            flex: 1;
            width: 100%;
            overflow: hidden;
            border-bottom: 1px solid #475569;
          }

          .holerite-table {
            width: 100%;
            border-collapse: collapse;
          }

          .holerite-table th {
            background: #f8fafc;
            border-bottom: 1px solid #475569;
            padding: 4px 6px;
            font-size: 7.5px;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            text-align: left;
          }

          .holerite-table td {
            padding: 3px 6px;
            font-size: 8.5px;
            border-bottom: 1px solid #f1f5f9;
          }

          .holerite-table tr.empty-row td {
            border-bottom: none;
          }

          .text-right {
            text-align: right !important;
          }

          .text-center {
            text-align: center !important;
          }

          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            .holerite-via {
              page-break-inside: avoid;
            }
            .no-print {
              display: none;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
          
          .btn-print-container {
            max-width: 850px;
            margin: 10px auto;
            display: flex;
            justify-content: flex-end;
          }

          .btn-print {
            background: #1e3a5f;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .btn-print:hover {
            background: #152943;
          }
        </style>
      </head>
      <body>
        <div class="btn-print-container no-print">
          <button class="btn-print" onclick="window.print()">
            Imprimir Holerite (2 Vias)
          </button>
        </div>
        ${gerarViaHTML("1ª VIA - EMPREGADOR")}
        ${gerarViaHTML("2ª VIA - COLABORADOR")}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      toast.error("Falha ao abrir janela de impressão. Certifique-se de habilitar pop-ups para este site.");
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="size-6 text-[#1e3a5f]" />
          Recursos Humanos
        </h1>
        <p className="text-sm text-muted-foreground">Gestão completa de colaboradores, ponto, férias, atestados e folha de pagamento.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: kpis.total, color: "bg-slate-50 border-slate-200", text: "text-slate-800", icon: Users },
          { label: "Ativos", value: kpis.ativos, color: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", icon: CheckCircle2 },
          { label: "Afastados", value: kpis.afastados, color: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: AlertTriangle },
          { label: "Em Férias", value: kpis.ferias, color: "bg-blue-50 border-blue-200", text: "text-blue-800", icon: Calendar },
          { label: "Demitidos", value: kpis.demitidos, color: "bg-red-50 border-red-200", text: "text-red-800", icon: X },
        ].map(kpi => (
          <Card key={kpi.label} className={`${kpi.color} border`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{kpi.label}</div>
                <div className={`text-2xl font-bold mt-0.5 ${kpi.text}`}>{kpi.value}</div>
              </div>
              <kpi.icon className={`size-6 opacity-60 ${kpi.text}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="ponto">Ponto</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="atestados">Atestados</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════ */}
        {/* ABA: FUNCIONÁRIOS */}
        {/* ═══════════════════════════════ */}
        <TabsContent value="funcionarios" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar funcionário..." value={searchFunc} onChange={e => setSearchFunc(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="ferias">Em Férias</SelectItem>
                  <SelectItem value="demitido">Demitido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {podeEscrever && (
              <Button onClick={() => setFuncModal("new")} className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                <Plus className="size-4" /> Novo Funcionário
              </Button>
            )}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo / Departamento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead className="text-right">Salário Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingFunc ? (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : filteredFuncionarios.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Users className="size-8 mx-auto mb-2 opacity-30" />
                    Nenhum funcionário encontrado
                  </TableCell></TableRow>
                ) : filteredFuncionarios.map(func => (
                  <TableRow key={func.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => setFuncModal(func)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs font-bold text-[#1e3a5f]">
                          {func.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{func.nome}</div>
                          <div className="text-xs text-muted-foreground">{func.cpf}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{func.cargo}</div>
                      {func.departamento && <div className="text-xs text-muted-foreground">{func.departamento}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{TIPO_CONTRATO_LABEL[func.tipo_contrato]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(func.data_admissao)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtBRL(func.salario_base)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_FUNC_BADGE[func.status]}>{STATUS_FUNC_LABEL[func.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {podeEscrever && (
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive" onClick={e => { e.stopPropagation(); setDeleteFunc(func); }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════ */}
        {/* ABA: PONTO */}
        {/* ═══════════════════════════════ */}
        <TabsContent value="ponto" className="space-y-4">
          {solicitacoesAjuste.filter(s => s.status === "pendente").length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileClock className="size-4 text-amber-700" />
                  Ajustes aguardando análise
                  <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">
                    {solicitacoesAjuste.filter(s => s.status === "pendente").length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {solicitacoesAjuste.filter(s => s.status === "pendente").slice(0, 6).map(solicitacao => {
                  const func = funcionarios?.find(f => f.id === solicitacao.funcionario_id);
                  return (
                    <div key={solicitacao.id} className="flex flex-col gap-3 rounded-lg border bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{func?.nome ?? "Funcionário"}</span>
                          <Badge variant="outline">{fmtDate(solicitacao.data)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{solicitacao.motivo}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {fmtTime(solicitacao.hora_entrada)} · {fmtTime(solicitacao.hora_saida_almoco)} · {fmtTime(solicitacao.hora_retorno_almoco)} · {fmtTime(solicitacao.hora_saida)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={revisarAjusteMutation.isPending}
                          onClick={() => revisarAjusteMutation.mutate({ id: solicitacao.id, status: "rejeitado" })}>
                          <X className="mr-1.5 size-4" /> Rejeitar
                        </Button>
                        <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={revisarAjusteMutation.isPending}
                          onClick={() => revisarAjusteMutation.mutate({ id: solicitacao.id, status: "aprovado" })}>
                          <CheckCircle2 className="mr-1.5 size-4" /> Aprovar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <TooltipProvider>
            <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <Select value={pontoFuncId} onValueChange={setPontoFuncId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione o funcionário..." /></SelectTrigger>
                <SelectContent>
                  {(funcionarios ?? []).filter(f => f.status !== "demitido").map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="size-9" onClick={() => {
                  const d = parseISO(pontoMes + "-01");
                  d.setMonth(d.getMonth() - 1);
                  setPontoMes(format(d, "yyyy-MM"));
                }}><ChevronLeft className="size-4" /></Button>
                <div className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">
                  {format(parseISO(pontoMes + "-01"), "MMMM yyyy", { locale: ptBR })}
                </div>
                <Button size="icon" variant="outline" className="size-9" onClick={() => {
                  const d = parseISO(pontoMes + "-01");
                  d.setMonth(d.getMonth() + 1);
                  setPontoMes(format(d, "yyyy-MM"));
                }}><ChevronRight className="size-4" /></Button>
              </div>
            </div>
            {pontoFuncId && (
              <Button onClick={exportarFolhaPonto} variant="outline" className="gap-2">
                <Download className="size-4" /> Exportar Ponto
              </Button>
            )}
          </div>

          {pontoFuncId ? (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Dias Trabalhados", value: pontoSummary.trabalhados, color: "text-emerald-700" },
                  { label: "Faltas", value: pontoSummary.faltas, color: "text-red-600" },
                  { label: "Total de Horas", value: `${pontoSummary.totalH}h`, color: "text-[#1e3a5f]" },
                  { label: "Horas Extras", value: `${pontoSummary.extras}h`, color: "text-amber-700" },
                ].map(s => (
                  <Card key={s.label} className="border">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase text-muted-foreground font-semibold">{s.label}</div>
                      <div className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída Alm.</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pontoRows.map(({ dia, dataStr, reg, weekend, feriadoNome }) => {
                      const funcObj = funcionarios?.find(f => f.id === pontoFuncId) ?? null;
                      return (
                        <TableRow key={dataStr} className={cn("group", weekend && "bg-slate-50/50", feriadoNome && "bg-purple-50/25", !reg && !weekend && !feriadoNome && "text-muted-foreground/50")}>
                          <TableCell className="font-mono text-xs">
                            {feriadoNome ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="underline decoration-dotted cursor-help text-purple-700 font-semibold">
                                    {fmtDate(dataStr)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{feriadoNome}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              fmtDate(dataStr)
                            )}
                          </TableCell>
                          <TableCell className="text-xs capitalize">{format(dia, "EEEE", { locale: ptBR })}</TableCell>
                          <TableCell>
                            {reg ? (
                              <Badge className={`text-xs ${TIPO_DIA_BADGE[reg.tipo_dia]}`}>{TIPO_DIA_LABEL[reg.tipo_dia]}</Badge>
                            ) : feriadoNome ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-help border border-purple-200">
                                    Feriado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{feriadoNome}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : weekend ? (
                              <span className="text-xs text-muted-foreground">Fim de Semana</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{reg ? fmtTime(reg.hora_entrada) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{reg ? fmtTime(reg.hora_saida_almoco) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{reg ? fmtTime(reg.hora_retorno_almoco) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{reg ? fmtTime(reg.hora_saida) : "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {(() => {
                              if (!reg) return "—";
                              const h = reg.horas_trabalhadas ?? calcularHorasTrabalhadas(reg.hora_entrada, reg.hora_saida_almoco, reg.hora_retorno_almoco, reg.hora_saida);
                              return h > 0 ? `${h.toFixed(1)}h` : "—";
                            })()}
                          </TableCell>
                          <TableCell>
                            {podeEscrever && funcObj && (
                              <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100"
                                onClick={() => setPontoModal({ func: funcObj, registro: reg, defaultDate: dataStr })}>
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="size-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Selecione um funcionário para ver a folha de ponto</p>
            </div>
          )}
          </TooltipProvider>
        </TabsContent>

        {/* ═══════════════════════════════ */}
        {/* ABA: FÉRIAS */}
        {/* ═══════════════════════════════ */}
        <TabsContent value="ferias" className="space-y-4">
          {feriasVencidas > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
              <AlertTriangle className="size-5 shrink-0" />
              <span className="text-sm font-medium">
                {feriasVencidas} funcionário{feriasVencidas > 1 ? "s" : ""} com período de férias vencido! Programe com urgência.
              </span>
            </div>
          )}

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Próx. Vencimento</TableHead>
                  <TableHead className="text-right">Dias Direito</TableHead>
                  <TableHead className="text-right">Dias Gozados</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {feriasData.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Calendar className="size-8 mx-auto mb-2 opacity-30" />Nenhum funcionário ativo
                  </TableCell></TableRow>
                ) : feriasData.map(({ func, diasDireito, diasGozados, saldo, proximoVencimento, diasParaVencer, vencida }) => (
                  <TableRow key={func.id} className={vencida ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium">{func.nome}</TableCell>
                    <TableCell className="text-sm">{fmtDate(func.data_admissao)}</TableCell>
                    <TableCell className="text-sm">
                      <div className={vencida ? "text-red-600 font-semibold" : ""}>
                        {fmtDate(format(proximoVencimento, "yyyy-MM-dd"))}
                      </div>
                      {vencida ? (
                        <div className="text-xs text-red-500">{Math.abs(diasParaVencer)}d vencida</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">em {diasParaVencer}d</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{diasDireito}</TableCell>
                    <TableCell className="text-right font-mono">{diasGozados}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{saldo}</TableCell>
                    <TableCell>
                      <Badge className={vencida ? "bg-red-100 text-red-800" : saldo === 0 ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800"}>
                        {vencida ? "VENCIDA" : saldo === 0 ? "Sem Saldo" : "Regular"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {podeEscrever && (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setFeriasModal({ func, ferias: null })}>
                          <Plus className="size-3" /> Programar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════ */}
        {/* ABA: ATESTADOS & AFASTAMENTOS */}
        {/* ═══════════════════════════════ */}
        <TabsContent value="atestados" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Select value={atestadoFuncId} onValueChange={setAtestadoFuncId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos os funcionários" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {(funcionarios ?? []).map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {podeEscrever && (
              <Button className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white" onClick={() => {
                const func = atestadoFuncId !== "all" ? funcionarios?.find(f => f.id === atestadoFuncId) : null;
                if (func) setAfastamentoModal({ func, afastamento: null });
                else toast.info("Selecione um funcionário primeiro");
              }}>
                <Plus className="size-4" /> Registrar Afastamento
              </Button>
            )}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>CID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(afastamentos?.filter(a => atestadoFuncId === "all" || a.funcionario_id === atestadoFuncId) ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Heart className="size-8 mx-auto mb-2 opacity-30" />Nenhum afastamento registrado
                  </TableCell></TableRow>
                ) : (afastamentos?.filter(a => atestadoFuncId === "all" || a.funcionario_id === atestadoFuncId) ?? []).map(a => {
                  const func = funcionarios?.find(f => f.id === a.funcionario_id);
                  return (
                    <TableRow key={a.id} className="group hover:bg-muted/30">
                      <TableCell className="font-medium">{func?.nome ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{TIPO_AFASTAMENTO_LABEL[a.tipo]}</Badge></TableCell>
                      <TableCell className="text-sm">{fmtDate(a.data_inicio)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(a.data_fim)}</TableCell>
                      <TableCell className="text-right font-mono">{a.dias ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{a.cid ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={a.status === "aprovado" ? "bg-emerald-100 text-emerald-800" : a.status === "reprovado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                          {a.status === "aprovado" ? "Aprovado" : a.status === "reprovado" ? "Reprovado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100">
                          {a.arquivo_url && (
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openR2File(a.arquivo_url)}>
                              <Eye className="size-3.5" />
                            </Button>
                          )}
                          {podeEscrever && func && (
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setAfastamentoModal({ func, afastamento: a })}>
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════ */}
        {/* ABA: FOLHA DE PAGAMENTO */}
        {/* ═══════════════════════════════ */}
        <TabsContent value="folha" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <Select value={folhaFuncId} onValueChange={setFolhaFuncId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione o funcionário..." /></SelectTrigger>
                <SelectContent>
                  {(funcionarios ?? []).filter(f => f.status !== "demitido").map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="size-9" onClick={() => {
                  const d = parseISO(folhaCompetencia + "-01");
                  d.setMonth(d.getMonth() - 1);
                  setFolhaCompetencia(format(d, "yyyy-MM"));
                }}><ChevronLeft className="size-4" /></Button>
                <div className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">
                  {format(parseISO(folhaCompetencia + "-01"), "MMMM yyyy", { locale: ptBR })}
                </div>
                <Button size="icon" variant="outline" className="size-9" onClick={() => {
                  const d = parseISO(folhaCompetencia + "-01");
                  d.setMonth(d.getMonth() + 1);
                  setFolhaCompetencia(format(d, "yyyy-MM"));
                }}><ChevronRight className="size-4" /></Button>
              </div>
            </div>
            <div className="flex gap-2">
              {resumoFolha && (
                <Button onClick={exportarHolerite} variant="outline" className="gap-2">
                  <Download className="size-4" /> Exportar Holerite
                </Button>
              )}
              {podeEscrever && folhaFuncId && (
                <Button className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white" onClick={() => {
                  const func = funcionarios?.find(f => f.id === folhaFuncId);
                  if (func) setEventoModal({ func, evento: null });
                }}>
                  <Plus className="size-4" /> Adicionar Evento
                </Button>
              )}
            </div>
          </div>

          {resumoFolha ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Holerite */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="size-4" />
                      {resumoFolha.func.nome}
                      <span className="text-muted-foreground font-normal text-sm">— {resumoFolha.func.cargo}</span>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Competência: {format(parseISO(folhaCompetencia + "-01"), "MMMM yyyy", { locale: ptBR })} •
                      Admissão: {fmtDate(resumoFolha.func.data_admissao)} •
                      {TIPO_CONTRATO_LABEL[resumoFolha.func.tipo_contrato]}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Proventos */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-700 font-bold mb-2">Proventos</div>
                      <div className="space-y-1">
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <span>Salário Base</span>
                          <span className="font-mono font-semibold text-emerald-700">{fmtBRL(resumoFolha.func.salario_base)}</span>
                        </div>
                        {resumoFolha.proventos.map(e => (
                          <div key={e.id} className="flex justify-between items-center py-1 text-sm group">
                            <div className="flex items-center gap-2">
                              <span>{TIPO_EVENTO_LABEL[e.tipo]}{e.descricao ? ` — ${e.descricao}` : ""}</span>
                              <span className="text-xs text-muted-foreground">({e.quantidade}x {fmtBRL(e.valor_unitario)})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-emerald-700">{fmtBRL(e.valor_total)}</span>
                              {podeEscrever && (
                                <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEventoMutation.mutate(e.id)}>
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 font-semibold border-t">
                          <span className="text-sm">Total Bruto</span>
                          <span className="font-mono">{(resumoFolha.totalBruto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Descontos */}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-red-700 font-bold mb-2">Descontos</div>
                      <div className="space-y-1">
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <div>
                            <span>INSS</span>
                            <span className="text-xs text-muted-foreground ml-2">(Tabela Progressiva 2024)</span>
                          </div>
                          <span className="font-mono font-semibold text-red-600">- {resumoFolha.inss.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <div>
                            <span>IRRF</span>
                            <span className="text-xs text-muted-foreground ml-2">(Base: {(resumoFolha.totalBruto - resumoFolha.inss).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
                          </div>
                          <span className="font-mono font-semibold text-red-600">- {resumoFolha.irrf.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        {resumoFolha.descontos.map(e => (
                          <div key={e.id} className="flex justify-between items-center py-1 text-sm group">
                            <span>{TIPO_EVENTO_LABEL[e.tipo]}{e.descricao ? ` — ${e.descricao}` : ""}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-red-600">- {fmtBRL(e.valor_total)}</span>
                              {podeEscrever && (
                                <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEventoMutation.mutate(e.id)}>
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 font-semibold border-t text-red-700">
                          <span className="text-sm">Total Descontos</span>
                          <span className="font-mono">- {resumoFolha.totalDescontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />
                    <div className="flex justify-between items-center py-2">
                      <span className="text-lg font-bold">Salário Líquido</span>
                      <span className="text-xl font-bold text-[#1e3a5f] font-mono">{resumoFolha.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Info Cards */}
              <div className="space-y-3">
                <Card className="bg-[#1e3a5f]/5 border-[#1e3a5f]/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground uppercase font-semibold mb-3">Alíquotas Aplicadas</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Alíquota INSS</span>
                        <span className="font-mono">{resumoFolha.totalBruto > 0 ? ((resumoFolha.inss / resumoFolha.totalBruto) * 100).toFixed(1) : "0"}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Alíquota IRRF</span>
                        <span className="font-mono">{resumoFolha.totalBruto > 0 ? ((resumoFolha.irrf / resumoFolha.totalBruto) * 100).toFixed(1) : "0"}%</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Carga Total</span>
                        <span className="font-mono">{resumoFolha.totalBruto > 0 ? ((resumoFolha.totalDescontos / resumoFolha.totalBruto) * 100).toFixed(1) : "0"}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <div className="text-xs text-amber-800 font-semibold uppercase mb-1">Tabela INSS 2024</div>
                    <div className="text-xs text-amber-700 space-y-0.5">
                      <div>Até R$ 1.412: 7,5%</div>
                      <div>Até R$ 2.666: 9%</div>
                      <div>Até R$ 4.000: 12%</div>
                      <div>Até R$ 7.786: 14%</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-700 font-semibold uppercase mb-1">Tabela IRRF 2024</div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>Até R$ 2.112: Isento</div>
                      <div>Até R$ 2.826: 7,5%</div>
                      <div>Até R$ 3.751: 15%</div>
                      <div>Até R$ 4.664: 22,5%</div>
                      <div>Acima: 27,5%</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Banknote className="size-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Selecione um funcionário e competência para ver a folha</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════ */}
      {/* DIALOGS */}
      {/* ═══════════════════════════════════════ */}

      {/* FUNCIONÁRIO CRUD */}
      {funcModal && (
        <FuncionarioDialog
          open={!!funcModal}
          onOpenChange={o => !o && setFuncModal(null)}
          target={funcModal === "new" ? null : funcModal}
          obras={obras ?? []}
          onSubmit={(values) => funcMutation.mutate({ values, target: funcModal === "new" ? null : funcModal })}
          submitting={funcMutation.isPending}
        />
      )}

      {/* DELETE FUNCIONÁRIO */}
      <AlertDialog open={!!deleteFunc} onOpenChange={o => !o && setDeleteFunc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>{deleteFunc?.nome}</strong> excluirá também todos os registros de ponto, férias e documentos vinculados. Considere usar o status "Demitido" para manter o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteFunc && deleteFuncMutation.mutate(deleteFunc.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PONTO DIALOG */}
      {pontoModal && (
        <PontoDialog
          open={!!pontoModal}
          onOpenChange={o => !o && setPontoModal(null)}
          func={pontoModal.func}
          registro={pontoModal.registro}
          defaultDate={pontoModal.defaultDate}
          onSubmit={(values) => pontoMutation.mutate({ values, funcId: pontoModal.func.id, existingId: pontoModal.registro?.id ?? null })}
          submitting={pontoMutation.isPending}
        />
      )}

      {/* FÉRIAS DIALOG */}
      {feriasModal && (
        <FeriasDialog
          open={!!feriasModal}
          onOpenChange={o => !o && setFeriasModal(null)}
          func={feriasModal.func}
          ferias={feriasModal.ferias}
          onSubmit={(values) => feriasMutation.mutate({ values, funcId: feriasModal.func.id, existingId: feriasModal.ferias?.id ?? null })}
          submitting={feriasMutation.isPending}
        />
      )}

      {/* AFASTAMENTO DIALOG */}
      {afastamentoModal && (
        <AfastamentoDialog
          open={!!afastamentoModal}
          onOpenChange={o => !o && setAfastamentoModal(null)}
          func={afastamentoModal.func}
          afastamento={afastamentoModal.afastamento}
          onSubmit={(values, file) => afastamentoMutation.mutate({ values, funcId: afastamentoModal.func.id, file, existingId: afastamentoModal.afastamento?.id ?? null })}
          submitting={afastamentoMutation.isPending}
        />
      )}

      {/* EVENTO FOLHA DIALOG */}
      {eventoModal && (
        <EventoFolhaDialog
          open={!!eventoModal}
          onOpenChange={o => !o && setEventoModal(null)}
          func={eventoModal.func}
          competencia={folhaCompetencia}
          onSubmit={(values) => eventoMutation.mutate({ values, funcId: eventoModal.func.id, existingId: eventoModal.evento?.id ?? null })}
          submitting={eventoMutation.isPending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DIALOG: FUNCIONÁRIO (CRUD)
// ─────────────────────────────────────────────
function FuncionarioDialog({ open, onOpenChange, target, obras, onSubmit, submitting }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: FuncionarioRow | null;
  obras: { id: string; numero: string; nome: string }[];
  onSubmit: (values: FuncionarioForm) => void;
  submitting: boolean;
}) {
  const [section, setSection] = useState("pessoal");
  const form = useForm<FuncionarioForm>({
    resolver: zodResolver(funcionarioSchema) as any,
    defaultValues: {
      nome: "", cpf: "", rg: "", data_nascimento: "", sexo: "", estado_civil: "",
      email: "", telefone: "", celular: "",
      cep: "", logradouro: "", numero_end: "", complemento: "", bairro: "", cidade: "", uf: "",
      matricula: "", cargo: "", departamento: "", obra_id: "", data_admissao: "",
      data_demissao: "", motivo_demissao: "", tipo_contrato: "clt",
      carga_horaria_semanal: 44, salario_base: 0, status: "ativo",
      banco: "", agencia: "", conta: "", tipo_conta: "", pix: "",
      pis: "", ctps_numero: "", ctps_serie: "", observacoes: "",
    },
  });

  useEffect(() => {
    if (open) {
      setSection("pessoal");
      if (target) {
        form.reset({
          nome: target.nome, cpf: target.cpf, rg: target.rg ?? "",
          data_nascimento: target.data_nascimento ?? "", sexo: target.sexo ?? "",
          estado_civil: target.estado_civil ?? "", email: target.email ?? "",
          telefone: target.telefone ?? "", celular: target.celular ?? "",
          cep: target.cep ?? "", logradouro: target.logradouro ?? "",
          numero_end: target.numero_end ?? "", complemento: target.complemento ?? "",
          bairro: target.bairro ?? "", cidade: target.cidade ?? "", uf: target.uf ?? "",
          matricula: target.matricula ?? "", cargo: target.cargo,
          departamento: target.departamento ?? "", obra_id: target.obra_id ?? "",
          data_admissao: target.data_admissao, data_demissao: target.data_demissao ?? "",
          motivo_demissao: target.motivo_demissao ?? "",
          tipo_contrato: target.tipo_contrato as any,
          carga_horaria_semanal: target.carga_horaria_semanal,
          salario_base: target.salario_base / 100,
          status: target.status,
          banco: target.banco ?? "", agencia: target.agencia ?? "",
          conta: target.conta ?? "", tipo_conta: target.tipo_conta ?? "",
          pix: target.pix ?? "", pis: target.pis ?? "",
          ctps_numero: target.ctps_numero ?? "", ctps_serie: target.ctps_serie ?? "",
          observacoes: target.observacoes ?? "",
        });
      } else {
        form.reset();
      }
    }
  }, [open, target, form]);

  const sections = [
    { id: "pessoal", label: "Pessoal", icon: User },
    { id: "contato", label: "Contato", icon: Phone },
    { id: "contrato", label: "Contrato", icon: Briefcase },
    { id: "bancario", label: "Bancário", icon: CreditCard },
    { id: "documentos", label: "Documentos", icon: FileText },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          <DialogDescription>Preencha os dados do colaborador. Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>

        {/* Section tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors", section === s.id ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>
              <s.icon className="size-3.5" />{s.label}
            </button>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={(form.handleSubmit as any)(onSubmit)} className="space-y-4">
            {/* ── Pessoal ── */}
            {section === "pessoal" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="nome" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="cpf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="rg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="data_nascimento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="sexo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="estado_civil" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado Civil</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="uniao_estavel">União Estável</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="observacoes" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* ── Contato / Endereço ── */}
            {section === "contato" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="celular" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl><Input placeholder="(00) 90000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(00) 0000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="logradouro" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="numero_end" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="complemento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="bairro" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="cidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="uf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                      <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* ── Contrato ── */}
            {section === "contrato" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="matricula" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="cargo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="departamento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="obra_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Obra / Lotação</FormLabel>
                    <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem vínculo</SelectItem>
                        {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.numero} — {o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="tipo_contrato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Contrato *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(TIPO_CONTRATO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_FUNC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="data_admissao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Admissão *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="carga_horaria_semanal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carga Horária Semanal</FormLabel>
                    <FormControl><Input type="number" min={1} max={48} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="salario_base" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário Base (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        value={formatBRLInput(field.value)}
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const cleanDigits = rawVal.replace(/\D/g, "");
                          if (!cleanDigits) {
                            field.onChange(0);
                            return;
                          }
                          const val = parseInt(cleanDigits, 10) / 100;
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="data_demissao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Demissão</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="motivo_demissao" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Motivo da Demissão</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* ── Bancário ── */}
            {section === "bancario" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="banco" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl><Input placeholder="Ex: Caixa Econômica Federal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="tipo_conta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupança</SelectItem>
                        <SelectItem value="salario">Conta Salário</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="agencia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agência</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="conta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta (com dígito)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="pix" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl><Input placeholder="CPF, e-mail, celular ou chave aleatória" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* ── Documentos ── */}
            {section === "documentos" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="pis" render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIS / PASEP</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="ctps_numero" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CTPS Número</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="ctps_serie" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CTPS Série</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {submitting ? <><Loader2 className="size-4 animate-spin mr-2" />Salvando...</> : "Salvar Funcionário"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// DIALOG: PONTO
// ─────────────────────────────────────────────
function PontoDialog({ open, onOpenChange, func, registro, defaultDate, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  func: FuncionarioRow; registro: RegistroPontoRow | null;
  defaultDate?: string;
  onSubmit: (v: PontoForm) => void; submitting: boolean;
}) {
  const form = useForm<PontoForm>({ resolver: zodResolver(pontoSchema), defaultValues: {
    data: registro?.data ?? defaultDate ?? format(new Date(), "yyyy-MM-dd"),
    hora_entrada: "", hora_saida_almoco: "", hora_retorno_almoco: "", hora_saida: "",
    tipo_dia: "normal", observacoes: "",
  }});

  useEffect(() => {
    if (open) {
      const dateToUse = registro?.data ?? defaultDate ?? format(new Date(), "yyyy-MM-dd");
      const parsedDate = parseISO(dateToUse);
      const isWk = isWeekend(parsedDate);
      const isHol = getFeriadosNacionais(parsedDate.getFullYear())[dateToUse] !== undefined;
      const defaultTipo = isHol ? "feriado" : isWk ? "folga" : "normal";

      form.reset({
        data: dateToUse,
        hora_entrada: registro?.hora_entrada?.slice(0, 5) ?? "",
        hora_saida_almoco: registro?.hora_saida_almoco?.slice(0, 5) ?? "",
        hora_retorno_almoco: registro?.hora_retorno_almoco?.slice(0, 5) ?? "",
        hora_saida: registro?.hora_saida?.slice(0, 5) ?? "",
        tipo_dia: (registro?.tipo_dia as any) ?? defaultTipo,
        observacoes: registro?.observacoes ?? "",
      });
    }
  }, [open, registro, defaultDate, form]);

  const tipoDia = form.watch("tipo_dia");
  const showHours = ["normal","meio_periodo"].includes(tipoDia);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar Ponto</DialogTitle>
          <DialogDescription>{func.nome} — {func.cargo}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control as any} name="data" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="tipo_dia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo do Dia *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(TIPO_DIA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {showHours && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="hora_entrada" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entrada</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="hora_saida_almoco" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saída Almoço</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="hora_retorno_almoco" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retorno Almoço</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control as any} name="hora_saida" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saída</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}
            <FormField control={form.control as any} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Salvar Ponto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// DIALOG: FÉRIAS
// ─────────────────────────────────────────────
function FeriasDialog({ open, onOpenChange, func, ferias, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  func: FuncionarioRow; ferias: FeriasRow | null;
  onSubmit: (v: FeriasForm) => void; submitting: boolean;
}) {
  const form = useForm<FeriasForm>({ resolver: zodResolver(feriasSchema) as any, defaultValues: {
    periodo_aquisitivo_inicio: func.data_admissao,
    periodo_aquisitivo_fim: format(addYears(parseISO(func.data_admissao), 1), "yyyy-MM-dd"),
    dias_direito: 30, data_inicio_gozo: "", data_fim_gozo: "",
    data_retorno: "", abono_pecuniario: 0, status: "aquisitivo", observacoes: "",
  }});

  useEffect(() => {
    if (open) {
      if (ferias) {
        form.reset({
          periodo_aquisitivo_inicio: ferias.periodo_aquisitivo_inicio,
          periodo_aquisitivo_fim: ferias.periodo_aquisitivo_fim,
          dias_direito: ferias.dias_direito,
          data_inicio_gozo: ferias.data_inicio_gozo ?? "",
          data_fim_gozo: ferias.data_fim_gozo ?? "",
          data_retorno: ferias.data_retorno ?? "",
          abono_pecuniario: ferias.abono_pecuniario,
          status: ferias.status as any,
          observacoes: ferias.observacoes ?? "",
        });
      } else {
        form.reset();
      }
    }
  }, [open, ferias, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar Férias</DialogTitle>
          <DialogDescription>{func.nome} — admitido em {fmtDate(func.data_admissao)}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(form.handleSubmit as any)(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control as any} name="periodo_aquisitivo_inicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Período Aquisitivo Início *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="periodo_aquisitivo_fim" render={({ field }) => (
                <FormItem>
                  <FormLabel>Período Aquisitivo Fim *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="dias_direito" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dias de Direito</FormLabel>
                  <FormControl><Input type="number" min={1} max={30} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="abono_pecuniario" render={({ field }) => (
                <FormItem>
                  <FormLabel>Abono Pecuniário (dias)</FormLabel>
                  <FormControl><Input type="number" min={0} max={10} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_inicio_gozo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Início do Gozo</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_fim_gozo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim do Gozo</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_retorno" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Retorno</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="aquisitivo">Em Aquisição</SelectItem>
                      <SelectItem value="programado">Programado</SelectItem>
                      <SelectItem value="gozando">Em Gozo</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control as any} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Salvar Férias"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// DIALOG: AFASTAMENTO
// ─────────────────────────────────────────────
function AfastamentoDialog({ open, onOpenChange, func, afastamento, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  func: FuncionarioRow; afastamento: AfastamentoRow | null;
  onSubmit: (v: AfastamentoForm, file: File | null) => void; submitting: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<AfastamentoForm>({ resolver: zodResolver(afastamentoSchema), defaultValues: {
    tipo: "atestado_medico", data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: "", cid: "", medico: "", crm: "", observacoes: "", status: "pendente",
  }});

  useEffect(() => {
    if (open) {
      setFile(null);
      if (afastamento) {
        form.reset({
          tipo: afastamento.tipo as any, data_inicio: afastamento.data_inicio,
          data_fim: afastamento.data_fim ?? "", cid: afastamento.cid ?? "",
          medico: afastamento.medico ?? "", crm: afastamento.crm ?? "",
          observacoes: afastamento.observacoes ?? "", status: afastamento.status as any,
        });
      } else form.reset();
    }
  }, [open, afastamento, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Afastamento</DialogTitle>
          <DialogDescription>{func.nome}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => onSubmit(v, file))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control as any} name="tipo" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo de Afastamento *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(TIPO_AFASTAMENTO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_inicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Início *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_fim" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Fim</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="cid" render={({ field }) => (
                <FormItem>
                  <FormLabel>CID-10</FormLabel>
                  <FormControl><Input placeholder="Ex: J11" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="medico" render={({ field }) => (
                <FormItem>
                  <FormLabel>Médico / Responsável</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="crm" render={({ field }) => (
                <FormItem>
                  <FormLabel>CRM</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control as any} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />
            {/* File upload */}
            <div>
              <div className="text-sm font-medium mb-1.5">Documento (PDF / Imagem)</div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> {file ? "Trocar arquivo" : "Anexar atestado"}
                </Button>
                {file && <span className="text-sm text-muted-foreground truncate max-w-[200px]">{file.name}</span>}
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {afastamento?.arquivo_url && !file && (
                <div className="text-xs text-muted-foreground mt-1">Arquivo já anexado — novo upload substituirá o anterior</div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Salvar Afastamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// DIALOG: EVENTO FOLHA
// ─────────────────────────────────────────────
function EventoFolhaDialog({ open, onOpenChange, func, competencia, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  func: FuncionarioRow; competencia: string;
  onSubmit: (v: EventoFolhaForm) => void; submitting: boolean;
}) {
  const form = useForm<EventoFolhaForm>({ resolver: zodResolver(eventoFolhaSchema), defaultValues: {
    tipo: "hora_extra_50", descricao: "", quantidade: 1, valor_unitario: 0, natureza: "provento",
  }});

  const tipoWatch = form.watch("tipo");
  useEffect(() => {
    const descMap: Record<string, "provento" | "desconto"> = {
      hora_extra_50: "provento", hora_extra_100: "provento", adicional_noturno: "provento",
      adicional_insalubridade: "provento", adicional_periculosidade: "provento",
      vale_transporte: "desconto", vale_refeicao: "provento",
      desconto_falta: "desconto", desconto_atraso: "desconto",
      adiantamento: "desconto", outros_proventos: "provento", outros_descontos: "desconto",
    };
    form.setValue("natureza", descMap[tipoWatch] ?? "provento");
  }, [tipoWatch, form]);

  useEffect(() => { if (open) form.reset(); }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Evento à Folha</DialogTitle>
          <DialogDescription>
            {func.nome} — Competência: {format(parseISO(competencia + "-01"), "MMMM yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control as any} name="tipo" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Evento *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="hora_extra_50">Hora Extra 50%</SelectItem>
                    <SelectItem value="hora_extra_100">Hora Extra 100%</SelectItem>
                    <SelectItem value="adicional_noturno">Adicional Noturno</SelectItem>
                    <SelectItem value="adicional_insalubridade">Insalubridade</SelectItem>
                    <SelectItem value="adicional_periculosidade">Periculosidade</SelectItem>
                    <SelectItem value="vale_transporte">Vale Transporte</SelectItem>
                    <SelectItem value="vale_refeicao">Vale Refeição</SelectItem>
                    <SelectItem value="desconto_falta">Desconto por Falta</SelectItem>
                    <SelectItem value="desconto_atraso">Desconto por Atraso</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento</SelectItem>
                    <SelectItem value="outros_proventos">Outros Proventos</SelectItem>
                    <SelectItem value="outros_descontos">Outros Descontos</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control as any} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control as any} name="quantidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="valor_unitario" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Unitário (R$) *</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      value={formatBRLInput(field.value)}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        const cleanDigits = rawVal.replace(/\D/g, "");
                        if (!cleanDigits) {
                          field.onChange(0);
                          return;
                        }
                        const val = parseInt(cleanDigits, 10) / 100;
                        field.onChange(val);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control as any} name="natureza" render={({ field }) => (
              <FormItem>
                <FormLabel>Natureza</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="provento">Provento (aumenta salário)</SelectItem>
                    <SelectItem value="desconto">Desconto (reduz salário)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              Total: <span className="font-bold font-mono">
                {((form.watch("quantidade") || 0) * (form.watch("valor_unitario") || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "Adicionar Evento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
