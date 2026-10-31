import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  FileText,
  AlertTriangle,
  Upload,
  Download,
  ExternalLink,
  Loader2,
  Search,
  Printer,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { uploadR2, openR2File } from "@/lib/r2";
import { gerarParcelasFinanceiras } from "@/lib/financeiro-parcelamento";
import { ArrowRightLeft, Sparkles, Clock, CalendarDays, Layers } from "lucide-react";
import { TransferenciaFormDialog } from "@/components/financeiro/transferencia-form-dialog";
import { ConciliacaoOfxDialog } from "@/components/financeiro/conciliacao-ofx-dialog";
import { AlertasVencimentoBar } from "@/components/financeiro/alertas-vencimento-bar";
import { ReciboFinanceiroDialog, ContaReciboData } from "@/components/financeiro/recibo-financeiro-dialog";
import { FluxoCaixaAvancado } from "@/components/financeiro/fluxo-caixa-avancado";
import * as XLSX from "xlsx";
import {
  contasReceberSchema,
  contasPagarSchema,
  type ContasReceberFormValues,
  type ContasPagarFormValues,
  type StatusReceber,
  type StatusPagar,
  STATUS_RECEBER_LABEL,
  STATUS_RECEBER_BADGE,
  STATUS_PAGAR_LABEL,
  STATUS_PAGAR_BADGE,
  FORMA_PAGAMENTO_RECEITA_LABEL,
  type FormaPagamentoReceita,
} from "@/lib/financeiro.schema";
import { cn, formatBRLInput } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroCivilPage,
});

function FinanceiroCivilPage() {
  return <FinanceiroPage forcedOrigin="erp" />;
}

interface ContaReceberRow {
  id: string;
  obra_id: string;
  cliente_id: string;
  descricao: string;
  valor_total: number; // centavos
  valor_aditivo: number; // centavos
  data_vencimento: string;
  status: StatusReceber;
  data_recebimento: string | null;
  valor_recebido: number | null; // centavos
  forma_pagamento: FormaPagamentoReceita | null;
  nota_fiscal_url: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  created_at: string;
  origem?: "erp" | "imobiliaria";
  imob_locacao_id?: string | null;
  imob_cliente_id?: string | null;
  conciliado?: boolean;
  etapa_id?: string | null;
  etapa_nome?: string | null;
  parcelamento_id?: string | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
}

interface ContaPagarRow {
  id: string;
  obra_id: string | null;
  fornecedor_id: string | null;
  pedido_id: string | null;
  descricao: string;
  valor_total: number; // centavos
  data_vencimento: string;
  status: StatusPagar;
  data_pagamento: string | null;
  valor_pago: number | null; // centavos
  nota_fiscal_url: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  created_at: string;
  origem?: "erp" | "imobiliaria";
  imob_locacao_id?: string | null;
  imob_cliente_id?: string | null;
  conciliado?: boolean;
  etapa_id?: string | null;
  etapa_nome?: string | null;
  parcelamento_id?: string | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
}

const fmtBRL = (v: number | null | undefined) => {
  const val = (v ?? 0) / 100;
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};


const EMPTY_RECEBER = {
  obra_id: "",
  cliente_id: "",
  descricao: "",
  valor_total: 0,
  valor_aditivo: 0,
  data_vencimento: new Date().toISOString().slice(0, 10),
  status: "aberta" as StatusReceber,
  data_recebimento: "",
  valor_recebido: 0,
  forma_pagamento: "",
  nota_fiscal_url: "",
  comprovante_url: "",
  observacoes: "",
  conta_bancaria_id: "",
  categoria_dre_id: "",
  numero_documento: "",
};

const EMPTY_PAGAR = {
  obra_id: "",
  fornecedor_id: "",
  pedido_id: "",
  descricao: "",
  valor_total: 0,
  data_vencimento: new Date().toISOString().slice(0, 10),
  status: "aberta" as StatusPagar,
  data_pagamento: "",
  valor_pago: 0,
  nota_fiscal_url: "",
  comprovante_url: "",
  observacoes: "",
  conta_bancaria_id: "",
  categoria_dre_id: "",
  numero_documento: "",
};

export function FinanceiroPage({ forcedOrigin }: { forcedOrigin?: "erp" | "imobiliaria" }) {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdminOrDirector = roles.includes("admin") || roles.includes("diretor");
  const canAccessCivil = isAdminOrDirector || roles.includes("financeiro_civil") || (roles as string[]).includes("financeiro");
  const canAccessImobiliaria = isAdminOrDirector || roles.includes("financeiro_imobiliaria");
  const roleScopedOrigin = canAccessCivil && canAccessImobiliaria
    ? null
    : canAccessImobiliaria ? "imobiliaria" : "erp";
  const scopedOrigin = forcedOrigin ?? roleScopedOrigin;
  const podeEditar = canAccessCivil || canAccessImobiliaria;
  const podeExcluir = isAdminOrDirector;

  const [activeTab, setActiveTab] = useState("receber");
  const [receberFormOpen, setReceberFormOpen] = useState(false);
  const [pagarFormOpen, setPagarFormOpen] = useState(false);
  const [receberEditTarget, setReceberEditTarget] = useState<ContaReceberRow | null>(null);
  const [pagarEditTarget, setPagarEditTarget] = useState<ContaPagarRow | null>(null);

  // Mark Received Modal State
  const [receivedTarget, setReceivedTarget] = useState<ContaReceberRow | null>(null);
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedVal, setReceivedVal] = useState(0);
  const [receivedPaymentMethod, setReceivedPaymentMethod] = useState<FormaPagamentoReceita | "">("");
  const [receivedFile, setReceivedFile] = useState<File | null>(null);
  const [uploadingReceived, setUploadingReceived] = useState(false);

  // Mark Paid Modal State
  const [paidTarget, setPaidTarget] = useState<ContaPagarRow | null>(null);
  const [paidDate, setPaidDate] = useState("");
  const [paidVal, setPaidVal] = useState(0);
  const [paidFile, setPaidFile] = useState<File | null>(null);
  const [uploadingPaid, setUploadingPaid] = useState(false);

  // Delete State
  const [deleteReceberId, setDeleteReceberId] = useState<string | null>(null);
  const [deletePagarId, setDeletePagarId] = useState<string | null>(null);

  // Filters
  const [filtroObra, setFiltroObra] = useState("todos");
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [filtroObraDre, setFiltroObraDre] = useState("todos");
  const [filtroStatusReceber, setFiltroStatusReceber] = useState("todos");
  const [filtroStatusPagar, setFiltroStatusPagar] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");

  useEffect(() => {
    setFiltroOrigem(scopedOrigin ?? "todos");
  }, [scopedOrigin]);

  // Queries
  const { data: contasReceber, isLoading: loadingCR } = useQuery({
    queryKey: ["contas_receber", scopedOrigin],
    queryFn: async () => {
      let query = (supabase as any)
        .from("contas_receber")
        .select("*")
        .order("data_vencimento", { ascending: false });
      if (scopedOrigin) query = query.eq("origem", scopedOrigin);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ContaReceberRow[];
    },
    enabled: podeEditar,
  });

  const { data: contasPagar, isLoading: loadingCP } = useQuery({
    queryKey: ["contas_pagar", scopedOrigin],
    queryFn: async () => {
      let query = (supabase as any)
        .from("contas_pagar")
        .select("*")
        .order("data_vencimento", { ascending: false });
      if (scopedOrigin) query = query.eq("origem", scopedOrigin);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ContaPagarRow[];
    },
    enabled: podeEditar,
  });

  const contasReceberFiltradas = useMemo(() => {
    return (contasReceber ?? []).filter((conta) => {
      if (filtroOrigem === "todos") return true;
      return (conta.origem ?? "erp") === filtroOrigem;
    });
  }, [contasReceber, filtroOrigem]);

  const contasPagarFiltradas = useMemo(() => {
    return (contasPagar ?? []).filter((conta) => {
      if (filtroOrigem === "todos") return true;
      return (conta.origem ?? "erp") === filtroOrigem;
    });
  }, [contasPagar, filtroOrigem]);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-fin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clientes")
        .select("id,nome")
        .is("deleted_at", null)
        .order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: imobClientes } = useQuery({
    queryKey: ["imob-clientes-fin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("imobiliaria_clientes")
        .select("id,nome")
        .is("deleted_at", null)
        .order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: obras } = useQuery({
    queryKey: ["obras-fin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("obras")
        .select("id,numero,nome,cliente_id")
        .order("nome");
      return (data ?? []) as { id: string; numero: string; nome: string; cliente_id: string }[];
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-fin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("fornecedores")
        .select("id,razao_social")
        .order("razao_social");
      return (data ?? []) as { id: string; razao_social: string }[];
    },
  });

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos-fin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pedidos_compra")
        .select("id,numero,valor_total")
        .order("created_at", { ascending: false });
      return (data ?? []) as { id: string; numero: string; valor_total: number }[];
    },
  });

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias-fin"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("*").order("nome");
      return data || [];
    },
  });

  const { data: categoriasFinanceiras } = useQuery({
    queryKey: ["categorias-financeiras-fin"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("*").order("nome");
      return data || [];
    },
  });


  const { data: etapasFiltroObra } = useQuery({
    queryKey: ["etapas-filtro-obra", filtroObra],
    queryFn: async () => {
      if (!filtroObra || filtroObra === "todos" || filtroObra === "none") return [];
      const { data: orcamento } = await (supabase as any)
        .from("orcamentos")
        .select("id")
        .eq("obra_id", filtroObra)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orcamento?.id) {
        const { data: etapas } = await (supabase as any)
          .from("orcamento_etapas")
          .select("id, codigo, nome, ordem")
          .eq("orcamento_id", orcamento.id)
          .order("ordem", { ascending: true });

        if (etapas && etapas.length > 0) return etapas;
      }

      const { data: crono } = await (supabase as any)
        .from("obra_cronograma")
        .select("id, nome, ordem")
        .eq("obra_id", filtroObra)
        .order("ordem", { ascending: true });

      return (crono || []).map((c: any) => ({
        id: c.id,
        codigo: null,
        nome: c.nome,
        ordem: c.ordem,
      }));
    },
    enabled: !!filtroObra && filtroObra !== "todos" && filtroObra !== "none",
  });

  // DRE calculation
  const dreReport = useMemo(() => {
    if (!contasReceber || !contasPagar || !categoriasFinanceiras) {
      return { receitas: [], despesas: [], totalReceitas: 0, totalDespesas: 0, resultado: 0 };
    }

    let paidReceitas = contasReceberFiltradas.filter(r => r.status === "recebida");
    let paidDespesas = contasPagarFiltradas.filter(p => p.status === "paga");

    if (filtroObraDre !== "todos") {
      paidReceitas = paidReceitas.filter(r => r.obra_id === filtroObraDre);
      paidDespesas = paidDespesas.filter(p => p.obra_id === filtroObraDre);
    }

    const categoryMap = new Map<string, string>();
    categoriasFinanceiras.forEach(cat => categoryMap.set(cat.id, cat.nome));

    const recGroup: Record<string, number> = {};
    let totalReceitas = 0;
    paidReceitas.forEach(r => {
      const catId = (r as any).categoria_dre_id || "sem_categoria";
      const catName = categoryMap.get(catId) || "Receitas Gerais (Sem Categoria)";
      recGroup[catName] = (recGroup[catName] || 0) + (r.valor_recebido || r.valor_total);
      totalReceitas += (r.valor_recebido || r.valor_total);
    });

    const pagGroup: Record<string, number> = {};
    let totalDespesas = 0;
    paidDespesas.forEach(d => {
      const catId = (d as any).categoria_dre_id || "sem_categoria";
      const catName = categoryMap.get(catId) || "Despesas Gerais (Sem Categoria)";
      pagGroup[catName] = (pagGroup[catName] || 0) + (d.valor_pago || d.valor_total);
      totalDespesas += (d.valor_pago || d.valor_total);
    });

    return {
      receitas: Object.entries(recGroup).map(([name, value]) => ({ name, value })),
      despesas: Object.entries(pagGroup).map(([name, value]) => ({ name, value })),
      totalReceitas,
      totalDespesas,
      resultado: totalReceitas - totalDespesas
    };
  }, [contasReceberFiltradas, contasPagarFiltradas, categoriasFinanceiras, filtroObraDre]);

  const bankAccountsList = useMemo(() => {
    if (!contasBancarias) return [];
    return contasBancarias.map(acc => {
      const paidCR = (contasReceber || []).filter(r => r.status === "recebida" && (r as any).conta_bancaria_id === acc.id);
      const paidCP = (contasPagar || []).filter(p => p.status === "paga" && (p as any).conta_bancaria_id === acc.id);
      
      const sumCR = paidCR.reduce((sum, r) => sum + (r.valor_recebido || r.valor_total), 0);
      const sumCP = paidCP.reduce((sum, p) => sum + (p.valor_pago || p.valor_total), 0);

      const saldoInicialCentavos = Math.round(Number(acc.saldo_inicial) * 100);
      const saldoAtualCentavos = saldoInicialCentavos + sumCR - sumCP;

      return {
        ...acc,
        saldoAtual: saldoAtualCentavos
      };
    });
  }, [contasBancarias, contasReceber, contasPagar]);

  // Maps for UI
  const obrasMap = useMemo(() => {
    const m: Record<string, string> = {};
    (obras ?? []).forEach((o) => {
      m[o.id] = `${o.numero} — ${o.nome}`;
    });
    return m;
  }, [obras]);

  const clientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientes ?? []).forEach((c) => {
      m[c.id] = c.nome;
    });
    return m;
  }, [clientes]);

  const imobClientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (imobClientes ?? []).forEach((c) => {
      m[c.id] = c.nome;
    });
    return m;
  }, [imobClientes]);

  const fornecedoresMap = useMemo(() => {
    const m: Record<string, string> = {};
    (fornecedores ?? []).forEach((f) => {
      m[f.id] = f.razao_social;
    });
    return m;
  }, [fornecedores]);

  const pedidosMap = useMemo(() => {
    const m: Record<string, string> = {};
    (pedidos ?? []).forEach((p) => {
      m[p.id] = `Pedido #${p.numero}`;
    });
    return m;
  }, [pedidos]);

  // Bank Account & Category States & Mutations
  const [bancoFormOpen, setBancoFormOpen] = useState(false);
  const [categoriaFormOpen, setCategoriaFormOpen] = useState(false);
  const [bancoNome, setBancoNome] = useState("");
  const [bancoTipo, setBancoTipo] = useState<"corrente" | "poupanca" | "aplicacao" | "caixa_interno">("corrente");
  const [bancoSaldoInicial, setBancoSaldoInicial] = useState(0);
  const [categoriaNome, setCategoriaNome] = useState("");
  const [categoriaTipo, setCategoriaTipo] = useState<"receita" | "despesa">("receita");
  const [categoriaPaiId, setCategoriaPaiId] = useState<string>("");

  // Estados para Recibo, Transferência Interna e Conciliação OFX
  const [reciboTarget, setReciboTarget] = useState<ContaReciboData | null>(null);
  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [transferenciaModalOpen, setTransferenciaModalOpen] = useState(false);
  const [ofxModalOpen, setOfxModalOpen] = useState(false);

  const createBancoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contas_bancarias").insert({
        nome: bancoNome,
        tipo: bancoTipo,
        saldo_inicial: bancoSaldoInicial,
        ativo: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta bancária adicionada!");
      qc.invalidateQueries({ queryKey: ["contas-bancarias-fin"] });
      setBancoFormOpen(false);
      setBancoNome("");
      setBancoSaldoInicial(0);
    },
    onError: (e) => toast.error(e.message)
  });

  const createCategoriaMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categorias_financeiras").insert({
        nome: categoriaNome,
        tipo: categoriaTipo,
        parent_id: categoriaPaiId || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria DRE adicionada!");
      qc.invalidateQueries({ queryKey: ["categorias-financeiras-fin"] });
      setCategoriaFormOpen(false);
      setCategoriaNome("");
      setCategoriaPaiId("");
    },
    onError: (e) => toast.error(e.message)
  });

  const toggleConciliado = async (id: string, table: "contas_receber" | "contas_pagar", currentVal: boolean) => {
    const { error } = await supabase.from(table).update({ conciliado: !currentVal } as any).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Status de conciliação atualizado!");
      qc.invalidateQueries({ queryKey: ["contas_receber"] });
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const currMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    let aReceberMes = 0;
    let aPagarMes = 0;
    let recebidoMes = 0;
    let pagoMes = 0;
    let atrasado = 0;

    (contasReceberFiltradas ?? []).forEach((cr) => {
      if (cr.status === "cancelada") return;
      const m = cr.data_vencimento.slice(0, 7);
      if (m === currMonthStr) {
        if (cr.status !== "recebida") {
          aReceberMes += cr.valor_total;
        } else {
          recebidoMes += cr.valor_recebido ?? cr.valor_total;
        }
      }
      if (cr.status === "atrasada" || (cr.status === "aberta" && cr.data_vencimento < todayStr)) {
        atrasado += cr.valor_total - (cr.valor_recebido ?? 0);
      }
    });

    (contasPagarFiltradas ?? []).forEach((cp) => {
      if (cp.status === "cancelada") return;
      const m = cp.data_vencimento.slice(0, 7);
      if (m === currMonthStr) {
        if (cp.status !== "paga") {
          aPagarMes += cp.valor_total;
        } else {
          pagoMes += cp.valor_pago ?? cp.valor_total;
        }
      }
      if (cp.status === "atrasada" || (cp.status === "aberta" && cp.data_vencimento < todayStr)) {
        atrasado += cp.valor_total - (cp.valor_pago ?? 0);
      }
    });

    const saldoProjetado = (recebidoMes + aReceberMes) - (pagoMes + aPagarMes);

    return {
      aReceberMes,
      aPagarMes,
      saldoProjetado,
      atrasado,
    };
  }, [contasReceberFiltradas, contasPagarFiltradas]);

  // Aging groups calculation for Receivables
  const agingReceber = useMemo(() => {
    const groups = {
      aVencer: 0,
      venceHoje: 0,
      atrasado1_30: 0,
      atrasado31_60: 0,
      atrasado61_plus: 0,
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);

    (contasReceberFiltradas ?? []).forEach((cr) => {
      if (cr.status === "recebida" || cr.status === "cancelada") return;

      const venc = new Date(cr.data_vencimento);
      const diffTime = today.getTime() - venc.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (cr.data_vencimento > todayStr) {
        groups.aVencer += cr.valor_total;
      } else if (cr.data_vencimento === todayStr) {
        groups.venceHoje += cr.valor_total;
      } else if (diffDays <= 30) {
        groups.atrasado1_30 += cr.valor_total;
      } else if (diffDays <= 60) {
        groups.atrasado31_60 += cr.valor_total;
      } else {
        groups.atrasado61_plus += cr.valor_total;
      }
    });

    return groups;
  }, [contasReceberFiltradas]);

  // Filtered List
  const filtradosReceber = useMemo(() => {
    return (contasReceberFiltradas ?? []).filter((cr) => {
      const matchObra =
        filtroObra === "todos"
          ? true
          : filtroObra === "none"
            ? !cr.obra_id
            : cr.obra_id === filtroObra;
      const matchStatus = filtroStatusReceber === "todos" || cr.status === filtroStatusReceber;
      return matchObra && matchStatus;
    });
  }, [contasReceberFiltradas, filtroObra, filtroStatusReceber]);

  const filtradosPagar = useMemo(() => {
    return (contasPagarFiltradas ?? []).filter((cp) => {
      const matchObra =
        filtroObra === "todos"
          ? true
          : filtroObra === "none"
            ? !cp.obra_id
            : cp.obra_id === filtroObra;
      const matchStatus = filtroStatusPagar === "todos" || cp.status === filtroStatusPagar;
      return matchObra && matchStatus;
    });
  }, [contasPagarFiltradas, filtroObra, filtroStatusPagar]);

  // Cash Flow charts calculation
  const cashFlowData = useMemo(() => {
    const monthlyMap: Record<
      string,
      { month: string; recPrev: number; recReal: number; pagPrev: number; pagReal: number }
    > = {};

    const formatMonth = (dateStr: string) => {
      const parts = dateStr.split("-");
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${months[mIdx]}/${parts[0].slice(2)}`;
    };

    // Initialize last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // "YYYY-MM"
      monthlyMap[key] = {
        month: formatMonth(key + "-01"),
        recPrev: 0,
        recReal: 0,
        pagPrev: 0,
        pagReal: 0,
      };
    }

    (contasReceberFiltradas ?? []).forEach((cr) => {
      if (cr.status === "cancelada") return;
      const key = cr.data_vencimento.slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].recPrev += cr.valor_total / 100;
        if (cr.status === "recebida") {
          monthlyMap[key].recReal += (cr.valor_recebido ?? cr.valor_total) / 100;
        }
      }
    });

    (contasPagarFiltradas ?? []).forEach((cp) => {
      if (cp.status === "cancelada") return;
      const key = cp.data_vencimento.slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].pagPrev += cp.valor_total / 100;
        if (cp.status === "paga") {
          monthlyMap[key].pagReal += (cp.valor_pago ?? cp.valor_total) / 100;
        }
      }
    });

    return Object.keys(monthlyMap)
      .sort()
      .map((k) => monthlyMap[k]);
  }, [contasReceberFiltradas, contasPagarFiltradas]);

  // Mutations
  const deleteReceberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("contas_receber").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta a receber excluída");
      qc.invalidateQueries({ queryKey: ["contas_receber"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePagarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("contas_pagar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta a pagar excluída");
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Action: Marcar Recebida
  const openReceberStatusModal = (cr: ContaReceberRow) => {
    setReceivedTarget(cr);
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setReceivedVal((cr.valor_total + (cr.valor_aditivo || 0)) / 100);
    setReceivedPaymentMethod(cr.forma_pagamento || "");
    setReceivedFile(null);
  };

  const submitRecebimento = async () => {
    if (!receivedTarget) return;
    if (!receivedDate) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (!receivedPaymentMethod) {
      toast.error("Informe a forma de pagamento.");
      return;
    }
    setUploadingReceived(true);
    try {
      let comprovanteUrl = receivedTarget.comprovante_url;

      if (receivedFile) {
        const filePath = await uploadR2(receivedFile, "financeiro/comprovantes");
        comprovanteUrl = filePath;
      }

      const { error } = await (supabase as any)
        .from("contas_receber")
        .update({
          status: "recebida",
          data_recebimento: receivedDate,
          valor_recebido: Math.round(receivedVal * 100),
          forma_pagamento: receivedPaymentMethod,
          comprovante_url: comprovanteUrl,
        })
        .eq("id", receivedTarget.id);

      if (error) throw error;
      toast.success("Recebimento registrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["contas_receber"] });
      setReceivedTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingReceived(false);
    }
  };

  // Action: Marcar Paga
  const openPagarStatusModal = (cp: ContaPagarRow) => {
    setPaidTarget(cp);
    setPaidDate(new Date().toISOString().slice(0, 10));
    setPaidVal(cp.valor_total / 100);
    setPaidFile(null);
  };

  const submitPagamento = async () => {
    if (!paidTarget) return;
    setUploadingPaid(true);
    try {
      let comprovanteUrl = paidTarget.comprovante_url;

      if (paidFile) {
        const filePath = await uploadR2(paidFile, "financeiro/comprovantes");
        comprovanteUrl = filePath;
      }

      const { error } = await (supabase as any)
        .from("contas_pagar")
        .update({
          status: "paga",
          data_pagamento: paidDate,
          valor_pago: Math.round(paidVal * 100),
          comprovante_url: comprovanteUrl,
        })
        .eq("id", paidTarget.id);

      if (error) throw error;
      toast.success("Pagamento registrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
      setPaidTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingPaid(false);
    }
  };

  // Get link to Comprovante
  const handleOpenComprovante = (path: string) => {
    openR2File(path);
  };

  const handleExportReceberExcel = () => {
    if (!filtradosReceber || filtradosReceber.length === 0) {
      toast.error("Nenhum lançamento a receber para exportar");
      return;
    }
    const rows = filtradosReceber.map((cr) => ({
      "Descrição": cr.descricao,
      "Obra": obrasMap[cr.obra_id || ""] || "Geral",
      "Cliente": clientesMap[cr.cliente_id || ""] || "—",
      "Valor Total (R$)": cr.valor_total / 100,
      "Aditivo (R$)": (cr.valor_aditivo || 0) / 100,
      "Total com Aditivo (R$)": (cr.valor_total + (cr.valor_aditivo || 0)) / 100,
      "Vencimento": cr.data_vencimento ? new Date(cr.data_vencimento + "T00:00").toLocaleDateString("pt-BR") : "",
      "Status": STATUS_RECEBER_LABEL[cr.status] || cr.status,
      "Data de Recebimento": cr.data_recebimento ? new Date(cr.data_recebimento + "T00:00").toLocaleDateString("pt-BR") : "—",
      "Valor Recebido (R$)": cr.valor_recebido ? cr.valor_recebido / 100 : 0,
      "Forma de Pagamento": cr.forma_pagamento ? FORMA_PAGAMENTO_RECEITA_LABEL[cr.forma_pagamento] : "—",
      "Observações": cr.observacoes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
    XLSX.writeFile(wb, `contas-a-receber-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPagarExcel = () => {
    if (!filtradosPagar || filtradosPagar.length === 0) {
      toast.error("Nenhum lançamento a pagar para exportar");
      return;
    }
    const rows = filtradosPagar.map((cp) => ({
      "Descrição": cp.descricao,
      "Obra": obrasMap[cp.obra_id || ""] || "Geral",
      "Fornecedor": fornecedoresMap[cp.fornecedor_id || ""] || "—",
      "Pedido": cp.pedido_id ? pedidosMap[cp.pedido_id] || "Sim" : "—",
      "Valor Total (R$)": cp.valor_total / 100,
      "Vencimento": cp.data_vencimento ? new Date(cp.data_vencimento + "T00:00").toLocaleDateString("pt-BR") : "",
      "Status": STATUS_PAGAR_LABEL[cp.status] || cp.status,
      "Data de Pagamento": cp.data_pagamento ? new Date(cp.data_pagamento + "T00:00").toLocaleDateString("pt-BR") : "—",
      "Valor Pago (R$)": cp.valor_pago ? cp.valor_pago / 100 : 0,
      "Observações": cp.observacoes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, `contas-a-pagar-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportReceberExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArr = evt.target?.result;
        const workbook = XLSX.read(dataArr, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (json.length < 2) {
          toast.error("Planilha vazia ou sem cabeçalhos.");
          return;
        }

        const headers = json[0].map((h) => String(h).trim().toLowerCase());
        const dataRows = json.slice(1);

        const idxDescricao = headers.indexOf("descrição") !== -1 ? headers.indexOf("descrição") : headers.indexOf("descricao");
        const idxValor = headers.indexOf("valor") !== -1 ? headers.indexOf("valor") : headers.indexOf("valor total");
        const idxVencimento = headers.indexOf("vencimento") !== -1 ? headers.indexOf("vencimento") : headers.indexOf("data vencimento");
        const idxObra = headers.indexOf("obra");
        const idxCliente = headers.indexOf("cliente");
        const idxStatus = headers.indexOf("status");
        const idxObservacoes = headers.indexOf("observações") !== -1 ? headers.indexOf("observações") : headers.indexOf("observacoes");

        if (idxDescricao === -1 || idxValor === -1 || idxVencimento === -1) {
          toast.error("Colunas obrigatórias 'Descrição', 'Valor' e 'Vencimento' não encontradas.");
          return;
        }

        let countSuccess = 0;
        let countError = 0;

        for (const row of dataRows) {
          if (!row || row.length === 0) continue;

          const descricao = String(row[idxDescricao] ?? "").trim();
          const rawValor = Number(row[idxValor] ?? 0);
          const rawVenc = String(row[idxVencimento] ?? "").trim();

          if (!descricao || isNaN(rawValor) || !rawVenc) {
            countError++;
            continue;
          }

          const valor_total = Math.round(rawValor * 100);

          let data_vencimento = rawVenc;
          if (rawVenc.includes("/")) {
            const parts = rawVenc.split("/");
            if (parts.length === 3) {
              data_vencimento = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          } else if (rawVenc.includes("-") && rawVenc.length > 10) {
            data_vencimento = rawVenc.slice(0, 10);
          }

          let obra_id = null;
          if (idxObra !== -1 && row[idxObra]) {
            const valObra = String(row[idxObra]).trim().toLowerCase();
            const matchedObra = (obras ?? []).find(
              (o) =>
                o.numero.toLowerCase() === valObra ||
                o.nome.toLowerCase().includes(valObra)
            );
            if (matchedObra) obra_id = matchedObra.id;
          }

          let cliente_id = null;
          if (idxCliente !== -1 && row[idxCliente]) {
            const valCli = String(row[idxCliente]).trim().toLowerCase();
            const matchedCli = (clientes ?? []).find((c) =>
              c.nome.toLowerCase().includes(valCli)
            );
            if (matchedCli) cliente_id = matchedCli.id;
          }

          if (obra_id && !cliente_id) {
            const selectedObra = (obras ?? []).find((o) => o.id === obra_id);
            if (selectedObra?.cliente_id) {
              cliente_id = selectedObra.cliente_id;
            }
          }

          const status = idxStatus !== -1 && row[idxStatus]
            ? String(row[idxStatus]).trim().toLowerCase()
            : "aberta";

          const observacoes = idxObservacoes !== -1 && row[idxObservacoes]
            ? String(row[idxObservacoes]).trim()
            : null;

          const payload = {
            descricao,
            valor_total,
            data_vencimento,
            obra_id,
            cliente_id,
            status: ["aberta", "recebida", "atrasada", "cancelada"].includes(status) ? status : "aberta",
            observacoes,
          };

          const { error } = await (supabase as any).from("contas_receber").insert(payload);
          if (error) {
            console.warn("Erro ao importar conta a receber:", error.message);
            countError++;
          } else {
            countSuccess++;
          }
        }

        toast.success(`Importação concluída: ${countSuccess} lançados, ${countError} falhas.`);
        qc.invalidateQueries({ queryKey: ["contas_receber"] });
      } catch (err) {
        toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportPagarExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArr = evt.target?.result;
        const workbook = XLSX.read(dataArr, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (json.length < 2) {
          toast.error("Planilha vazia ou sem cabeçalhos.");
          return;
        }

        const headers = json[0].map((h) => String(h).trim().toLowerCase());
        const dataRows = json.slice(1);

        const idxDescricao = headers.indexOf("descrição") !== -1 ? headers.indexOf("descrição") : headers.indexOf("descricao");
        const idxValor = headers.indexOf("valor") !== -1 ? headers.indexOf("valor") : headers.indexOf("valor total");
        const idxVencimento = headers.indexOf("vencimento") !== -1 ? headers.indexOf("vencimento") : headers.indexOf("data vencimento");
        const idxObra = headers.indexOf("obra");
        const idxFornecedor = headers.indexOf("fornecedor");
        const idxStatus = headers.indexOf("status");
        const idxObservacoes = headers.indexOf("observações") !== -1 ? headers.indexOf("observações") : headers.indexOf("observacoes");

        if (idxDescricao === -1 || idxValor === -1 || idxVencimento === -1) {
          toast.error(`Colunas obrigatórias não encontradas. Cabeçalhos detectados: ${headers.join(", ")}`);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        let countSuccess = 0;
        let countError = 0;
        let firstErrorMsg = "";

        for (const row of dataRows) {
          if (!row || row.length === 0) continue;

          const descricao = String(row[idxDescricao] ?? "").trim();
          const rawValor = Number(row[idxValor] ?? 0);
          const rawVenc = row[idxVencimento];

          if (!descricao || isNaN(rawValor) || rawVenc === undefined || rawVenc === null || rawVenc === "") {
            countError++;
            continue;
          }

          const valor_total = Math.round(rawValor * 100);

          // Converter data: suporta número serial do Excel, dd/mm/yyyy e yyyy-mm-dd
          let data_vencimento: string;
          if (typeof rawVenc === "number") {
            const excelEpoch = new Date(1899, 11, 30);
            const d = new Date(excelEpoch.getTime() + rawVenc * 86400000);
            data_vencimento = d.toISOString().slice(0, 10);
          } else {
            const s = String(rawVenc).trim();
            if (s.includes("/")) {
              const parts = s.split("/");
              data_vencimento = parts.length === 3
                ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
                : s;
            } else {
              data_vencimento = s.length > 10 ? s.slice(0, 10) : s;
            }
          }

          let obra_id = null;
          if (idxObra !== -1 && row[idxObra]) {
            const valObra = String(row[idxObra]).trim().toLowerCase();
            const matchedObra = (obras ?? []).find(
              (o) =>
                o.numero.toLowerCase() === valObra ||
                o.nome.toLowerCase().includes(valObra)
            );
            if (matchedObra) obra_id = matchedObra.id;
          }

          let fornecedor_id = null;
          if (idxFornecedor !== -1 && row[idxFornecedor]) {
            const valForn = String(row[idxFornecedor]).trim().toLowerCase();
            const matchedForn = (fornecedores ?? []).find((f) =>
              f.razao_social.toLowerCase().includes(valForn)
            );
            if (matchedForn) fornecedor_id = matchedForn.id;
          }

          const status = idxStatus !== -1 && row[idxStatus]
            ? String(row[idxStatus]).trim().toLowerCase()
            : "aberta";

          const observacoes = idxObservacoes !== -1 && row[idxObservacoes]
            ? String(row[idxObservacoes]).trim()
            : null;

          const payload: Record<string, any> = {
            descricao,
            valor_total,
            data_vencimento,
            status: ["aberta", "paga", "atrasada", "cancelada"].includes(status) ? status : "aberta",
            observacoes,
            ...(obra_id ? { obra_id } : {}),
            ...(fornecedor_id ? { fornecedor_id } : {}),
            ...(user?.id ? { created_by: user.id } : {}),
          };

          const { error } = await (supabase as any).from("contas_pagar").insert(payload);
          if (error) {
            console.warn("Erro ao importar conta a pagar:", error.message, payload);
            if (!firstErrorMsg) firstErrorMsg = error.message;
            countError++;
          } else {
            countSuccess++;
          }
        }

        if (countSuccess > 0) {
          toast.success(`Importação concluída: ${countSuccess} lançados, ${countError} falhas.`);
          qc.invalidateQueries({ queryKey: ["contas_pagar"] });
        } else if (firstErrorMsg) {
          toast.error(`Falha ao importar: ${firstErrorMsg}`);
        } else {
          toast.warning(`Nenhum registro importado (${countError} linhas inválidas).`);
        }
      } catch (err) {
        toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardKpi
          label="A Receber (Este Mês)"
          value={fmtBRL(kpis.aReceberMes)}
          icon={TrendingUp}
          className="text-green-600 border-green-100 bg-green-50/20"
        />
        <CardKpi
          label="A Pagar (Este Mês)"
          value={fmtBRL(kpis.aPagarMes)}
          icon={TrendingDown}
          className="text-red-600 border-red-100 bg-red-50/20"
        />
        <CardKpi
          label="Saldo Projetado (Mês)"
          value={fmtBRL(kpis.saldoProjetado)}
          icon={DollarSign}
          className={cn(
            "border-blue-100 bg-blue-50/20",
            kpis.saldoProjetado >= 0 ? "text-blue-600" : "text-amber-600"
          )}
        />
        <CardKpi
          label="Títulos em Atraso (Total)"
          value={fmtBRL(kpis.atrasado)}
          icon={AlertTriangle}
          className="text-destructive border-red-200 bg-red-100/10 animate-pulse"
        />
      </div>

      {/* Global Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-lg border bg-card/60 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Search className="size-4" /> Filtrar por Obra:
            </div>
            <Select value={filtroObra} onValueChange={(val) => { setFiltroObra(val); setFiltroEtapa("todos"); }}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Todas as obras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as obras</SelectItem>
                <SelectItem value="none">Sem vínculo (Geral)</SelectItem>
                {obras?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.numero} — {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Origem:
            </div>
            {scopedOrigin ? (
              <Badge variant="outline" className="h-9 px-3">
                {scopedOrigin === "imobiliaria" ? "Financeiro Imobiliária" : "Financeiro Civil"}
              </Badge>
            ) : (
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os Lançamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Lançamentos</SelectItem>
                  <SelectItem value="erp">Apenas Obras / ERP</SelectItem>
                  <SelectItem value="imobiliaria">Apenas Imobiliária</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {activeTab === "receber" && (
            <>
              <Button onClick={handleExportReceberExcel} variant="outline" className="gap-2">
                <Download className="size-4" /> Exportar Excel
              </Button>
              {podeEditar && (
                <>
                  <label className="cursor-pointer">
                    <Button variant="outline" className="gap-2 pointer-events-none">
                      <Upload className="size-4" /> Importar Planilha
                    </Button>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportReceberExcel} />
                  </label>
                  <Button
                    onClick={() => {
                      setReceberEditTarget(null);
                      setReceberFormOpen(true);
                    }}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95"
                  >
                    <Plus className="size-4" /> Nova Receita
                  </Button>
                </>
              )}
            </>
          )}
          {activeTab === "pagar" && (
            <>
              <Button onClick={handleExportPagarExcel} variant="outline" className="gap-2">
                <Download className="size-4" /> Exportar Excel
              </Button>
              {podeEditar && (
                <>
                  <label className="cursor-pointer">
                    <Button variant="outline" className="gap-2 pointer-events-none">
                      <Upload className="size-4" /> Importar Planilha
                    </Button>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportPagarExcel} />
                  </label>
                  <Button
                    onClick={() => {
                      setPagarEditTarget(null);
                      setPagarFormOpen(true);
                    }}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95"
                  >
                    <Plus className="size-4" /> Nova Despesa
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Primary Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 max-w-[850px]">
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
          <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="dre">DRE Simplificado</TabsTrigger>
          <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
        </TabsList>

        {/* CONTAS A RECEBER TAB */}
        <TabsContent value="receber" className="space-y-4">
          {/* Aging metrics widget */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg border bg-card">
            <div className="text-center p-2 rounded bg-muted/40">
              <div className="text-xs text-muted-foreground">A Vencer</div>
              <div className="text-sm font-semibold font-mono">{fmtBRL(agingReceber.aVencer)}</div>
            </div>
            <div className="text-center p-2 rounded bg-blue-50/30 text-blue-600">
              <div className="text-xs">Vence Hoje</div>
              <div className="text-sm font-semibold font-mono">{fmtBRL(agingReceber.venceHoje)}</div>
            </div>
            <div className="text-center p-2 rounded bg-amber-50/30 text-amber-600">
              <div className="text-xs">Atrasado (1-30d)</div>
              <div className="text-sm font-semibold font-mono">{fmtBRL(agingReceber.atrasado1_30)}</div>
            </div>
            <div className="text-center p-2 rounded bg-orange-50/30 text-orange-600">
              <div className="text-xs">Atrasado (31-60d)</div>
              <div className="text-sm font-semibold font-mono">{fmtBRL(agingReceber.atrasado31_60)}</div>
            </div>
            <div className="text-center p-2 rounded bg-red-50/30 text-red-600">
              <div className="text-xs">Atrasado (60d+)</div>
              <div className="text-sm font-semibold font-mono">{fmtBRL(agingReceber.atrasado61_plus)}</div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Tabs
              value={filtroStatusReceber}
              onValueChange={setFiltroStatusReceber}
              className="w-auto"
            >
              <TabsList className="scale-90 origin-left">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="aberta">Abertas</TabsTrigger>
                <TabsTrigger value="recebida">Recebidas</TabsTrigger>
                <TabsTrigger value="atrasada">Atrasadas</TabsTrigger>
                <TabsTrigger value="cancelada">Canceladas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCR ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : filtradosReceber.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <DollarSign className="size-8 mx-auto mb-2 opacity-30" />
                      Nenhuma conta a receber encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradosReceber.map((cr) => (
                    <TableRow key={cr.id}>
                      <TableCell>
                        <div className="font-medium">{cr.descricao}</div>
                        {cr.observacoes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {cr.observacoes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {cr.obra_id ? obrasMap[cr.obra_id] || "Obra Desconhecida" : "Sem vínculo"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {cr.origem === "imobiliaria"
                          ? imobClientesMap[cr.imob_cliente_id || ""] || "—"
                          : clientesMap[cr.cliente_id || ""] || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cr.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(STATUS_RECEBER_BADGE[cr.status])}>
                          {STATUS_RECEBER_LABEL[cr.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-700">
                        <div>{fmtBRL(cr.valor_total + (cr.valor_aditivo || 0))}</div>
                        {cr.valor_aditivo > 0 && (
                          <div className="text-[10px] font-normal text-muted-foreground">
                            Previsto {fmtBRL(cr.valor_total)} + aditivo {fmtBRL(cr.valor_aditivo)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {cr.nota_fiscal_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Visualizar Nota Fiscal"
                              onClick={() => handleOpenComprovante(cr.nota_fiscal_url!)}
                            >
                              <FileText className="size-4" />
                            </Button>
                          )}
                          {cr.comprovante_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Visualizar Comprovante"
                              onClick={() => handleOpenComprovante(cr.comprovante_url!)}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="Emitir Recibo de Recebimento"
                            onClick={() => {
                              const nomeCli = cr.cliente_id ? clientesMap[cr.cliente_id] : cr.imob_cliente_id ? imobClientesMap[cr.imob_cliente_id] : (cr as any).cliente_nome;
                              setReciboTarget({
                                id: cr.id,
                                tipo: "receber",
                                descricao: cr.descricao,
                                obra_id: cr.obra_id,
                                obra_nome: cr.obra_id ? obrasMap[cr.obra_id] : undefined,
                                cliente_id: cr.cliente_id || cr.imob_cliente_id,
                                cliente_nome: nomeCli,
                                valor_total: cr.valor_total,
                                valor_liquidado: cr.valor_recebido,
                                data_vencimento: cr.data_vencimento,
                                data_liquidacao: cr.data_recebimento,
                                forma_pagamento: cr.forma_pagamento,
                                numero_documento: cr.numero_documento,
                                etapa_nome: cr.etapa_nome,
                                parcela_atual: cr.parcela_atual,
                                total_parcelas: cr.total_parcelas,
                              });
                              setReciboModalOpen(true);
                            }}
                          >
                            <Printer className="size-4" />
                          </Button>
                          {podeEditar && cr.status !== "recebida" && cr.status !== "cancelada" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-green-700 hover:text-green-800 hover:bg-green-50"
                              title="Registrar recebimento"
                              onClick={() => openReceberStatusModal(cr)}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          )}
                          {podeEditar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              title="Editar"
                              onClick={() => {
                                setReceberEditTarget(cr);
                                setReceberFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-red-50"
                              title="Excluir"
                              onClick={() => setDeleteReceberId(cr.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* CONTAS A PAGAR TAB */}
        <TabsContent value="pagar" className="space-y-4">
          <div className="flex justify-between items-center">
            <Tabs value={filtroStatusPagar} onValueChange={setFiltroStatusPagar} className="w-auto">
              <TabsList className="scale-90 origin-left">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="aberta">Abertas</TabsTrigger>
                <TabsTrigger value="paga">Pagas</TabsTrigger>
                <TabsTrigger value="atrasada">Atrasadas</TabsTrigger>
                <TabsTrigger value="cancelada">Canceladas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Obra / Fornecedor</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCP ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : filtradosPagar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <DollarSign className="size-8 mx-auto mb-2 opacity-30" />
                      Nenhuma conta a pagar encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradosPagar.map((cp) => (
                    <TableRow key={cp.id}>
                      <TableCell>
                        <div className="font-medium">{cp.descricao}</div>
                        {cp.observacoes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {cp.observacoes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {cp.obra_id ? obrasMap[cp.obra_id] || "—" : "Despesa Administrativa"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cp.origem === "imobiliaria"
                            ? `Inquilino/Proprietário: ${imobClientesMap[cp.imob_cliente_id || ""] || "—"}`
                            : cp.fornecedor_id ? fornecedoresMap[cp.fornecedor_id] || "—" : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {cp.pedido_id ? (
                          <span className="font-mono text-xs underline">
                            {pedidosMap[cp.pedido_id]}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(cp.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(STATUS_PAGAR_BADGE[cp.status])}>
                          {STATUS_PAGAR_LABEL[cp.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-red-700">
                        {fmtBRL(cp.valor_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {cp.nota_fiscal_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Visualizar Nota Fiscal"
                              onClick={() => handleOpenComprovante(cp.nota_fiscal_url!)}
                            >
                              <FileText className="size-4" />
                            </Button>
                          )}
                          {cp.comprovante_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Visualizar Comprovante"
                              onClick={() => handleOpenComprovante(cp.comprovante_url!)}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="Emitir Comprovante de Quitação"
                            onClick={() => {
                              const nomeForn = cp.fornecedor_id ? fornecedoresMap[cp.fornecedor_id] : (cp as any).fornecedor_nome;
                              setReciboTarget({
                                id: cp.id,
                                tipo: "pagar",
                                descricao: cp.descricao,
                                obra_id: cp.obra_id,
                                obra_nome: cp.obra_id ? obrasMap[cp.obra_id] : undefined,
                                fornecedor_id: cp.fornecedor_id,
                                fornecedor_nome: nomeForn,
                                valor_total: cp.valor_total,
                                valor_liquidado: cp.valor_pago,
                                data_vencimento: cp.data_vencimento,
                                data_liquidacao: cp.data_pagamento,
                                forma_pagamento: cp.forma_pagamento,
                                numero_documento: cp.numero_documento,
                                etapa_nome: cp.etapa_nome,
                                parcela_atual: cp.parcela_atual,
                                total_parcelas: cp.total_parcelas,
                              });
                              setReciboModalOpen(true);
                            }}
                          >
                            <Printer className="size-4" />
                          </Button>
                          {podeEditar && cp.status !== "paga" && cp.status !== "cancelada" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-green-700 hover:text-green-800 hover:bg-green-50"
                              title="Registrar pagamento"
                              onClick={() => openPagarStatusModal(cp)}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          )}
                          {podeEditar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              title="Editar"
                              onClick={() => {
                                setPagarEditTarget(cp);
                                setPagarFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-red-50"
                              title="Excluir"
                              onClick={() => setDeletePagarId(cp.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* FLUXO DE CAIXA TAB */}
        <TabsContent value="fluxo" className="space-y-4">
          <FluxoCaixaAvancado
            contasReceber={contasReceber || []}
            contasPagar={contasPagar || []}
            contasBancarias={bankAccountsList.map((b: any) => ({
              id: b.id,
              nome_conta: b.nome,
              banco: b.banco || b.tipo,
              saldo_atual_centavos: b.saldoAtual,
            }))}
            obras={obras || []}
          />
        </TabsContent>

        {/* CONCILIACAO TAB */}
        <TabsContent value="conciliacao" className="space-y-4">
          <Card>
            <CardHeader className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Conciliação Bancária</CardTitle>
                <p className="text-xs text-muted-foreground">Marque os lançamentos compensados no extrato ou importe via OFX.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setOfxModalOpen(true)}
                >
                  <Upload className="size-4" /> Importar Extrato OFX
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...(contasReceberFiltradas ?? []).filter(c => c.status === "recebida").map(c => ({ ...c, type: "receita" as const })),
                    ...(contasPagarFiltradas ?? []).filter(c => c.status === "paga").map(c => ({ ...c, type: "despesa" as const }))
                  ]
                    .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento))
                    .map((item) => {
                      const contaNome = contasBancarias?.find((cb: any) => cb.id === (item as any).conta_bancaria_id)?.nome || "Caixa Geral";
                      const dataItem = (item as any).data_recebimento || (item as any).data_pagamento || item.data_vencimento;
                      const valorItem = (item as any).valor_recebido || (item as any).valor_pago || item.valor_total;
                      const isConciliado = Boolean((item as any).conciliado);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{dataItem}</TableCell>
                          <TableCell className="text-xs font-mono">{(item as any).numero_documento || "—"}</TableCell>
                          <TableCell className="text-xs font-medium">
                            <span className={cn("inline-block w-2 h-2 rounded-full mr-2", item.type === "receita" ? "bg-green-500" : "bg-red-500")} />
                            {item.descricao}
                          </TableCell>
                          <TableCell className="text-xs">{contaNome}</TableCell>
                          <TableCell className={cn("text-right text-xs font-mono font-bold", item.type === "receita" ? "text-green-700" : "text-red-700")}>
                            {item.type === "receita" ? "+" : "-"}{fmtBRL(valorItem)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={isConciliado ? "default" : "outline"}
                              className="h-7 text-[10px] px-2.5"
                              onClick={() => toggleConciliado(item.id, item.type === "receita" ? "contas_receber" : "contas_pagar", isConciliado)}
                            >
                              {isConciliado ? "Conciliado" : "Pendente"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {((contasReceberFiltradas ?? []).filter(c => c.status === "recebida").length === 0 &&
                    (contasPagarFiltradas ?? []).filter(c => c.status === "paga").length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Nenhum lançamento pago/recebido para conciliação.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRE TAB */}
        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Demonstrativo do Resultado do Exercício (DRE)</CardTitle>
              <p className="text-xs text-muted-foreground">Visão geral simplificada baseada em lançamentos efetivamente realizados (regime de caixa).</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-green-700 border-b pb-1">1. RECEITAS OPERACIONAIS</h4>
                <div className="pl-4 space-y-1">
                  {dreReport.receitas.map((r, i) => (
                    <div key={i} className="flex justify-between text-xs font-mono">
                      <span>{r.name}</span>
                      <span className="text-green-700 font-semibold">{fmtBRL(r.value)}</span>
                    </div>
                  ))}
                  {dreReport.receitas.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">Nenhuma receita registrada no período</div>
                  )}
                </div>
                <div className="flex justify-between text-xs font-bold pt-1 border-t">
                  <span>TOTAL DE RECEITAS</span>
                  <span className="text-green-800">{fmtBRL(dreReport.totalReceitas)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-red-700 border-b pb-1">2. CUSTOS E DESPESAS</h4>
                <div className="pl-4 space-y-1">
                  {dreReport.despesas.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs font-mono">
                      <span>{d.name}</span>
                      <span className="text-red-700 font-semibold">{fmtBRL(d.value)}</span>
                    </div>
                  ))}
                  {dreReport.despesas.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">Nenhum custo ou despesa registrada no período</div>
                  )}
                </div>
                <div className="flex justify-between text-xs font-bold pt-1 border-t">
                  <span>TOTAL DE CUSTOS/DESPESAS</span>
                  <span className="text-red-800">{fmtBRL(dreReport.totalDespesas)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-double border-t-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>RESULTADO LÍQUIDO DO PERÍODO</span>
                  <span className={cn(dreReport.resultado >= 0 ? "text-green-800" : "text-red-800")}>
                    {fmtBRL(dreReport.resultado)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTAS BANCARIAS TAB */}
        <TabsContent value="contas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-muted-foreground">Contas & Locais Disponíveis</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTransferenciaModalOpen(true)}>
                <ArrowRightLeft className="size-4" /> Transferência Interna
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCategoriaFormOpen(true)}>
                <Plus className="size-4" /> Nova Categoria DRE
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setBancoFormOpen(true)}>
                <Plus className="size-4" /> Nova Conta / Local
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccountsList.map((acc: any) => (
              <Card key={acc.id} className="relative overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">{acc.nome}</CardTitle>
                  <span className="text-[10px] uppercase text-muted-foreground font-mono">{acc.tipo}</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold font-mono text-primary">{fmtBRL(acc.saldoAtual)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Saldo Inicial: {acc.saldo_inicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* DRE Categories Listing */}
          <Card className="mt-6">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-bold">Árvore de Categorias DRE Cadastradas</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pertence à Categoria Pai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriasFinanceiras?.map((cat: any) => {
                    const paiNome = categoriasFinanceiras?.find((p: any) => p.id === cat.parent_id)?.nome || "Raiz";
                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="text-xs font-semibold">{cat.nome}</TableCell>
                        <TableCell className="text-xs capitalize">
                          <Badge variant={cat.tipo === "receita" ? "default" : "secondary"} className="text-[9px] h-4">
                            {cat.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{paiNome}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: NOVO BANCO */}
      <Dialog open={bancoFormOpen} onOpenChange={setBancoFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Conta / Local Financeiro</DialogTitle>
            <DialogDescription>Cadastre contas correntes, caixas internos ou carteiras de aplicação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome da Conta / Local</label>
              <Input placeholder="Ex: Itaú Empresa, Caixa de Obra..." value={bancoNome} onChange={(e) => setBancoNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Tipo</label>
              <Select value={bancoTipo} onValueChange={(val: any) => setBancoTipo(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Conta Poupança</SelectItem>
                  <SelectItem value="aplicacao">Aplicação Financeira</SelectItem>
                  <SelectItem value="caixa_interno">Caixa Físico Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Saldo Inicial (R$)</label>
              <Input type="number" step="0.01" value={bancoSaldoInicial} onChange={(e) => setBancoSaldoInicial(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBancoFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createBancoMutation.mutate()} disabled={createBancoMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: NOVA CATEGORIA */}
      <Dialog open={categoriaFormOpen} onOpenChange={setCategoriaFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Categoria de Fluxo / DRE</DialogTitle>
            <DialogDescription>Cadastre rubricas contábeis para classificar lançamentos do DRE.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome da Categoria</label>
              <Input placeholder="Ex: Aluguel, Pro-labore, Vendas de Serviços..." value={categoriaNome} onChange={(e) => setCategoriaNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Tipo</label>
              <Select value={categoriaTipo} onValueChange={(val: any) => setCategoriaTipo(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa / Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoria Pai (Subordinação)</label>
              <Select value={categoriaPaiId || "none"} onValueChange={(val) => setCategoriaPaiId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma (Categoria Raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Categoria Raiz)</SelectItem>
                  {categoriasFinanceiras?.filter((c: any) => !c.parent_id).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createCategoriaMutation.mutate()} disabled={createCategoriaMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REGISTRO DE RECEBIMENTO DIALOG */}
      <Dialog open={!!receivedTarget} onOpenChange={(o) => !o && setReceivedTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
            <DialogDescription>
              Confirme os dados de entrada para a conta a receber.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Data do Pagamento</label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={receivedPaymentMethod} onValueChange={(value) => setReceivedPaymentMethod(value as FormaPagamentoReceita)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMA_PAGAMENTO_RECEITA_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Total Real Recebido (R$)</label>
              <Input
                type="text"
                value={formatBRLInput(receivedVal)}
                readOnly
                className="bg-muted font-semibold"
              />
              <p className="mt-1 text-xs text-muted-foreground">Valor previsto + aditivo.</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Comprovante de Recebimento</label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.zip"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files[0]) {
                    setReceivedFile(files[0]);
                  }
                }}
              />
              <span className="text-xs text-muted-foreground mt-1 block">
                Opcional. Tipos permitidos: PDF, Imagens, ZIP.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivedTarget(null)} disabled={uploadingReceived}>
              Cancelar
            </Button>
            <Button onClick={submitRecebimento} disabled={uploadingReceived}>
              {uploadingReceived ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                "Confirmar Recebimento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REGISTRO DE PAGAMENTO DIALOG */}
      <Dialog open={!!paidTarget} onOpenChange={(o) => !o && setPaidTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Insira a data, o valor pago e anexe o comprovante se disponível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Data do Pagamento</label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Valor Pago (R$)</label>
              <Input
                type="text"
                value={formatBRLInput(paidVal)}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const cleanDigits = rawVal.replace(/\D/g, "");
                  if (!cleanDigits) {
                    setPaidVal(0);
                    return;
                  }
                  const val = parseInt(cleanDigits, 10) / 100;
                  setPaidVal(val);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Comprovante de Pagamento</label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.zip"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files[0]) {
                    setPaidFile(files[0]);
                  }
                }}
              />
              <span className="text-xs text-muted-foreground mt-1 block">
                Opcional. Tipos permitidos: PDF, Imagens, ZIP.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidTarget(null)} disabled={uploadingPaid}>
              Cancelar
            </Button>
            <Button onClick={submitPagamento} disabled={uploadingPaid}>
              {uploadingPaid ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                "Confirmar Pagamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FORM DIALOG: CONTAS RECEBER */}
      <ReceberFormDialog
        open={receberFormOpen}
        onOpenChange={setReceberFormOpen}
        target={receberEditTarget}
        obras={obras ?? []}
        clientes={clientes ?? []}
        origem={receberEditTarget?.origem ?? (filtroOrigem === "imobiliaria" ? "imobiliaria" : "erp")}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["contas_receber"] })}
      />

      {/* FORM DIALOG: CONTAS PAGAR */}
      <PagarFormDialog
        open={pagarFormOpen}
        onOpenChange={setPagarFormOpen}
        target={pagarEditTarget}
        obras={obras ?? []}
        fornecedores={fornecedores ?? []}
        pedidos={pedidos ?? []}
        origem={pagarEditTarget?.origem ?? (filtroOrigem === "imobiliaria" ? "imobiliaria" : "erp")}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["contas_pagar"] })}
      />

      {/* ALERTS DE EXCLUSÃO */}
      <AlertDialog
        open={!!deleteReceberId}
        onOpenChange={(o) => !o && setDeleteReceberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteReceberId) deleteReceberMutation.mutate(deleteReceberId);
                setDeleteReceberId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePagarId} onOpenChange={(o) => !o && setDeletePagarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletePagarId) deletePagarMutation.mutate(deletePagarId);
                setDeletePagarId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE EMISSÃO DE RECIBO FINANCEIRO */}
      <ReciboFinanceiroDialog
        open={reciboModalOpen}
        onOpenChange={setReciboModalOpen}
        conta={reciboTarget}
      />

      {/* DIALOG DE TRANSFERÊNCIA BANCÁRIA INTERNA */}
      <TransferenciaFormDialog
        open={transferenciaModalOpen}
        onOpenChange={setTransferenciaModalOpen}
        contasBancarias={contasBancarias || []}
      />

      {/* DIALOG DE CONCILIAÇÃO BANCÁRIA OFX */}
      <ConciliacaoOfxDialog
        open={ofxModalOpen}
        onOpenChange={setOfxModalOpen}
        contasBancarias={contasBancarias || []}
        contasReceber={contasReceber || []}
        contasPagar={contasPagar || []}
      />
    </div>
  );
}

function CardKpi({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon: any;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <Icon className="size-4" />
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}

// FORM DIALOG CONTAS A RECEBER
function ReceberFormDialog({
  open,
  onOpenChange,
  target,
  obras,
  clientes,
  origem,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ContaReceberRow | null;
  obras: { id: string; numero: string; nome: string; cliente_id: string }[];
  clientes: { id: string; nome: string }[];
  origem: "erp" | "imobiliaria";
  onSuccess: () => void;
}) {
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias-opt"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, nome").eq("ativo", true);
      return data || [];
    }
  });

  const { data: categoriasDre } = useQuery({
    queryKey: ["categorias-dre-opt"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("id, nome, tipo");
      return data || [];
    }
  });

  const form = useForm<any>({
    resolver: zodResolver(contasReceberSchema),
    defaultValues: EMPTY_RECEBER,
  });

  const watchObraId = form.watch("obra_id");
  const watchStatusReceita = form.watch("status");
  const watchValorPrevisto = Number(form.watch("valor_total") || 0);
  const watchValorAditivo = Number(form.watch("valor_aditivo") || 0);
  const watchTipoLancamento = form.watch("tipo_lancamento") || "a_vista";
  const watchQuantidadeParcelas = Number(form.watch("quantidade_parcelas") || 1);
  const totalRealRecebido = watchValorPrevisto + watchValorAditivo;

  const { data: etapasDaObra, isLoading: loadingEtapas } = useQuery({
    queryKey: ["etapas-obra-receber", watchObraId],
    queryFn: async () => {
      if (!watchObraId || watchObraId === "none") return [];
      const { data: orcamento } = await (supabase as any)
        .from("orcamentos")
        .select("id")
        .eq("obra_id", watchObraId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orcamento?.id) {
        const { data: etapas } = await (supabase as any)
          .from("orcamento_etapas")
          .select("id, codigo, nome, ordem")
          .eq("orcamento_id", orcamento.id)
          .order("ordem", { ascending: true });

        if (etapas && etapas.length > 0) return etapas;
      }

      const { data: crono } = await (supabase as any)
        .from("obra_cronograma")
        .select("id, nome, ordem")
        .eq("obra_id", watchObraId)
        .order("ordem", { ascending: true });

      return (crono || []).map((c: any) => ({
        id: c.id,
        codigo: null,
        nome: c.nome,
        ordem: c.ordem,
      }));
    },
    enabled: !!watchObraId && watchObraId !== "none",
  });

  useEffect(() => {
    if (!open) return;
    setNotaFile(null);
    setComprovanteFile(null);
    if (target) {
      form.reset({
        obra_id: target.obra_id || "",
        cliente_id: target.cliente_id || "",
        descricao: target.descricao,
        valor_total: target.valor_total / 100,
        valor_aditivo: (target.valor_aditivo || 0) / 100,
        data_vencimento: target.data_vencimento,
        status: target.status,
        data_recebimento: target.data_recebimento ?? "",
        valor_recebido: target.valor_recebido ? target.valor_recebido / 100 : 0,
        forma_pagamento: target.forma_pagamento || "",
        nota_fiscal_url: target.nota_fiscal_url ?? "",
        comprovante_url: target.comprovante_url ?? "",
        observacoes: target.observacoes ?? "",
        conta_bancaria_id: (target as any).conta_bancaria_id || "",
        categoria_dre_id: (target as any).categoria_dre_id || "",
        numero_documento: (target as any).numero_documento || "",
        etapa_id: target.etapa_id || "",
        etapa_nome: target.etapa_nome || "",
        tipo_lancamento: "a_vista" as const,
        quantidade_parcelas: 1,
        periodicidade_parcelas: "mensal" as const,
      });
    } else {
      form.reset(EMPTY_RECEBER);
    }
  }, [open, target, form]);

  const onSubmit = async (values: ContasReceberFormValues) => {
    try {
      let notaFiscalUrl = target?.nota_fiscal_url || "";
      let comprovanteUrl = target?.comprovante_url || "";

      if (notaFile) {
        notaFiscalUrl = await uploadR2(notaFile, "financeiro/notas");
      }
      if (comprovanteFile) {
        comprovanteUrl = await uploadR2(comprovanteFile, "financeiro/comprovantes");
      }

      const basePayload = {
        origem,
        obra_id: values.obra_id || null,
        cliente_id: values.cliente_id || null,
        valor_aditivo: Math.round((values.valor_aditivo || 0) * 100),
        status: values.status,
        data_recebimento: values.status === "recebida" ? values.data_recebimento || null : null,
        valor_recebido: values.status === "recebida" ? Math.round((values.valor_total + (values.valor_aditivo || 0)) * 100) : null,
        forma_pagamento: values.status === "recebida" ? values.forma_pagamento || null : null,
        nota_fiscal_url: notaFiscalUrl || null,
        comprovante_url: comprovanteUrl || null,
        observacoes: values.observacoes || null,
        conta_bancaria_id: values.conta_bancaria_id || null,
        categoria_dre_id: values.categoria_dre_id || null,
        numero_documento: values.numero_documento || null,
        etapa_id: values.etapa_id || null,
        etapa_nome: values.etapa_nome || null,
      };

      if (!target && values.tipo_lancamento === "parcelado" && Number(values.quantidade_parcelas) > 1) {
        const parcelas = gerarParcelasFinanceiras({
          valorTotalCentavos: Math.round(values.valor_total * 100),
          quantidadeParcelas: Number(values.quantidade_parcelas),
          dataPrimeiroVencimento: values.data_vencimento,
          periodicidade: values.periodicidade_parcelas || "mensal",
          descricaoBase: values.descricao,
        });

        const parcelamentoId = crypto.randomUUID();
        const rows = parcelas.map((p) => ({
          ...basePayload,
          descricao: p.descricao,
          valor_total: p.valorCentavos,
          data_vencimento: p.dataVencimento,
          parcelamento_id: parcelamentoId,
          parcela_atual: p.numero,
          total_parcelas: p.totalParcelas,
        }));

        const { error } = await (supabase as any).from("contas_receber").insert(rows);
        if (error) throw error;
        toast.success(`${parcelas.length} parcelas de receita geradas com sucesso!`);
      } else {
        const singlePayload = {
          ...basePayload,
          descricao: values.descricao,
          valor_total: Math.round(values.valor_total * 100),
          data_vencimento: values.data_vencimento,
          parcelamento_id: target?.parcelamento_id || null,
          parcela_atual: target?.parcela_atual || null,
          total_parcelas: target?.total_parcelas || null,
        };

        if (target) {
          const { error } = await (supabase as any)
            .from("contas_receber")
            .update(singlePayload)
            .eq("id", target.id);
          if (error) throw error;
          toast.success("Conta a receber atualizada");
        } else {
          const { error } = await (supabase as any).from("contas_receber").insert(singlePayload);
          if (error) throw error;
          toast.success("Conta a receber adicionada");
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar Receita" : "Nova Receita"}</DialogTitle>
          <DialogDescription>
            Registre o recebimento previsto da obra.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="obra_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Obra (Opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        const nextVal = val === "none" ? "" : val;
                        field.onChange(nextVal);
                        form.setValue("etapa_id", "");
                        form.setValue("etapa_nome", "");
                        const selectedObra = obras.find((o) => o.id === nextVal);
                        if (selectedObra?.cliente_id) {
                          form.setValue("cliente_id", selectedObra.cliente_id);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sem vínculo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem vínculo (Receita Geral)</SelectItem>
                        {obras.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.numero} — {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (Opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                      disabled={!!watchObraId && watchObraId !== "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem Cliente</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchObraId && watchObraId !== "none" && (
              <FormField
                control={form.control as any}
                name="etapa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Etapa do Orçamento / Cronograma (Apropriação)
                    </FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        const nextId = val === "none" ? "" : val;
                        field.onChange(nextId);
                        const match = etapasDaObra?.find((e: any) => e.id === nextId);
                        form.setValue("etapa_nome", match?.nome || "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingEtapas ? "Carregando etapas..." : "Selecione a etapa (opcional)"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Geral / Sem etapa específica</SelectItem>
                        {etapasDaObra?.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.codigo ? `${e.codigo} - ${e.nome}` : e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control as any}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control as any}
                name="valor_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Previsto (R$) *</FormLabel>
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
                )}
              />

              <FormField
                control={form.control as any}
                name="valor_aditivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aditivo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        value={formatBRLInput(field.value)}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/\D/g, "");
                          field.onChange(cleanDigits ? parseInt(cleanDigits, 10) / 100 : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Total Real Recebido</label>
                <Input value={formatBRLInput(totalRealRecebido)} readOnly className="bg-muted font-semibold text-green-700" />
                <p className="text-[10px] text-muted-foreground">Previsto + aditivo</p>
              </div>

              <FormField
                control={form.control as any}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!target && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Condição de Recebimento</span>
                  </div>
                  <div className="flex items-center gap-1 bg-background rounded-md p-0.5 border text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("tipo_lancamento", "a_vista");
                        form.setValue("quantidade_parcelas", 1);
                      }}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-medium transition-colors",
                        watchTipoLancamento !== "parcelado"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      À Vista (1x)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("tipo_lancamento", "parcelado");
                        if (!form.getValues("quantidade_parcelas") || form.getValues("quantidade_parcelas") <= 1) {
                          form.setValue("quantidade_parcelas", 2);
                        }
                      }}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-medium transition-colors",
                        watchTipoLancamento === "parcelado"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Parcelado
                    </button>
                  </div>
                </div>

                {watchTipoLancamento === "parcelado" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <FormField
                      control={form.control as any}
                      name="quantidade_parcelas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Número de Parcelas</FormLabel>
                          <Select
                            value={String(field.value || 2)}
                            onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-56">
                              {Array.from({ length: 59 }, (_, i) => i + 2).map((n) => {
                                const parcelaAprox = watchValorPrevisto > 0 ? (watchValorPrevisto / n) : 0;
                                return (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}x de {formatBRLInput(parcelaAprox)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control as any}
                      name="periodicidade_parcelas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Periodicidade</FormLabel>
                          <Select
                            value={field.value || "mensal"}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mensal">Mensal (a cada 30 dias)</SelectItem>
                              <SelectItem value="quinzenal">Quinzenal (a cada 15 dias)</SelectItem>
                              <SelectItem value="semanal">Semanal (a cada 7 dias)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col justify-center text-xs text-muted-foreground bg-background/60 rounded-md p-2 border">
                      <span className="font-medium text-foreground">
                        {watchQuantidadeParcelas}x de ~{formatBRLInput(watchValorPrevisto / (watchQuantidadeParcelas || 1))}
                      </span>
                      <span>Total: {formatBRLInput(watchValorPrevisto)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border bg-muted/20 p-3">
              <FormField control={form.control as any} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="recebida">Recebida</SelectItem>
                      <SelectItem value="atrasada">Atrasada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control as any} name="data_recebimento" render={({ field }) => (
                <FormItem><FormLabel>Data do Pagamento{watchStatusReceita === "recebida" ? " *" : ""}</FormLabel>
                  <FormControl><Input type="date" {...field} disabled={watchStatusReceita !== "recebida"} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="forma_pagamento" render={({ field }) => (
                <FormItem><FormLabel>Forma de Pagamento{watchStatusReceita === "recebida" ? " *" : ""}</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange} disabled={watchStatusReceita !== "recebida"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(FORMA_PAGAMENTO_RECEITA_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control as any}
                name="conta_bancaria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Bancária</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhuma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {contasBancarias?.map((cb: any) => (
                          <SelectItem key={cb.id} value={cb.id}>{cb.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="categoria_dre_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria DRE</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categoriasDre?.filter((c: any) => c.tipo === "receita_operacional" || c.tipo === "outras_receitas").map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="numero_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Documento / Cheque</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: NF-1234, CH-99" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nota Fiscal (Anexo)</label>
                <Input
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) setNotaFile(files[0]);
                  }}
                />
                {target?.nota_fiscal_url && (
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs p-0 h-auto text-blue-600 mt-1"
                    onClick={() => openR2File(target.nota_fiscal_url!)}
                  >
                    Visualizar Nota Existente
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comprovante de Pagamento</label>
                <Input
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) setComprovanteFile(files[0]);
                  }}
                />
                {target?.comprovante_url && (
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs p-0 h-auto text-blue-600 mt-1"
                    onClick={() => openR2File(target.comprovante_url!)}
                  >
                    Visualizar Comprovante Existente
                  </Button>
                )}
              </div>
            </div>

            <FormField
              control={form.control as any}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// FORM DIALOG CONTAS A PAGAR
function PagarFormDialog({
  open,
  onOpenChange,
  target,
  obras,
  fornecedores,
  pedidos,
  origem,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ContaPagarRow | null;
  obras: { id: string; numero: string; nome: string }[];
  fornecedores: { id: string; razao_social: string }[];
  pedidos: { id: string; numero: string; valor_total: number }[];
  origem: "erp" | "imobiliaria";
  onSuccess: () => void;
}) {
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias-opt-pag"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, nome").eq("ativo", true);
      return data || [];
    }
  });

  const { data: categoriasDre } = useQuery({
    queryKey: ["categorias-dre-opt-pag"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("id, nome, tipo");
      return data || [];
    }
  });

  const form = useForm<any>({
    resolver: zodResolver(contasPagarSchema),
    defaultValues: EMPTY_PAGAR,
  });

  const watchObraId = form.watch("obra_id");
  const watchTipoLancamento = form.watch("tipo_lancamento") || "a_vista";
  const watchQuantidadeParcelas = Number(form.watch("quantidade_parcelas") || 1);
  const watchValorTotal = Number(form.watch("valor_total") || 0);

  const { data: etapasDaObra, isLoading: loadingEtapas } = useQuery({
    queryKey: ["etapas-obra-pagar", watchObraId],
    queryFn: async () => {
      if (!watchObraId || watchObraId === "none") return [];
      const { data: orcamento } = await (supabase as any)
        .from("orcamentos")
        .select("id")
        .eq("obra_id", watchObraId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orcamento?.id) {
        const { data: etapas } = await (supabase as any)
          .from("orcamento_etapas")
          .select("id, codigo, nome, ordem")
          .eq("orcamento_id", orcamento.id)
          .order("ordem", { ascending: true });

        if (etapas && etapas.length > 0) return etapas;
      }

      const { data: crono } = await (supabase as any)
        .from("obra_cronograma")
        .select("id, nome, ordem")
        .eq("obra_id", watchObraId)
        .order("ordem", { ascending: true });

      return (crono || []).map((c: any) => ({
        id: c.id,
        codigo: null,
        nome: c.nome,
        ordem: c.ordem,
      }));
    },
    enabled: !!watchObraId && watchObraId !== "none",
  });

  useEffect(() => {
    if (!open) return;
    setNotaFile(null);
    setComprovanteFile(null);
    if (target) {
      form.reset({
        obra_id: target.obra_id || "",
        fornecedor_id: target.fornecedor_id || "",
        pedido_id: target.pedido_id || "",
        descricao: target.descricao,
        valor_total: target.valor_total / 100,
        data_vencimento: target.data_vencimento,
        status: target.status,
        data_pagamento: target.data_pagamento ?? "",
        valor_pago: target.valor_pago ? target.valor_pago / 100 : 0,
        nota_fiscal_url: target.nota_fiscal_url ?? "",
        comprovante_url: target.comprovante_url ?? "",
        observacoes: target.observacoes ?? "",
        conta_bancaria_id: (target as any).conta_bancaria_id || "",
        categoria_dre_id: (target as any).categoria_dre_id || "",
        numero_documento: (target as any).numero_documento || "",
        etapa_id: target.etapa_id || "",
        etapa_nome: target.etapa_nome || "",
        tipo_lancamento: "a_vista" as const,
        quantidade_parcelas: 1,
        periodicidade_parcelas: "mensal" as const,
      });
    } else {
      form.reset(EMPTY_PAGAR);
    }
  }, [open, target, form]);

  const onSubmit = async (values: ContasPagarFormValues) => {
    try {
      let notaFiscalUrl = target?.nota_fiscal_url || "";
      let comprovanteUrl = target?.comprovante_url || "";

      if (notaFile) {
        notaFiscalUrl = await uploadR2(notaFile, "financeiro/notas");
      }
      if (comprovanteFile) {
        comprovanteUrl = await uploadR2(comprovanteFile, "financeiro/comprovantes");
      }

      const basePayload = {
        origem,
        obra_id: values.obra_id || null,
        fornecedor_id: values.fornecedor_id || null,
        pedido_id: values.pedido_id || null,
        status: values.status,
        data_pagamento: values.data_pagamento || null,
        valor_pago: values.valor_pago ? Math.round(values.valor_pago * 100) : null,
        nota_fiscal_url: notaFiscalUrl || null,
        comprovante_url: comprovanteUrl || null,
        observacoes: values.observacoes || null,
        conta_bancaria_id: values.conta_bancaria_id || null,
        categoria_dre_id: values.categoria_dre_id || null,
        numero_documento: values.numero_documento || null,
        etapa_id: values.etapa_id || null,
        etapa_nome: values.etapa_nome || null,
      };

      if (!target && values.tipo_lancamento === "parcelado" && Number(values.quantidade_parcelas) > 1) {
        const parcelas = gerarParcelasFinanceiras({
          valorTotalCentavos: Math.round(values.valor_total * 100),
          quantidadeParcelas: Number(values.quantidade_parcelas),
          dataPrimeiroVencimento: values.data_vencimento,
          periodicidade: values.periodicidade_parcelas || "mensal",
          descricaoBase: values.descricao,
        });

        const parcelamentoId = crypto.randomUUID();
        const rows = parcelas.map((p) => ({
          ...basePayload,
          descricao: p.descricao,
          valor_total: p.valorCentavos,
          data_vencimento: p.dataVencimento,
          parcelamento_id: parcelamentoId,
          parcela_atual: p.numero,
          total_parcelas: p.totalParcelas,
        }));

        const { error } = await (supabase as any).from("contas_pagar").insert(rows);
        if (error) throw error;
        toast.success(`${parcelas.length} parcelas de despesa geradas com sucesso!`);
      } else {
        const singlePayload = {
          ...basePayload,
          descricao: values.descricao,
          valor_total: Math.round(values.valor_total * 100),
          data_vencimento: values.data_vencimento,
          parcelamento_id: target?.parcelamento_id || null,
          parcela_atual: target?.parcela_atual || null,
          total_parcelas: target?.total_parcelas || null,
        };

        if (target) {
          const { error } = await (supabase as any)
            .from("contas_pagar")
            .update(singlePayload)
            .eq("id", target.id);
          if (error) throw error;
          toast.success("Conta a pagar atualizada");
        } else {
          const { error } = await (supabase as any).from("contas_pagar").insert(singlePayload);
          if (error) throw error;
          toast.success("Conta a pagar adicionada");
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          <DialogDescription>
            Registre a conta a pagar ou despesa administrativa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="obra_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Obra (Opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        const nextVal = val === "none" ? "" : val;
                        field.onChange(nextVal);
                        form.setValue("etapa_id", "");
                        form.setValue("etapa_nome", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sem vínculo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Despesa Administrativa</SelectItem>
                        {obras.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.numero} — {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="fornecedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor (Opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem Fornecedor</SelectItem>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {watchObraId && watchObraId !== "none" && (
              <FormField
                control={form.control as any}
                name="etapa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Etapa do Orçamento / Cronograma (Apropriação de Custo)
                    </FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        const nextId = val === "none" ? "" : val;
                        field.onChange(nextId);
                        const match = etapasDaObra?.find((e: any) => e.id === nextId);
                        form.setValue("etapa_nome", match?.nome || "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingEtapas ? "Carregando etapas..." : "Selecione a etapa da obra (opcional)"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Geral / Sem etapa específica</SelectItem>
                        {etapasDaObra?.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.codigo ? `${e.codigo} - ${e.nome}` : e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="pedido_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pedido de Compra (Opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        field.onChange(val === "none" ? "" : val);
                        if (val !== "none") {
                          const p = pedidos.find((item) => item.id === val);
                          if (p) {
                            form.setValue("valor_total", p.valor_total / 100);
                          }
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem Pedido</SelectItem>
                        {pedidos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            Pedido #{p.numero} (R$ {(p.valor_total / 100).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="valor_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Previsto (R$) *</FormLabel>
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
                )}
              />

              <FormField
                control={form.control as any}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!target && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Condição de Pagamento</span>
                  </div>
                  <div className="flex items-center gap-1 bg-background rounded-md p-0.5 border text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("tipo_lancamento", "a_vista");
                        form.setValue("quantidade_parcelas", 1);
                      }}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-medium transition-colors",
                        watchTipoLancamento !== "parcelado"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      À Vista (1x)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("tipo_lancamento", "parcelado");
                        if (!form.getValues("quantidade_parcelas") || form.getValues("quantidade_parcelas") <= 1) {
                          form.setValue("quantidade_parcelas", 2);
                        }
                      }}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-medium transition-colors",
                        watchTipoLancamento === "parcelado"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Parcelado
                    </button>
                  </div>
                </div>

                {watchTipoLancamento === "parcelado" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <FormField
                      control={form.control as any}
                      name="quantidade_parcelas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Número de Parcelas</FormLabel>
                          <Select
                            value={String(field.value || 2)}
                            onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-56">
                              {Array.from({ length: 59 }, (_, i) => i + 2).map((n) => {
                                const parcelaAprox = watchValorTotal > 0 ? (watchValorTotal / n) : 0;
                                return (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}x de {formatBRLInput(parcelaAprox)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control as any}
                      name="periodicidade_parcelas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Periodicidade</FormLabel>
                          <Select
                            value={field.value || "mensal"}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mensal">Mensal (a cada 30 dias)</SelectItem>
                              <SelectItem value="quinzenal">Quinzenal (a cada 15 dias)</SelectItem>
                              <SelectItem value="semanal">Semanal (a cada 7 dias)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col justify-center text-xs text-muted-foreground bg-background/60 rounded-md p-2 border">
                      <span className="font-medium text-foreground">
                        {watchQuantidadeParcelas}x de ~{formatBRLInput(watchValorTotal / (watchQuantidadeParcelas || 1))}
                      </span>
                      <span>Total: {formatBRLInput(watchValorTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control as any}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aberta">Aberta</SelectItem>
                        <SelectItem value="paga">Paga</SelectItem>
                        <SelectItem value="atrasada">Atrasada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="data_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Pagamento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="valor_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Pago (R$)</FormLabel>
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
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control as any}
                name="conta_bancaria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Bancária</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhuma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {contasBancarias?.map((cb: any) => (
                          <SelectItem key={cb.id} value={cb.id}>{cb.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="categoria_dre_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria DRE</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categoriasDre?.filter((c: any) => c.tipo !== "receita_operacional" && c.tipo !== "outras_receitas").map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="numero_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Documento / Boleto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: NF-1234, BOL-99" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nota Fiscal (Anexo)</label>
                <Input
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) setNotaFile(files[0]);
                  }}
                />
                {target?.nota_fiscal_url && (
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs p-0 h-auto text-blue-600 mt-1"
                    onClick={() => openR2File(target.nota_fiscal_url!)}
                  >
                    Visualizar Nota Existente
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comprovante de Pagamento</label>
                <Input
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) setComprovanteFile(files[0]);
                  }}
                />
                {target?.comprovante_url && (
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs p-0 h-auto text-blue-600 mt-1"
                    onClick={() => openR2File(target.comprovante_url!)}
                  >
                    Visualizar Comprovante Existente
                  </Button>
                )}
              </div>
            </div>

            <FormField
              control={form.control as any}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
