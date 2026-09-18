import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, Eye, Loader2, Calendar,
  ClipboardCheck, DollarSign, CalendarDays, Upload, FileText,
  Check, AlertCircle, TrendingUp, AlertTriangle, Printer
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { uploadR2, openR2File } from "@/lib/r2";
import {
  locacaoSchema,
  type LocacaoFormValues,
  GARANTIA_LOCACAO_LABEL,
  STATUS_LOCACAO_LABEL,
  STATUS_LOCACAO_BADGE,
} from "@/lib/imobiliaria.schema";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/imobiliaria/locacoes")({
  component: LocacoesPage,
});

interface LocacaoRow {
  id: string;
  contrato_numero: string;
  imovel_id: string;
  locatario_id: string;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  valor_aluguel: number;
  taxa_administracao_percentual: number;
  garantia_tipo: "caucao" | "fiador" | "seguro_fianca" | "sem_garantia";
  garantia_valor: number | null;
  fiador_id: string | null;
  tipo_contrato: "inicial" | "renovacao" | "rescisao";
  indice_reajuste: "ipca" | "igp_m" | "inpc" | "manual";
  status: "ativo" | "finalizado" | "rescindido";
  observacoes: string | null;
  imoveis: {
    codigo: string;
    titulo: string;
    tipo: "apartamento" | "casa" | "comercial" | "terreno";
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    imobiliaria_clientes: {
      nome: string;
      cpf_cnpj: string;
      email: string | null;
      celular: string | null;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
    } | null;
  } | null;
  imobiliaria_clientes: {
    nome: string;
    cpf_cnpj: string;
    email: string | null;
    celular: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
}

interface FaturaReceber {
  id: string;
  descricao: string;
  valor_total: number; // centavos
  data_vencimento: string;
  status: string;
  data_recebimento: string | null;
  valor_recebido: number | null;
}

interface FaturaPagar {
  id: string;
  descricao: string;
  valor_total: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
}

interface VistoriaRow {
  id: string;
  tipo: "entrada" | "saida" | "periodica";
  data_vistoria: string;
  status: "agendada" | "realizada" | "cancelada";
  responsavel: string;
  parecer_geral: string | null;
  fotos: string[];
}

interface VistoriaItemRow {
  id: string;
  item_categoria: string;
  item_nome: string;
  observacao: string | null;
  status: "pendente" | "ok" | "defeito" | "observacao";
  ordem: number;
}

const VISTORIA_CHECKLIST_CATEGORIAS = [
  { categoria: "estrutura", label: "Estrutura", itens: ["Paredes", "Teto", "Piso", "Portas", "Janelas", "Fechaduras"] },
  { categoria: "hidrossanitario", label: "Hidrossanitário", itens: ["Vazamentos", "Pressão água", "Vasos sanitários", "Pias", "Chuveiros", "Ralos"] },
  { categoria: "eletrico", label: "Elétrico", itens: ["Interruptores", "Tomadas", "Lâmpadas", "Disjuntores", "Tomadas 220V", "Aterramento"] },
  { categoria: "acabamento", label: "Acabamento", itens: ["Pintura", "Revestimentos", "Rodapés", "Espelhos", "Box", "Armários"] },
  { categoria: "externo", label: "Área Externa", itens: ["Fachada", "Varanda", "Garagem", "Jardim", "Cerca/Muro", "Portão"] },
] as const;

const EMPTY_FORM: LocacaoFormValues = {
  contrato_numero: "",
  imovel_id: "",
  locatario_id: "",
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  dia_vencimento: 10,
  valor_aluguel: 0,
  taxa_administracao_percentual: 0,
  garantia_tipo: "sem_garantia",
  garantia_valor: 0,
  fiador_id: null,
  tipo_contrato: "inicial",
  indice_reajuste: "manual",
  status: "ativo",
  observacoes: "",
};

const fmtBRL = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtBRLFromCents = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function LocacoesPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    roles.includes("admin") ||
    roles.includes("diretor") ||
    roles.includes("imobiliaria") ||
    roles.includes("financeiro_imobiliaria");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipoImovel, setFilterTipoImovel] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LocacaoRow | null>(null);
  const [viewTarget, setViewTarget] = useState<LocacaoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocacaoRow | null>(null);
  
  // Reajuste State
  const [reajusteTarget, setReajusteTarget] = useState<LocacaoRow | null>(null);
  const [reajusteValor, setReajusteValor] = useState<number>(0);
  const [reajusteAtualizarPendentes, setReajusteAtualizarPendentes] = useState<boolean>(true);
  const [reajusteIndice, setReajusteIndice] = useState<"ipca" | "igp_m" | "inpc" | "manual">("manual");

  // Vistorias Form State
  const [vistoriaFormOpen, setVistoriaFormOpen] = useState(false);
  const [vistoriaTipo, setVistoriaTipo] = useState<"entrada" | "saida" | "periodica">("entrada");
  const [vistoriaStatus, setVistoriaStatus] = useState<"agendada" | "realizada" | "cancelada">("agendada");
  const [vistoriaData, setVistoriaData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [vistoriaResponsavel, setVistoriaResponsavel] = useState<string>("");
  const [vistoriaParecer, setVistoriaParecer] = useState<string>("");
  const [vistoriaFotos, setVistoriaFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  // Checklist state
  const [vistoriaChecklist, setVistoriaChecklist] = useState<Record<string, { status: string; obs: string }>>({});

  // Print vistoria state
  const [printVistoriaTarget, setPrintVistoriaTarget] = useState<VistoriaRow | null>(null);

  // Details view active tab
  const [detailsTab, setDetailsTab] = useState("info");

  // Queries
  const { data: locacoes, isLoading } = useQuery({
    queryKey: ["locacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locacoes")
        .select(`
          id, contrato_numero, imovel_id, locatario_id, data_inicio, data_fim,
          dia_vencimento, valor_aluguel, taxa_administracao_percentual,
          garantia_tipo, garantia_valor, fiador_id, tipo_contrato, indice_reajuste,
          status, observacoes,
          imoveis (
            codigo, titulo, tipo, logradouro, numero, complemento, bairro, cidade, uf, cep,
            imobiliaria_clientes ( id, nome, cpf_cnpj, email, celular, logradouro, numero, complemento, bairro, cidade, uf, cep )
          ),
          imobiliaria_clientes ( nome, cpf_cnpj, email, celular, logradouro, numero, complemento, bairro, cidade, uf, cep )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar locações: " + error.message);
        throw error;
      }
      return (data ?? []) as unknown as LocacaoRow[];
    },
  });

  const { data: imoveisDisponiveis } = useQuery({
    queryKey: ["imoveis_disponiveis", editTarget?.id],
    queryFn: async () => {
      let query = supabase
        .from("imoveis")
        .select("id, codigo, titulo, valor_locacao")
        .is("deleted_at", null);

      if (editTarget) {
        query = query.or(`status.eq.disponivel,id.eq.${editTarget.imovel_id}`);
      } else {
        query = query.eq("status", "disponivel");
      }

      const { data, error } = await query.order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inquilinos } = useQuery({
    queryKey: ["imob_inquilinos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("id, nome")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fiadores } = useQuery({
    queryKey: ["imob_fiadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_fiadores")
        .select(`
          id, cliente_id, vinculo_tipo, renda_mensal, documento_vida,
          imobiliaria_clientes ( nome, cpf_cnpj )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f: any) => ({
        ...f,
        cliente_nome: f.imobiliaria_clientes?.nome,
        cliente_cpf_cnpj: f.imobiliaria_clientes?.cpf_cnpj,
      }));
    },
  });

  // Faturas a receber (Aluguéis)
  const { data: faturasReceber, refetch: refetchFaturasReceber } = useQuery({
    queryKey: ["faturas_receber_locacao", viewTarget?.id],
    queryFn: async () => {
      if (!viewTarget) return [];
      const { data, error } = await supabase
        .from("contas_receber")
        .select("id, descricao, valor_total, data_vencimento, status, data_recebimento, valor_recebido")
        .eq("imob_locacao_id", viewTarget.id)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaturaReceber[];
    },
    enabled: !!viewTarget,
  });

  // Faturas a pagar (Repasses aos Proprietários)
  const { data: faturasPagar, refetch: refetchFaturasPagar } = useQuery({
    queryKey: ["faturas_pagar_locacao", viewTarget?.id],
    queryFn: async () => {
      if (!viewTarget) return [];
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("id, descricao, valor_total, data_vencimento, status, data_pagamento, valor_pago")
        .eq("imob_locacao_id", viewTarget.id)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaturaPagar[];
    },
    enabled: !!viewTarget,
  });

  // Vistorias
  const { data: vistorias, refetch: refetchVistorias } = useQuery({
    queryKey: ["vistorias_locacao", viewTarget?.id],
    queryFn: async () => {
      if (!viewTarget) return [];
      const { data, error } = await supabase
        .from("imob_vistorias")
        .select("*")
        .eq("locacao_id", viewTarget.id)
        .is("deleted_at", null)
        .order("data_vistoria", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VistoriaRow[];
    },
    enabled: !!viewTarget,
  });

  const { data: printVistoriaItens = [], isLoading: loadingPrintVistoriaItens } = useQuery({
    queryKey: ["vistoria_itens_print", printVistoriaTarget?.id],
    queryFn: async () => {
      if (!printVistoriaTarget) return [];
      const { data, error } = await supabase
        .from("imob_vistorias_itens")
        .select("id,item_categoria,item_nome,observacao,status,ordem")
        .eq("vistoria_id", printVistoriaTarget.id)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VistoriaItemRow[];
    },
    enabled: !!printVistoriaTarget,
  });

  const filteredLocacoes = useMemo(() => {
    return (locacoes ?? []).filter((loc) => {
      if (filterStatus !== "all" && loc.status !== filterStatus) return false;
      if (filterTipoImovel !== "all" && (!loc.imoveis || loc.imoveis.tipo !== filterTipoImovel)) return false;
      if (search) {
        const s = search.toLowerCase();
        const searchBlob = `${loc.contrato_numero} ${loc.imoveis?.titulo ?? ""} ${loc.imoveis?.codigo ?? ""} ${loc.imoveis?.tipo ?? ""} ${loc.imobiliaria_clientes?.nome ?? ""}`.toLowerCase();
        if (!searchBlob.includes(s)) return false;
      }
      return true;
    });
  }, [locacoes, search, filterStatus, filterTipoImovel]);

  // Alertas de Vigência: Contratos expirando em 60 dias ou menos
  const alertasVigencia = useMemo(() => {
    if (!locacoes) return [];
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 60);

    return locacoes.filter((loc) => {
      if (loc.status !== "ativo" || !loc.data_fim) return false;
      const end = new Date(loc.data_fim + "T00:00:00");
      return end >= today && end <= limitDate;
    });
  }, [locacoes]);

  // Form setup
  const form = useForm<LocacaoFormValues>({
    resolver: zodResolver(locacaoSchema) as any,
    defaultValues: EMPTY_FORM as any,
  });

  const selectedImovelId = form.watch("imovel_id");

  // Autofill valor_aluguel from selected imovel
  useEffect(() => {
    if (selectedImovelId && !editTarget) {
      const im = imoveisDisponiveis?.find((item) => item.id === selectedImovelId);
      if (im && im.valor_locacao) {
        form.setValue("valor_aluguel", im.valor_locacao);
      }
    }
  }, [selectedImovelId, imoveisDisponiveis, editTarget]);

  // Create
  const handleCreate = () => {
    setEditTarget(null);
    form.reset(EMPTY_FORM);
    setFormOpen(true);
  };

  // Edit
  const handleEdit = async (loc: LocacaoRow) => {
    try {
      const { data, error } = await supabase
        .from("locacoes")
        .select("*")
        .eq("id", loc.id)
        .single();
      if (error) throw error;

      setEditTarget(loc);
      form.reset({
        contrato_numero: data.contrato_numero,
        imovel_id: data.imovel_id,
        locatario_id: data.locatario_id,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim ?? "",
        dia_vencimento: data.dia_vencimento,
        valor_aluguel: data.valor_aluguel,
        taxa_administracao_percentual: data.taxa_administracao_percentual,
        garantia_tipo: data.garantia_tipo as any,
        garantia_valor: data.garantia_valor ?? 0,
        fiador_id: data.fiador_id,
        tipo_contrato: data.tipo_contrato || "inicial",
        indice_reajuste: data.indice_reajuste || "manual",
        status: data.status as any,
        observacoes: data.observacoes ?? "",
      });
      setFormOpen(true);
    } catch (e: any) {
      toast.error("Erro ao carregar locação: " + e.message);
    }
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: locData, error: locErr } = await supabase
        .from("locacoes")
        .select("imovel_id")
        .eq("id", id)
        .single();
      if (locErr) throw locErr;

      const { error: delErr } = await supabase
        .from("locacoes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (delErr) throw delErr;

      // Restore property status to "disponível" so it reappears in the catalog
      if (locData?.imovel_id) {
        const { error: propErr } = await supabase
          .from("imoveis")
          .update({ status: "disponivel" })
          .eq("id", locData.imovel_id);
        if (propErr) throw propErr;
      }
    },
    onSuccess: () => {
      toast.success("Locação excluída — imóvel marcado como Disponível");
      qc.invalidateQueries({ queryKey: ["locacoes"] });
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao excluir locação: " + e.message);
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: LocacaoFormValues) => {
      const payload = {
        ...values,
        data_fim: values.data_fim || null,
        garantia_valor: values.garantia_valor || null,
        observacoes: values.observacoes || null,
        updated_at: new Date().toISOString(),
      };

      let locacaoId = "";
      if (editTarget) {
        const { error } = await supabase
          .from("locacoes")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
        locacaoId = editTarget.id;
      } else {
        const { data, error } = await supabase
          .from("locacoes")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        locacaoId = data.id;

        // Auto-update property status to 'alugado'
        await supabase
          .from("imoveis")
          .update({ status: "alugado" })
          .eq("id", values.imovel_id);
      }

      return { locacaoId, isNew: !editTarget, values };
    },
    onSuccess: async (res) => {
      toast.success(res.isNew ? "Contrato de locação ativado" : "Contrato atualizado");

      // Auto-generate installments for new contracts
      if (res.isNew) {
        handleAutoGenerateInstallments(res.locacaoId, res.values);
      }

      // Auto-create vistoria de saída when contract is finalized or rescinded
      const newStatus = res.values.status as string;
      if (!res.isNew && ["finalizado", "rescindido"].includes(newStatus)) {
        const imovelId = res.values.imovel_id || (viewTarget?.imovel_id ?? "");
        if (imovelId) {
          try {
            await supabase.from("imob_vistorias").insert({
              imovel_id: imovelId,
              locacao_id: res.locacaoId,
              tipo: "saida",
              status: "realizada",
              data_vistoria: new Date().toISOString().slice(0, 10),
              responsavel: perfil?.nome || "Sistema",
              parecer_geral: `Vistoria de saída automática — contrato ${newStatus}.`,
              fotos: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            toast.success("Vistoria de saída registrada automaticamente");
          } catch {
            // Non-critical — don't block contract save if vistoria creation fails
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["locacoes"] });
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      setFormOpen(false);
      form.reset(EMPTY_FORM);
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar locação: " + e.message);
    },
  });

  // Auto Generate Split Billing Installments (12 months)
  const handleAutoGenerateInstallments = async (locacaoId: string, values: LocacaoFormValues) => {
    try {
      // 1. Fetch property owner ID
      const { data: imovelData, error: imovelErr } = await supabase
        .from("imoveis")
        .select("proprietario_id")
        .eq("id", values.imovel_id)
        .single();
      
      if (imovelErr) throw imovelErr;
      const ownerId = imovelData?.proprietario_id;

      const parcelasReceber = [];
      const parcelasPagar = [];
      const startDate = new Date(values.data_inicio + "T00:00:00");
      
      for (let i = 1; i <= 12; i++) {
        const currDate = new Date(startDate);
        currDate.setMonth(startDate.getMonth() + i - 1);
        currDate.setDate(values.dia_vencimento);
        
        const year = currDate.getFullYear();
        const month = String(currDate.getMonth() + 1).padStart(2, "0");
        const day = String(currDate.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        // Recebível (Inquilino -> ERP)
        parcelasReceber.push({
          descricao: `Aluguel - Contrato #${values.contrato_numero} (Parc. ${i}/12)`,
          valor_total: Math.round(values.valor_aluguel * 100),
          data_vencimento: dateStr,
          status: "aberta",
          origem: "imobiliaria",
          imob_locacao_id: locacaoId,
          imob_cliente_id: values.locatario_id,
          created_at: new Date().toISOString(),
        });

        // Pagável (Repasse ao Proprietário com carência de 5 dias)
        const payDate = new Date(currDate);
        payDate.setDate(payDate.getDate() + 5);
        const pYear = payDate.getFullYear();
        const pMonth = String(payDate.getMonth() + 1).padStart(2, "0");
        const pDay = String(payDate.getDate()).padStart(2, "0");
        const payDateStr = `${pYear}-${pMonth}-${pDay}`;

        const valorRepasse = values.valor_aluguel * (1 - (values.taxa_administracao_percentual || 0) / 100);

        if (ownerId) {
          parcelasPagar.push({
            descricao: `Repasse Aluguel - Contrato #${values.contrato_numero} (Parc. ${i}/12)`,
            valor_total: Math.round(valorRepasse * 100),
            data_vencimento: payDateStr,
            status: "aberta",
            origem: "imobiliaria",
            imob_locacao_id: locacaoId,
            imob_cliente_id: ownerId,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Bulk insertions
      const { error: recErr } = await (supabase as any).from("contas_receber").insert(parcelasReceber);
      if (recErr) throw recErr;

      if (parcelasPagar.length > 0) {
        const { error: pagErr } = await (supabase as any).from("contas_pagar").insert(parcelasPagar);
        if (pagErr) throw pagErr;
      }

      toast.success("Parcelas de cobrança e repasse de aluguel geradas com sucesso!");
      qc.invalidateQueries({ queryKey: ["contas_receber"] });
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
    } catch (err: any) {
      toast.error("Erro ao gerar parcelas financeiras automaticamente: " + err.message);
    }
  };

  const onSubmit = (values: LocacaoFormValues) => {
    saveMutation.mutate(values);
  };

  // Generate installments manually from Details View
  const generateManualInstallments = async () => {
    if (!viewTarget) return;
    try {
      await handleAutoGenerateInstallments(viewTarget.id, {
        contrato_numero: viewTarget.contrato_numero,
        imovel_id: viewTarget.imovel_id,
        locatario_id: viewTarget.locatario_id,
        data_inicio: viewTarget.data_inicio,
        dia_vencimento: viewTarget.dia_vencimento,
        valor_aluguel: viewTarget.valor_aluguel,
        taxa_administracao_percentual: viewTarget.taxa_administracao_percentual,
        garantia_tipo: viewTarget.garantia_tipo,
        garantia_valor: viewTarget.garantia_valor,
        status: viewTarget.status,
      } as any);
      refetchFaturasReceber();
      refetchFaturasPagar();
    } catch {}
  };

  // Reajuste Mutation
  const reajusteMutation = useMutation({
    mutationFn: async (payload: { locacaoId: string; novoValor: number; atualizarPendentes: boolean }) => {
      const { error: locErr } = await supabase
        .from("locacoes")
        .update({ valor_aluguel: payload.novoValor })
        .eq("id", payload.locacaoId);
      
      if (locErr) throw locErr;

      if (payload.atualizarPendentes) {
        const { data: locData } = await supabase
          .from("locacoes")
          .select("taxa_administracao_percentual")
          .eq("id", payload.locacaoId)
          .single();
        
        const taxa = locData?.taxa_administracao_percentual || 0;

        // Atualiza contas a receber abertas
        const { error: recErr } = await supabase
          .from("contas_receber")
          .update({ valor_total: Math.round(payload.novoValor * 100) })
          .eq("imob_locacao_id", payload.locacaoId)
          .eq("status", "aberta");
        if (recErr) throw recErr;

        // Atualiza contas a pagar abertas
        const valorRepasse = payload.novoValor * (1 - taxa / 100);
        const { error: pagErr } = await supabase
          .from("contas_pagar")
          .update({ valor_total: Math.round(valorRepasse * 100) })
          .eq("imob_locacao_id", payload.locacaoId)
          .eq("status", "aberta");
        if (pagErr) throw pagErr;
      }
    },
    onSuccess: () => {
      toast.success("Contrato reajustado com sucesso!");
      qc.invalidateQueries({ queryKey: ["locacoes"] });
      qc.invalidateQueries({ queryKey: ["contas_receber"] });
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
      setReajusteTarget(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao reajustar aluguel: " + e.message);
    }
  });

  const handleOpenReajuste = (loc: LocacaoRow) => {
    setReajusteTarget(loc);
    setReajusteValor(Math.round(loc.valor_aluguel * 1.05)); // Sugere +5%
    setReajusteAtualizarPendentes(true);
  };

  // Vistorias Photo Upload
  const handleVistoriaPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const path = await uploadR2(file, "imobiliaria/vistorias");
      setVistoriaFotos((prev) => [...prev, path]);
      toast.success("Foto carregada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao subir imagem: " + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  // Submit Vistoria
  const submitVistoria = () => {
    if (!viewTarget || !vistoriaResponsavel) {
      toast.error("Preencha o nome do responsável!");
      return;
    }
    createVistoriaMutation.mutate({
      vistoria: {
        locacao_id: viewTarget.id,
        imovel_id: viewTarget.imovel_id,
        tipo: vistoriaTipo,
        status: vistoriaStatus,
        data_vistoria: vistoriaData,
        responsavel: vistoriaResponsavel,
        parecer_geral: vistoriaParecer,
        fotos: vistoriaFotos,
      },
      checklist: vistoriaChecklist,
    });
  };

  // Vistoria Creation Mutation
  const createVistoriaMutation = useMutation({
    mutationFn: async ({ vistoria, checklist }: {
      vistoria: Record<string, unknown>;
      checklist: Record<string, { status: string; obs: string }>;
    }) => {
      const { data: created, error } = await supabase
        .from("imob_vistorias")
        .insert({
          ...vistoria,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();
      if (error || !created) throw error || new Error("Vistoria não criada.");

      const items = VISTORIA_CHECKLIST_CATEGORIAS.flatMap((category, categoryIndex) =>
        category.itens.map((item, itemIndex) => {
          const saved = checklist[`${category.categoria}-${item}`];
          return {
            vistoria_id: created.id,
            item_categoria: category.categoria,
            item_nome: item,
            status: saved?.status || "pendente",
            observacao: saved?.obs?.trim() || null,
            ordem: categoryIndex * 100 + itemIndex,
          };
        }),
      );

      const { error: itemsError } = await supabase.from("imob_vistorias_itens").insert(items);
      if (itemsError) {
        await supabase.from("imob_vistorias").delete().eq("id", created.id);
        throw itemsError;
      }
    },
    onSuccess: () => {
      toast.success("Vistoria registrada!");
      refetchVistorias();
      setVistoriaFormOpen(false);
      setVistoriaResponsavel("");
      setVistoriaParecer("");
      setVistoriaFotos([]);
      setVistoriaChecklist({});
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar vistoria: " + err.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Locações</h1>
          <p className="text-muted-foreground">
            Acompanhe os contratos de aluguel, vigências, garantias e fluxo de faturamento.
          </p>
        </div>
        <div>
          {podeEditar && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="size-4" />
              Nova Locação
            </Button>
          )}
        </div>
      </div>

      {/* Alertas de Vigência Panel */}
      {alertasVigencia.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 text-amber-900 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <div className="flex-1 text-sm">
              <strong>Contratos Expirando:</strong> Existem {alertasVigencia.length} contrato(s) ativo(s) vencendo nos próximos 60 dias. Verifique e aplique reajustes se necessário.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº de contrato, locatário ou imóvel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status da Locação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="rescindido">Rescindido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTipoImovel} onValueChange={setFilterTipoImovel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo do Imóvel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filteredLocacoes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhuma locação ativa ou cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Locatário (Inquilino)</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocacoes.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-mono font-bold">#{loc.contrato_numero}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-xs block text-muted-foreground uppercase">{loc.imoveis?.codigo}</span>
                        <span className="line-clamp-1">{loc.imoveis?.titulo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{loc.imobiliaria_clientes?.nome}</TableCell>
                    <TableCell className="text-center font-semibold">Dia {loc.dia_vencimento}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <div>De: {new Date(loc.data_inicio + "T00:00").toLocaleDateString("pt-BR")}</div>
                      {loc.data_fim ? (
                        <div>Até: {new Date(loc.data_fim + "T00:00").toLocaleDateString("pt-BR")}</div>
                      ) : (
                        <div className="text-muted-foreground italic">Prazo indeterminado</div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-blue-600">
                      {fmtBRL(Number(loc.valor_aluguel))}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs font-semibold", STATUS_LOCACAO_BADGE[loc.status])}>
                        {STATUS_LOCACAO_LABEL[loc.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setDetailsTab("info"); setViewTarget(loc); }} title="Ver Detalhes">
                          <Eye className="size-4" />
                        </Button>
                        {podeEditar && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenReajuste(loc)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Reajustar Aluguel">
                              <TrendingUp className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(loc)} title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(loc)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Editar Contrato de Locação" : "Cadastrar Contrato de Locação"}
            </DialogTitle>
            <DialogDescription>
              Vincule um imóvel disponível a um inquilino e defina os termos financeiros e garantias.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contrato_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Contrato</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: LOC-2026-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do Contrato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="finalizado">Finalizado</SelectItem>
                          <SelectItem value="rescindido">Rescindido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imovel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imóvel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o imóvel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(imoveisDisponiveis ?? []).map((im) => (
                            <SelectItem key={im.id} value={im.id}>
                              [{im.codigo}] {im.titulo}
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
                  name="locatario_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locatário (Inquilino)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o inquilino" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(inquilinos ?? []).map((inq) => (
                            <SelectItem key={inq.id} value={inq.id}>
                              {inq.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Vigência</h3>
                </div>

                <FormField
                  control={form.control}
                  name="data_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_fim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fim (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Termos Financeiros</h3>
                </div>

                <FormField
                  control={form.control}
                  name="valor_aluguel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Mensal do Aluguel (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2500" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dia_vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia de Vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10" min="1" max="31" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxa_administracao_percentual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxa de Administração (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10" min="0" max="100" step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="garantia_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Garantia</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sem_garantia">Sem Garantia</SelectItem>
                          <SelectItem value="caucao">Caução</SelectItem>
                          <SelectItem value="fiador">Fiador</SelectItem>
                          <SelectItem value="seguro_fianca">Seguro Fiança</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="garantia_valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Garantia (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="7500" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("garantia_tipo") === "fiador" && (
                  <FormField
                    control={form.control}
                    name="fiador_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiador</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fiador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(fiadores ?? []).map((f: any) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.cliente_nome} - {f.vinculo_tipo}
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
                  control={form.control}
                  name="tipo_contrato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Contrato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inicial">Inicial</SelectItem>
                          <SelectItem value="renovacao">Renovação</SelectItem>
                          <SelectItem value="rescisao">Rescisão</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="indice_reajuste"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Índice de Reajuste</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o índice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="ipca">IPCA</SelectItem>
                          <SelectItem value="igp_m">IGP-M</SelectItem>
                          <SelectItem value="inpc">INPC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Observações Gerais</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Indique termos adicionais do contrato ou da garantia..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!editTarget && (
                <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-200 mt-2">
                  <strong>Aviso Importante:</strong> Ao salvar este novo contrato, o sistema irá gerar automaticamente
                  as primeiras 12 parcelas mensais de **Contas a Receber** (aluguel) e **Contas a Pagar** (repasse do proprietário com desconto da comissão).
                </div>
              )}

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Ativar Contrato
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog with Tabs */}
      <Dialog open={viewTarget !== null} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Locação: Contrato #{viewTarget?.contrato_numero}</DialogTitle>
          </DialogHeader>

          {viewTarget && (
            <Tabs value={detailsTab} onValueChange={setDetailsTab} className="mt-4">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="faturas">Faturas (Fluxo)</TabsTrigger>
                <TabsTrigger value="pdf">Visualizar Contrato</TabsTrigger>
                <TabsTrigger value="vistorias">Vistorias</TabsTrigger>
              </TabsList>

              {/* INFO TAB */}
              <TabsContent value="info" className="space-y-4 text-sm mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
                  <div className="col-span-2">
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Locatário</span>
                    <span className="font-bold">{viewTarget.imobiliaria_clientes?.nome}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Aluguel / Mês</span>
                    <span className="font-bold text-blue-600">{fmtBRL(Number(viewTarget.valor_aluguel))}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Status</span>
                    <Badge className={cn("text-[10px] font-semibold mt-1", STATUS_LOCACAO_BADGE[viewTarget.status])}>
                      {STATUS_LOCACAO_LABEL[viewTarget.status]}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Imóvel Vinculado</span>
                    <span className="font-medium">[{viewTarget.imoveis?.codigo}] {viewTarget.imoveis?.titulo}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Vigência de Contrato</span>
                    <span>
                      Início: {new Date(viewTarget.data_inicio + "T00:00").toLocaleDateString("pt-BR")}
                      {viewTarget.data_fim ? ` - Fim: ${new Date(viewTarget.data_fim + "T00:00").toLocaleDateString("pt-BR")}` : " (Sem data final)"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-b pb-4">
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Dia de Vencimento</span>
                    <span>Todo dia {viewTarget.dia_vencimento}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Taxa de Adm.</span>
                    <span>{viewTarget.taxa_administracao_percentual}%</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Garantia Contratual</span>
                    <span>
                      {GARANTIA_LOCACAO_LABEL[viewTarget.garantia_tipo]}
                      {viewTarget.garantia_valor && ` (${fmtBRL(Number(viewTarget.garantia_valor))})`}
                    </span>
                  </div>
                </div>

                {viewTarget.observacoes && (
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Observações</span>
                    <p className="bg-muted p-3 rounded-lg text-xs mt-1 whitespace-pre-wrap">{viewTarget.observacoes}</p>
                  </div>
                )}
              </TabsContent>

              {/* FATURAS (FLUXO) TAB */}
              <TabsContent value="faturas" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Fluxo Financeiro do Contrato</span>
                  {faturasReceber?.length === 0 && podeEditar && (
                    <Button size="sm" onClick={generateManualInstallments} className="gap-2">
                      <CalendarDays className="size-3.5" />
                      Gerar Primeiras 12 Faturas & Repasses
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Receber */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-green-700 uppercase">Cobrança (Inquilino)</h4>
                    <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                      {faturasReceber?.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma fatura gerada.</div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">Vencimento</TableHead>
                              <TableHead className="text-xs">Valor</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {faturasReceber?.map((fat) => (
                              <TableRow key={fat.id} className="text-xs">
                                <TableCell>{new Date(fat.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="font-bold">{fmtBRLFromCents(fat.valor_total)}</TableCell>
                                <TableCell>
                                  <Badge className={cn("text-[9px] font-bold px-1.5 py-0.5", 
                                    fat.status === "recebida" ? "bg-green-600 text-white" :
                                    fat.status === "atrasada" ? "bg-red-600 text-white" :
                                    "bg-muted text-muted-foreground"
                                  )}>
                                    {fat.status === "recebida" ? "Pago" : fat.status === "atrasada" ? "Atrasado" : "Pendente"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>

                  {/* Repasse */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-700 uppercase">Repasse (Proprietário)</h4>
                    <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                      {faturasPagar?.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">Nenhum repasse gerado.</div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">Vencimento</TableHead>
                              <TableHead className="text-xs">Valor</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {faturasPagar?.map((fat) => (
                              <TableRow key={fat.id} className="text-xs">
                                <TableCell>{new Date(fat.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="font-bold">{fmtBRLFromCents(fat.valor_total)}</TableCell>
                                <TableCell>
                                  <Badge className={cn("text-[9px] font-bold px-1.5 py-0.5", 
                                    fat.status === "paga" ? "bg-green-600 text-white" :
                                    fat.status === "atrasada" ? "bg-red-600 text-white" :
                                    "bg-muted text-muted-foreground"
                                  )}>
                                    {fat.status === "paga" ? "Repassado" : fat.status === "atrasada" ? "Atrasado" : "Pendente"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* CONTRATO PDF TAB */}
              <TabsContent value="pdf" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Pré-visualização do Contrato</span>
                  <Button size="sm" onClick={() => {
                    const printContent = document.getElementById("contrato-impressao")?.innerHTML;
                    if (printContent) {
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(`
                          <html>
                            <head>
                              <title>Contrato de Locação - #${viewTarget.contrato_numero}</title>
                              <style>
                                body {
                                  font-family: 'Times New Roman', Times, serif;
                                  font-size: 12pt;
                                  line-height: 1.6;
                                  padding: 40px;
                                  color: black;
                                  background: white;
                                }
                                h1, h2, h3 {
                                  text-align: center;
                                }
                                .text-justify {
                                  text-align: justify;
                                }
                                .margin-y {
                                  margin-top: 20px;
                                  margin-bottom: 20px;
                                }
                                .signatures {
                                  margin-top: 50px;
                                  display: grid;
                                  grid-template-columns: 1fr 1fr;
                                  gap: 50px 30px;
                                }
                                .signature-line {
                                  border-top: 1px solid black;
                                  text-align: center;
                                  padding-top: 5px;
                                  margin-top: 40px;
                                }
                              </style>
                            </head>
                            <body>
                              ${printContent}
                              <script>
                                window.onload = function() {
                                  window.print();
                                  window.close();
                                }
                              </script>
                            </body>
                          </html>
                        `);
                        win.document.close();
                      }
                    }
                  }} className="gap-2">
                    <Calendar className="size-3.5" />
                    Gerar PDF / Imprimir
                  </Button>
                </div>

                <div 
                  id="contrato-impressao" 
                  className="bg-white text-black p-8 rounded-lg border shadow-sm font-serif text-[11px] leading-relaxed max-h-[400px] overflow-y-auto"
                >
                  <h2 className="text-center font-bold text-sm uppercase tracking-wide">INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO</h2>
                  
                  <div className="margin-y text-justify">
                    <p className="mb-2">
                      Pelo presente instrumento particular, as partes qualificadas a seguir têm, entre si, justo e contratado a locação do imóvel residencial/comercial sob as seguintes cláusulas e condições:
                    </p>
                    
                    <p className="mb-1">
                      <strong>LOCADOR (PROPRIETÁRIO):</strong> {viewTarget.imoveis?.imobiliaria_clientes?.nome || "—"}, 
                      inscrito no CPF/CNPJ sob o nº {viewTarget.imoveis?.imobiliaria_clientes?.cpf_cnpj || "—"}
                      {viewTarget.imoveis?.imobiliaria_clientes?.logradouro ? `, residente e domiciliado na ${viewTarget.imoveis.imobiliaria_clientes.logradouro}, nº ${viewTarget.imoveis.imobiliaria_clientes.numero}, ${viewTarget.imoveis.imobiliaria_clientes.bairro}, ${viewTarget.imoveis.imobiliaria_clientes.cidade}/${viewTarget.imoveis.imobiliaria_clientes.uf}` : ""}.
                    </p>

                    <p className="mb-1">
                      <strong>LOCATÁRIO (INQUILINO):</strong> {viewTarget.imobiliaria_clientes?.nome || "—"}, 
                      inscrito no CPF/CNPJ sob o nº {viewTarget.imobiliaria_clientes?.cpf_cnpj || "—"}
                      {viewTarget.imobiliaria_clientes?.logradouro ? `, residente e domiciliado na ${viewTarget.imobiliaria_clientes.logradouro}, nº ${viewTarget.imobiliaria_clientes.numero}, ${viewTarget.imobiliaria_clientes.bairro}, ${viewTarget.imobiliaria_clientes.cidade}/${viewTarget.imobiliaria_clientes.uf}` : ""}.
                    </p>

                    <p className="mb-1">
                      <strong>IMÓVEL LOCADO:</strong> Imóvel situado na {viewTarget.imoveis?.logradouro || "—"}, nº {viewTarget.imoveis?.numero || "—"} {viewTarget.imoveis?.complemento ? `- ${viewTarget.imoveis.complemento}` : ""}, Bairro {viewTarget.imoveis?.bairro || "—"}, Cidade {viewTarget.imoveis?.cidade || "—"}/{viewTarget.imoveis?.uf || "—"}, CEP {viewTarget.imoveis?.cep || "—"}.
                    </p>
                  </div>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA PRIMEIRA – DO OBJETO</h3>
                  <p className="text-justify mt-1 mb-2">
                    Constitui objeto do presente contrato a locação do IMÓVEL LOCADO acima descrito, cedido pelo LOCADOR ao LOCATÁRIO para fins exclusivos de moradia ou comércio, sendo vedada qualquer sublocação ou cessão a terceiros sem prévio consentimento formal por escrito do LOCADOR.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA SECOND – DO PRAZO DE VIGÊNCIA</h3>
                  <p className="text-justify mt-1 mb-2">
                    O contrato terá início em {new Date(viewTarget.data_inicio + "T00:00").toLocaleDateString("pt-BR")} e vigência 
                    {viewTarget.data_fim ? ` até ${new Date(viewTarget.data_fim + "T00:00").toLocaleDateString("pt-BR")}` : " por prazo indeterminado"}. 
                    Ao término deste período, caso o LOCATÁRIO permaneça no imóvel sem oposição do LOCADOR por mais de 30 dias, a locação reputar-se-á prorrogada sob as mesmas condições.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA TERCEIRA – DO VALOR DO ALUGUEL E REAJUSTE</h3>
                  <p className="text-justify mt-1 mb-2">
                    O valor do aluguel mensal acordado é de <strong>{fmtBRL(Number(viewTarget.valor_aluguel))}</strong>, a ser pago pelo LOCATÁRIO até o dia <strong>{viewTarget.dia_vencimento}</strong> de cada mês, através do método indicado pela administração. O reajuste anual do aluguel ocorrerá com base no índice oficial acumulado do período.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA QUARTA – DOS JUROS E MULTA POR INADIMPLEMENTO</h3>
                  <p className="text-justify mt-1 mb-2">
                    O atraso no pagamento do aluguel e dos encargos incidentes implicará na aplicação imediata de multa de <strong>10% (dez por cento)</strong> sobre o débito total, juros de mora de <strong>1% (um por cento) ao mês</strong> (calculados pro-rata die) e atualização monetária correspondente ao período.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA QUINTA – DA RESCISÃO E MULTA PENAL</h3>
                  <p className="text-justify mt-1 mb-2">
                    A rescisão do contrato antes do término avençado por qualquer das partes acarretará a cobrança de multa penal equivalente a <strong>3 (três) meses de aluguel vigente</strong>. A referida multa será paga proporcionalmente ao tempo de vigência que faltar para o cumprimento integral do prazo contratado, nos termos da Lei 8.245/91.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA SEXTA – DA GARANTIA</h3>
                  <p className="text-justify mt-1 mb-2">
                    Para garantia das obrigações assumidas neste contrato, o LOCATÁRIO presta a garantia na modalidade de <strong>{GARANTIA_LOCACAO_LABEL[viewTarget.garantia_tipo]}</strong>
                    {viewTarget.garantia_valor && ` no valor de ${fmtBRL(Number(viewTarget.garantia_valor))}`}.
                  </p>

                  <h3 className="font-bold border-b pb-1 mt-4 text-xs">CLÁUSULA SÉTIMA – DAS BENFEITORIAS E CONSERVAÇÃO</h3>
                  <p className="text-justify mt-1 mb-2">
                    O LOCATÁRIO obriga-se a manter o imóvel nas mesmas condições de conservação e limpeza em que o recebeu. Quaisquer benfeitorias ou modificações estruturais exigirirão expressa anuência por escrito do LOCADOR, sob pena de infração contratual.
                  </p>

                  <p className="mt-8 text-center">
                    São Paulo, {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.
                  </p>

                  <div className="signatures">
                    <div className="signature-line">
                      <strong>LOCADOR</strong>
                      <div className="text-[10px] text-muted-foreground">{viewTarget.imoveis?.imobiliaria_clientes?.nome}</div>
                    </div>
                    <div className="signature-line">
                      <strong>LOCATÁRIO</strong>
                      <div className="text-[10px] text-muted-foreground">{viewTarget.imobiliaria_clientes?.nome}</div>
                    </div>
                    <div className="signature-line">
                      <strong>TESTEMUNHA 1</strong>
                      <div className="text-[10px] text-muted-foreground">CPF:</div>
                    </div>
                    <div className="signature-line">
                      <strong>TESTEMUNHA 2</strong>
                      <div className="text-[10px] text-muted-foreground">CPF:</div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* VISTORIAS TAB */}
              <TabsContent value="vistorias" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Laudos de Vistoria</span>
                  {podeEditar && !vistoriaFormOpen && (
                    <Button size="sm" onClick={() => setVistoriaFormOpen(true)} className="gap-2">
                      <ClipboardCheck className="size-3.5" />
                      Registrar Vistoria
                    </Button>
                  )}
                </div>

                {/* Vistoria Form */}
                {vistoriaFormOpen && (
                  <Card className="border p-4 bg-muted/30 space-y-4">
                    <div className="text-xs font-semibold uppercase">Nova Vistoria</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo</label>
                        <Select onValueChange={(v: any) => setVistoriaTipo(v)} value={vistoriaTipo}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="periodica">Periódica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                        <Select onValueChange={(v: any) => setVistoriaStatus(v)} value={vistoriaStatus}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agendada">Agendada</SelectItem>
                            <SelectItem value="realizada">Realizada</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Data</label>
                        <Input type="date" value={vistoriaData} onChange={(e) => setVistoriaData(e.target.value)} className="bg-white" />
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Responsável / Vistoriador</label>
                        <Input placeholder="Nome completo do vistoriador" value={vistoriaResponsavel} onChange={(e) => setVistoriaResponsavel(e.target.value)} className="bg-white" />
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Parecer Geral / Detalhes de Conservação</label>
                        <Textarea placeholder="Indique o estado do imóvel (pintura, chaves, elétrica, hidráulica)..." rows={3} value={vistoriaParecer} onChange={(e) => setVistoriaParecer(e.target.value)} className="bg-white" />
                      </div>

                      {/* Checklist de Vistoria */}
                      <div className="md:col-span-3 space-y-4">
                        <label className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Checklist de Vistoria</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {VISTORIA_CHECKLIST_CATEGORIAS.map(({ categoria, label, itens }) => (
                            <div key={categoria} className="bg-muted/30 p-4 rounded-lg">
                              <h5 className="font-semibold text-sm mb-2 text-muted-foreground">{label}</h5>
                              <div className="space-y-2">
                                {itens.map((item) => {
                                  const key = `${categoria}-${item}`;
                                  const itemState = vistoriaChecklist[key] || { status: 'pendente', obs: '' };
                                  return (
                                    <div key={key} className="space-y-1 text-xs">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={itemState.status === 'ok'}
                                          onChange={(e) => setVistoriaChecklist((prev) => ({
                                            ...prev,
                                            [key]: { status: e.target.checked ? 'ok' : 'pendente', obs: prev[key]?.obs || '' }
                                          }))}
                                          className="rounded border-gray-300 text-blue-600 size-4"
                                        />
                                        <label className="flex-1">{item}</label>
                                        <select
                                          value={itemState.status}
                                          onChange={(e) => setVistoriaChecklist((prev) => ({
                                            ...prev,
                                            [key]: { status: e.target.value, obs: prev[key]?.obs || '' }
                                          }))}
                                          className="text-[10px] px-2 py-1 border rounded text-muted-foreground"
                                        >
                                          <option value="pendente">Pendente</option>
                                          <option value="ok">OK</option>
                                          <option value="defeito">Defeito</option>
                                          <option value="observacao">Observação</option>
                                        </select>
                                      </div>
                                      {(itemState.status === 'defeito' || itemState.status === 'observacao') && (
                                        <Input
                                          value={itemState.obs}
                                          onChange={(e) => setVistoriaChecklist((prev) => ({
                                            ...prev,
                                            [key]: { status: itemState.status, obs: e.target.value }
                                          }))}
                                          placeholder="Descreva o defeito ou observação"
                                          className="h-7 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Photo upload and gallery inside form */}
                      <div className="md:col-span-3 space-y-2">
                        <label className="text-xs font-medium text-muted-foreground block">Fotos do Imóvel</label>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" className="gap-2 pointer-events-none" disabled={uploadingFoto}>
                              {uploadingFoto ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                              Enviar Foto
                            </Button>
                            <input type="file" accept="image/*" className="hidden" onChange={handleVistoriaPhotoUpload} />
                          </label>
                          {vistoriaFotos.length > 0 && (
                            <span className="text-xs text-muted-foreground">{vistoriaFotos.length} foto(s) anexada(s)</span>
                          )}
                        </div>

                        {vistoriaFotos.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {vistoriaFotos.map((f, idx) => (
                              <div key={idx} className="relative size-16 group border rounded overflow-hidden">
                                <img src={`${import.meta.env.VITE_R2_PUBLIC_URL}/${f}`} className="size-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setVistoriaFotos((prev) => prev.filter((_, i) => i !== idx))}
                                  className="absolute top-0.5 right-0.5 size-4 bg-destructive text-white rounded-full flex items-center justify-center text-[9px] hover:bg-destructive/80"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => setVistoriaFormOpen(false)}>Cancelar</Button>
                      <Button size="sm" onClick={submitVistoria} disabled={createVistoriaMutation.isPending}>
                        Salvar Laudo
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Vistorias List */}
                <div className="space-y-4">
                  {vistorias?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                      Nenhuma vistoria registrada para este contrato.
                    </div>
                  ) : (
                    vistorias?.map((vist) => (
                      <Card key={vist.id} className="border p-4 shadow-sm bg-card">
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="capitalize font-bold text-xs">{vist.tipo}</Badge>
                            <Badge className={cn("text-xs font-semibold", 
                              vist.status === "realizada" ? "bg-green-600 text-white" :
                              vist.status === "cancelada" ? "bg-muted text-muted-foreground" :
                              "bg-blue-600 text-white"
                            )}>
                              {vist.status}
                            </Badge>
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {new Date(vist.data_vistoria + "T00:00").toLocaleDateString("pt-BR")}
                          </span>
                          {vist.status === "realizada" && podeEditar && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setPrintVistoriaTarget(vist)}>
                              <Printer className="size-3" />
                              Imprimir
                            </Button>
                          )}
                        </div>

                        <div className="text-xs space-y-1">
                          <div><strong>Vistoriador:</strong> {vist.responsavel}</div>
                          {vist.parecer_geral && (
                            <div className="mt-1 bg-muted p-2 rounded text-muted-foreground italic">
                              {vist.parecer_geral}
                            </div>
                          )}

                          {vist.fotos && vist.fotos.length > 0 && (
                            <div className="mt-3">
                              <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Galeria de Imagens</span>
                              <div className="flex flex-wrap gap-2">
                                {vist.fotos.map((f, idx) => (
                                  <img 
                                    key={idx} 
                                    src={`${import.meta.env.VITE_R2_PUBLIC_URL}/${f}`} 
                                    className="size-16 object-cover rounded border cursor-pointer hover:opacity-80 transition"
                                    onClick={() => openR2File(f)}
                                    title="Clique para ampliar"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button type="button" onClick={() => setViewTarget(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reajuste Dialog */}
      <Dialog open={reajusteTarget !== null} onOpenChange={(open) => !open && setReajusteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reajustar Aluguel: Contrato #{reajusteTarget?.contrato_numero}</DialogTitle>
            <DialogDescription>
              Ajuste o valor mensal do aluguel. Você pode atualizar o contrato e as parcelas pendentes.
            </DialogDescription>
          </DialogHeader>

          {reajusteTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block uppercase">Valor Atual</span>
                  <span className="font-bold text-base">{fmtBRL(Number(reajusteTarget.valor_aluguel))}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block uppercase">Nova Sugestão (+5%)</span>
                  <span className="font-bold text-base text-blue-600">{fmtBRL(Number(reajusteTarget.valor_aluguel * 1.05))}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium block">Índice de Reajuste</label>
                <Select value={reajusteIndice} onValueChange={(v: any) => setReajusteIndice(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o índice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="ipca">IPCA (Índice de Preços ao Consumidor Amplo)</SelectItem>
                    <SelectItem value="igp_m">IGP-M (Índice Geral de Preços - Mercado)</SelectItem>
                    <SelectItem value="inpc">INPC (Índice Nacional de Preços ao Consumidor)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {reajusteIndice === "manual" && "Informe o novo valor manualmente."}
                  {reajusteIndice === "ipca" && "Baseado no IPCA acumulado. Valor sugerido com +5% (simulação)."}
                  {reajusteIndice === "igp_m" && "Baseado no IGP-M acumulado. Valor sugerido com +5% (simulação)."}
                  {reajusteIndice === "inpc" && "Baseado no INPC acumulado. Valor sugerido com +5% (simulação)."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium block">Novo Valor Mensal (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={reajusteValor || ""}
                  onChange={(e) => setReajusteValor(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="reajuste_pendentes"
                  checked={reajusteAtualizarPendentes} 
                  onChange={(e) => setReajusteAtualizarPendentes(e.target.checked)} 
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <label htmlFor="reajuste_pendentes" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Reajustar automaticamente faturas em aberto no Contas a Receber e Repasses no Contas a Pagar.
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReajusteTarget(null)}>Cancelar</Button>
            <Button 
              onClick={() => reajusteTarget && reajusteMutation.mutate({
                locacaoId: reajusteTarget.id,
                novoValor: reajusteValor,
                atualizarPendentes: reajusteAtualizarPendentes
              })}
              disabled={reajusteMutation.isPending}
            >
              {reajusteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar Reajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a locação do contrato <strong>{deleteTarget?.contrato_numero}</strong>.
              As faturas geradas no contas a receber não serão apagadas, mas o imóvel voltará a ficar "Disponível".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Vistoria Dialog */}
      <Dialog open={printVistoriaTarget !== null} onOpenChange={(open) => !open && setPrintVistoriaTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Laudo de Vistoria - Impressão</DialogTitle>
            <DialogDescription>
              Laudo de vistoria de {printVistoriaTarget?.tipo} - {new Date(printVistoriaTarget?.data_vistoria + "T00:00:00").toLocaleDateString("pt-BR")}
            </DialogDescription>
          </DialogHeader>
          <div className="print:hidden mb-4 flex justify-end">
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="size-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
          <div id="print-vistoria-content" className="bg-white text-black p-8 rounded-lg border shadow-sm font-serif text-[11px] leading-relaxed max-h-[70vh] overflow-y-auto">
            {printVistoriaTarget && (
              <div className="space-y-6">
                <header className="border-b-2 pb-4 text-center">
                  <h1 className="text-xl font-bold uppercase tracking-wide">LAUDO DE VISTORIA</h1>
                  <p className="text-sm mt-1">Tipo: <strong>{printVistoriaTarget.tipo.toUpperCase()}</strong></p>
                  <p className="text-sm">Data: {new Date(printVistoriaTarget.data_vistoria + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  <p className="text-sm">Status: <strong>{printVistoriaTarget.status}</strong></p>
                  <p className="text-sm">Responsável: {printVistoriaTarget.responsavel}</p>
                </header>

                <section className="space-y-3">
                  <h2 className="font-bold border-b pb-1">1. DADOS DA LOCAÇÃO</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Contrato:</span> #{viewTarget?.contrato_numero}
                    </div>
                    <div>
                      <span className="font-semibold">Imóvel:</span> [{viewTarget?.imoveis?.codigo}] {viewTarget?.imoveis?.titulo}
                    </div>
                    <div>
                      <span className="font-semibold">Endereço:</span> {viewTarget?.imoveis?.logradouro}, nº {viewTarget?.imoveis?.numero} - {viewTarget?.imoveis?.bairro}, {viewTarget?.imoveis?.cidade}/{viewTarget?.imoveis?.uf}
                    </div>
                    <div>
                      <span className="font-semibold">Locatário:</span> {viewTarget?.imobiliaria_clientes?.nome}
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="font-bold border-b pb-1">2. DADOS DA VISTORIA</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Tipo:</span> {printVistoriaTarget.tipo}
                    </div>
                    <div>
                      <span className="font-semibold">Data:</span> {new Date(printVistoriaTarget.data_vistoria + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span> {printVistoriaTarget.status}
                    </div>
                    <div>
                      <span className="font-semibold">Responsável:</span> {printVistoriaTarget.responsavel}
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="font-bold border-b pb-1">3. PARECER GERAL</h2>
                  <p className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">{printVistoriaTarget.parecer_geral || "—"}</p>
                </section>

                <section className="space-y-3">
                  <h2 className="font-bold border-b pb-1">4. CHECKLIST DE VISTORIA</h2>
                  {loadingPrintVistoriaItens ? (
                    <p className="text-sm">Carregando checklist...</p>
                  ) : printVistoriaItens.length === 0 ? (
                    <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                      Esta vistoria foi registrada sem itens de checklist. Os estados antigos não podem ser recuperados porque não foram salvos pelo sistema.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {VISTORIA_CHECKLIST_CATEGORIAS.map(({ categoria, label }) => {
                        const categoryItems = printVistoriaItens.filter((item) => item.item_categoria === categoria);
                        if (categoryItems.length === 0) return null;
                        return (
                          <div key={categoria} className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-2 text-muted-foreground">{label}</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {categoryItems.map((item) => (
                                <div key={item.id} className="rounded border p-2 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <strong>{item.item_nome}</strong>
                                    <span className={cn(
                                      "font-bold uppercase",
                                      item.status === "ok" && "text-green-700",
                                      item.status === "defeito" && "text-red-700",
                                      item.status === "observacao" && "text-amber-700",
                                      item.status === "pendente" && "text-slate-500",
                                    )}>
                                      {item.status === "ok" ? "✓ OK" : item.status === "defeito" ? "Defeito" : item.status === "observacao" ? "Observação" : "Pendente"}
                                    </span>
                                  </div>
                                  {item.observacao && <p className="mt-1 text-slate-700">{item.observacao}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {printVistoriaTarget.fotos && printVistoriaTarget.fotos.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-bold border-b pb-1">5. REGISTRO FOTOGRÁFICO</h2>
                    <div className="grid grid-cols-3 gap-4">
                      {printVistoriaTarget.fotos.map((f, idx) => (
                        <div key={idx} className="border rounded overflow-hidden">
                          <img
                            src={`${import.meta.env.VITE_R2_PUBLIC_URL}/${f}`}
                            className="w-full h-32 object-cover"
                            alt={`Foto ${idx + 1}`}
                          />
                          <p className="text-xs text-center p-1">Foto {idx + 1}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <footer className="mt-12 border-t pt-4">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="text-center">
                      <p className="border-t pt-2 font-semibold">Vistoriador</p>
                      <p className="text-xs text-muted-foreground">{printVistoriaTarget.responsavel}</p>
                    </div>
                    <div className="text-center">
                      <p className="border-t pt-2 font-semibold">Locatário</p>
                      <p className="text-xs text-muted-foreground">{viewTarget?.imobiliaria_clientes?.nome}</p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-8">
                    Documento gerado em {new Date().toLocaleString("pt-BR")} pelo Sistema ObrasFlow ERP
                  </p>
                </footer>
              </div>
            )}
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setPrintVistoriaTarget(null)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4 mr-2" />
              Imprimir / Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
