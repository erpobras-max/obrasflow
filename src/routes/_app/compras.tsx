import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Search, FileText, Package, Users, HardHat,
  AlertTriangle, Check, X, Star, Calendar, RefreshCw, ClipboardCheck, ArrowDown, Loader2,
  Download, Upload
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import * as XLSX from "xlsx";
import {
  fornecedorSchema,
  produtoSchema as materialSchema,
  solicitacaoSchema,
  pedidoSchema,
  type FornecedorFormValues,
  type ProdutoFormValues as MaterialFormValues,
  type SolicitacaoFormValues,
  type PedidoFormValues,
  type FornecedorRow,
  type ProdutoRow as MaterialRow,
  type SolicitacaoCompraRow,
  type SolicitacaoItemRow,
  type PedidoCompraRow,
  type PedidoItemRow
} from "@/lib/compras.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/compras")({
  component: ComprasPage,
});

const fmtBRL = (v: number | null | undefined) =>
  ((v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComprasPage() {
  const { perfil, loading, user } = useAuth();
  const qc = useQueryClient();

  const podeAprovar =
    perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "compras";

  const [activeTab, setActiveTab] = useState("solicitacoes");

  // State Modals
  const [fornecedorModal, setFornecedorModal] = useState<FornecedorRow | null | "new">(null);
  const [materialModal, setMaterialModal] = useState<MaterialRow | null | "new">(null);
  const [solicitacaoModal, setSolicitacaoModal] = useState<boolean>(false);
  const [aprovarModal, setAprovarModal] = useState<SolicitacaoCompraRow | null>(null);
  const [reprovarMotivo, setReprovarMotivo] = useState("");
  const [pedidoModal, setPedidoModal] = useState<SolicitacaoCompraRow | null>(null);
  const [recebimentoModal, setRecebimentoModal] = useState<PedidoCompraRow | null>(null);

  // Queries
  const { data: obras } = useQuery({
    queryKey: ["obras-opt"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obras")
        .select("id,numero,nome")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; numero: string; nome: string }[];
    },
  });

  const { data: fornecedores, isLoading: loadingForn } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fornecedores")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as FornecedorRow[];
    },
  });

  const { data: materiais, isLoading: loadingMat } = useQuery({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos")
        .select("id, codigo:sku, descricao:nome, unidade, categoria, estoque_min")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as MaterialRow[];
    },
  });

  const { data: solicitacoes, isLoading: loadingSol } = useQuery({
    queryKey: ["solicitacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solicitacoes_compra")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolicitacaoCompraRow[];
    },
  });

  const { data: pedidos, isLoading: loadingPed } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos_compra")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PedidoCompraRow[];
    },
  });

  // Maps for UI
  const obrasMap = useMemo(() => {
    const m: Record<string, string> = {};
    (obras ?? []).forEach((o) => { m[o.id] = `${o.numero} — ${o.nome}`; });
    return m;
  }, [obras]);

  const fornecedoresMap = useMemo(() => {
    const m: Record<string, string> = {};
    (fornecedores ?? []).forEach((f) => { m[f.id] = f.razao_social; });
    return m;
  }, [fornecedores]);

  const materiaisMap = useMemo(() => {
    const m: Record<string, MaterialRow> = {};
    (materiais ?? []).forEach((mat) => { m[mat.id] = mat; });
    return m;
  }, [materiais]);

  // KPIs
  const kpis = useMemo(() => {
    const pendentes = (solicitacoes ?? []).filter((s) => s.status === "aberta" || s.status === "em_aprovacao").length;
    const abertos = (pedidos ?? []).filter((p) => p.status === "emitido" || p.status === "confirmado").length;
    const atrasados = (pedidos ?? []).filter((p) => {
      if (p.status !== "emitido" && p.status !== "confirmado") return false;
      if (!p.data_entrega_prev) return false;
      return new Date(p.data_entrega_prev) < new Date();
    }).length;
    return { pendentes, abertos, atrasados };
  }, [solicitacoes, pedidos]);

  // Mutações
  const fornecedorMutation = useMutation({
    mutationFn: async (values: FornecedorFormValues) => {
      const payload = {
        razao_social: values.razao_social,
        nome_fantasia: values.nome_fantasia || null,
        cnpj: values.cnpj || null,
        cpf: values.cpf || null,
        tipo: values.tipo,
        email: values.email || null,
        telefone: values.telefone || null,
        avaliacao: values.avaliacao ? Number(values.avaliacao) : null,
        ativo: values.ativo,
      };

      if (fornecedorModal && fornecedorModal !== "new") {
        const { error } = await (supabase as any)
          .from("fornecedores")
          .update(payload)
          .eq("id", fornecedorModal.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("fornecedores")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fornecedor salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setFornecedorModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const materialMutation = useMutation({
    mutationFn: async (values: MaterialFormValues) => {
      const payload = {
        sku: values.codigo,
        nome: values.descricao,
        unidade: values.unidade,
        categoria: values.categoria,
        estoque_min: values.estoque_min,
      };

      if (materialModal && materialModal !== "new") {
        const { error } = await (supabase as any)
          .from("produtos")
          .update(payload)
          .eq("id", materialModal.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("produtos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["materiais"] });
      setMaterialModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: "aprovada" | "reprovada"; motivo?: string }) => {
      const { error } = await (supabase as any)
        .from("solicitacoes_compra")
        .update({
          status,
          reprovacao_motivo: motivo || null,
          aprovado_por: user?.id || null,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Solicitação ${variables.status === "aprovada" ? "aprovada" : "reprovada"} com sucesso`);
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      setAprovarModal(null);
      setReprovarMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportFornecedoresExcel = () => {
    if (!fornecedores || fornecedores.length === 0) {
      toast.error("Nenhum fornecedor cadastrado para exportar");
      return;
    }
    const rows = fornecedores.map((f) => ({
      "Razão Social": f.razao_social,
      "Nome Fantasia": f.nome_fantasia || "",
      "Tipo": f.tipo === "pj" ? "Pessoa Jurídica" : "Pessoa Física",
      "CNPJ": f.cnpj || "",
      "CPF": f.cpf || "",
      "E-mail": f.email || "",
      "Telefone": f.telefone || "",
      "Avaliação": f.avaliacao || "",
      "Status": f.ativo ? "Ativo" : "Inativo",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
    XLSX.writeFile(wb, `fornecedores-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPedidosExcel = () => {
    if (!pedidos || pedidos.length === 0) {
      toast.error("Nenhum pedido cadastrado para exportar");
      return;
    }
    const rows = pedidos.map((p) => ({
      "Data": new Date(p.created_at).toLocaleDateString("pt-BR"),
      "Fornecedor": fornecedoresMap[p.fornecedor_id] || "—",
      "Obra": obrasMap[p.obra_id] || "—",
      "Previsão Entrega": p.data_entrega_prev ? new Date(p.data_entrega_prev + "T00:00").toLocaleDateString("pt-BR") : "Não definida",
      "Valor Total": p.valor_total / 100,
      "Status": p.status.replace("_", " ").toUpperCase(),
      "Observações": p.observacoes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos de Compra");
    XLSX.writeFile(wb, `pedidos-compra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportMateriaisExcel = () => {
    if (!materiais || materiais.length === 0) {
      toast.error("Nenhum material cadastrado para exportar");
      return;
    }
    const rows = materiais.map((m) => ({
      "Código": m.codigo,
      "Descrição": m.descricao,
      "Unidade": m.unidade,
      "Categoria": m.categoria,
      "Estoque Mínimo": m.estoque_min,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo de Materiais");
    XLSX.writeFile(wb, `materiais-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportMateriaisExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const idxCodigo = headers.indexOf("código") !== -1 ? headers.indexOf("código") : headers.indexOf("codigo");
        const idxDescricao = headers.indexOf("descrição") !== -1 ? headers.indexOf("descrição") : headers.indexOf("descricao");
        const idxUnidade = headers.indexOf("unidade");
        const idxCategoria = headers.indexOf("categoria");
        const idxEstoqueMin = headers.indexOf("estoque mínimo") !== -1 ? headers.indexOf("estoque mínimo") : (headers.indexOf("estoque minimo") !== -1 ? headers.indexOf("estoque minimo") : headers.indexOf("estoque_min"));

        if (idxCodigo === -1 || idxDescricao === -1) {
          toast.error("Colunas obrigatórias 'Código' e 'Descrição' não encontradas.");
          return;
        }

        let countSuccess = 0;
        let countError = 0;

        for (const row of dataRows) {
          if (!row || row.length === 0) continue;

          const codigo = String(row[idxCodigo] ?? "").trim();
          const descricao = String(row[idxDescricao] ?? "").trim();

          if (!codigo || !descricao) {
            countError++;
            continue;
          }

          const unidade = idxUnidade !== -1 && row[idxUnidade] ? String(row[idxUnidade]).trim() : "UN";
          const categoria = idxCategoria !== -1 && row[idxCategoria] ? String(row[idxCategoria]).trim() : "MAT";
          const estoqueMinVal = idxEstoqueMin !== -1 && row[idxEstoqueMin] !== undefined ? Number(row[idxEstoqueMin]) : 0;
          const estoque_min = isNaN(estoqueMinVal) ? 0 : estoqueMinVal;

          const payload = {
            sku: codigo,
            nome: descricao,
            unidade,
            categoria,
            estoque_min,
          };

          const { data: existing } = await (supabase as any)
            .from("produtos")
            .select("id")
            .eq("sku", codigo)
            .maybeSingle();

          let error;
          if (existing) {
            const { error: err } = await (supabase as any)
              .from("produtos")
              .update(payload)
              .eq("id", existing.id);
            error = err;
          } else {
            const { error: err } = await (supabase as any)
              .from("produtos")
              .insert(payload);
            error = err;
          }

          if (error) {
            console.warn("Erro ao importar produto:", error.message);
            countError++;
          } else {
            countSuccess++;
          }
        }

        toast.success(`Importação concluída: ${countSuccess} cadastrados/atualizados, ${countError} falhas.`);
        qc.invalidateQueries({ queryKey: ["materiais"] });
      } catch (err) {
        toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Compras</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento de fornecedores, materiais, cotações, solicitações e pedidos.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#1e3a5f]/5 border-[#1e3a5f]/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Solicitações Pendentes</div>
              <div className="text-2xl font-bold mt-1 text-[#1e3a5f]">{kpis.pendentes}</div>
            </div>
            <div className="size-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center text-[#1e3a5f]">
              <ClipboardCheck className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-orange-800 font-semibold">Pedidos em Aberto</div>
              <div className="text-2xl font-bold mt-1 text-[#f97316]">{kpis.abertos}</div>
            </div>
            <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center text-[#f97316]">
              <ShoppingCart className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-red-800 font-semibold">Pedidos Atrasados</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{kpis.atrasados}</div>
            </div>
            <div className="size-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA: SOLICITAÇÕES */}
        {/* ========================================================================= */}
        <TabsContent value="solicitacoes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-foreground">Solicitações de Compra</h3>
            <Button onClick={() => setSolicitacaoModal(true)} className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
              <Plus className="size-4" /> Nova Solicitação
            </Button>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criação</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Urgente</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSol ? (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (solicitacoes ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma solicitação encontrada</TableCell></TableRow>
                ) : (solicitacoes ?? []).map((sol) => (
                  <TableRow key={sol.id}>
                    <TableCell className="text-sm">{new Date(sol.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{obrasMap[sol.obra_id] || "Obra desconhecida"}</TableCell>
                    <TableCell>
                      <Badge className={
                        sol.status === "aberta" ? "bg-gray-100 text-gray-800" :
                        sol.status === "em_aprovacao" ? "bg-amber-100 text-amber-800" :
                        sol.status === "aprovada" ? "bg-green-100 text-green-800" :
                        sol.status === "reprovada" ? "bg-red-100 text-red-800" :
                        "bg-blue-100 text-blue-800"
                      }>
                        {sol.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sol.urgente ? (
                        <Badge variant="destructive" className="gap-1 px-1.5"><AlertTriangle className="size-3" /> Sim</Badge>
                      ) : "Não"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(sol.status === "aberta" || sol.status === "em_aprovacao") && podeAprovar && (
                          <Button size="sm" variant="outline" className="h-7 text-green-700 border-green-200 hover:bg-green-50" onClick={() => setAprovarModal(sol)}>
                            Analisar
                          </Button>
                        )}
                        {sol.status === "aprovada" && (
                          <Button size="sm" className="h-7 bg-[#f97316] text-white hover:bg-[#f97316]/90" onClick={() => setPedidoModal(sol)}>
                            Gerar Pedido
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA: PEDIDOS */}
        {/* ========================================================================= */}
        <TabsContent value="pedidos" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">Pedidos de Compra</h3>
            <Button onClick={handleExportPedidosExcel} variant="outline" className="gap-2">
              <Download className="size-4" /> Exportar Excel
            </Button>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Previsão Entrega</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPed ? (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (pedidos ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum pedido gerado</TableCell></TableRow>
                ) : (pedidos ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{fornecedoresMap[p.fornecedor_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{obrasMap[p.obra_id] || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.data_entrega_prev ? new Date(p.data_entrega_prev + "T00:00").toLocaleDateString("pt-BR") : "Não definida"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtBRL(p.valor_total)}</TableCell>
                    <TableCell>
                      <Badge className={
                        p.status === "emitido" ? "bg-gray-100 text-gray-800" :
                        p.status === "confirmado" ? "bg-amber-100 text-amber-800" :
                        p.status === "entregue_parcial" ? "bg-blue-100 text-blue-800" :
                        p.status === "entregue" ? "bg-green-100 text-green-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {p.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(p.status === "emitido" || p.status === "confirmado" || p.status === "entregue_parcial") && (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setRecebimentoModal(p)}>
                          <ArrowDown className="size-3" /> Receber
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA: FORNECEDORES */}
        {/* ========================================================================= */}
        <TabsContent value="fornecedores" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">Cadastro de Fornecedores</h3>
            <div className="flex gap-2">
              <Button onClick={handleExportFornecedoresExcel} variant="outline" className="gap-2">
                <Download className="size-4" /> Exportar Excel
              </Button>
              <Button onClick={() => setFornecedorModal("new")} className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                <Plus className="size-4" /> Novo Fornecedor
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingForn ? (
                  <TableRow><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (fornecedores ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum fornecedor cadastrado</TableCell></TableRow>
                ) : (fornecedores ?? []).map((f) => (
                  <TableRow key={f.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => setFornecedorModal(f)}>
                    <TableCell className="font-semibold">{f.razao_social}</TableCell>
                    <TableCell>{f.nome_fantasia || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {f.telefone && <div>{f.telefone}</div>}
                      {f.email && <div className="text-xs text-muted-foreground">{f.email}</div>}
                    </TableCell>
                    <TableCell className="capitalize">{f.tipo}</TableCell>
                    <TableCell>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3.5 ${i < (f.avaliacao ?? 0) ? "fill-current" : "opacity-30"}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA: MATERIAIS */}
        {/* ========================================================================= */}
        <TabsContent value="materiais" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">Catálogo de Materiais</h3>
            <div className="flex gap-2">
              <Button onClick={handleExportMateriaisExcel} variant="outline" className="gap-2">
                <Download className="size-4" /> Exportar Excel
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" className="gap-2 pointer-events-none">
                  <Upload className="size-4" /> Importar Planilha
                </Button>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportMateriaisExcel} />
              </label>
              <Button onClick={() => setMaterialModal("new")} className="gap-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                <Plus className="size-4" /> Novo Material
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estoque Mínimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMat ? (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (materiais ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum material cadastrado</TableCell></TableRow>
                ) : (materiais ?? []).map((m) => (
                  <TableRow key={m.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => setMaterialModal(m)}>
                    <TableCell className="font-mono text-xs font-semibold">{m.codigo}</TableCell>
                    <TableCell className="font-medium">{m.descricao}</TableCell>
                    <TableCell>{m.unidade}</TableCell>
                    <TableCell><Badge variant="secondary">{m.categoria}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{m.estoque_min}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: CRUD FORNECEDOR */}
      {/* ========================================================================= */}
      {fornecedorModal && (
        <FornecedorDialog
          open={!!fornecedorModal}
          onOpenChange={(o) => !o && setFornecedorModal(null)}
          target={fornecedorModal === "new" ? null : fornecedorModal}
          onSubmit={fornecedorMutation.mutate}
          submitting={fornecedorMutation.isPending}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRUD MATERIAL */}
      {/* ========================================================================= */}
      {materialModal && (
        <MaterialDialog
          open={!!materialModal}
          onOpenChange={(o) => !o && setMaterialModal(null)}
          target={materialModal === "new" ? null : materialModal}
          onSubmit={materialMutation.mutate}
          submitting={materialMutation.isPending}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA SOLICITAÇÃO */}
      {/* ========================================================================= */}
      {solicitacaoModal && (
        <SolicitacaoDialog
          open={solicitacaoModal}
          onOpenChange={setSolicitacaoModal}
          obras={obras ?? []}
          materiais={materiais ?? []}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["solicitacoes"] });
            setSolicitacaoModal(false);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: APROVAÇÃO SOLICITAÇÃO */}
      {/* ========================================================================= */}
      {aprovarModal && (
        <AprovacaoDialog
          open={!!aprovarModal}
          onOpenChange={(o) => !o && setAprovarModal(null)}
          solicitacao={aprovarModal}
          materiaisMap={materiaisMap}
          reprovarMotivo={reprovarMotivo}
          onMotivoChange={setReprovarMotivo}
          onAction={(status) => approveMutation.mutate({ id: aprovarModal.id, status, motivo: reprovarMotivo })}
          submitting={approveMutation.isPending}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: GERAR PEDIDO COMPRA */}
      {/* ========================================================================= */}
      {pedidoModal && (
        <GerarPedidoDialog
          open={!!pedidoModal}
          onOpenChange={(o) => !o && setPedidoModal(null)}
          solicitacao={pedidoModal}
          fornecedores={fornecedores ?? []}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["pedidos"] });
            qc.invalidateQueries({ queryKey: ["solicitacoes"] });
            setPedidoModal(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR RECEBIMENTO */}
      {/* ========================================================================= */}
      {recebimentoModal && (
        <RecebimentoDialog
          open={!!recebimentoModal}
          onOpenChange={(o) => !o && setRecebimentoModal(null)}
          pedido={recebimentoModal}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["pedidos"] });
            setRecebimentoModal(null);
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// SUB-DIALOGS IMPLEMENTATION
// ==========================================

function FornecedorDialog({
  open, onOpenChange, target, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: FornecedorRow | null;
  onSubmit: (values: FornecedorFormValues) => void;
  submitting: boolean;
}) {
  const form = useForm<any>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      cpf: "",
      tipo: "pj",
      email: "",
      telefone: "",
      avaliacao: 5,
      ativo: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (target) {
        form.reset({
          razao_social: target.razao_social,
          nome_fantasia: target.nome_fantasia ?? "",
          cnpj: target.cnpj ?? "",
          cpf: target.cpf ?? "",
          tipo: target.tipo,
          email: target.email ?? "",
          telefone: target.telefone ?? "",
          avaliacao: target.avaliacao ?? 5,
          ativo: target.ativo,
        });
      } else {
        form.reset({
          razao_social: "",
          nome_fantasia: "",
          cnpj: "",
          cpf: "",
          tipo: "pj",
          email: "",
          telefone: "",
          avaliacao: 5,
          ativo: true,
        });
      }
    }
  }, [open, target, form]);

  const tipo = form.watch("tipo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Editar Fornecedor" : "Cadastrar Fornecedor"}</DialogTitle>
          <DialogDescription>Insira os dados de contato e faturamento do fornecedor.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                      <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {tipo === "pj" ? (
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="cpf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="razao_social" render={({ field }) => (
              <FormItem>
                <FormLabel>{tipo === "pj" ? "Razão Social *" : "Nome Completo *"}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {tipo === "pj" && (
              <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Fantasia</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" placeholder="fornecedor@email.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <FormField control={form.control} name="avaliacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avaliação Geral (Estrelas)</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <SelectItem key={s} value={String(s)}>{s} Estrela{s > 1 && "s"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="ativo" render={({ field }) => (
                <FormItem className="flex items-center gap-3 border rounded px-3 py-2 bg-muted/20">
                  <FormLabel className="flex-1 mt-0">Ativo</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
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

function MaterialDialog({
  open, onOpenChange, target, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: MaterialRow | null;
  onSubmit: (values: MaterialFormValues) => void;
  submitting: boolean;
}) {
  const form = useForm<any>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      codigo: "",
      descricao: "",
      unidade: "un",
      categoria: "MAT",
      estoque_min: 0,
    },
  });

  useEffect(() => {
    if (open) {
      if (target) {
        form.reset({
          codigo: target.codigo,
          descricao: target.descricao,
          unidade: target.unidade,
          categoria: target.categoria,
          estoque_min: target.estoque_min,
        });
      } else {
        form.reset({
          codigo: "",
          descricao: "",
          unidade: "un",
          categoria: "MAT",
          estoque_min: 0,
        });
      }
    }
  }, [open, target, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target ? "Editar Material" : "Cadastrar Material"}</DialogTitle>
          <DialogDescription>Cadastre materiais no catálogo geral do ERP.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="codigo" render={({ field }) => (
              <FormItem>
                <FormLabel>Código Único (SKU/Código de Fábrica) *</FormLabel>
                <FormControl><Input placeholder="CIM-01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição/Nome do Material *</FormLabel>
                <FormControl><Input placeholder="Cimento CP-II 50kg" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="unidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade de Medida *</FormLabel>
                  <FormControl><Input placeholder="Ex: un, kg, m3, sc" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="categoria" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl><Input placeholder="Ex: MAT, ELE, HID" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="estoque_min" render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque Mínimo para Alerta</FormLabel>
                <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
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

function SolicitacaoDialog({
  open, onOpenChange, obras, materiais, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  obras: { id: string; numero: string; nome: string }[];
  materiais: MaterialRow[];
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const form = useForm<any>({
    resolver: zodResolver(solicitacaoSchema),
    defaultValues: {
      obra_id: "",
      urgente: false,
      observacoes: "",
      itens: [{ material_id: "", descricao_livre: "", quantidade: 1, unidade: "un" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  const onSubmit = async (values: SolicitacaoFormValues) => {
    try {
      // 1. Insert header
      const { data: sol, error: solErr } = await (supabase as any)
        .from("solicitacoes_compra")
        .insert({
          obra_id: values.obra_id,
          solicitante_id: user?.id,
          urgente: values.urgente,
          observacoes: values.observacoes || null,
          status: "em_aprovacao",
        })
        .select()
        .single();

      if (solErr) throw solErr;

      // 2. Insert items
      const itemsPayload = values.itens.map((item) => ({
        solicitacao_id: sol.id,
        produto_id: item.material_id || null,
        descricao_livre: item.descricao_livre || null,
        quantidade: item.quantidade,
        unidade: item.unidade,
      }));

      const { error: itemsErr } = await (supabase as any)
        .from("solicitacao_itens")
        .insert(itemsPayload);

      if (itemsErr) throw itemsErr;

      toast.success("Solicitação enviada para aprovação");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Compra</DialogTitle>
          <DialogDescription>Selecione a obra de destino e adicione as quantidades dos itens necessários.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 items-end">
              <FormField control={form.control as any} name="obra_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {obras.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.numero} — {o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control as any} name="urgente" render={({ field }) => (
                <FormItem className="flex items-center gap-3 border rounded px-3 py-2 bg-red-50/50 border-red-100">
                  <FormLabel className="flex-1 mt-0 text-red-900 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-red-600" /> Marcar como urgente
                  </FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold">Itens Necessários *</label>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => append({ material_id: "", descricao_livre: "", quantidade: 1, unidade: "un" })}>
                  <Plus className="size-3.5" /> Adicionar Item
                </Button>
              </div>

              {fields.map((f, idx) => {
                const selectedMatId = form.watch(`itens.${idx}.material_id`);
                return (
                  <div key={f.id} className="grid grid-cols-[1.5fr_1fr_100px_90px_auto] gap-2 items-start bg-muted/10 border p-3 rounded-lg relative">
                    <FormField control={form.control as any} name={`itens.${idx}.material_id`} render={({ field }) => (
                      <FormItem>
                        <Select value={field.value || "_libre"} onValueChange={(val) => {
                          field.onChange(val === "_libre" ? "" : val);
                          if (val !== "_libre" && val) {
                            const mat = materiais.find((m) => m.id === val);
                            if (mat) form.setValue(`itens.${idx}.unidade`, mat.unidade);
                          }
                        }}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione material" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="_libre">— Campo Livre —</SelectItem>
                            {materiais.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.codigo} - {m.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control as any} name={`itens.${idx}.descricao_livre`} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Descrição alternativa" disabled={!!selectedMatId} {...field} />
                        </FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control as any} name={`itens.${idx}.quantidade`} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="Qtd" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control as any} name={`itens.${idx}.unidade`} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Unidade" disabled={!!selectedMatId} {...field} />
                        </FormControl>
                      </FormItem>
                    )} />

                    <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => fields.length > 1 && remove(idx)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <FormField control={form.control as any} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações/Instruções Adicionais</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AprovacaoDialog({
  open, onOpenChange, solicitacao, materiaisMap, reprovarMotivo, onMotivoChange, onAction, submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  solicitacao: SolicitacaoCompraRow;
  materiaisMap: Record<string, MaterialRow>;
  reprovarMotivo: string;
  onMotivoChange: (val: string) => void;
  onAction: (status: "aprovada" | "reprovada") => void;
  submitting: boolean;
}) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ["solicitacao-itens", solicitacao.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solicitacao_itens")
        .select("*")
        .eq("solicitacao_id", solicitacao.id);
      if (error) throw error;
      return (data ?? []) as SolicitacaoItemRow[];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Análise de Solicitação de Compra</DialogTitle>
          <DialogDescription>Revise os itens e aprove ou reprove a solicitação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {solicitacao.observacoes && (
            <div className="bg-muted/30 border p-3 rounded text-sm text-foreground">
              <strong>Observações: </strong> {solicitacao.observacoes}
            </div>
          )}

          <div className="border rounded overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material / Descrição</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : (itens ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {it.material_id ? (materiaisMap[it.material_id]?.descricao || "Material") : it.descricao_livre || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">{it.quantidade}</TableCell>
                    <TableCell>{it.unidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-1.5">
            <FormLabel>Motivo da Reprovação (Obrigatório apenas se for reprovar)</FormLabel>
            <Textarea
              placeholder="Descreva o motivo caso vá reprovar a solicitação..."
              value={reprovarMotivo}
              onChange={(e) => onMotivoChange(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="destructive" disabled={submitting || !reprovarMotivo.trim()} onClick={() => onAction("reprovada")}>
            Reprovar
          </Button>
          <Button className="bg-green-700 hover:bg-green-800 text-white" disabled={submitting} onClick={() => onAction("aprovada")}>
            Aprovar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerarPedidoDialog({
  open, onOpenChange, solicitacao, fornecedores, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  solicitacao: SolicitacaoCompraRow;
  fornecedores: FornecedorRow[];
  onSuccess: () => void;
}) {
  const form = useForm<any>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      fornecedor_id: "",
      data_entrega_prev: "",
      observacoes: "",
      itens: [],
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "itens" });

  const { data: itens, isLoading } = useQuery({
    queryKey: ["solicitacao-itens-ped", solicitacao.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solicitacao_itens")
        .select("material_id:produto_id,descricao_livre,quantidade,unidade")
        .eq("solicitacao_id", solicitacao.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && itens) {
      const mapped = (itens as any[] ?? []).map((it: any) => ({
        material_id: it.material_id || null,
        descricao: it.descricao_livre || "",
        quantidade: it.quantidade,
        unidade: it.unidade,
        valor_unit: 0.0,
      }));

      // Fetch names for material_ids if available to prefill descriptions
      (async () => {
        for (const it of mapped) {
          if (it.material_id) {
            const { data } = await (supabase as any).from("produtos").select("descricao:nome").eq("id", it.material_id).single();
            if (data?.descricao) it.descricao = data.descricao;
          }
        }
        form.reset({
          fornecedor_id: "",
          data_entrega_prev: "",
          observacoes: "",
          itens: mapped,
        });
      })();
    }
  }, [open, itens, form]);

  // Watch unit prices to calculate total
  const formItens = form.watch("itens") || [];
  const valorTotalCalculado = useMemo(() => {
    return formItens.reduce((sum: number, it: any) => {
      const price = Number(it.valor_unit || 0) * 100; // to centavos
      const qty = Number(it.quantidade || 0);
      return sum + (price * qty);
    }, 0);
  }, [formItens]);

  const onSubmit = async (values: PedidoFormValues) => {
    try {
      // 1. Insert Pedido
      const { data: ped, error: pedErr } = await (supabase as any)
        .from("pedidos_compra")
        .insert({
          solicitacao_id: solicitacao.id,
          fornecedor_id: values.fornecedor_id,
          obra_id: solicitacao.obra_id,
          status: "emitido",
          data_entrega_prev: values.data_entrega_prev || null,
          observacoes: values.observacoes || null,
          valor_total: Math.round(valorTotalCalculado),
        })
        .select()
        .single();

      if (pedErr) throw pedErr;

      // 2. Insert items
      const itemsPayload = values.itens.map((item) => ({
        pedido_id: ped.id,
        produto_id: item.material_id || null,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unit: Math.round(item.valor_unit * 100),
      }));

      const { error: itemsErr } = await (supabase as any)
        .from("pedido_itens")
        .insert(itemsPayload);

      if (itemsErr) throw itemsErr;

      // 3. Mark solicitacao as pedido_gerado
      await (supabase as any)
        .from("solicitacoes_compra")
        .update({ status: "pedido_gerado" })
        .eq("id", solicitacao.id);

      toast.success("Pedido de compra gerado!");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Pedido de Compra</DialogTitle>
          <DialogDescription>Revise os quantitativos e informe os preços negociados com o fornecedor.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin size-6 text-muted-foreground" /></div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control as any} name="fornecedor_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control as any} name="data_entrega_prev" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsão de Entrega</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-2">
                <FormLabel>Itens e Preços Negociados</FormLabel>

                {fields.map((f, idx) => (
                  <div key={f.id} className="grid grid-cols-[2fr_100px_90px_120px] gap-2 items-center bg-muted/10 border p-3 rounded-lg">
                    <div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {form.watch(`itens.${idx}.descricao`)}
                      </div>
                    </div>
                    <FormField control={form.control as any} name={`itens.${idx}.quantidade`} render={({ field }) => (
                      <FormItem>
                        <FormControl><Input type="number" step="0.001" placeholder="Qtd" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div>
                      <Badge variant="secondary" className="text-xs">{form.watch(`itens.${idx}.unidade`)}</Badge>
                    </div>
                    <FormField control={form.control as any} name={`itens.${idx}.valor_unit`} render={({ field }) => (
                      <FormItem>
                        <FormControl><Input type="number" step="0.01" placeholder="R$ Unit" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t pt-3 bg-muted/20 px-4 py-2 rounded border">
                <span className="font-semibold text-sm">Valor Total do Pedido:</span>
                <span className="text-lg font-bold text-green-700 font-mono">{fmtBRL(valorTotalCalculado)}</span>
              </div>

              <FormField control={form.control as any} name="observacoes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações do Pedido</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white">
                  Confirmar e Emitir Pedido
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecebimentoDialog({
  open, onOpenChange, pedido, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedido: PedidoCompraRow;
  onSuccess: () => void;
}) {
  const [recebendo, setRecebendo] = useState(false);
  const { data: itens, isLoading } = useQuery({
    queryKey: ["pedido-itens-rec", pedido.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedido_itens")
        .select("id, pedido_id, material_id:produto_id, descricao, quantidade, unidade, valor_unit, valor_total")
        .eq("pedido_id", pedido.id);
      if (error) throw error;
      return (data ?? []) as PedidoItemRow[];
    },
    enabled: open,
  });

  const [quantidadesRecebidas, setQuantidadesRecebidas] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && itens) {
      const q: Record<string, number> = {};
      itens.forEach((it) => {
        q[it.id] = it.quantidade; // Default to receive full qty
      });
      setQuantidadesRecebidas(q);
    }
  }, [open, itens]);

  const handleConfirm = async () => {
    setRecebendo(true);
    try {
      let todasEntregues = true;
      let algumaEntregue = false;
      let totalReceivedCentavos = 0;

      // Obter id do depósito padrão DPG
      const { data: dep } = await (supabase as any)
        .from("depositos")
        .select("id")
        .eq("codigo", "DPG")
        .maybeSingle();
      const targetDepositoId = dep?.id;

      if (!targetDepositoId) {
        throw new Error("Depósito Geral (DPG) não localizado no sistema.");
      }

      for (const it of itens ?? []) {
        const recebida = quantidadesRecebidas[it.id] ?? 0;
        if (recebida < it.quantidade) {
          todasEntregues = false;
        }
        if (recebida > 0) {
          algumaEntregue = true;
          totalReceivedCentavos += Math.round(recebida * Number(it.valor_unit));
        }

        // Trigger stock movement if product_id is linked
        if (it.material_id && recebida > 0) {
          const { error: stockErr } = await (supabase as any).rpc("registrar_movimentacao_produto", {
            p_produto_id: it.material_id,
            p_deposito_id: targetDepositoId,
            p_tipo: "entrada",
            p_quantidade: recebida,
            p_custo_unitario: Number(it.valor_unit) / 100, // converter de centavos
            p_deposito_destino_id: null,
            p_observacao: `Recebimento de Pedido #${pedido.id.slice(0, 8)}`,
          });
          if (stockErr) console.warn("Erro ao registrar movimentação de estoque: ", stockErr.message);
        }
      }

      const statusFinal = todasEntregues ? "entregue" : algumaEntregue ? "entregue_parcial" : "confirmado";

      const { error: updErr } = await (supabase as any)
        .from("pedidos_compra")
        .update({ status: statusFinal })
        .eq("id", pedido.id);

      if (updErr) throw updErr;

      // Automatically launch accounts payable (contas_pagar) if any item was received
      if (algumaEntregue && totalReceivedCentavos > 0) {
        const dataVenc = pedido.data_entrega_prev || new Date().toISOString().slice(0, 10);
        const { error: payErr } = await (supabase as any)
          .from("contas_pagar")
          .insert({
            obra_id: pedido.obra_id,
            fornecedor_id: pedido.fornecedor_id,
            pedido_id: pedido.id,
            descricao: `Faturamento - Recebimento de Pedido #${pedido.id.slice(0, 8)}`,
            valor_total: totalReceivedCentavos,
            data_vencimento: dataVenc,
            status: "aberta",
          });
        if (payErr) {
          console.warn("Erro ao lançar conta a pagar: ", payErr.message);
        }
      }

      toast.success("Recebimento registrado com sucesso!");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRecebendo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento de Materiais</DialogTitle>
          <DialogDescription>Confirme as quantidades recebidas no canteiro de obras.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin size-6 text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material / Descrição</TableHead>
                    <TableHead className="text-right">Qtd Comprada</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="w-32">Qtd Recebida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(itens ?? []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.descricao}</TableCell>
                      <TableCell className="text-right font-mono">{it.quantidade}</TableCell>
                      <TableCell>{it.unidade}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          max={it.quantidade}
                          min={0}
                          value={quantidadesRecebidas[it.id] ?? 0}
                          onChange={(e) => setQuantidadesRecebidas({
                            ...quantidadesRecebidas,
                            [it.id]: Math.min(it.quantidade, Math.max(0, Number(e.target.value))),
                          })}
                          className="h-8 py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recebendo}>Cancelar</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white" disabled={recebendo} onClick={handleConfirm}>
                {recebendo ? "Salvando..." : "Confirmar Recebimento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
