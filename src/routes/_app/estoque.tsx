import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  Info,
  FileSpreadsheet,
  Upload,
  History,
  GitCompare,
  Landmark,
  ArrowRightLeft,
  Settings,
  Pencil,
  Trash2,
  Download,
  QrCode,
  Printer,
  CheckSquare,
  Square,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { QrCodeLabel } from "@/components/estoque/QrCodeLabel";

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

const prateleiraFormSchema = z.object({
  deposito_id: z.string().uuid("Selecione um depósito"),
  codigo: z.string().trim().min(1, "Código obrigatório").max(30),
  nome: z.string().trim().min(1, "Nome obrigatório").max(100),
  descricao: z.string().trim().max(300).optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});

type PrateleiraFormValues = z.infer<typeof prateleiraFormSchema>;

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
  qr_token: string;
}

interface DepositoRow {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  created_at: string;
}

interface PrateleiraRow {
  id: string;
  deposito_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  qr_token: string;
  ativo: boolean;
  created_at: string;
  depositos: { nome: string } | null;
}

interface PosicaoEstoqueRow {
  id: string;
  produto_id: string;
  deposito_id: string;
  saldo: number;
  produtos: {
    sku: string;
    nome: string;
    categoria: string | null;
    unidade: string;
    estoque_min: number;
    estoque_max: number;
    situacao: string;
  } | null;
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
  justificativa: string | null;
  documento: string | null;
  saldo_anterior: number | null;
  obra_id: string | null;
  prateleira_id: string | null;
  user_id: string | null;
  usuario_id: string | null;
  created_at: string;
  produtos: { sku: string; nome: string; unidade: string } | null;
  deposito_origem: { nome: string } | null;
  deposito_destino: { nome: string } | null;
  estoque_prateleiras: { codigo: string; nome: string } | null;
}

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EstoquePage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { perfil, roles, user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("produtos");

  // Search/Filters states
  const [searchProd, setSearchProd] = useState("");
  const [filterDep, setFilterDep] = useState<string>("all");
  const [searchPos, setSearchPos] = useState("");
  const [searchMov, setSearchMov] = useState("");
  const [filterMovTipo, setFilterMovTipo] = useState("all");
  const [filterMovUser, setFilterMovUser] = useState("all");
  const [filterMovObra, setFilterMovObra] = useState("all");
  const [filterMovPrateleira, setFilterMovPrateleira] = useState("all");
  const [filterMovInicio, setFilterMovInicio] = useState("");
  const [filterMovFim, setFilterMovFim] = useState("");

  // Modals target
  const [productModal, setProductModal] = useState<ProductRow | null | "new">(null);
  const [depositoModal, setDepositoModal] = useState<DepositoRow | null | "new">(null);
  const [prateleiraModal, setPrateleiraModal] = useState<PrateleiraRow | "new" | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedPrateleiraIds, setSelectedPrateleiraIds] = useState<string[]>([]);
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);

  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria" ||
    perfil?.perfil === "almoxarifado";

  const podeGerenciarPrateleiras = roles.some(
    (role) => role === "admin" || role === "diretor" || role === "almoxarifado",
  );

  // Queries
  const { data: produtos, isLoading: loadingProds } = useQuery({
    queryKey: ["produtos-estoque-list"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const { data: depositos, isLoading: loadingDeps } = useQuery({
    queryKey: ["depositos-estoque-list"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase.from("depositos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as DepositoRow[];
    },
  });

  const { data: prateleiras, isLoading: loadingPrateleiras } = useQuery({
    queryKey: ["estoque-prateleiras-list"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_prateleiras")
        .select("*, depositos(nome)")
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as PrateleiraRow[];
    },
  });

  const { data: posicao, isLoading: loadingPos } = useQuery({
    queryKey: ["posicao-estoque-list"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_estoque")
        .select(
          "*, produtos(sku, nome, categoria, unidade, estoque_min, estoque_max, situacao), depositos(nome)",
        );
      if (error) throw error;
      return (data ?? []) as unknown as PosicaoEstoqueRow[];
    },
  });

  const { data: movimentacoes, isLoading: loadingMovs } = useQuery({
    queryKey: ["movimentacoes-estoque-list"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select(
          `
          *,
          produtos(sku, nome, unidade),
          deposito_origem:depositos!movimentacoes_estoque_deposito_id_fkey(nome),
          deposito_destino:depositos!movimentacoes_estoque_deposito_destino_id_fkey(nome),
          estoque_prateleiras(codigo,nome)
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MovimentacaoRow[];
    },
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["estoque-colaboradores"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_usuarios")
        .select("user_id,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; nome: string }>;
    },
  });

  const { data: obrasFiltro = [] } = useQuery({
    queryKey: ["estoque-obras-filtro"],
    enabled: pathname !== "/estoque/movimentacao",
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id,numero,nome").order("numero");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; numero: string; nome: string }>;
    },
  });

  // Filtered lists
  const filteredProducts = useMemo(() => {
    return (produtos ?? []).filter((p) => {
      if (searchProd) {
        const s = searchProd.toLowerCase();
        return (
          p.nome.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          (p.gtin && p.gtin.includes(s))
        );
      }
      return true;
    });
  }, [produtos, searchProd]);

  const filteredPosicao = useMemo(() => {
    return (posicao ?? []).filter((pos) => {
      if (filterDep !== "all" && pos.deposito_id !== filterDep) return false;
      if (searchPos) {
        const s = searchPos.toLowerCase();
        return (
          pos.produtos?.nome.toLowerCase().includes(s) ||
          pos.produtos?.sku.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [posicao, filterDep, searchPos]);

  const filteredMovs = useMemo(() => {
    return (movimentacoes ?? []).filter((mov) => {
      const movDate = new Date(mov.created_at);
      if (filterMovTipo !== "all" && mov.tipo !== filterMovTipo) return false;
      if (filterMovUser !== "all" && (mov.user_id ?? mov.usuario_id) !== filterMovUser)
        return false;
      if (filterMovObra !== "all" && mov.obra_id !== filterMovObra) return false;
      if (filterMovPrateleira !== "all" && mov.prateleira_id !== filterMovPrateleira) return false;
      if (filterMovInicio && movDate < new Date(`${filterMovInicio}T00:00:00`)) return false;
      if (filterMovFim && movDate > new Date(`${filterMovFim}T23:59:59.999`)) return false;
      if (searchMov) {
        const s = searchMov.toLowerCase();
        return (
          mov.produtos?.nome.toLowerCase().includes(s) ||
          mov.produtos?.sku.toLowerCase().includes(s) ||
          (mov.observacao && mov.observacao.toLowerCase().includes(s)) ||
          (mov.documento && mov.documento.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [
    movimentacoes,
    searchMov,
    filterMovTipo,
    filterMovUser,
    filterMovObra,
    filterMovPrateleira,
    filterMovInicio,
    filterMovFim,
  ]);

  const stockAlertsCount = useMemo(() => {
    return (posicao ?? []).filter((pos) => pos.produtos && pos.saldo <= pos.produtos.estoque_min)
      .length;
  }, [posicao]);

  useEffect(() => {
    if (!user?.id || !posicao?.length) return;
    const lowStockRows = posicao.filter(
      (position) =>
        position.produtos &&
        position.produtos.estoque_min > 0 &&
        position.saldo <= position.produtos.estoque_min,
    );
    if (!lowStockRows.length) return;

    const notifications = lowStockRows.map((position) => ({
      user_id: user.id,
      alerta_id: `estoque_minimo:${position.produto_id}:${position.deposito_id}`,
    }));
    const notificationsClient = supabase as unknown as {
      from: (table: "notificacoes_usuario") => {
        upsert: (
          rows: Array<{ user_id: string; alerta_id: string }>,
          options: { onConflict: string; ignoreDuplicates: boolean },
        ) => PromiseLike<{ error: Error | null }>;
      };
    };
    void notificationsClient
      .from("notificacoes_usuario")
      .upsert(notifications, { onConflict: "user_id,alerta_id", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error("Falha ao registrar alerta de estoque mínimo:", error.message);
      });
  }, [posicao, user?.id]);

  // Mutations
  const productMutation = useMutation({
    mutationFn: async (values: ProdutoFormValues) => {
      if (productModal && productModal !== "new") {
        const { error } = await supabase
          .from("produtos")
          .update(values as any)
          .eq("id", productModal.id);
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
        const { error } = await supabase
          .from("depositos")
          .update(values as any)
          .eq("id", depositoModal.id);
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

  const prateleiraMutation = useMutation({
    mutationFn: async (values: PrateleiraFormValues) => {
      const payload = {
        deposito_id: values.deposito_id,
        codigo: values.codigo.trim().toUpperCase(),
        nome: values.nome.trim(),
        descricao: values.descricao?.trim() || null,
        ativo: values.ativo,
      };

      if (prateleiraModal && prateleiraModal !== "new") {
        const { error } = await (supabase as any)
          .from("estoque_prateleiras")
          .update(payload)
          .eq("id", prateleiraModal.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("estoque_prateleiras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Prateleira salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["estoque-prateleiras-list"] });
      setPrateleiraModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePrateleiraMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("estoque_prateleiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prateleira excluída.");
      qc.invalidateQueries({ queryKey: ["estoque-prateleiras-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajusteMutation = useMutation({
    mutationFn: async (values: AjusteFormValues) => {
      const { error } = await (supabase as any).rpc("registrar_movimentacao_almoxarifado", {
        p_produto_id: values.produto_id,
        p_deposito_id: values.deposito_id,
        p_tipo: "ajuste",
        p_quantidade: values.quantidade,
        p_obra_id: null,
        p_prateleira_id: null,
        p_documento: null,
        p_justificativa: values.observacao,
        p_custo_unitario: values.preco_custo ?? null,
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
    const dataRows = posicao.map((pos) => ({
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

  const handleExportMovimentacoesExcel = () => {
    const rows = filteredMovs.map((mov) => ({
      Data: new Date(mov.created_at).toLocaleString("pt-BR"),
      Material: mov.produtos?.nome || "",
      SKU: mov.produtos?.sku || "",
      Tipo: mov.tipo,
      Quantidade: mov.quantidade,
      "Saldo anterior": mov.saldo_anterior ?? "",
      "Saldo após": mov.saldo_apos,
      Obra: obrasFiltro.find((obra) => obra.id === mov.obra_id)?.nome || "",
      Local: mov.estoque_prateleiras
        ? `${mov.estoque_prateleiras.codigo} — ${mov.estoque_prateleiras.nome}`
        : mov.deposito_origem?.nome || "",
      Responsável:
        perfis.find((profile) => profile.user_id === (mov.user_id ?? mov.usuario_id))?.nome || "",
      Justificativa: mov.justificativa || mov.observacao || "",
      Documento: mov.documento || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimentações");
    XLSX.writeFile(workbook, "historico_movimentacoes_estoque.xlsx");
  };

  const toggleSelected = (
    id: string,
    selected: string[],
    setSelected: (value: string[]) => void,
  ) => {
    setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const printQrLabels = () => {
    if (selectedProductIds.length === 0 && selectedPrateleiraIds.length === 0) {
      toast.error("Selecione pelo menos um produto ou uma prateleira.");
      return;
    }
    window.print();
  };

  const selectedProducts = (produtos ?? []).filter((product) =>
    selectedProductIds.includes(product.id),
  );
  const selectedPrateleiras = (prateleiras ?? []).filter((shelf) =>
    selectedPrateleiraIds.includes(shelf.id),
  );

  if (pathname === "/estoque/movimentacao") {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos & Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Ficha de produtos, múltiplos depósitos e auditoria de movimentações.
          </p>
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
          {activeTab === "etiquetas" && (
            <Button className="gap-2" onClick={printQrLabels}>
              <Printer className="size-4" /> Imprimir selecionadas
            </Button>
          )}
        </div>
      </div>

      {stockAlertsCount > 0 && (
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30">
          <CardContent className="p-4 flex items-center gap-3 text-amber-800 dark:text-amber-300 text-sm">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              Você possui <strong>{stockAlertsCount}</strong> produtos com saldo igual ou abaixo do
              estoque mínimo definido.
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
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
          <TabsTrigger value="etiquetas" className="gap-2">
            <QrCode className="size-4" /> Etiquetas QR
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
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum produto cadastrado.
                </div>
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
                        <TableCell className="text-right text-xs font-bold text-primary">
                          {fmtBRL(p.preco_venda)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {fmtBRL(p.preco_custo)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.situacao === "ativo" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {p.situacao.toUpperCase()}
                          </Badge>
                        </TableCell>
                        {podeEditar && (
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => setProductModal(p)}
                            >
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
              <CardDescription>
                Depósitos cadastrados no sistema para movimentações internas e de vendas/compras.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDeps ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full" />
                </div>
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
                          <Badge
                            variant={d.ativo ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {d.ativo ? "ATIVO" : "INATIVO"}
                          </Badge>
                        </TableCell>
                        {podeEditar && (
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => setDepositoModal(d)}
                            >
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
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-md">Prateleiras e localizações</CardTitle>
                <CardDescription>
                  Organize os materiais por localização dentro de cada depósito.
                </CardDescription>
              </div>
              {podeGerenciarPrateleiras && (
                <Button className="gap-2" onClick={() => setPrateleiraModal("new")}>
                  <Plus className="size-4" /> Nova prateleira
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingPrateleiras ? (
                <div className="p-6">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (prateleiras ?? []).length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhuma prateleira cadastrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Depósito</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-28 text-center">QR</TableHead>
                        {podeGerenciarPrateleiras && (
                          <TableHead className="w-24 text-center">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(prateleiras ?? []).map((shelf) => (
                        <TableRow key={shelf.id}>
                          <TableCell className="font-mono text-xs">{shelf.codigo}</TableCell>
                          <TableCell className="text-xs font-semibold">{shelf.nome}</TableCell>
                          <TableCell className="text-xs">{shelf.depositos?.nome || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={shelf.ativo ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {shelf.ativo ? "ATIVA" : "INATIVA"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant={
                                selectedPrateleiraIds.includes(shelf.id) ? "default" : "ghost"
                              }
                              className="size-8"
                              title="Selecionar etiqueta QR"
                              onClick={() =>
                                toggleSelected(
                                  shelf.id,
                                  selectedPrateleiraIds,
                                  setSelectedPrateleiraIds,
                                )
                              }
                            >
                              {selectedPrateleiraIds.includes(shelf.id) ? (
                                <CheckSquare className="size-4" />
                              ) : (
                                <QrCode className="size-4" />
                              )}
                            </Button>
                          </TableCell>
                          {podeGerenciarPrateleiras && (
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  onClick={() => setPrateleiraModal(shelf)}
                                  title="Editar prateleira"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 text-destructive hover:text-destructive"
                                  title="Excluir prateleira"
                                  onClick={() => {
                                    if (window.confirm(`Excluir a prateleira ${shelf.codigo}?`))
                                      deletePrateleiraMutation.mutate(shelf.id);
                                  }}
                                  disabled={deletePrateleiraMutation.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ETIQUETAS QR */}
        <TabsContent value="etiquetas" className="qr-print-sheet space-y-4">
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-md">Etiquetas QR</CardTitle>
              <CardDescription>
                Selecione produtos e prateleiras. O QR abre a movimentação já identificada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Produtos</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedProductIds(
                          selectedProductIds.length === (produtos ?? []).length
                            ? []
                            : (produtos ?? []).map((p) => p.id),
                        )
                      }
                    >
                      {selectedProductIds.length === (produtos ?? []).length &&
                      (produtos ?? []).length > 0
                        ? "Limpar"
                        : "Selecionar todos"}
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {(produtos ?? []).map((product) => {
                      const checked = selectedProductIds.includes(product.id);
                      return (
                        <button
                          type="button"
                          key={product.id}
                          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted"
                          onClick={() =>
                            toggleSelected(product.id, selectedProductIds, setSelectedProductIds)
                          }
                        >
                          {checked ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{product.nome}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {product.sku}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Prateleiras</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedPrateleiraIds(
                          selectedPrateleiraIds.length === (prateleiras ?? []).length
                            ? []
                            : (prateleiras ?? []).map((shelf) => shelf.id),
                        )
                      }
                    >
                      {selectedPrateleiraIds.length === (prateleiras ?? []).length &&
                      (prateleiras ?? []).length > 0
                        ? "Limpar"
                        : "Selecionar todas"}
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {(prateleiras ?? []).map((shelf) => {
                      const checked = selectedPrateleiraIds.includes(shelf.id);
                      return (
                        <button
                          type="button"
                          key={shelf.id}
                          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted"
                          onClick={() =>
                            toggleSelected(
                              shelf.id,
                              selectedPrateleiraIds,
                              setSelectedPrateleiraIds,
                            )
                          }
                        >
                          {checked ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{shelf.nome}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {shelf.codigo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button className="w-full gap-2 sm:w-auto" onClick={printQrLabels}>
                <Printer className="size-4" /> Imprimir etiquetas selecionadas
              </Button>
            </CardContent>
          </Card>

          <div className="qr-print-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedProducts.map((product) => (
              <QrCodeLabel
                key={`produto-${product.id}`}
                kind="produto"
                token={product.qr_token}
                title={product.nome}
                code={`SKU: ${product.sku}`}
                unidade={product.unidade}
              />
            ))}
            {selectedPrateleiras.map((shelf) => (
              <QrCodeLabel
                key={`prateleira-${shelf.id}`}
                kind="prateleira"
                token={shelf.qr_token}
                title={shelf.nome}
                code={shelf.codigo}
                subtitle={`Depósito: ${shelf.depositos?.nome || "—"}`}
              />
            ))}
          </div>
        </TabsContent>

        {/* TAB: POSICAO */}
        <TabsContent value="posicao" className="space-y-4">
          <Card>
            <CardHeader className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-md">Saldos Físicos em Estoque</CardTitle>
                <CardDescription>
                  Consulta rápida de saldos agrupados por local de armazenamento.
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterDep} onValueChange={setFilterDep}>
                  <SelectTrigger className="w-56 h-9">
                    <SelectValue placeholder="Selecione o Depósito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Depósitos</SelectItem>
                    {depositos?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
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
                <div className="p-6">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredPosicao.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum saldo registrado.
                </div>
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
                          <TableCell className="font-semibold text-xs">
                            {pos.produtos?.nome}
                          </TableCell>
                          <TableCell className="text-xs">{pos.depositos?.nome}</TableCell>
                          <TableCell className="text-center text-xs">
                            {pos.produtos?.unidade}
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            {pos.saldo}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {pos.produtos?.estoque_min || 0} / {pos.produtos?.estoque_max || 0}
                          </TableCell>
                          <TableCell>
                            {isZero ? (
                              <Badge className="bg-red-600 text-white text-[10px]">ZERADO</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-500 text-white text-[10px]">BAIXO</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 text-[10px]">
                                NORMAL
                              </Badge>
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
            <CardHeader className="p-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-md">Extrato de movimentações</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2"
                  onClick={handleExportMovimentacoesExcel}
                  disabled={!filteredMovs.length}
                >
                  <Download className="size-4" /> Exportar filtro para Excel
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative sm:col-span-2 xl:col-span-1">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar movimentações"
                    placeholder="Material, SKU, observação ou documento"
                    value={searchMov}
                    onChange={(e) => setSearchMov(e.target.value)}
                    className="min-h-11 pl-9"
                  />
                </div>
                <Select value={filterMovTipo} onValueChange={setFilterMovTipo}>
                  <SelectTrigger className="min-h-11" aria-label="Filtrar por tipo">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterMovUser} onValueChange={setFilterMovUser}>
                  <SelectTrigger className="min-h-11" aria-label="Filtrar por colaborador">
                    <SelectValue placeholder="Todos os colaboradores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os colaboradores</SelectItem>
                    {perfis.map((profile) => (
                      <SelectItem key={profile.user_id} value={profile.user_id}>
                        {profile.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMovObra} onValueChange={setFilterMovObra}>
                  <SelectTrigger className="min-h-11" aria-label="Filtrar por obra">
                    <SelectValue placeholder="Todas as obras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as obras</SelectItem>
                    {obrasFiltro.map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.numero} — {obra.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMovPrateleira} onValueChange={setFilterMovPrateleira}>
                  <SelectTrigger className="min-h-11" aria-label="Filtrar por prateleira">
                    <SelectValue placeholder="Todos os locais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os locais</SelectItem>
                    {(prateleiras ?? []).map((shelf) => (
                      <SelectItem key={shelf.id} value={shelf.id}>
                        {shelf.codigo} — {shelf.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    aria-label="Data inicial"
                    value={filterMovInicio}
                    onChange={(e) => setFilterMovInicio(e.target.value)}
                    className="min-h-11"
                  />
                  <Input
                    type="date"
                    aria-label="Data final"
                    value={filterMovFim}
                    onChange={(e) => setFilterMovFim(e.target.value)}
                    className="min-h-11"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMovs ? (
                <div className="p-6">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredMovs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma movimentação registrada.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Saldo anterior → após</TableHead>
                          <TableHead>Obra</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Justificativa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovs.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-xs">
                              {new Date(mov.created_at).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-xs">{mov.produtos?.nome}</div>
                              <div className="text-[10px] text-muted-foreground">
                                SKU: {mov.produtos?.sku}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {mov.tipo === "saida"
                                  ? "Saída"
                                  : mov.tipo === "ajuste"
                                    ? "Ajuste"
                                    : mov.tipo === "transferencia"
                                      ? "Transferência"
                                      : "Entrada"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {mov.quantidade} {mov.produtos?.unidade || ""}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {mov.saldo_anterior ?? "—"} → {mov.saldo_apos}
                            </TableCell>
                            <TableCell className="text-xs">
                              {obrasFiltro.find((obra) => obra.id === mov.obra_id)?.nome || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {mov.estoque_prateleiras
                                ? `${mov.estoque_prateleiras.codigo} — ${mov.estoque_prateleiras.nome}`
                                : mov.deposito_origem?.nome || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {perfis.find(
                                (profile) => profile.user_id === (mov.user_id ?? mov.usuario_id),
                              )?.nome || "—"}
                            </TableCell>
                            <TableCell
                              className="max-w-56 truncate text-xs"
                              title={mov.justificativa || mov.observacao || ""}
                            >
                              {mov.justificativa || mov.observacao || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 px-4 pb-4 md:hidden">
                    {filteredMovs.map((mov) => (
                      <article key={mov.id} className="rounded-lg border bg-card p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold break-words">
                              {mov.produtos?.nome || "Material"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {mov.produtos?.sku || "—"}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {mov.tipo === "saida"
                              ? "Saída"
                              : mov.tipo === "ajuste"
                                ? "Ajuste"
                                : mov.tipo === "transferencia"
                                  ? "Transferência"
                                  : "Entrada"}
                          </Badge>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <dt className="text-muted-foreground">Data</dt>
                            <dd>{new Date(mov.created_at).toLocaleString("pt-BR")}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Quantidade</dt>
                            <dd>
                              {mov.quantidade} {mov.produtos?.unidade || ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Saldo anterior → após</dt>
                            <dd>
                              {mov.saldo_anterior ?? "—"} → {mov.saldo_apos}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Obra</dt>
                            <dd className="break-words">
                              {obrasFiltro.find((obra) => obra.id === mov.obra_id)?.nome || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Local</dt>
                            <dd className="break-words">
                              {mov.estoque_prateleiras
                                ? `${mov.estoque_prateleiras.codigo} — ${mov.estoque_prateleiras.nome}`
                                : mov.deposito_origem?.nome || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Responsável</dt>
                            <dd className="break-words">
                              {perfis.find(
                                (profile) => profile.user_id === (mov.user_id ?? mov.usuario_id),
                              )?.nome || "—"}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">Justificativa</dt>
                            <dd className="break-words">
                              {mov.justificativa || mov.observacao || "—"}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
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
              <DialogTitle>
                {productModal === "new" ? "Cadastrar Novo Produto" : "Editar Ficha do Produto"}
              </DialogTitle>
              <DialogDescription>
                Edite as abas cadastrais, fiscais e financeiras do produto.
              </DialogDescription>
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
              <DialogTitle>
                {depositoModal === "new" ? "Cadastrar Novo Depósito" : "Editar Depósito"}
              </DialogTitle>
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

      {prateleiraModal && (
        <Dialog open={!!prateleiraModal} onOpenChange={(open) => !open && setPrateleiraModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {prateleiraModal === "new" ? "Nova prateleira" : "Editar prateleira"}
              </DialogTitle>
              <DialogDescription>Defina a localização física dentro do depósito.</DialogDescription>
            </DialogHeader>
            <PrateleiraForm
              target={prateleiraModal === "new" ? null : prateleiraModal}
              depositos={depositos || []}
              onSave={prateleiraMutation.mutate}
              onClose={() => setPrateleiraModal(null)}
              submitting={prateleiraMutation.isPending}
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
              <DialogDescription>
                Insira o novo saldo absoluto para recalcular e atualizar o inventário do depósito.
              </DialogDescription>
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
  target,
  onSave,
  onClose,
  submitting,
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
  }, [target, form]);

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
                    <FormControl>
                      <Input placeholder="Ex: PROD-001" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="Ex: UN, M, KG" {...field} />
                    </FormControl>
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
                  <FormControl>
                    <Input placeholder="Ex: Parafuso Sextavado ZB" {...field} />
                  </FormControl>
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
                    <FormControl>
                      <Input placeholder="Ex: Ferragens" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" step="0.001" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" step="0.001" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="Ex: 7318.15.00" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="Código de barras" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
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
  target,
  onSave,
  onClose,
  submitting,
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
  }, [target, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Depósito</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Depósito A" {...field} />
              </FormControl>
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
              <FormControl>
                <Input placeholder="Ex: DEP-A" disabled={!!target} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Confirmar
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function PrateleiraForm({
  target,
  depositos,
  onSave,
  onClose,
  submitting,
}: {
  target: PrateleiraRow | null;
  depositos: DepositoRow[];
  onSave: (values: PrateleiraFormValues) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const form = useForm<PrateleiraFormValues>({
    resolver: zodResolver(prateleiraFormSchema) as any,
    defaultValues: {
      deposito_id: "",
      codigo: "",
      nome: "",
      descricao: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (target) {
      form.reset({
        deposito_id: target.deposito_id,
        codigo: target.codigo,
        nome: target.nome,
        descricao: target.descricao || "",
        ativo: target.ativo,
      });
    } else {
      form.reset({ deposito_id: "", codigo: "", nome: "", descricao: "", ativo: true });
    }
  }, [target, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="deposito_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Depósito</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o depósito" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {depositos
                    .filter((deposito) => deposito.ativo)
                    .map((deposito) => (
                      <SelectItem key={deposito.id} value={deposito.id}>
                        {deposito.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: A-01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: Corredor A" {...field} />
                </FormControl>
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
              <FormLabel>Descrição opcional</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes da localização" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ativo"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-3">
              <FormLabel className="cursor-pointer">Prateleira ativa</FormLabel>
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="size-5 accent-primary"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar prateleira
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// AJUSTE FORM COMPONENT
function AjusteForm({
  produtos,
  depositos,
  onSave,
  onClose,
  submitting,
}: {
  produtos: ProductRow[];
  depositos: DepositoRow[];
  onSave: (v: AjusteFormValues) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const form = useForm<AjusteFormValues>({
    resolver: zodResolver(ajusteFormSchema) as any,
    defaultValues: {
      produto_id: "",
      deposito_id: "",
      quantidade: 0,
      preco_custo: 0,
      observacao: "",
    },
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
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (SKU: {p.sku})
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
          name="deposito_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Depósito</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o depósito" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {depositos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
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
                <FormControl>
                  <Input type="number" step="0.001" {...field} />
                </FormControl>
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
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
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
              <FormControl>
                <Textarea placeholder="Ex: Inventário de estoque, ajuste de perdas..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Salvar Ajuste
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
