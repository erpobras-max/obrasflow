import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  MessageCircle,
  HardHat,
  Filter,
  Check,
  RotateCcw,
  Bell,
  MailCheck,
  Mail,
  Smartphone,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  solicitarPermissaoEInscreverPush,
  obterInscricaoPushAtual,
  obterStatusPermissao,
} from "@/lib/push-notifications";
import {
  ordemServicoSchema,
  type OrdemServicoFormValues,
  type OrdemServicoRow,
  type StatusOS,
  type PrioridadeOS,
  PRIORIDADES_OS,
  STATUS_OS,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  calcularStatusPrazo,
  gerarLinkWhatsApp,
} from "@/lib/ordens-servico.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/ui/responsive-table";

export const Route = createFileRoute("/_app/ordens-servico")({
  validateSearch: (search: Record<string, unknown>) => ({
    busca: typeof search.busca === "string" ? search.busca : undefined,
    obraId: typeof search.obraId === "string" ? search.obraId : undefined,
    tab: typeof search.tab === "string" ? search.tab : "todas",
  }),
  component: OrdensServicoPage,
});

const DEFAULT_FORM_VALUES: OrdemServicoFormValues = {
  titulo: "",
  descricao: "",
  obra_id: "",
  cliente_id: "",
  responsavel_id: "",
  responsavel_nome: "",
  responsavel_telefone: "",
  email_notificacao: "",
  horario_lembrete: "08:00",
  data_previsao: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  prioridade: "media",
  status: "aberta",
  observacoes: "",
};

function OrdensServicoPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<OrdemServicoRow | null>(null);
  const [deletingOS, setDeletingOS] = useState<OrdemServicoRow | null>(null);

  const activeTab = searchParams.tab || "todas";
  const [busca, setBusca] = useState(searchParams.busca || "");
  const [filtroObra, setFiltroObra] = useState<string>(searchParams.obraId || "todas");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("todas");

  const [isProcessandoCron, setIsProcessandoCron] = useState(false);
  const [isInscrevendoPush, setIsInscrevendoPush] = useState(false);

  // Ativar Push Notifications no Aparelho
  const handleAtivarPush = async () => {
    setIsInscrevendoPush(true);
    try {
      const res = await solicitarPermissaoEInscreverPush(session?.user?.id);
      if (res.sucesso) {
        toast.success(res.mensagem);
      } else {
        toast.error(res.mensagem);
      }
    } finally {
      setIsInscrevendoPush(false);
    }
  };

  // Testar Notificação no Celular
  const handleTestarPush = async () => {
    try {
      if (!session?.user.id) throw new Error("Entre no sistema antes de testar.");
      const subscriptionId = await obterInscricaoPushAtual(session.user.id);
      const res = await fetch(`/api/cron-prazos?teste_push=1&subscription_id=${encodeURIComponent(subscriptionId)}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = (await res.json()) as { sucesso: boolean; pushDisparado: boolean; pushResult?: { erro?: string }; erro?: string };
      if (!res.ok || !data.sucesso || !data.pushDisparado) {
        throw new Error(data.pushResult?.erro || data.erro || "O OneSignal recusou o teste deste aparelho.");
      }
      toast.info("Teste aceito pelo OneSignal para este aparelho. Confira a central de notificações; o recebimento ainda não foi confirmado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar push neste aparelho.");
    }
  };

  // Disparar Verificação de Prazos & E-mails
  const handleVerificarPrazosEEmail = async () => {
    setIsProcessandoCron(true);
    try {
      const res = await fetch("/api/cron-prazos", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = (await res.json()) as {
        sucesso: boolean;
        alertasProcessados?: number;
        emailsDisparados?: number;
        smsDisparados?: number;
        pushDisparados?: number;
        sinosNotificados?: number;
        erro?: string;
      };

      if (!res.ok || !data.sucesso) {
        toast.error(`Erro ao processar prazos: ${data.erro || "Falha na requisição"}`);
        return;
      }

      toast.success(
        `Prazos verificados: ${data.emailsDisparados || 0} e-mail(s), ${data.smsDisparados || 0} SMS e ${data.pushDisparados || 0} push enviado(s).`
      );
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha ao executar rotina: ${msg}`);
    } finally {
      setIsProcessandoCron(false);
    }
  };

  // Buscar Obras para o seletor
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-options-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: !!session,
  });

  // Buscar Ordens de Serviço
  const {
    data: ordensServico = [],
    isLoading,
  } = useQuery({
    queryKey: ["ordens_servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          obra_id,
          cliente_id,
          titulo,
          descricao,
          responsavel_id,
          responsavel_nome,
          responsavel_telefone,
          email_notificacao,
          horario_lembrete,
          data_abertura,
          data_previsao,
          data_conclusao,
          prioridade,
          status,
          observacoes,
          created_at,
          updated_at,
          obras ( id, nome )
        `)
        .order("data_previsao", { ascending: true });

      if (error) {
        // Se a tabela ainda não foi criada no banco remoto, retorna vazio com aviso
        console.warn("Aviso ao buscar ordens_servico:", error.message);
        return [];
      }
      return (data || []) as unknown as OrdemServicoRow[];
    },
    enabled: !!session,
  });

  // Formulário React Hook Form
  const form = useForm<OrdemServicoFormValues>({
    resolver: zodResolver(ordemServicoSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const handleOpenCreate = () => {
    setEditingOS(null);
    form.reset(DEFAULT_FORM_VALUES);
    setDialogOpen(true);
  };

  const handleOpenEdit = (os: OrdemServicoRow) => {
    setEditingOS(os);
    form.reset({
      titulo: os.titulo,
      descricao: os.descricao || "",
      obra_id: os.obra_id || "",
      cliente_id: os.cliente_id || "",
      responsavel_id: os.responsavel_id || "",
      responsavel_nome: os.responsavel_nome || "",
      responsavel_telefone: os.responsavel_telefone || "",
      email_notificacao: os.email_notificacao || "",
      horario_lembrete: os.horario_lembrete ? os.horario_lembrete.slice(0, 5) : "08:00",
      data_previsao: os.data_previsao,
      prioridade: os.prioridade,
      status: os.status,
      observacoes: os.observacoes || "",
    });
    setDialogOpen(true);
  };

  // Mutation para Salvar (Criar ou Atualizar)
  const saveMutation = useMutation({
    mutationFn: async (values: OrdemServicoFormValues) => {
      const payload = {
        titulo: values.titulo,
        descricao: values.descricao || null,
        obra_id: values.obra_id ? values.obra_id : null,
        cliente_id: values.cliente_id ? values.cliente_id : null,
        responsavel_id: values.responsavel_id ? values.responsavel_id : null,
        responsavel_nome: values.responsavel_nome || null,
        responsavel_telefone: values.responsavel_telefone || null,
        email_notificacao: values.email_notificacao?.trim() ? values.email_notificacao.trim() : null,
        horario_lembrete: values.horario_lembrete ? values.horario_lembrete : "08:00",
        data_previsao: values.data_previsao,
        prioridade: values.prioridade,
        status: values.status,
        observacoes: values.observacoes || null,
        data_conclusao: values.status === "concluida" ? new Date().toISOString() : null,
      };

      if (editingOS) {
        const { error } = await supabase
          .from("ordens_servico")
          .update(payload)
          .eq("id", editingOS.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ordens_servico")
          .insert({
            ...payload,
            created_by: session?.user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingOS ? "Ordem de serviço atualizada com sucesso!" : "Ordem de serviço criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      setDialogOpen(false);
      setEditingOS(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar ordem de serviço: ${err.message}`);
    },
  });

  // Mutation para Concluir/Reabrir Rápido (estilo checkbox Trello)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: StatusOS }) => {
      const { error } = await supabase
        .from("ordens_servico")
        .update({
          status: novoStatus,
          data_conclusao: novoStatus === "concluida" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.novoStatus === "concluida" ? "OS marcada como concluída! 🎉" : "OS reaberta com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar situação: ${err.message}`);
    },
  });

  // Mutation para Excluir
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem de serviço removida.");
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      setDeletingOS(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover ordem de serviço: ${err.message}`);
    },
  });

  // Cálculo das Métricas Gerais estilo Trello
  const metricas = useMemo(() => {
    let atrasadas = 0;
    let vencendoBreve = 0;
    let concluidas = 0;
    let emAndamento = 0;

    ordensServico.forEach((os) => {
      if (os.status === "concluida") {
        concluidas++;
        return;
      }
      if (os.status === "cancelada") return;

      const prazo = calcularStatusPrazo(os.data_previsao, os.status);
      if (prazo.tipo === "atrasada") {
        atrasadas++;
      } else if (prazo.tipo === "vence_hoje" || prazo.tipo === "vence_amanha" || prazo.tipo === "vence_breve") {
        vencendoBreve++;
      } else {
        emAndamento++;
      }
    });

    return {
      total: ordensServico.length,
      atrasadas,
      vencendoBreve,
      concluidas,
      emAndamento,
    };
  }, [ordensServico]);

  // Filtragem dos registros
  const ordensFiltradas = useMemo(() => {
    return ordensServico.filter((os) => {
      // Filtro de aba
      if (activeTab === "vencendo") {
        if (os.status === "concluida" || os.status === "cancelada") return false;
        const p = calcularStatusPrazo(os.data_previsao, os.status);
        if (p.tipo !== "vence_hoje" && p.tipo !== "vence_amanha" && p.tipo !== "vence_breve") {
          return false;
        }
      } else if (activeTab === "atrasadas") {
        if (os.status === "concluida" || os.status === "cancelada") return false;
        const p = calcularStatusPrazo(os.data_previsao, os.status);
        if (p.tipo !== "atrasada") return false;
      } else if (activeTab === "abertas") {
        if (os.status === "concluida" || os.status === "cancelada") return false;
      } else if (activeTab === "concluidas") {
        if (os.status !== "concluida") return false;
      }

      // Filtro por Obra
      if (filtroObra !== "todas" && os.obra_id !== filtroObra) {
        return false;
      }

      // Filtro por Prioridade
      if (filtroPrioridade !== "todas" && os.prioridade !== filtroPrioridade) {
        return false;
      }

      // Filtro de Busca Textual
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const num = os.numero?.toLowerCase() || "";
        const tit = os.titulo?.toLowerCase() || "";
        const resp = os.responsavel_nome?.toLowerCase() || "";
        const obraNome = os.obras?.nome?.toLowerCase() || "";
        if (!num.includes(termo) && !tit.includes(termo) && !resp.includes(termo) && !obraNome.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [ordensServico, activeTab, filtroObra, filtroPrioridade, busca]);

  // Colunas da ResponsiveTable
  const columns: ResponsiveTableColumn<OrdemServicoRow>[] = [
    {
      key: "check",
      header: "Status",
      priority: "essential",
      mobileLabel: "Situação",
      cell: (row) => {
        const isConcluida = row.status === "concluida";
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={isConcluida ? "Reabrir OS" : "Marcar como concluída"}
              aria-label={isConcluida ? `Reabrir OS ${row.numero}` : `Concluir OS ${row.numero}`}
              onClick={() =>
                toggleStatusMutation.mutate({
                  id: row.id,
                  novoStatus: isConcluida ? "em_andamento" : "concluida",
                })
              }
              className={cn(
                "w-6 h-6 rounded-md border flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                isConcluida
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent"
              )}
            >
              <Check className="w-4 h-4" />
            </button>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-normal",
                isConcluida && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                row.status === "em_andamento" && "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
                row.status === "aberta" && "border-slate-300 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
                row.status === "aguardando_material" && "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                row.status === "cancelada" && "border-slate-200 text-slate-400 line-through"
              )}
            >
              {STATUS_LABEL[row.status]}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "os",
      header: "Ordem de Serviço",
      priority: "essential",
      mobileLabel: "OS / Título",
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary">{row.numero}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.titulo}</span>
          </div>
          {row.obras?.nome && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardHat className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{row.obras.nome}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "prazo",
      header: "Prazo de Conclusão",
      priority: "essential",
      mobileLabel: "Prazo",
      cell: (row) => {
        const prazo = calcularStatusPrazo(row.data_previsao, row.status);
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={cn("text-xs border", prazo.classeBadge)}>
              {prazo.tipo === "atrasada" && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
              {prazo.tipo === "concluida" && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
              {(prazo.tipo === "vence_hoje" || prazo.tipo === "vence_amanha") && (
                <Clock className="w-3 h-3 mr-1 inline animate-bounce" />
              )}
              {prazo.label}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "responsavel",
      header: "Responsável",
      priority: "secondary",
      mobileLabel: "Responsável",
      cell: (row) => {
        const waLink = gerarLinkWhatsApp(row.responsavel_telefone, {
          numero: row.numero,
          titulo: row.titulo,
          data_previsao: row.data_previsao,
          status: row.status,
          responsavel_nome: row.responsavel_nome,
          obra_nome: row.obras?.nome,
        });

        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.responsavel_nome || "Não atribuído"}</span>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  title={`Avisar ${row.responsavel_nome || "responsável"} no WhatsApp`}
                  aria-label={`Avisar ${row.responsavel_nome || "responsável"} via WhatsApp sobre ${row.numero}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-transform hover:scale-105 shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {row.email_notificacao && (
              <div
                className="flex items-center gap-1 text-[11px] text-muted-foreground"
                title={`Lembrete por e-mail para ${row.email_notificacao} às ${row.horario_lembrete ? row.horario_lembrete.slice(0, 5) : "08:00"}`}
              >
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate max-w-[130px]">{row.email_notificacao}</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 py-0.5 rounded font-mono shrink-0">
                  {row.horario_lembrete ? row.horario_lembrete.slice(0, 5) : "08:00"}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "prioridade",
      header: "Prioridade",
      priority: "secondary",
      mobileLabel: "Prioridade",
      cell: (row) => {
        const cores: Record<PrioridadeOS, string> = {
          baixa: "border-slate-200 text-slate-700 bg-slate-50 dark:bg-slate-900",
          media: "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/40",
          alta: "border-amber-200 text-amber-800 bg-amber-50 dark:bg-amber-950/40",
          urgente: "border-rose-300 text-rose-800 bg-rose-50 dark:bg-rose-950/50 font-bold",
        };
        return (
          <Badge variant="outline" className={cn("text-xs", cores[row.prioridade])}>
            {PRIORIDADE_LABEL[row.prioridade]}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Ordens de Serviço
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerenciamento de chamados, prazos e avisos automáticos por push, e-mail e SMS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAtivarPush}
            disabled={isInscrevendoPush}
            className="h-10 text-xs gap-1.5"
            title="Ativar notificações push no celular ou navegador"
          >
            <Smartphone className="w-4 h-4 text-primary" />
            {isInscrevendoPush ? "Ativando..." : "Ativar Push no Celular"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestarPush}
            className="h-10 text-xs gap-1.5"
            title="Testar alerta no aparelho"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            Testar Alerta
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVerificarPrazosEEmail}
            disabled={isProcessandoCron}
            className="h-10 text-xs gap-1.5"
            title="Verificar prazos e disparar notificações aos responsáveis"
          >
            <MailCheck className={cn("w-4 h-4 text-emerald-600", isProcessandoCron && "animate-spin")} />
            {isProcessandoCron ? "Verificando..." : "Disparar Alertas"}
          </Button>

          <Button onClick={handleOpenCreate} className="gap-2 h-10 px-4 font-medium shadow-sm text-xs">
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores Estilo Trello */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total de OSs</span>
            <ClipboardCheck className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{metricas.total}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{metricas.emAndamento} em andamento</p>
        </div>

        <div className={cn(
          "rounded-xl border p-4 shadow-xs transition-colors",
          metricas.atrasadas > 0
            ? "border-rose-300 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20"
            : "border-slate-200 dark:border-slate-800 bg-card"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-medium",
              metricas.atrasadas > 0 ? "text-rose-800 dark:text-rose-300 font-semibold" : "text-muted-foreground"
            )}>
              Atrasadas
            </span>
            <AlertTriangle className={cn("w-4 h-4", metricas.atrasadas > 0 ? "text-rose-600 animate-pulse" : "text-slate-400")} />
          </div>
          <div className={cn("mt-2 text-2xl font-bold tabular-nums", metricas.atrasadas > 0 && "text-rose-700 dark:text-rose-300")}>
            {metricas.atrasadas}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Exigem cobrança imediata</p>
        </div>

        <div className={cn(
          "rounded-xl border p-4 shadow-xs transition-colors",
          metricas.vencendoBreve > 0
            ? "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-slate-200 dark:border-slate-800 bg-card"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-medium",
              metricas.vencendoBreve > 0 ? "text-amber-900 dark:text-amber-300 font-semibold" : "text-muted-foreground"
            )}>
              Vencendo em Breve
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className={cn("mt-2 text-2xl font-bold tabular-nums", metricas.vencendoBreve > 0 && "text-amber-800 dark:text-amber-300")}>
            {metricas.vencendoBreve}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Vencem em até 3 dias</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {metricas.concluidas}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Finalizadas com sucesso</p>
        </div>
      </div>

      {/* Abas e Filtros */}
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            navigate({ search: (prev) => ({ ...prev, tab: val }) });
          }}
          className="w-full"
        >
          <TabsList className="w-full sm:w-auto h-auto flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
            <TabsTrigger value="todas" className="h-10 px-4 text-xs font-medium">
              Todas ({metricas.total})
            </TabsTrigger>
            <TabsTrigger value="vencendo" className="h-10 px-4 text-xs font-medium text-amber-800 dark:text-amber-300">
              Vencendo ({metricas.vencendoBreve})
            </TabsTrigger>
            <TabsTrigger value="atrasadas" className="h-10 px-4 text-xs font-medium text-rose-700 dark:text-rose-300">
              Atrasadas ({metricas.atrasadas})
            </TabsTrigger>
            <TabsTrigger value="abertas" className="h-10 px-4 text-xs font-medium">
              Em Aberto ({metricas.emAndamento})
            </TabsTrigger>
            <TabsTrigger value="concluidas" className="h-10 px-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Concluídas ({metricas.concluidas})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Linha de Busca e Seletores */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="busca-ordens-servico"
              name="busca-ordens-servico"
              placeholder="Buscar por número, título, responsável ou obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-11"
            />
          </div>

          <div className="flex gap-2">
            <Select value={filtroObra} onValueChange={setFiltroObra}>
              <SelectTrigger className="w-full sm:w-48 h-11 text-xs">
                <SelectValue placeholder="Todas as obras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as obras</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
              <SelectTrigger className="w-36 h-11 text-xs">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas prioridades</SelectItem>
                {PRIORIDADES_OS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORIDADE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabela Responsiva */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
        <ResponsiveTable<OrdemServicoRow>
          columns={columns}
          rows={ordensFiltradas}
          getRowKey={(row) => row.id}
          loading={isLoading}
          emptyState={
            <div className="p-12 text-center space-y-3">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground/50 mx-auto" />
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                Nenhuma ordem de serviço encontrada.
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {busca.trim() || filtroObra !== "todas"
                  ? "Tente ajustar os filtros de busca para encontrar os registros."
                  : "Crie a primeira ordem de serviço com prazo e receba alertas rápidos por WhatsApp."}
              </p>
              {!busca.trim() && filtroObra === "todas" && (
                <Button onClick={handleOpenCreate} variant="outline" className="mt-2">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Cadastrar Ordem de Serviço
                </Button>
              )}
            </div>
          }
          renderActions={(row) => {
            const waLink = gerarLinkWhatsApp(row.responsavel_telefone, {
              numero: row.numero,
              titulo: row.titulo,
              data_previsao: row.data_previsao,
              status: row.status,
              responsavel_nome: row.responsavel_nome,
              obra_nome: row.obras?.nome,
            });

            return (
              <div className="flex items-center justify-end gap-1.5">
                {waLink && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-9 px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    title="Avisar via WhatsApp"
                  >
                    <a href={waLink} target="_blank" rel="noreferrer">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-slate-600 hover:text-slate-900"
                  onClick={() => handleOpenEdit(row)}
                  aria-label={`Editar ${row.numero}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setDeletingOS(row)}
                  aria-label={`Excluir ${row.numero}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          }}
        />
      </div>

      {/* Modal de Criação / Edição de Ordem de Serviço */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              {editingOS ? `Editar Ordem de Serviço ${editingOS.numero}` : "Nova Ordem de Serviço"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do chamado ou serviço, defina o responsável e o prazo para acompanhamento.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título do Serviço / Demanda *</FormLabel>
                    <FormControl>
                      <Input
                        id="os-titulo"
                        placeholder="Ex: Troca de disjuntor do quadro elétrico"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="obra_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obra Vinculada (Opcional)</FormLabel>
                      <Select
                        value={field.value || "nenhuma"}
                        onValueChange={(val) => field.onChange(val === "nenhuma" ? "" : val)}
                      >
                        <FormControl>
                          <SelectTrigger id="os-obra-select">
                            <SelectValue placeholder="Selecione a obra..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="nenhuma">Nenhuma (Serviço geral)</SelectItem>
                          {obras.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_previsao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Limite / Prazo *</FormLabel>
                      <FormControl>
                        <Input id="os-data-previsao" type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsavel_nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Responsável / Encarregado</FormLabel>
                      <FormControl>
                        <Input
                          id="os-responsavel-nome"
                          placeholder="Ex: João Silva"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responsavel_telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp do Responsável</FormLabel>
                      <FormControl>
                        <Input
                          id="os-responsavel-telefone"
                          placeholder="Ex: (11) 98765-4321"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email_notificacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail para Lembrete (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          id="os-email-notificacao"
                          type="email"
                          placeholder="Ex: gestor@obra.com.br"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription className="text-[11px] text-muted-foreground">
                        Endereço para envio do comunicado de prazo desta OS.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="horario_lembrete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário do Lembrete</FormLabel>
                      <FormControl>
                        <Input
                          id="os-horario-lembrete"
                          type="time"
                          {...field}
                          value={field.value || "08:00"}
                        />
                      </FormControl>
                      <FormDescription className="text-[11px] text-muted-foreground">
                        Horário de disparo do alerta do dia (padrão: 08:00).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="os-prioridade-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORIDADES_OS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PRIORIDADE_LABEL[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="os-status-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição Detalhada do Serviço</FormLabel>
                    <FormControl>
                      <Textarea
                        id="os-descricao"
                        rows={3}
                        placeholder="Descreva as instruções, peças necessárias ou escopo da OS..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Internas</FormLabel>
                    <FormControl>
                      <Input
                        id="os-observacoes"
                        placeholder="Anotações de acompanhamento, impedimentos, etc."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : editingOS ? "Salvar Alterações" : "Criar Ordem de Serviço"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingOS} onOpenChange={(open) => !open && setDeletingOS(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a ordem de serviço{" "}
              <strong>{deletingOS?.numero} — {deletingOS?.titulo}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => deletingOS && deleteMutation.mutate(deletingOS.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Ordem de Serviço"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
