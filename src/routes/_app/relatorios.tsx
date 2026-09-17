import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  Layers,
  Wrench,
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  HardHat,
  Search,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — ERP Obras" }] }),
  component: RelatoriosPage,
});

type Categoria = "OPERACIONAL" | "FINANCEIRO";
type RelatorioTipo =
  | "situacao_obras"
  | "cronograma_fisico"
  | "compras_periodo"
  | "posicao_estoque"
  | "contas_receber"
  | "contas_pagar"
  | "fluxo_caixa"
  | "resultado_obra";

const fmtBRL = (v: number | null | undefined) => {
  const val = (v ?? 0) / 100;
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function RelatoriosPage() {
  const [selectedRelatorio, setSelectedRelatorio] = useState<RelatorioTipo>("situacao_obras");

  // Filter states
  const [filtroObra, setFiltroObra] = useState<string>("none");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [buscaText, setBuscaText] = useState<string>("");

  // Queries for option selects
  const { data: obras } = useQuery({
    queryKey: ["relatorios-obras-opt"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("obras").select("id, numero, nome").order("nome");
      return (data ?? []) as { id: string; numero: string; nome: string }[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["relatorios-clientes-opt"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("clientes").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["relatorios-fornecedores-opt"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("fornecedores").select("id, razao_social").order("razao_social");
      return (data ?? []) as { id: string; razao_social: string }[];
    },
  });

  // Automatically select first obra for single-obra reports if none is selected
  useEffect(() => {
    if (obras && obras.length > 0 && filtroObra === "none") {
      setFiltroObra(obras[0].id);
    }
  }, [obras, filtroObra]);

  // Main report data query
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      "report-data",
      selectedRelatorio,
      filtroObra,
      filtroStatus,
      filtroFornecedor,
      filtroCliente,
      dataInicio,
      dataFim,
      buscaText,
    ],
    queryFn: async () => {
      if (selectedRelatorio === "situacao_obras") {
        let query = (supabase as any).from("obras").select("*, clientes(nome)");
        if (filtroStatus !== "todos") {
          query = query.eq("status", filtroStatus);
        }
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data as any[];
      }

      if (selectedRelatorio === "cronograma_fisico") {
        if (!filtroObra || filtroObra === "none") return [];
        const { data, error } = await (supabase as any)
          .from("obras")
          .select("id, nome, numero, status, progresso")
          .eq("id", filtroObra)
          .single();
        if (error) throw error;

        // Generate standard physical roadmap stages based on overall progress
        const overall = Number(data.progresso || 0);
        const stages = [
          { nome: "1. Serviços Preliminares & Projetos", peso: 5, concl: overall >= 10 ? 100 : overall * 10 },
          { nome: "2. Infraestrutura & Fundações", peso: 15, concl: overall >= 30 ? 100 : Math.max(0, (overall - 5) * 5) },
          { nome: "3. Supraestrutura (Pilares/Lajes)", peso: 25, concl: overall >= 60 ? 100 : Math.max(0, (overall - 25) * 3) },
          { nome: "4. Alvenarias & Fechamentos", peso: 20, concl: overall >= 75 ? 100 : Math.max(0, (overall - 50) * 4) },
          { nome: "5. Instalações (Hidráulica/Elétrica)", peso: 15, concl: overall >= 85 ? 100 : Math.max(0, (overall - 65) * 5) },
          { nome: "6. Acabamentos & Pintura", peso: 20, concl: overall >= 100 ? 100 : Math.max(0, (overall - 80) * 5) },
        ];

        return stages.map((st) => ({
          ...st,
          progresso_calculado: Math.min(100, Math.round(st.concl)),
        }));
      }

      if (selectedRelatorio === "compras_periodo") {
        let query = (supabase as any).from("pedidos_compra").select("*, fornecedores(razao_social), obras(nome, numero)");
        if (filtroObra && filtroObra !== "none" && filtroObra !== "todos") {
          query = query.eq("obra_id", filtroObra);
        }
        if (filtroFornecedor && filtroFornecedor !== "todos") {
          query = query.eq("fornecedor_id", filtroFornecedor);
        }
        if (dataInicio) {
          query = query.gte("created_at", dataInicio);
        }
        if (dataFim) {
          query = query.lte("created_at", dataFim);
        }
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        return data as any[];
      }

      if (selectedRelatorio === "posicao_estoque") {
        if (!filtroObra || filtroObra === "none") return [];
        const { data, error } = await (supabase as any)
          .from("estoque_obra")
          .select("id, saldo, material:materiais(codigo, descricao, unidade, estoque_min)")
          .eq("obra_id", filtroObra);
        if (error) throw error;
        return data as any[];
      }

      if (selectedRelatorio === "contas_receber") {
        let query = (supabase as any).from("contas_receber").select("*, clientes(nome), obras(nome, numero)");
        if (filtroObra && filtroObra !== "none" && filtroObra !== "todos") {
          query = query.eq("obra_id", filtroObra);
        }
        if (filtroCliente && filtroCliente !== "todos") {
          query = query.eq("cliente_id", filtroCliente);
        }
        if (filtroStatus && filtroStatus !== "todos") {
          query = query.eq("status", filtroStatus);
        }
        if (dataInicio) {
          query = query.gte("data_vencimento", dataInicio);
        }
        if (dataFim) {
          query = query.lte("data_vencimento", dataFim);
        }
        const { data, error } = await query.order("data_vencimento", { ascending: true });
        if (error) throw error;
        return data as any[];
      }

      if (selectedRelatorio === "contas_pagar") {
        let query = (supabase as any).from("contas_pagar").select("*, fornecedores(razao_social), obras(nome, numero)");
        if (filtroObra && filtroObra !== "none" && filtroObra !== "todos") {
          query = query.eq("obra_id", filtroObra);
        }
        if (filtroFornecedor && filtroFornecedor !== "todos") {
          query = query.eq("fornecedor_id", filtroFornecedor);
        }
        if (filtroStatus && filtroStatus !== "todos") {
          query = query.eq("status", filtroStatus);
        }
        if (dataInicio) {
          query = query.gte("data_vencimento", dataInicio);
        }
        if (dataFim) {
          query = query.lte("data_vencimento", dataFim);
        }
        const { data, error } = await query.order("data_vencimento", { ascending: true });
        if (error) throw error;
        return data as any[];
      }

      if (selectedRelatorio === "fluxo_caixa") {
        const { data: recs } = await (supabase as any).from("contas_receber").select("valor_total, valor_recebido, data_vencimento, data_recebimento, status").neq("status", "cancelada");
        const { data: pags } = await (supabase as any).from("contas_pagar").select("valor_total, valor_pago, data_vencimento, data_pagamento, status").neq("status", "cancelada");

        // Group by month
        const monthsMap: Record<string, { mes: string; receitaPrev: number; receitaReal: number; custoPrev: number; custoReal: number }> = {};
        const formatMonth = (dStr: string) => dStr.slice(0, 7); // YYYY-MM

        const addValue = (date: string, type: "recPrev" | "recReal" | "pagPrev" | "pagReal", value: number) => {
          const m = formatMonth(date);
          if (!monthsMap[m]) {
            monthsMap[m] = { mes: m, receitaPrev: 0, receitaReal: 0, custoPrev: 0, custoReal: 0 };
          }
          if (type === "recPrev") monthsMap[m].receitaPrev += value;
          else if (type === "recReal") monthsMap[m].receitaReal += value;
          else if (type === "pagPrev") monthsMap[m].custoPrev += value;
          else if (type === "pagReal") monthsMap[m].custoReal += value;
        };

        (recs ?? []).forEach((r: any) => {
          addValue(r.data_vencimento, "recPrev", r.valor_total);
          if (r.status === "recebida" && r.data_recebimento) {
            addValue(r.data_recebimento, "recReal", r.valor_recebido ?? r.valor_total);
          }
        });

        (pags ?? []).forEach((p: any) => {
          addValue(p.data_vencimento, "pagPrev", p.valor_total);
          if (p.status === "paga" && p.data_pagamento) {
            addValue(p.data_pagamento, "pagReal", p.valor_pago ?? p.valor_total);
          }
        });

        return Object.keys(monthsMap)
          .sort()
          .map((m) => {
            const row = monthsMap[m];
            const parts = row.mes.split("-");
            const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            return {
              ...row,
              mes_rotulo: `${names[parseInt(parts[1], 10) - 1]}/${parts[0].slice(2)}`,
            };
          });
      }

      if (selectedRelatorio === "resultado_obra") {
        if (!filtroObra || filtroObra === "none") return [];
        const { data: recs } = await (supabase as any).from("contas_receber").select("valor_total, valor_recebido, status").eq("obra_id", filtroObra).neq("status", "cancelada");
        const { data: pags } = await (supabase as any).from("contas_pagar").select("valor_total, valor_pago, status").eq("obra_id", filtroObra).neq("status", "cancelada");

        let recPrev = 0;
        let recReal = 0;
        let custoPrev = 0;
        let custoReal = 0;

        (recs ?? []).forEach((r: any) => {
          recPrev += r.valor_total;
          if (r.status === "recebida") recReal += r.valor_recebido ?? r.valor_total;
        });

        (pags ?? []).forEach((p: any) => {
          custoPrev += p.valor_total;
          if (p.status === "paga") custoReal += p.valor_pago ?? p.valor_total;
        });

        return [
          {
            indicador: "Faturamento (Receitas)",
            previsto: recPrev,
            realizado: recReal,
          },
          {
            indicador: "Custos (Despesas)",
            previsto: custoPrev,
            realizado: custoReal,
          },
          {
            indicador: "Resultado Líquido",
            previsto: recPrev - custoPrev,
            realizado: recReal - custoReal,
          },
        ];
      }

      return [];
    },
  });

  const exportExcel = () => {
    if (!reportData || reportData.length === 0) {
      toast.error("Nenhum dado disponível para exportação.");
      return;
    }

    let rows: any[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    if (selectedRelatorio === "situacao_obras") {
      rows = reportData.map((item) => ({
        "Número": item.numero,
        "Nome da Obra": item.nome,
        "Cliente": item.clientes?.nome || "—",
        "Orçamento (R$)": item.orcamento ? Number(item.orcamento) : 0,
        "Valor Executado (R$)": item.valor_executado ? Number(item.valor_executado) : 0,
        "Progresso (%)": item.progresso ? Number(item.progresso) : 0,
        "Status": item.status,
        "Data Início": item.data_inicio_prevista ? new Date(item.data_inicio_prevista).toLocaleDateString("pt-BR") : "—",
        "Data Fim": item.data_fim_prevista ? new Date(item.data_fim_prevista).toLocaleDateString("pt-BR") : "—",
      }));
    } else if (selectedRelatorio === "cronograma_fisico") {
      rows = reportData.map((item) => ({
        "Etapa": item.nome,
        "Peso Percentual (%)": Number(item.peso),
        "Avanço Físico (%)": Number(item.progresso_calculado),
      }));
    } else if (selectedRelatorio === "compras_periodo") {
      rows = reportData.map((item) => ({
        "Número Pedido": item.numero,
        "Obra": item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "—",
        "Fornecedor": item.fornecedores?.razao_social || "—",
        "Valor Total (R$)": item.valor_total ? item.valor_total / 100 : 0,
        "Status": item.status,
        "Data Emissão": new Date(item.created_at).toLocaleDateString("pt-BR"),
      }));
    } else if (selectedRelatorio === "posicao_estoque") {
      rows = reportData.map((item) => ({
        "Código": item.material?.codigo || "—",
        "Material": item.material?.descricao || "—",
        "Unidade": item.material?.unidade || "—",
        "Saldo Físico": Number(item.saldo || 0),
        "Estoque Mínimo": Number(item.material?.estoque_min || 0),
        "Status": Number(item.saldo) === 0 ? "Zerado" : Number(item.saldo) <= Number(item.material?.estoque_min) ? "Baixo" : "Normal",
      }));
    } else if (selectedRelatorio === "contas_receber") {
      rows = reportData.map((item) => ({
        "Descrição": item.descricao,
        "Obra": item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "—",
        "Cliente": item.clientes?.nome || "—",
        "Vencimento": new Date(item.data_vencimento).toLocaleDateString("pt-BR"),
        "Valor Previsto (R$)": item.valor_total ? item.valor_total / 100 : 0,
        "Status": item.status,
        "Data Recebimento": item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString("pt-BR") : "—",
        "Valor Recebido (R$)": item.valor_recebido ? item.valor_recebido / 100 : 0,
      }));
    } else if (selectedRelatorio === "contas_pagar") {
      rows = reportData.map((item) => ({
        "Descrição": item.descricao,
        "Obra": item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "Despesa Administrativa",
        "Fornecedor": item.fornecedores?.razao_social || "—",
        "Vencimento": new Date(item.data_vencimento).toLocaleDateString("pt-BR"),
        "Valor Previsto (R$)": item.valor_total ? item.valor_total / 100 : 0,
        "Status": item.status,
        "Data Pagamento": item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString("pt-BR") : "—",
        "Valor Pago (R$)": item.valor_pago ? item.valor_pago / 100 : 0,
      }));
    } else if (selectedRelatorio === "fluxo_caixa") {
      rows = reportData.map((item) => ({
        "Mês/Ano": item.mes_rotulo,
        "Receita Prevista (R$)": item.receitaPrev / 100,
        "Receita Realizada (R$)": item.receitaReal / 100,
        "Custo Previsto (R$)": item.custoPrev / 100,
        "Custo Realizado (R$)": item.custoReal / 100,
        "Balanço Realizado (R$)": (item.receitaReal - item.custoReal) / 100,
      }));
    } else if (selectedRelatorio === "resultado_obra") {
      rows = reportData.map((item) => ({
        "Indicador": item.indicador,
        "Previsto (R$)": item.previsto / 100,
        "Realizado (R$)": item.realizado / 100,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    // Style first row as bold manually or with column headers
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio-${selectedRelatorio}-${dateStr}.xlsx`);
  };

  const menuItems = [
    { type: "situacao_obras", label: "Situação das Obras", cat: "OPERACIONAL" as Categoria, icon: Building2 },
    { type: "cronograma_fisico", label: "Cronograma Físico", cat: "OPERACIONAL" as Categoria, icon: Layers },
    { type: "compras_periodo", label: "Compras por Período", cat: "OPERACIONAL" as Categoria, icon: ShoppingCart },
    { type: "posicao_estoque", label: "Posição de Estoque", cat: "OPERACIONAL" as Categoria, icon: Package },
    { type: "contas_receber", label: "Contas a Receber", cat: "FINANCEIRO" as Categoria, icon: TrendingUp },
    { type: "contas_pagar", label: "Contas a Pagar", cat: "FINANCEIRO" as Categoria, icon: DollarSign },
    { type: "fluxo_caixa", label: "Fluxo de Caixa", cat: "FINANCEIRO" as Categoria, icon: Calendar },
    { type: "resultado_obra", label: "Resultado por Obra", cat: "FINANCEIRO" as Categoria, icon: HardHat },
  ];

  return (
    <div className="flex gap-6 items-start h-[calc(100vh-6rem)]">
      {/* Subsidebar */}
      <div className="w-64 bg-card border rounded-lg h-full p-4 flex flex-col gap-5 shrink-0 overflow-y-auto">
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase mb-2 tracking-wider px-2">
            Operacional
          </div>
          <ul className="space-y-1">
            {menuItems
              .filter((i) => i.cat === "OPERACIONAL")
              .map((item) => (
                <li key={item.type}>
                  <button
                    onClick={() => setSelectedRelatorio(item.type as any)}
                    className={cn(
                      "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                      selectedRelatorio === item.type
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-3.5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>

        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase mb-2 tracking-wider px-2">
            Financeiro
          </div>
          <ul className="space-y-1">
            {menuItems
              .filter((i) => i.cat === "FINANCEIRO")
              .map((item) => (
                <li key={item.type}>
                  <button
                    onClick={() => setSelectedRelatorio(item.type as any)}
                    className={cn(
                      "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                      selectedRelatorio === item.type
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-3.5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 border rounded-lg bg-card h-full flex flex-col overflow-hidden">
        {/* Header toolbar */}
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4 bg-muted/20">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {menuItems.find((i) => i.type === selectedRelatorio)?.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consolide e exporte os dados do sistema.
            </p>
          </div>

          <Button
            size="sm"
            onClick={exportExcel}
            disabled={isLoading || !reportData || reportData.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
          >
            <FileSpreadsheet className="size-4" /> Exportar Excel
          </Button>
        </div>

        {/* Dynamic Filter Section */}
        <div className="p-4 border-b grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/5">
          {/* Obra filter (where relevant) */}
          {(selectedRelatorio === "cronograma_fisico" ||
            selectedRelatorio === "posicao_estoque" ||
            selectedRelatorio === "compras_periodo" ||
            selectedRelatorio === "contas_receber" ||
            selectedRelatorio === "contas_pagar" ||
            selectedRelatorio === "resultado_obra") && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Obra</label>
              <Select value={filtroObra} onValueChange={setFiltroObra}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedRelatorio !== "cronograma_fisico" &&
                    selectedRelatorio !== "posicao_estoque" &&
                    selectedRelatorio !== "resultado_obra" && (
                      <SelectItem value="todos">Todas as obras</SelectItem>
                    )}
                  {obras?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero} — {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status filter (where relevant) */}
          {(selectedRelatorio === "situacao_obras" ||
            selectedRelatorio === "contas_receber" ||
            selectedRelatorio === "contas_pagar") && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {selectedRelatorio === "situacao_obras" ? (
                    <>
                      <SelectItem value="planejamento">Planejamento</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </>
                  ) : selectedRelatorio === "contas_receber" ? (
                    <>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="recebida">Recebida</SelectItem>
                      <SelectItem value="atrasada">Atrasada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="paga">Paga</SelectItem>
                      <SelectItem value="atrasada">Atrasada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Client Filter (for contas_receber) */}
          {selectedRelatorio === "contas_receber" && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente</label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Supplier Filter (for contas_pagar, compras) */}
          {(selectedRelatorio === "contas_pagar" || selectedRelatorio === "compras_periodo") && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Fornecedor
              </label>
              <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os fornecedores</SelectItem>
                  {fornecedores?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date range picker */}
          {(selectedRelatorio === "compras_periodo" ||
            selectedRelatorio === "contas_receber" ||
            selectedRelatorio === "contas_pagar") && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Início Vencimento
                </label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Fim Vencimento
                </label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}
        </div>

        {/* Report Table Display */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !reportData || reportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
              <Download className="size-8 opacity-25 mb-1.5" />
              Nenhum dado localizado para os filtros selecionados.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectedRelatorio === "situacao_obras" && (
                      <>
                        <TableHead>Número</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Progresso</TableHead>
                        <TableHead className="text-right">Orçamento</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "cronograma_fisico" && (
                      <>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Peso na Obra</TableHead>
                        <TableHead className="text-right">Progresso Físico</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "compras_periodo" && (
                      <>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "posicao_estoque" && (
                      <>
                        <TableHead>Código</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Saldo Físico</TableHead>
                        <TableHead className="text-right">Estoque Mínimo</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "contas_receber" && (
                      <>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "contas_pagar" && (
                      <>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Obra / Fornecedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "fluxo_caixa" && (
                      <>
                        <TableHead>Mês / Ano</TableHead>
                        <TableHead className="text-right">Receitas Previstas</TableHead>
                        <TableHead className="text-right">Receitas Realizadas</TableHead>
                        <TableHead className="text-right">Saídas Previstas</TableHead>
                        <TableHead className="text-right">Saídas Realizadas</TableHead>
                        <TableHead className="text-right">Saldo Líquido</TableHead>
                      </>
                    )}
                    {selectedRelatorio === "resultado_obra" && (
                      <>
                        <TableHead>Indicador</TableHead>
                        <TableHead className="text-right">Previsto</TableHead>
                        <TableHead className="text-right">Realizado</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item, index) => (
                    <TableRow key={index}>
                      {selectedRelatorio === "situacao_obras" && (
                        <>
                          <TableCell className="font-mono text-xs">{item.numero}</TableCell>
                          <TableCell className="font-medium">{item.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.clientes?.nome || "—"}
                          </TableCell>
                          <TableCell className="capitalize text-xs">{item.status.replace(/_/g," ")}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {item.progresso}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.orcamento ? `R$ ${Number(item.orcamento).toLocaleString("pt-BR")}` : "—"}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "cronograma_fisico" && (
                        <>
                          <TableCell className="font-medium">{item.nome}</TableCell>
                          <TableCell className="text-right font-mono">{item.peso}%</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-blue-700">
                            {item.progresso_calculado}%
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "compras_periodo" && (
                        <>
                          <TableCell className="font-mono text-xs">Pedido #{item.numero}</TableCell>
                          <TableCell className="text-xs">
                            {item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.fornecedores?.razao_social || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {fmtBRL(item.valor_total)}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "posicao_estoque" && (
                        <>
                          <TableCell className="font-mono text-xs">
                            {item.material?.codigo || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {item.material?.descricao || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {Number(item.saldo || 0).toFixed(3)} {item.material?.unidade || ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {Number(item.material?.estoque_min || 0).toFixed(3)}{" "}
                            {item.material?.unidade || ""}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(item.saldo) === 0 ? (
                              <Badge variant="destructive">Zerado</Badge>
                            ) : Number(item.saldo) <= Number(item.material?.estoque_min) ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                Baixo
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Normal
                              </Badge>
                            )}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "contas_receber" && (
                        <>
                          <TableCell className="font-medium">{item.descricao}</TableCell>
                          <TableCell className="text-xs">
                            {item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="capitalize text-xs">{item.status}</TableCell>
                          <TableCell className="text-right font-mono text-green-700 font-semibold">
                            {fmtBRL(item.valor_total)}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "contas_pagar" && (
                        <>
                          <TableCell className="font-medium">{item.descricao}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">
                              {item.obras ? `${item.obras.numero} — ${item.obras.nome}` : "Despesa Administrativa"}
                            </div>
                            <div className="text-muted-foreground">
                              {item.fornecedores?.razao_social || ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="capitalize text-xs">{item.status}</TableCell>
                          <TableCell className="text-right font-mono text-red-700 font-semibold">
                            {fmtBRL(item.valor_total)}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "fluxo_caixa" && (
                        <>
                          <TableCell className="font-medium">{item.mes_rotulo}</TableCell>
                          <TableCell className="text-right font-mono text-green-700">
                            {fmtBRL(item.receitaPrev)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-800 font-semibold">
                            {fmtBRL(item.receitaReal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-700">
                            {fmtBRL(item.custoPrev)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-800 font-semibold">
                            {fmtBRL(item.custoReal)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono font-bold",
                              item.receitaReal - item.custoReal >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            )}
                          >
                            {fmtBRL(item.receitaReal - item.custoReal)}
                          </TableCell>
                        </>
                      )}
                      {selectedRelatorio === "resultado_obra" && (
                        <>
                          <TableCell className="font-medium">{item.indicador}</TableCell>
                          <TableCell className="text-right font-mono">{fmtBRL(item.previsto)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono font-bold",
                              item.realizado >= 0 ? "text-slate-800" : "text-red-700"
                            )}
                          >
                            {fmtBRL(item.realizado)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
