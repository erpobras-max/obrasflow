import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, FileText, Check, X, Search, Info,
  Printer, ArrowRight, Loader2, Sparkles, Receipt, RefreshCw
} from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/vendas/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos de Venda — ERP Obras" }] }),
  component: PedidosVendaPage,
});

const pedidoItemFormSchema = z.object({
  produto_id: z.string().uuid("Selecione um produto"),
  quantidade: z.coerce.number().min(0.001, "Qtd deve ser > 0"),
  valor_unitario: z.coerce.number().min(0, "Preço deve ser ≥ 0"),
});

const pedidoFormSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente"),
  deposito_id: z.string().uuid("Selecione um depósito"),
  situacao: z.enum(["em_aberto", "atendido", "cancelado"]).default("em_aberto"),
  forma_pagamento: z.string().trim().max(100).optional().or(z.literal("")),
  valor_frete: z.coerce.number().min(0).default(0),
  valor_desconto: z.coerce.number().min(0).default(0),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  itens: z.array(pedidoItemFormSchema).min(1, "Adicione pelo menos um item"),
});

type PedidoFormValues = z.infer<typeof pedidoFormSchema>;

interface PedidoRow {
  id: string;
  numero: number;
  cliente_id: string;
  vendedor_id: string | null;
  deposito_id: string;
  situacao: "em_aberto" | "atendido" | "cancelado";
  forma_pagamento: string | null;
  valor_frete: number;
  valor_desconto: number;
  valor_produtos: number;
  valor_total: number;
  observacoes: string | null;
  nfe_chave: string | null;
  nfe_numero: string | null;
  nfe_status: "rascunho" | "processando" | "autorizada" | "cancelada" | "rejeitada";
  created_at: string;
  clientes: { nome: string; cpf_cnpj: string } | null;
  depositos: { nome: string } | null;
}

interface ItemRow {
  id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  produtos: { nome: string; sku: string; preco_venda: number } | null;
}

const STATUS_PEDIDO_BADGE: Record<string, string> = {
  em_aberto: "bg-blue-600 text-white hover:bg-blue-600",
  atendido: "bg-green-600 text-white hover:bg-green-600",
  cancelado: "bg-red-600 text-white hover:bg-red-600",
};

const STATUS_PEDIDO_LABEL: Record<string, string> = {
  em_aberto: "Em Aberto",
  atendido: "Atendido (Faturado)",
  cancelado: "Cancelado",
};

const STATUS_NFE_BADGE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  processando: "bg-amber-500 text-white animate-pulse",
  autorizada: "bg-emerald-600 text-white",
  cancelada: "bg-red-500 text-white",
  rejeitada: "bg-rose-700 text-white",
};

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PedidosVendaPage() {
  const { perfil, user } = useAuth();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PedidoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PedidoRow | null>(null);
  const [nfeTarget, setNfeTarget] = useState<PedidoRow | null>(null);
  const [nfeView, setNfeView] = useState<PedidoRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "em_aberto" | "atendido" | "cancelado">("all");

  // Queries
  const { data: pedidos, isLoading: loadingPedidos } = useQuery({
    queryKey: ["pedidos-venda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_venda" as any)
        .select("*, clientes(nome, cpf_cnpj), depositos(nome)")
        .order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PedidoRow[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-opt-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-opt-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, sku, preco_venda")
        .eq("situacao", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: depositos } = useQuery({
    queryKey: ["depositos-opt-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depositos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filteredPedidos = useMemo(() => {
    return (pedidos ?? []).filter((p) => {
      if (statusFilter !== "all" && p.situacao !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        const numStr = String(p.numero);
        const name = p.clientes?.nome?.toLowerCase() || "";
        const doc = p.clientes?.cpf_cnpj || "";
        if (!numStr.includes(query) && !name.includes(query) && !doc.includes(query)) return false;
      }
      return true;
    });
  }, [pedidos, search, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos_venda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido excluído.");
      qc.invalidateQueries({ queryKey: ["pedidos-venda"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Emulate NF-e authorization
  const authorizeNfeMutation = useMutation({
    mutationFn: async (pedido: PedidoRow) => {
      // 1. Update status to processando
      await supabase.from("pedidos_venda").update({ nfe_status: "processando" } as any).eq("id", pedido.id);
      
      // Simular delay de 2 segundos
      await new Promise(resolve => setTimeout(resolve, 2000));

      const chave = Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join("");
      const numNf = String(Math.floor(Math.random() * 900000) + 100000);

      // 2. Set to autorizada
      const { error } = await supabase
        .from("pedidos_venda")
        .update({
          nfe_status: "autorizada",
          nfe_chave: chave,
          nfe_numero: numNf
        } as any)
        .eq("id", pedido.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NF-e emitida e autorizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["pedidos-venda"] });
      setNfeTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos de Venda</h1>
          <p className="text-sm text-muted-foreground">Faturamento, controle e emissão de notas fiscais de venda.</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditTarget(null); setFormOpen(true); }}>
          <Plus className="size-4" /> Novo Pedido
        </Button>
      </div>

      {/* FILTROS E BUSCA */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou doc..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
              size="sm"
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === "em_aberto" ? "default" : "outline"}
              onClick={() => setStatusFilter("em_aberto")}
              size="sm"
            >
              Em Aberto
            </Button>
            <Button
              variant={statusFilter === "atendido" ? "default" : "outline"}
              onClick={() => setStatusFilter("atendido")}
              size="sm"
            >
              Atendidos
            </Button>
            <Button
              variant={statusFilter === "cancelado" ? "default" : "outline"}
              onClick={() => setStatusFilter("cancelado")}
              size="sm"
            >
              Cancelados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LISTAGEM DE PEDIDOS */}
      <Card>
        <CardContent className="p-0">
          {loadingPedidos ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : filteredPedidos.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum pedido de venda localizado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Forma Pgto</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>NF-e</TableHead>
                  <TableHead className="w-40 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold">#{p.numero}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.clientes?.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.clientes?.cpf_cnpj || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{p.depositos?.nome || "—"}</TableCell>
                    <TableCell className="text-xs">{p.forma_pagamento || "—"}</TableCell>
                    <TableCell className="text-right text-xs">{fmtBRL(p.valor_produtos)}</TableCell>
                    <TableCell className="text-right font-bold text-xs">{fmtBRL(p.valor_total)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_PEDIDO_BADGE[p.situacao] || "bg-muted text-muted-foreground"}>
                        {STATUS_PEDIDO_LABEL[p.situacao] || p.situacao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", STATUS_NFE_BADGE[p.nfe_status])}>
                        {p.nfe_status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {p.situacao === "em_aberto" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => { setEditTarget(p); setFormOpen(true); }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-red-600 hover:text-red-700"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {p.situacao === "atendido" && p.nfe_status === "rascunho" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-primary text-primary hover:bg-primary/5"
                            onClick={() => setNfeTarget(p)}
                          >
                            <Sparkles className="size-3" /> Emitir NF-e
                          </Button>
                        )}
                        {p.nfe_status === "autorizada" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => setNfeView(p)}
                          >
                            <Receipt className="size-3" /> NF-e #{p.nfe_numero}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* FORM DIALOG */}
      {formOpen && (
        <PedidoFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          target={editTarget}
          clientes={clientes || []}
          produtos={produtos || []}
          depositos={depositos || []}
          userId={user?.id || ""}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["pedidos-venda"] });
            setFormOpen(false);
          }}
        />
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Pedido de Venda</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o pedido #{deleteTarget.numero}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* EMITIR NFE CONFIRM */}
      {nfeTarget && (
        <Dialog open={!!nfeTarget} onOpenChange={(o) => !o && setNfeTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transmitir NF-e para SEFAZ</DialogTitle>
              <DialogDescription>
                Deseja iniciar a transmissão fiscal da nota do pedido #{nfeTarget.numero}?
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/10 border p-3 rounded text-xs space-y-2">
              <div><strong>Destinatário:</strong> {nfeTarget.clientes?.nome}</div>
              <div><strong>Valor total da nota:</strong> {fmtBRL(nfeTarget.valor_total)}</div>
              <div><strong>Depósito emissor:</strong> {nfeTarget.depositos?.nome}</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNfeTarget(null)}>Cancelar</Button>
              <Button
                className="gap-2"
                onClick={() => authorizeNfeMutation.mutate(nfeTarget)}
                disabled={authorizeNfeMutation.isPending}
              >
                {authorizeNfeMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Transmitir Nota Fiscal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* VISUALIZAR NF-e (MOCKED XML/DANFE) */}
      {nfeView && (
        <Dialog open={!!nfeView} onOpenChange={(o) => !o && setNfeView(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-emerald-600" /> DANFE Simplificado (Visualização Fiscal)
              </DialogTitle>
              <DialogDescription>Nota Fiscal Eletrônica (NF-e) autorizada junto à Receita Federal.</DialogDescription>
            </DialogHeader>
            <div className="border rounded p-4 text-xs space-y-4 font-mono bg-white text-black">
              {/* Header */}
              <div className="flex justify-between border-b pb-3 items-center">
                <div>
                  <h3 className="font-bold text-sm">ERP OBRAS LTDA</h3>
                  <p>CNPJ: 12.345.678/0001-99</p>
                  <p>Inscrição Estadual: 111.222.333.444</p>
                </div>
                <div className="text-right border p-2 rounded">
                  <div className="font-bold text-sm">DANFE</div>
                  <div>Nº {nfeView.nfe_numero}</div>
                  <div>Série 001</div>
                </div>
              </div>

              {/* Chave de acesso */}
              <div className="border p-2 rounded bg-muted/5">
                <div className="font-bold">CHAVE DE ACESSO (44 DÍGITOS)</div>
                <div className="text-[10px] break-all select-all font-semibold tracking-wider mt-1">{nfeView.nfe_chave}</div>
                <div className="text-[9px] text-muted-foreground mt-1">PROTOCOLO DE AUTORIZAÇÃO DE USO: {Math.floor(Math.random() * 9000000000) + 1000000000}</div>
              </div>

              {/* Destinatário */}
              <div className="border p-2 rounded">
                <div className="font-bold border-b pb-1 mb-2">DESTINATÁRIO / REMETENTE</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>NOME:</strong> {nfeView.clientes?.nome}</div>
                  <div><strong>CPF/CNPJ:</strong> {nfeView.clientes?.cpf_cnpj}</div>
                  <div><strong>INSCRIÇÃO ESTADUAL:</strong> ISENTO</div>
                  <div><strong>DATA EMISSÃO:</strong> {new Date(nfeView.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
              </div>

              {/* Valores totais */}
              <div className="border p-2 rounded">
                <div className="font-bold border-b pb-1 mb-2">CÁLCULO DO IMPOSTO</div>
                <div className="grid grid-cols-4 gap-2 text-right">
                  <div>
                    <div className="font-semibold text-[10px]">BASE CÁLC. ICMS</div>
                    <div>{fmtBRL(nfeView.valor_produtos * 0.8)}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[10px]">VALOR DO ICMS</div>
                    <div>{fmtBRL(nfeView.valor_produtos * 0.8 * 0.18)}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[10px]">DESCONTO</div>
                    <div>{fmtBRL(nfeView.valor_desconto)}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[10px]">VALOR TOTAL NOTA</div>
                    <div>{fmtBRL(nfeView.valor_total)}</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-muted-foreground italic border-t pt-2">
                "Este documento é uma representação gráfica simplificada da NF-e para controle gerencial."
              </div>
            </div>
            <DialogFooter>
              <Button className="gap-2" onClick={() => window.print()}>
                <Printer className="size-4" /> Imprimir DANFE
              </Button>
              <Button variant="outline" onClick={() => setNfeView(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Subcomponent: PedidoFormDialog
function PedidoFormDialog({
  open, onOpenChange, target, clientes, produtos, depositos, userId, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: PedidoRow | null;
  clientes: any[];
  produtos: any[];
  depositos: any[];
  userId: string;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const form = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoFormSchema) as any,
    defaultValues: {
      cliente_id: "",
      deposito_id: "",
      situacao: "em_aberto",
      forma_pagamento: "",
      valor_frete: 0,
      valor_desconto: 0,
      observacoes: "",
      itens: [{ produto_id: "", quantidade: 1, valor_unitario: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  // Calculate dynamic totals for preview
  const formValues = form.watch();
  const valorProdutos = useMemo(() => {
    return (formValues.itens || []).reduce((sum, item) => {
      const qty = Number(item.quantidade) || 0;
      const price = Number(item.valor_unitario) || 0;
      return sum + (qty * price);
    }, 0);
  }, [formValues.itens]);

  const valorTotal = useMemo(() => {
    const frete = Number(formValues.valor_frete) || 0;
    const desc = Number(formValues.valor_desconto) || 0;
    return valorProdutos + frete - desc;
  }, [valorProdutos, formValues.valor_frete, formValues.valor_desconto]);

  // Load existing values for editing
  useEffect(() => {
    const loadDetails = async () => {
      if (target) {
        form.reset({
          cliente_id: target.cliente_id,
          deposito_id: target.deposito_id,
          situacao: target.situacao,
          forma_pagamento: target.forma_pagamento || "",
          valor_frete: target.valor_frete,
          valor_desconto: target.valor_desconto,
          observacoes: target.observacoes || "",
          itens: [],
        });

        // Fetch items
        const { data, error } = await supabase
          .from("pedidos_venda_itens")
          .select("*")
          .eq("pedido_venda_id", target.id);

        if (!error && data) {
          form.setValue("itens", data.map((it: any) => ({
            produto_id: it.produto_id,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          })));
        }
      } else {
        // Pre-select first deposit
        if (depositos.length > 0) {
          form.setValue("deposito_id", depositos[0].id);
        }
      }
    };
    loadDetails();
  }, [target, depositos, open]);

  // Autofill unit price on product select
  const handleProductChange = (index: number, prodId: string) => {
    const prod = produtos.find(p => p.id === prodId);
    if (prod) {
      form.setValue(`itens.${index}.valor_unitario` as any, prod.preco_venda);
    }
  };

  const onSubmit = async (values: PedidoFormValues) => {
    setSubmitting(true);
    try {
      if (target) {
        // Edit order
        const { error: updErr } = await supabase
          .from("pedidos_venda")
          .update({
            cliente_id: values.cliente_id,
            deposito_id: values.deposito_id,
            situacao: values.situacao,
            forma_pagamento: values.forma_pagamento || null,
            valor_frete: values.valor_frete,
            valor_desconto: values.valor_desconto,
            valor_produtos: valorProdutos,
            valor_total: valorTotal,
            observacoes: values.observacoes || null,
          } as any)
          .eq("id", target.id);

        if (updErr) throw updErr;

        // Recreate items
        await supabase.from("pedidos_venda_itens").delete().eq("pedido_venda_id", target.id);
        const finalItens = values.itens.map(it => ({
          pedido_venda_id: target.id,
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.quantidade * it.valor_unitario
        }));
        const { error: itemsErr } = await supabase.from("pedidos_venda_itens").insert(finalItens);
        if (itemsErr) throw itemsErr;

        // Dummy update to fire atendido trigger if situation was set to atendido
        if (values.situacao === "atendido" && target.situacao !== "atendido") {
          await supabase.from("pedidos_venda").update({ updated_at: new Date().toISOString() } as any).eq("id", target.id);
        }

        toast.success("Pedido atualizado!");
      } else {
        // Create order
        const { data: newOrder, error: orderErr } = await supabase
          .from("pedidos_venda")
          .insert({
            cliente_id: values.cliente_id,
            deposito_id: values.deposito_id,
            vendedor_id: userId || null,
            situacao: values.situacao,
            forma_pagamento: values.forma_pagamento || null,
            valor_frete: values.valor_frete,
            valor_desconto: values.valor_desconto,
            valor_produtos: valorProdutos,
            valor_total: valorTotal,
            observacoes: values.observacoes || null,
            nfe_status: "rascunho"
          } as any)
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        const finalItens = values.itens.map(it => ({
          pedido_venda_id: newOrder.id,
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.quantidade * it.valor_unitario
        }));
        const { error: itemsErr } = await supabase.from("pedidos_venda_itens").insert(finalItens);
        if (itemsErr) throw itemsErr;

        // Dummy update to trigger atendido triggers if initial state was atendido
        if (values.situacao === "atendido") {
          await supabase.from("pedidos_venda").update({ updated_at: new Date().toISOString() } as any).eq("id", newOrder.id);
        }

        toast.success("Pedido de venda gerado!");
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{target ? `Editar Pedido #${target.numero}` : "Novo Pedido de Venda"}</DialogTitle>
          <DialogDescription>Preencha os dados do faturamento e selecione os produtos correspondentes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-6 my-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} ({c.cpf_cnpj})
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
                    <FormLabel>Depósito de Origem</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o depósito" />
                        </SelectTrigger>
                      </FormControl>
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

              <FormField
                control={form.control}
                name="situacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação do Pedido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={target?.situacao === "atendido"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="em_aberto">Em Aberto</SelectItem>
                        <SelectItem value="atendido">Atendido (Faturar & Baixar Estoque)</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="forma_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Boleto 30 dias, PIX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_frete"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Frete (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_desconto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Desconto (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ITENS DO PEDIDO */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold text-sm">Itens e Produtos do Pedido</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ produto_id: "", quantidade: 1, valor_unitario: 0 })}
                >
                  <Plus className="size-3.5 mr-1" /> Adicionar Produto
                </Button>
              </div>

              {fields.map((field, idx) => (
                <div key={field.id} className="flex gap-4 items-end bg-muted/5 border p-3 rounded-md">
                  <div className="flex-1 min-w-[200px]">
                    <FormField
                      control={form.control}
                      name={`itens.${idx}.produto_id` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Produto</FormLabel>
                          <Select
                            onValueChange={(v) => { field.onChange(v); handleProductChange(idx, v); }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione o produto" />
                              </SelectTrigger>
                            </FormControl>
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
                  </div>

                  <div className="w-24">
                    <FormField
                      control={form.control}
                      name={`itens.${idx}.quantidade` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Qtd</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" className="h-9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="w-32">
                    <FormField
                      control={form.control}
                      name={`itens.${idx}.valor_unitario` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Unitário (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" className="h-9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="w-28 text-right pr-2 pb-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Subtotal</div>
                    <div className="text-sm font-bold">
                      {fmtBRL((Number(formValues.itens?.[idx]?.quantidade) || 0) * (Number(formValues.itens?.[idx]?.valor_unitario) || 0))}
                    </div>
                  </div>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-red-600 hover:text-red-700"
                      onClick={() => remove(idx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações do Pedido</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Instruções de entrega, detalhes de cobrança..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PREVIEW DO TOTAL */}
            <div className="bg-muted/10 border p-4 rounded-lg flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Produtos: <span className="font-semibold text-foreground">{fmtBRL(valorProdutos)}</span></div>
                <div>Frete (+): <span className="font-semibold text-foreground">{fmtBRL(Number(formValues.valor_frete) || 0)}</span></div>
                <div>Desconto (-): <span className="font-semibold text-foreground text-red-500">{fmtBRL(Number(formValues.valor_desconto) || 0)}</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Total Geral do Pedido</div>
                <div className="text-2xl font-black text-primary">{fmtBRL(valorTotal)}</div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Salvar Pedido
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
