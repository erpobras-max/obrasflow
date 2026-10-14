/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, PackageCheck, RefreshCw, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { QrScanner } from "@/components/estoque/QrScanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const searchSchema = z.object({
  produto: z.string().optional(),
  prateleira: z.string().optional(),
});

const movimentacaoSchema = z
  .object({
    produto_id: z.string().uuid("Selecione um material."),
    deposito_id: z.string().uuid("Selecione um depósito."),
    tipo: z.enum(["entrada", "saida", "ajuste"]),
    quantidade: z.coerce.number().positive("Informe um valor maior que zero."),
    obra_id: z.string().optional(),
    prateleira_id: z.string().optional(),
    documento: z.string().trim().max(120, "Máximo de 120 caracteres.").optional(),
    observacao: z.string().trim().max(500, "Máximo de 500 caracteres.").optional(),
    custo_unitario: z.coerce.number().min(0, "O custo não pode ser negativo.").optional(),
  })
  .superRefine((values, context) => {
    if (values.tipo === "saida" && !values.obra_id) {
      context.addIssue({
        code: "custom",
        path: ["obra_id"],
        message: "A obra é obrigatória para uma saída.",
      });
    }
    if (values.tipo === "ajuste" && !values.observacao?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["observacao"],
        message: "Justifique o novo saldo físico.",
      });
    }
  });

type MovimentacaoFormValues = z.infer<typeof movimentacaoSchema>;
type TipoMovimentacao = MovimentacaoFormValues["tipo"];

type Produto = {
  id: string;
  nome: string;
  sku: string;
  unidade: string;
  qr_token: string;
  preco_custo: number | null;
  situacao: string;
};

type Deposito = { id: string; nome: string; codigo: string; ativo: boolean };
type Prateleira = {
  id: string;
  deposito_id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  depositos: { nome: string } | null;
};
type Obra = { id: string; numero: string; nome: string };

export const Route = createFileRoute("/_app/estoque/movimentacao")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Nova movimentação — Estoque" }] }),
  component: MovimentacaoPage,
});

function getQrValue(value: string): { produto?: string; prateleira?: string } | null {
  try {
    const url = new URL(value, window.location.origin);
    const produto = url.searchParams.get("produto") || undefined;
    const prateleira = url.searchParams.get("prateleira") || undefined;
    if (produto || prateleira) return { produto, prateleira };
  } catch {
    // A URL pode ser apenas o token; handled below as a product token.
  }

  const token = value.trim();
  return token ? { produto: token } : null;
}

function rpcErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("saldo insuficiente")) return message;
  if (normalized.includes("obra_id") || normalized.includes("obra é obrigatório"))
    return "Selecione a obra para registrar uma saída.";
  if (normalized.includes("justificativa"))
    return "Informe a justificativa obrigatória para o ajuste.";
  if (normalized.includes("prateleira"))
    return "A prateleira não pertence ao depósito selecionado ou está inativa.";
  if (normalized.includes("cargo autorizado") || normalized.includes("permission denied"))
    return "Seu cargo não pode registrar movimentações. Solicite acesso ao administrador.";
  if (normalized.includes("deposit") && normalized.includes("schema"))
    return "A tabela de depósitos ainda não está disponível no banco. Aplique a migration de estoque antes de continuar.";
  return `Não foi possível registrar a movimentação: ${message}`;
}

function MovimentacaoPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { loading, user, roles } = useAuth();
  const qc = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(search.produto ? "" : "");
  const [selectedShelfId, setSelectedShelfId] = useState(search.prateleira ?? "");

  const form = useForm<MovimentacaoFormValues>({
    resolver: zodResolver(movimentacaoSchema) as never,
    defaultValues: {
      produto_id: "",
      deposito_id: "",
      tipo: "entrada",
      quantidade: 0,
      obra_id: "",
      prateleira_id: "",
      documento: "",
      observacao: "",
      custo_unitario: undefined,
    },
  });

  const canWrite = roles.some(
    (role) => role === "admin" || role === "diretor" || role === "almoxarifado",
  );
  const tipo = form.watch("tipo");
  const depositoId = form.watch("deposito_id");

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { redirect: window.location.pathname + window.location.search },
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["movimentacao-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos")
        .select("id,nome,sku,unidade,qr_token,preco_custo,situacao")
        .eq("situacao", "ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
    enabled: !!user,
  });

  const { data: depositos = [], isLoading: loadingDepositos } = useQuery({
    queryKey: ["movimentacao-depositos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("depositos")
        .select("id,nome,codigo,ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Deposito[];
    },
    enabled: !!user,
  });

  const { data: prateleiras = [] } = useQuery({
    queryKey: ["movimentacao-prateleiras"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_prateleiras")
        .select("id,deposito_id,codigo,nome,ativo,depositos(nome)")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as Prateleira[];
    },
    enabled: !!user,
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["movimentacao-obras"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obras")
        .select("id,numero,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Obra[];
    },
    enabled: !!user,
  });

  const { data: produtoPorQr } = useQuery({
    queryKey: ["movimentacao-produto-qr", search.produto],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos")
        .select("id,nome,sku,unidade,qr_token,preco_custo,situacao")
        .eq("qr_token", search.produto)
        .maybeSingle();
      if (error) throw error;
      return data as Produto | null;
    },
    enabled: !!user && !!search.produto,
  });

  const { data: prateleiraPorQr } = useQuery({
    queryKey: ["movimentacao-prateleira-qr", search.prateleira],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_prateleiras")
        .select("id,deposito_id,codigo,nome,ativo,depositos(nome)")
        .eq("qr_token", search.prateleira)
        .maybeSingle();
      if (error) throw error;
      return data as Prateleira | null;
    },
    enabled: !!user && !!search.prateleira,
  });

  useEffect(() => {
    if (produtoPorQr?.id) {
      setSelectedProductId(produtoPorQr.id);
      form.setValue("produto_id", produtoPorQr.id, { shouldValidate: true });
    }
  }, [produtoPorQr, form]);

  useEffect(() => {
    if (prateleiraPorQr?.id) {
      setSelectedShelfId(prateleiraPorQr.id);
      form.setValue("prateleira_id", prateleiraPorQr.id);
      form.setValue("deposito_id", prateleiraPorQr.deposito_id, { shouldValidate: true });
    }
  }, [prateleiraPorQr, form]);

  const selectedProduct = useMemo(
    () => produtos.find((product) => product.id === selectedProductId),
    [produtos, selectedProductId],
  );
  const selectedShelf = useMemo(
    () => prateleiras.find((shelf) => shelf.id === selectedShelfId),
    [prateleiras, selectedShelfId],
  );
  const shelvesForDeposit = useMemo(
    () => prateleiras.filter((shelf) => !depositoId || shelf.deposito_id === depositoId),
    [prateleiras, depositoId],
  );

  const { data: saldoAtual = 0, isFetching: loadingSaldo } = useQuery({
    queryKey: ["movimentacao-saldo", selectedProductId, depositoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produto_estoque")
        .select("saldo")
        .eq("produto_id", selectedProductId)
        .eq("deposito_id", depositoId)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.saldo ?? 0);
    },
    enabled: !!user && !!selectedProductId && !!depositoId,
  });

  const applyQrValue = useCallback(
    (value: string) => {
      const parsed = getQrValue(value);
      if (!parsed) {
        toast.error("QR Code vazio ou inválido.");
        return;
      }
      setScannerOpen(false);
      setManualOpen(false);
      if (parsed.produto) {
        void navigate({
          to: "/estoque/movimentacao",
          search: { produto: parsed.produto } as never,
          replace: true,
        });
      } else if (parsed.prateleira) {
        void navigate({
          to: "/estoque/movimentacao",
          search: { prateleira: parsed.prateleira } as never,
          replace: true,
        });
      }
    },
    [navigate],
  );

  const mutation = useMutation({
    mutationFn: async (values: MovimentacaoFormValues) => {
      if (!canWrite) throw new Error("Seu cargo não pode registrar movimentações.");
      if (values.tipo === "saida" && values.quantidade > saldoAtual) {
        throw new Error(`Saldo insuficiente. Disponível: ${saldoAtual}.`);
      }
      const { error } = await (supabase as any).rpc("registrar_movimentacao_almoxarifado", {
        p_produto_id: values.produto_id,
        p_deposito_id: values.deposito_id,
        p_tipo: values.tipo,
        p_quantidade: values.quantidade,
        p_obra_id: values.tipo === "saida" ? values.obra_id || null : null,
        p_prateleira_id: values.prateleira_id || null,
        p_documento: values.documento?.trim() || null,
        p_justificativa: values.observacao?.trim() || null,
        p_custo_unitario: values.custo_unitario ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["movimentacao-saldo"] });
      void qc.invalidateQueries({ queryKey: ["posicao-estoque-list"] });
      void qc.invalidateQueries({ queryKey: ["movimentacoes-estoque-list"] });
      form.reset({
        produto_id: selectedProductId,
        deposito_id: depositoId,
        tipo: "entrada",
        quantidade: 0,
        obra_id: "",
        prateleira_id: selectedShelfId,
        documento: "",
        observacao: "",
        custo_unitario: selectedProduct?.preco_custo ?? undefined,
      });
    },
    onError: (error) => toast.error(rpcErrorMessage(error)),
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    form.setValue("produto_id", id, { shouldValidate: true });
    if (!form.getValues("custo_unitario")) {
      const product = produtos.find((item) => item.id === id);
      form.setValue("custo_unitario", product?.preco_custo ?? undefined);
    }
  };

  const handleShelfChange = (id: string) => {
    setSelectedShelfId(id);
    form.setValue("prateleira_id", id || undefined);
    const shelf = prateleiras.find((item) => item.id === id);
    if (shelf) form.setValue("deposito_id", shelf.deposito_id, { shouldValidate: true });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Almoxarifado
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Nova movimentação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre entradas, saídas e ajustes sem alterar o saldo diretamente.
        </p>
      </div>

      {!canWrite && (
        <Alert>
          <PackageCheck className="size-4" />
          <AlertTitle>Modo consulta</AlertTitle>
          <AlertDescription>
            Seu cargo pode consultar os dados, mas somente admin, diretor e almoxarifado registram
            movimentações.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="size-5" /> Identificar material
          </CardTitle>
          <CardDescription>
            Leia uma etiqueta QR ou selecione o material pelo nome/SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" className="min-h-11 gap-2" onClick={() => setScannerOpen(true)}>
              <Camera className="size-4" /> Ler QR Code
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => setManualOpen(true)}
            >
              <RefreshCw className="size-4" /> Inserir manualmente
            </Button>
          </div>
          {selectedProduct && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">{selectedProduct.nome}</p>
              <p className="text-muted-foreground">
                SKU {selectedProduct.sku} · unidade {selectedProduct.unidade}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          <Card>
            <CardHeader>
              <CardTitle>Dados da movimentação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="produto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleProductChange}
                      disabled={loadingProdutos}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-11">
                          <SelectValue placeholder="Selecione por nome ou SKU" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {produtos.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.nome} · {product.sku}
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
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: TipoMovimentacao) => field.onChange(value)}
                      disabled={!canWrite}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída para obra</SelectItem>
                        <SelectItem value="ajuste">Ajuste — novo saldo físico</SelectItem>
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
                    <FormLabel>Depósito *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleShelfChange("");
                      }}
                      disabled={loadingDepositos || !!selectedShelf}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-11">
                          <SelectValue placeholder="Selecione o depósito" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {depositos.map((deposito) => (
                          <SelectItem key={deposito.id} value={deposito.id}>
                            {deposito.nome} · {deposito.codigo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedShelf && (
                      <p className="text-xs text-muted-foreground">
                        Derivado da prateleira {selectedShelf.codigo}.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prateleira_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prateleira (opcional)</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => handleShelfChange(value === "none" ? "" : value)}
                      disabled={!depositoId}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-11">
                          <SelectValue placeholder="Sem prateleira" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem prateleira</SelectItem>
                        {shelvesForDeposit.map((shelf) => (
                          <SelectItem key={shelf.id} value={shelf.id}>
                            {shelf.codigo} · {shelf.nome}
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
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {tipo === "ajuste" ? "Novo saldo físico *" : "Quantidade *"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        inputMode="decimal"
                        className="min-h-11"
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    {tipo === "ajuste" && (
                      <p className="text-xs text-muted-foreground">
                        Informe o saldo final encontrado na conferência.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="custo_unitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo unitário (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="min-h-11"
                        placeholder="Usar custo do produto"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value === "" ? undefined : event.target.value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipo === "saida" && (
                <FormField
                  control={form.control}
                  name="obra_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obra *</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="min-h-11">
                            <SelectValue placeholder="Selecione a obra" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {obras.map((obra) => (
                            <SelectItem key={obra.id} value={obra.id}>
                              {obra.numero} · {obra.nome}
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
                name="documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento</FormLabel>
                    <FormControl>
                      <Input
                        className="min-h-11"
                        placeholder="NF, requisição ou referência"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacao"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>
                      {tipo === "ajuste" ? "Justificativa do ajuste *" : "Observação"}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-24"
                        placeholder={
                          tipo === "ajuste"
                            ? "Explique a conferência ou divergência encontrada."
                            : "Observações da movimentação."
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Saldo atual no depósito: </span>
                <Badge variant="outline" className="text-base">
                  {loadingSaldo ? "..." : saldoAtual} {selectedProduct?.unidade || "un"}
                </Badge>
                {tipo === "saida" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A saída acima do saldo será bloqueada.
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="min-h-11 w-full sm:w-auto"
                disabled={!canWrite || mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Registrar movimentação
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Ler etiqueta QR</DialogTitle>
            <DialogDescription>
              Use a câmera traseira do celular para identificar o material ou a prateleira.
            </DialogDescription>
          </DialogHeader>
          {scannerOpen && <QrScanner onScan={applyQrValue} onClose={() => setScannerOpen(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Inserir QR manualmente</DialogTitle>
            <DialogDescription>Cole a URL completa da etiqueta ou o token QR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="https://.../estoque/movimentacao?produto=..."
              className="min-h-11"
            />
            <Button
              type="button"
              className="min-h-11 w-full"
              onClick={() => applyQrValue(manualValue)}
            >
              Identificar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
