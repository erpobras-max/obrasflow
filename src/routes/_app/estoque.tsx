import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Package, Plus, Search, Calendar, RefreshCw, AlertTriangle,
  ArrowUpDown, Loader2, Info, FileSpreadsheet, Upload, History,
  GitCompare, Landmark, ArrowRightLeft, Settings
} from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/estoque")({
  head: () => ({ meta: [{ title: "Estoque — ERP Obras" }] }),
  component: EstoquePage,
});

// Product validation schema
const produtoFormSchema = z.object({
  sku: z.string().trim().min(1, "SKU é obrigatório").max(50),
  nome: z.string().trim().min(2, "Descrição/Nome é obrigatório").max(200),
  categoria: z.string().trim().max(100).optional().or(z.literal("")),
  unidade: z.string().trim().min(1, "Unidade é obrigatória").max(10).default("UN"),
  preco_custo: z.coerce.number().min(0, "Custo inválido"),
  preco_venda: z.coerce.number().min(0, "Venda inválida"),
  ncm: z.string().trim().max(10).optional().or(z.literal("")),
  gtin: z.string().trim().max(20).optional().or(z.literal("")),
  situacao: z.enum(["ativo", "inativo"]).default("ativo"),
  estoque_min: z.coerce.number().min(0).default(0),
  estoque_max: z.coerce.number().min(0).default(0),
  imagem_url: z.string().trim().url().optional().or(z.literal("")),
});

type ProdutoFormValues = z.infer<typeof produtoFormSchema>;

// Warehouse validation schema
const depositoFormSchema = z.object({
  nome: z.string().trim().min(2, "Nome do depósito obrigatório").max(100),
  codigo: z.string().trim().min(2, "Código único obrigatório").max(20),
  ativo: z.boolean().default(true),
});

type DepositoFormValues = z.infer<typeof depositoFormSchema>;

// Quick adjustment validation schema
const ajusteFormSchema = z.object({
  produto_id: z.string().uuid("Selecione um produto"),
  deposito_id: z.string().uuid("Selecione um depósito"),
  quantidade: z.coerce.number().min(0, "O saldo final deve ser maior ou igual a zero"),
  preco_custo: z.coerce.number().min(0, "Preço de custo inválido").optional(),
  observacao: z.string().trim().max(500).optional().or(z.literal("")),
});

type AjusteFormValues = z.infer<typeof ajusteFormSchema>;

interface ProductRow {
  id: string;
  sku: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  ncm: string | null;
  gtin: string | null;
  situacao: "ativo" | "inativo";
  estoque_min: number;
  estoque_max: number;
  imagem_url: string | null;
  created_at: string;
}

interface DepositoRow {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  created_at: string;
}

interface PosicaoEstoqueRow {
  id: string;
  produto_id: string;
  deposito_id: string;
  saldo: number;
  produtos: { sku: string; nome: string; categoria: string | null; unidade: string; estoque_min: number; estoque_max: number; situacao: string } | null;
  depositos: { nome: string } | null;
}

interface MovimentacaoRow {
  id: string;
  produto_id: string;
  deposito_id: string;
  deposito_destino_id: string | null;
  tipo: "entrada" | "saida" | "ajuste" | "transferencia";
  quantidade: number;
  custo_unitario: number;
  saldo_apos: number;
  custo_medio_apos: number;
  observacao: string | null;
  created_at: string;
  produtos: { sku: string; nome: string; unidade: string } | null;
  deposito_origem: { nome: string } | null;
  deposito_destino: { nome: string } | null;
}

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EstoquePage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("produtos");

  // Search/Filters states
  const [searchProd, setSearchProd] = useState("");
  const [filterDep, setFilterDep] = useState<string>("all");
  const [searchPos, setSearchPos] = useState("");
  const [searchMov, setSearchMov] = useState("");

  // Modals target
  const [productModal, setProductModal] = useState<ProductRow | null | "new">(null);
  const [depositoModal, setDepositoModal] = useState<DepositoRow | null | "new">(null);
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);

  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria" ||
    perfil?.perfil === "almoxarifado";

  // Queries
  const { data: produtos, isLoading: loadingProds } = useQuery({
    queryKey: ["produtos-estoque-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const { data: depositos, isLoading: loadingDeps } = useQuery({
    queryKey: ["depositos-estoque-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depositos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as DepositoRow[];
    },
  });

  const { data: posicao, isLoading: loadingPos } = useQuery({
    queryKey: ["posicao-estoque-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_estoque")
        .select("*, produtos(sku, nome, categoria, unidade, estoque_min, estoque_max, situacao), depositos(nome)");
      if (error) throw error;
      return (data ?? []) as unknown as PosicaoEstoqueRow[];
    },
  });

  const { data: movimentacoes, isLoading: loadingMovs } = useQuery({
    queryKey: ["movimentacoes-estoque-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select(`
          *,
          produtos(sku, nome, unidade),
          deposito_origem:depositos!movimentacoes_estoque_deposito_id_fkey(nome),
          deposito_destino:depositos!movimentacoes_estoque_deposito_destino_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MovimentacaoRow[];
    },
  });

  // Filtered lists
  const filteredProducts = useMemo(() => {
    return (produtos ?? []).filter((p) => {
      if (searchProd) {
        const s = searchProd.toLowerCase();
        return p.nome.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.gtin && p.gtin.includes(s));
      }
      return true;
    });
  }, [produtos, searchProd]);

  const filteredPosicao = useMemo(() => {
    return (posicao ?? []).filter((pos) => {
      if (filterDep !== "all" && pos.deposito_id !== filterDep) return false;
      if (searchPos) {
        const s = searchPos.toLowerCase();
        return pos.produtos?.nome.toLowerCase().includes(s) || pos.produtos?.sku.toLowerCase().includes(s);
      }
      return true;
    });
  }, [posicao, filterDep, searchPos]);

  const filteredMovs = useMemo(() => {
    return (movimentacoes ?? []).filter((mov) => {
      if (searchMov) {
        const s = searchMov.toLowerCase();
        return mov.produtos?.nome.toLowerCase().includes(s) || mov.produtos?.sku.toLowerCase().includes(s) || (mov.observacao && mov.observacao.toLowerCase().includes(s));
      }
      return true;
    });
  }, [movimentacoes, searchMov]);

  const stockAlertsCount = useMemo(() => {
    return (posicao ?? []).filter(pos => pos.produtos && pos.saldo <= pos.produtos.estoque_min).length;
  }, [posicao]);

  // Mutations
  const productMutation = useMutation({
    mutationFn: async (values: ProdutoFormValues) => {
      if (productModal && productModal !== "new") {
        const { error } = await supabase.from("produtos").update(values as any).eq("id", productModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["produtos-estoque-list"] });
      setProductModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const depositoMutation = useMutation({
    mutationFn: async (values: DepositoFormValues) => {
      if (depositoModal && depositoModal !== "new") {
        const { error } = await supabase.from("depositos").update(values as any).eq("id", depositoModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("depositos").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Depósito salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["depositos-estoque-list"] });
      setDepositoModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajusteMutation = useMutation({
    mutationFn: async (values: AjusteFormValues) => {
      const { error } = await supabase.rpc("registrar_movimentacao_produto", {
        p_produto_id: values.produto_id,
        p_deposito_id: values.deposito_id,
        p_tipo: "ajuste",
        p_quantidade: values.quantidade,
        p_custo_unitario: values.preco_custo || 0,
        p_deposito_destino_id: null,
        p_observacao: values.observacao || "Ajuste de saldo manual"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajuste de saldo efetuado!");
      qc.invalidateQueries({ queryKey: ["posicao-estoque-list"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-estoque-list"] });
      setAjusteModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportExcel = () => {
    if (!posicao || posicao.length === 0) return;
    const dataRows = posicao.map(pos => ({
      SKU: pos.produtos?.sku || "",
      Produto: pos.produtos?.nome || "",
      Depósito: pos.depositos?.nome || "",
      Unidade: pos.produtos?.unidade || "",
      Saldo: pos.saldo,
      Mínimo: pos.produtos?.estoque_min || 0,
      Máximo: pos.produtos?.estoque_max || 0,
      Situação: pos.produtos?.situacao || "ativo",
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Posição de Estoque");
    XLSX.writeFile(wb, "posicao_estoque.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos & Estoque</h1>
          <p className="text-sm text-muted-foreground">Ficha de produtos, múltiplos depósitos e auditoria de movimentações.</p>
        </div>
        <div className="flex gap-2">
          {podeEditar && (
            <Button variant="outline" className="gap-2" onClick={() => setAjusteModalOpen(true)}>
              <GitCompare className="size-4" /> Ajustar Saldo
            </Button>
          )}
          {activeTab === "produtos" && podeEditar && (
            <Button className="gap-2" onClick={() => setProductModal("new")}>
              <Plus className="size-4" /> Novo Produto
            </Button>
          )}
          {activeTab === "depositos" && podeEditar && (
            <Button className="gap-2" onClick={() => setDepositoModal("new")}>
              <Plus className="size-4" /> Novo Depósito
            </Button>
          )}
        </div>
      </div>

      {stockAlertsCount > 0 && (
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30">
          <CardContent className="p-4 flex items-center gap-3 text-amber-800 dark:text-amber-300 text-sm">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              Você possui <strong>{stockAlertsCount}</strong> produtos com saldo igual ou abaixo do estoque mínimo definido.
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="size-4" /> Cadastro de Produtos
          </TabsTrigger>
          <TabsTrigger value="depositos" className="gap-2">
            <Landmark className="size-4" /> Depósitos
          </TabsTrigger>
          <TabsTrigger value="posicao" className="gap-2">
            <Landmark className="size-4" /> Posição de Estoque
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2">
            <History className="size-4" /> Extrato de Movimentações
          </TabsTrigger>
        </TabsList>

        {/* TAB: PRODUTOS */}
        <TabsContent value="produtos" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
              <CardTitle className="text-md">Catálogo de Produtos</CardTitle>
              <div className="relative w-80">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU, nome ou GTIN..."
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              {loadingProds ? (
                <div className="p-6 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhum produto cadastrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Preço Venda</TableHead>
                      <TableHead className="text-right">Preço Custo</TableHead>
                      <TableHead>Situação</TableHead>
                      {podeEditar && <TableHead className="w-20 text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold text-xs">{p.sku}</TableCell>
                        <TableCell className="font-semibold text-xs">{p.nome}</TableCell>
                        <TableCell className="text-xs">{p.categoria || "—"}</TableCell>
                        <TableCell className="text-xs">{p.unidade}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-primary">{fmtBRL(p.preco_venda)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{fmtBRL(p.preco_custo)}</TableCell>
                        <TableCell>
                          <Badge variant={p.situacao === "ativo" ? "default" : "secondary"} className="text-[10px]">
                            {p.situacao.toUpperCase()}
                          </Badge>
                        </TableCell>
                        {podeEditar && (
                          <TableCell className="text-center">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setProductModal(p)}>
                              <Settings className="size-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DEPOSITOS */}
        <TabsContent value="depositos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Locais de Armazenamento</CardTitle>
              <CardDescription>Depósitos cadastrados no sistema para movimentações internas e de vendas/compras.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDeps ? (
                <div className="p-6 space-y-3"><Skeleton className="h-10 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome do Depósito</TableHead>
                      <TableHead>Status</TableHead>
                      {podeEditar && <TableHead className="w-20 text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depositos?.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.codigo}</TableCell>
                        <TableCell className="font-semibold text-xs">{d.nome}</TableCell>
                        <TableCell>
                          <Badge variant={d.ativo ? "default" : "secondary"} className="text-[10px]">
                            {d.ativo ? "ATIVO" : "INATIVO"}
                          </Badge>
                        </TableCell>
                        {podeEditar && (
                          <TableCell className="text-center">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setDepositoModal(d)}>
                              <Settings className="size-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: POSICAO */}
        <TabsContent value="posicao" className="space-y-4">
          <Card>
            <CardHeader className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-md">Saldos Físicos em Estoque</CardTitle>
                <CardDescription>Consulta rápida de saldos agrupados por local de armazenamento.</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterDep} onValueChange={setFilterDep}>
                  <SelectTrigger className="w-56 h-9">
                    <SelectValue placeholder="Selecione o Depósito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Depósitos</SelectItem>
                    {depositos?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Buscar por SKU/nome..."
                  value={searchPos}
                  onChange={(e) => setSearchPos(e.target.value)}
                  className="w-56 h-9"
                />
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
                  <FileSpreadsheet className="size-4" /> Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPos ? (
                <div className="p-6"><Skeleton className="h-10 w-full" /></div>
              ) : filteredPosicao.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhum saldo registrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-right">Saldo Físico</TableHead>
                      <TableHead className="text-right">Min/Max</TableHead>
                      <TableHead>Alerta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosicao.map((pos) => {
                      const isLow = pos.produtos && pos.saldo <= pos.produtos.estoque_min;
                      const isZero = pos.saldo <= 0;
                      return (
                        <TableRow key={pos.id}>
                          <TableCell className="font-bold text-xs">{pos.produtos?.sku}</TableCell>
                          <TableCell className="font-semibold text-xs">{pos.produtos?.nome}</TableCell>
                          <TableCell className="text-xs">{pos.depositos?.nome}</TableCell>
                          <TableCell className="text-center text-xs">{pos.produtos?.unidade}</TableCell>
                          <TableCell className="text-right font-bold text-xs">{pos.saldo}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {pos.produtos?.estoque_min || 0} / {pos.produtos?.estoque_max || 0}
                          </TableCell>
                          <TableCell>
                            {isZero ? (
                              <Badge className="bg-red-600 text-white text-[10px]">ZERADO</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-500 text-white text-[10px]">BAIXO</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 text-[10px]">NORMAL</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: MOVIMENTACOES */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <Card>
            <CardHeader className="p-4 flex justify-between items-center flex-row">
              <CardTitle className="text-md">Extrato de Auditoria Fiscal & Física</CardTitle>
              <div className="relative w-80">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por SKU, nome ou observação..."
                  value={searchMov}
                  onChange={(e) => setSearchMov(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMovs ? (
                <div className="p-6"><Skeleton className="h-10 w-full" /></div>
              ) : filteredMovs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo Unitário</TableHead>
                      <TableHead className="text-right">Saldo Final</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovs.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-xs">{new Date(mov.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs">{mov.produtos?.nome}</div>
                          <div className="text-[10px] text-muted-foreground">SKU: {mov.produtos?.sku}</div>
                        </TableCell>
                        <TableCell className="text-xs">{mov.deposito_origem?.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{mov.deposito_destino?.nome || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {mov.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs">{mov.quantidade}</TableCell>
                        <TableCell className="text-right text-xs">{fmtBRL(mov.custo_unitario)}</TableCell>
                        <TableCell className="text-right text-xs font-bold">{mov.saldo_apos}</TableCell>
                        <TableCell className="text-right text-xs text-primary font-semibold">{fmtBRL(mov.custo_medio_apos)}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={mov.observacao || ""}>
                          {mov.observacao || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: PRODUTO */}
      {productModal && (
        <Dialog open={!!productModal} onOpenChange={(o) => !o && setProductModal(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{productModal === "new" ? "Cadastrar Novo Produto" : "Editar Ficha do Produto"}</DialogTitle>
              <DialogDescription>Edite as abas cadastrais, fiscais e financeiras do produto.</DialogDescription>
            </DialogHeader>
            <ProductForm
              target={productModal === "new" ? null : productModal}
              onSave={productMutation.mutate}
              onClose={() => setProductModal(null)}
              submitting={productMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG: DEPOSITOS */}
      {depositoModal && (
        <Dialog open={!!depositoModal} onOpenChange={(o) => !o && setDepositoModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{depositoModal === "new" ? "Cadastrar Novo Depósito" : "Editar Depósito"}</DialogTitle>
              <DialogDescription>Cadastre ou modifique locais de estoque.</DialogDescription>
            </DialogHeader>
            <DepositoForm
              target={depositoModal === "new" ? null : depositoModal}
              onSave={depositoMutation.mutate}
              onClose={() => setDepositoModal(null)}
              submitting={depositoMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG: AJUSTE SALDO */}
      {ajusteModalOpen && (
        <Dialog open={ajusteModalOpen} onOpenChange={setAjusteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajuste Manual de Saldo de Estoque</DialogTitle>
              <DialogDescription>Insira o novo saldo absoluto para recalcular e atualizar o inventário do depósito.</DialogDescription>
            </DialogHeader>
            <AjusteForm
              produtos={produtos || []}
              depositos={depositos || []}
              onSave={ajusteMutation.mutate}
              onClose={() => setAjusteModalOpen(false)}
              submitting={ajusteMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// PRODUCT FORM COMPONENT
function ProductForm({
  target, onSave, onClose, submitting
}: {
  target: ProductRow | null;
  onSave: (v: ProdutoFormValues) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const form = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoFormSchema) as any,
    defaultValues: {
      sku: "",
      nome: "",
      categoria: "",
      unidade: "UN",
      preco_custo: 0,
      preco_venda: 0,
      ncm: "",
      gtin: "",
      situacao: "ativo",
      estoque_min: 0,
      estoque_max: 0,
      imagem_url: "",
    },
  });

  useEffect(() => {
    if (target) {
      form.reset({
        sku: target.sku,
        nome: target.nome,
        categoria: target.categoria || "",
        unidade: target.unidade,
        preco_custo: target.preco_custo,
        preco_venda: target.preco_venda,
        ncm: target.ncm || "",
        gtin: target.gtin || "",
        situacao: target.situacao,
        estoque_min: target.estoque_min,
        estoque_max: target.estoque_max,
        imagem_url: target.imagem_url || "",
      });
    }
  }, [target]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <Tabs defaultValue="geral" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="precos">Preços</TabsTrigger>
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código SKU</FormLabel>
                    <FormControl><Input placeholder="Ex: PROD-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl><Input placeholder="Ex: UN, M, KG" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Descrição do Produto</FormLabel>
                  <FormControl><Input placeholder="Ex: Parafuso Sextavado ZB" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <FormControl><Input placeholder="Ex: Ferragens" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="situacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="precos" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preco_custo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Custo (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preco_venda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Venda (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="estoque" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estoque_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estoque_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Máximo</FormLabel>
                    <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="fiscal" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ncm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NCM</FormLabel>
                    <FormControl><Input placeholder="Ex: 7318.15.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gtin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GTIN / EAN</FormLabel>
                    <FormControl><Input placeholder="Código de barras" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Confirmar
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// DEPOSITO FORM COMPONENT
function DepositoForm({
  target, onSave, onClose, submitting
}: {
  target: DepositoRow | null;
  onSave: (v: DepositoFormValues) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const form = useForm<DepositoFormValues>({
    resolver: zodResolver(depositoFormSchema) as any,
    defaultValues: { nome: "", codigo: "", ativo: true },
  });

  useEffect(() => {
    if (target) {
      form.reset({ nome: target.nome, codigo: target.codigo, ativo: target.ativo });
    }
  }, [target]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Depósito</FormLabel>
              <FormControl><Input placeholder="Ex: Depósito A" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código Identificador Único</FormLabel>
              <FormControl><Input placeholder="Ex: DEP-A" disabled={!!target} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Confirmar
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// AJUSTE FORM COMPONENT
function AjusteForm({
  produtos, depositos, onSave, onClose, submitting
}: {
  produtos: ProductRow[];
  depositos: DepositoRow[];
  onSave: (v: AjusteFormValues) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const form = useForm<AjusteFormValues>({
    resolver: zodResolver(ajusteFormSchema) as any,
    defaultValues: { produto_id: "", deposito_id: "", quantidade: 0, preco_custo: 0, observacao: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="produto_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produto</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger></FormControl>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (SKU: {p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deposito_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Depósito</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger></FormControl>
                <SelectContent>
                  {depositos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Novo Saldo Físico</FormLabel>
                <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preco_custo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Unitário Custo (R$)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="observacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo do Ajuste</FormLabel>
              <FormControl><Textarea placeholder="Ex: Inventário de estoque, ajuste de perdas..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Salvar Ajuste
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
