/* eslint-disable @typescript-eslint/no-explicit-any -- Tabelas de vendas ainda não constam em types.ts; casts locais serão removidos após regenerar o schema. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { deleteR2, openR2File, uploadR2, validateFileSize, validateFileType } from "@/lib/r2";
import { imprimirElemento } from "@/lib/impressao";
import { formatarDocumento } from "@/lib/documento";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/imobiliaria/vendas")({
  component: VendasImobiliariasPage,
  head: () => ({ meta: [{ title: "Vendas de imóveis — ERP" }] }),
});

type StatusVenda = "rascunho" | "proposta" | "contratada" | "efetivada" | "cancelada";
type FormaPagamento = "avista" | "financiamento" | "parcelado" | "permuta" | "outro";

type Venda = {
  id: string;
  numero: string;
  imovel_id: string;
  comprador_id: string;
  data_proposta: string;
  data_contrato: string | null;
  data_fechamento: string | null;
  valor_venda: number;
  entrada_valor: number;
  forma_pagamento: FormaPagamento;
  parcelas: number;
  comissao_percentual: number;
  status: StatusVenda;
  observacoes: string | null;
  imovel: {
    codigo: string;
    titulo: string;
    logradouro: string | null;
    numero: string | null;
    cidade: string | null;
    uf: string | null;
    imobiliaria_clientes: { nome: string; cpf_cnpj: string } | null;
  } | null;
  comprador: {
    nome: string;
    cpf_cnpj: string;
    email: string | null;
    celular: string | null;
  } | null;
};

type DocumentoVenda = {
  id: string;
  nome: string;
  categoria: string;
  object_key: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};
type FormVenda = Omit<Venda, "id" | "imovel" | "comprador" | "observacoes"> & {
  observacoes: string;
};

const statusLabel: Record<StatusVenda, string> = {
  rascunho: "Rascunho",
  proposta: "Proposta",
  contratada: "Contratada",
  efetivada: "Efetivada",
  cancelada: "Cancelada",
};
const statusColor: Record<StatusVenda, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  proposta: "bg-blue-100 text-blue-700",
  contratada: "bg-amber-100 text-amber-800",
  efetivada: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-red-100 text-red-700",
};
const formaLabel: Record<FormaPagamento, string> = {
  avista: "À vista",
  financiamento: "Financiamento",
  parcelado: "Parcelado",
  permuta: "Permuta",
  outro: "Outro",
};
const categoriaLabel: Record<string, string> = {
  proposta: "Proposta",
  documento_comprador: "Documento do comprador",
  documento_proprietario: "Documento do proprietário",
  contrato: "Contrato",
  contrato_assinado: "Contrato assinado",
  financiamento: "Financiamento",
  certidao: "Certidão",
  outro: "Outro",
};
const brl = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";

function emptyForm(): FormVenda {
  const today = new Date().toISOString().slice(0, 10);
  return {
    numero: `VEN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    imovel_id: "",
    comprador_id: "",
    data_proposta: today,
    data_contrato: null,
    data_fechamento: null,
    valor_venda: 0,
    entrada_valor: 0,
    forma_pagamento: "avista",
    parcelas: 1,
    comissao_percentual: 0,
    status: "proposta",
    observacoes: "",
  };
}

function VendasImobiliariasPage() {
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const podeEditar =
    roles.includes("admin") ||
    roles.includes("diretor") ||
    roles.includes("imobiliaria") ||
    roles.includes("financeiro_imobiliaria");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Venda | null>(null);
  const [detalhe, setDetalhe] = useState<Venda | null>(null);
  const [excluir, setExcluir] = useState<Venda | null>(null);
  const [form, setForm] = useState<FormVenda>(emptyForm());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoriaArquivo, setCategoriaArquivo] = useState("outro");
  const contractRef = useRef<HTMLElement>(null);

  const {
    data: vendas = [],
    isLoading,
    error: vendasError,
    refetch: refetchVendas,
  } = useQuery({
    queryKey: ["imob_vendas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("imob_vendas")
        .select(
          "id,numero,imovel_id,comprador_id,data_proposta,data_contrato,data_fechamento,valor_venda,entrada_valor,forma_pagamento,parcelas,comissao_percentual,status,observacoes,imovel:imoveis(codigo,titulo,logradouro,numero,cidade,uf,imobiliaria_clientes(nome,cpf_cnpj)),comprador:imobiliaria_clientes!imob_vendas_comprador_id_fkey(nome,cpf_cnpj,email,celular)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Venda[];
    },
  });

  const { data: imoveis = [] } = useQuery({
    queryKey: ["imob_vendas_imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("id,codigo,titulo,status,valor_venda")
        .is("deleted_at", null)
        .in("status", ["disponivel", "vendido"] as any)
        .order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["imob_vendas_clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("id,nome,cpf_cnpj")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: documentos = [] } = useQuery({
    queryKey: ["imob_venda_documentos", detalhe?.id],
    enabled: Boolean(detalhe),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("imob_venda_documentos")
        .select("*")
        .eq("venda_id", detalhe!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoVenda[];
    },
  });
  const { data: empresa } = useQuery({
    queryKey: ["empresa-venda-imovel"],
    enabled: Boolean(detalhe),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("razao_social,nome_fantasia,cnpj")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const filtradas = useMemo(
    () =>
      vendas.filter((v) => {
        if (statusFilter !== "todos" && v.status !== statusFilter) return false;
        const term = search.trim().toLowerCase();
        return (
          !term ||
          `${v.numero} ${v.imovel?.codigo ?? ""} ${v.imovel?.titulo ?? ""} ${v.comprador?.nome ?? ""}`
            .toLowerCase()
            .includes(term)
        );
      }),
    [vendas, search, statusFilter],
  );

  const abrirNova = () => {
    setEditando(null);
    setForm(emptyForm());
    setFormOpen(true);
  };
  const abrirEdicao = (venda: Venda) => {
    setEditando(venda);
    setForm({
      numero: venda.numero,
      imovel_id: venda.imovel_id,
      comprador_id: venda.comprador_id,
      data_proposta: venda.data_proposta,
      data_contrato: venda.data_contrato,
      data_fechamento: venda.data_fechamento,
      valor_venda: venda.valor_venda,
      entrada_valor: venda.entrada_valor,
      forma_pagamento: venda.forma_pagamento,
      parcelas: venda.parcelas,
      comissao_percentual: venda.comissao_percentual,
      status: venda.status,
      observacoes: venda.observacoes ?? "",
    });
    setFormOpen(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!form.imovel_id || !form.comprador_id)
        throw new Error("Selecione o imóvel e o comprador.");
      if (form.valor_venda <= 0) throw new Error("Informe um valor de venda válido.");
      const payload = {
        numero: form.numero,
        imovel_id: form.imovel_id,
        comprador_id: form.comprador_id,
        data_proposta: form.data_proposta,
        data_contrato: form.data_contrato || null,
        data_fechamento: form.data_fechamento || null,
        valor_venda: form.valor_venda,
        entrada_valor: form.entrada_valor,
        forma_pagamento: form.forma_pagamento,
        parcelas: form.parcelas,
        comissao_percentual: form.comissao_percentual,
        status: form.status,
        observacoes: form.observacoes || null,
      };
      const query = (supabase as any).from("imob_vendas");
      const { error } = editando
        ? await query.update(payload).eq("id", editando.id)
        : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editando ? "Venda atualizada." : "Proposta de venda criada.");
      queryClient.invalidateQueries({ queryKey: ["imob_vendas"] });
      queryClient.invalidateQueries({ queryKey: ["imob_vendas_imoveis"] });
      setFormOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const excluirMutation = useMutation({
    mutationFn: async () => {
      if (!excluir) return;
      const { error } = await (supabase as any)
        .from("imob_vendas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", excluir.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda removida.");
      queryClient.invalidateQueries({ queryKey: ["imob_vendas"] });
      setExcluir(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!detalhe || !arquivo) throw new Error("Escolha um arquivo para anexar.");
      if (!validateFileType(arquivo)) throw new Error("Tipo de arquivo não permitido.");
      if (!validateFileSize(arquivo, 20)) throw new Error("O arquivo deve ter no máximo 20 MB.");
      const objectKey = await uploadR2(arquivo, "documentos/imobiliaria/vendas");
      const { error } = await (supabase as any).from("imob_venda_documentos").insert({
        venda_id: detalhe.id,
        nome: arquivo.name,
        categoria: categoriaArquivo,
        object_key: objectKey,
        mime_type: arquivo.type || null,
        tamanho_bytes: arquivo.size,
      });
      if (error) {
        await deleteR2(objectKey);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Documento anexado.");
      setArquivo(null);
      queryClient.invalidateQueries({ queryKey: ["imob_venda_documentos", detalhe?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const excluirDocumento = useMutation({
    mutationFn: async (doc: DocumentoVenda) => {
      const { error } = await (supabase as any)
        .from("imob_venda_documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      await deleteR2(doc.object_key);
    },
    onSuccess: () => {
      toast.success("Documento removido.");
      queryClient.invalidateQueries({ queryKey: ["imob_venda_documentos", detalhe?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendas de imóveis</h1>
          <p className="text-sm text-muted-foreground">
            Propostas, contrato de compra e venda e documentos da negociação.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNova}>
            <Plus className="size-4" /> Nova venda
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por número, imóvel ou comprador"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(statusLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando vendas…</div>
          ) : vendasError ? (
            <div className="space-y-3 p-8 text-center">
              <p className="text-destructive">
                Não foi possível carregar as vendas: {vendasError.message}
              </p>
              <Button variant="outline" onClick={() => void refetchVendas()}>
                Tentar novamente
              </Button>
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhuma venda cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="p-3">Número</th>
                    <th className="p-3">Imóvel</th>
                    <th className="p-3">Comprador</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((venda) => (
                    <tr key={venda.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{venda.numero}</td>
                      <td className="p-3">
                        <div>{venda.imovel?.titulo ?? "—"}</div>
                        <span className="text-xs text-muted-foreground">
                          {venda.imovel?.codigo}
                        </span>
                      </td>
                      <td className="p-3">{venda.comprador?.nome ?? "—"}</td>
                      <td className="p-3 font-medium">{brl(venda.valor_venda)}</td>
                      <td className="p-3">
                        <Badge className={cn("border-0", statusColor[venda.status])}>
                          {statusLabel[venda.status]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Ver venda"
                            onClick={() => setDetalhe(venda)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {podeEditar && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Editar venda"
                                onClick={() => abrirEdicao(venda)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                title="Excluir venda"
                                onClick={() => setExcluir(venda)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar venda" : "Nova venda de imóvel"}</DialogTitle>
            <DialogDescription>
              Registre a proposta e acompanhe-a até o fechamento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Número da proposta/contrato">
              <Input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </Campo>
            <Campo label="Status">
              <Select
                value={form.status}
                onValueChange={(status: StatusVenda) => setForm({ ...form, status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Imóvel">
              <Select
                value={form.imovel_id}
                onValueChange={(imovel_id) => {
                  const imovel = imoveis.find((item: any) => item.id === imovel_id);
                  setForm({
                    ...form,
                    imovel_id,
                    valor_venda: Number(imovel?.valor_venda ?? form.valor_venda),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {imoveis.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.codigo} — {i.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Comprador">
              <Select
                value={form.comprador_id}
                onValueChange={(comprador_id) => setForm({ ...form, comprador_id })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Valor da venda">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_venda || ""}
                onChange={(e) => setForm({ ...form, valor_venda: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Entrada">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.entrada_valor || ""}
                onChange={(e) => setForm({ ...form, entrada_valor: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Forma de pagamento">
              <Select
                value={form.forma_pagamento}
                onValueChange={(forma_pagamento: FormaPagamento) =>
                  setForm({ ...form, forma_pagamento })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formaLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Número de parcelas">
              <Input
                type="number"
                min="1"
                max="360"
                value={form.parcelas}
                onChange={(e) => setForm({ ...form, parcelas: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Comissão (%)">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.comissao_percentual || ""}
                onChange={(e) => setForm({ ...form, comissao_percentual: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Data da proposta">
              <Input
                type="date"
                value={form.data_proposta}
                onChange={(e) => setForm({ ...form, data_proposta: e.target.value })}
              />
            </Campo>
            <Campo label="Data do contrato">
              <Input
                type="date"
                value={form.data_contrato ?? ""}
                onChange={(e) => setForm({ ...form, data_contrato: e.target.value || null })}
              />
            </Campo>
            <Campo label="Data do fechamento">
              <Input
                type="date"
                value={form.data_fechamento ?? ""}
                onChange={(e) => setForm({ ...form, data_fechamento: e.target.value || null })}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Observações">
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Condições, pendências e observações da negociação"
                />
              </Campo>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}>
              {salvarMutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detalhe)} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venda {detalhe?.numero}</DialogTitle>
            <DialogDescription>
              {detalhe?.imovel?.codigo} — {detalhe?.imovel?.titulo}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <Tabs defaultValue="dados">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="contrato">Contrato</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="space-y-4 pt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Resumo label="Valor da venda" value={brl(detalhe.valor_venda)} />
                  <Resumo label="Entrada" value={brl(detalhe.entrada_valor)} />
                  <Resumo
                    label="Comissão estimada"
                    value={brl((detalhe.valor_venda * detalhe.comissao_percentual) / 100)}
                  />
                </div>
                <div className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
                  <div>
                    <b>Comprador:</b> {detalhe.comprador?.nome ?? "—"}
                    <br />
                    <span className="text-muted-foreground">
                      {formatarDocumento(detalhe.comprador?.cpf_cnpj)}
                    </span>
                  </div>
                  <div>
                    <b>Proprietário:</b> {detalhe.imovel?.imobiliaria_clientes?.nome ?? "—"}
                    <br />
                    <span className="text-muted-foreground">
                      {formatarDocumento(detalhe.imovel?.imobiliaria_clientes?.cpf_cnpj)}
                    </span>
                  </div>
                  <div>
                    <b>Pagamento:</b> {formaLabel[detalhe.forma_pagamento]} · {detalhe.parcelas}{" "}
                    parcela(s)
                  </div>
                  <div>
                    <b>Datas:</b> proposta em {dataBr(detalhe.data_proposta)} · fechamento{" "}
                    {dataBr(detalhe.data_fechamento)}
                  </div>
                </div>
                {detalhe.observacoes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Observações</CardTitle>
                    </CardHeader>
                    <CardContent className="whitespace-pre-wrap text-sm">
                      {detalhe.observacoes}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="contrato" className="space-y-3 pt-4">
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      imprimirElemento(
                        contractRef.current,
                        `Contrato compra e venda ${detalhe.numero}`,
                      )
                    }
                  >
                    <Printer className="size-4" /> Imprimir / Salvar PDF
                  </Button>
                </div>
                <article
                  ref={contractRef}
                  className="print-sheet mx-auto max-w-[794px] space-y-5 bg-white p-8 text-[12px] text-slate-900 shadow print:shadow-none"
                >
                  <style>{`@media print { @page { size:A4; margin:12mm; } .print-sheet { box-shadow:none!important; max-width:none!important; } }`}</style>
                  <header className="border-b-2 border-slate-800 pb-4 text-center">
                    <h1 className="text-xl font-bold">
                      CONTRATO PARTICULAR DE COMPRA E VENDA DE IMÓVEL
                    </h1>
                    <p className="mt-1">
                      Contrato nº {detalhe.numero} · Emissão:{" "}
                      {new Date().toLocaleDateString("pt-BR")}
                    </p>
                  </header>
                  <p>
                    <b>VENDEDOR(A):</b> {detalhe.imovel?.imobiliaria_clientes?.nome ?? "—"},
                    documento {formatarDocumento(detalhe.imovel?.imobiliaria_clientes?.cpf_cnpj)}.
                  </p>
                  <p>
                    <b>COMPRADOR(A):</b> {detalhe.comprador?.nome ?? "—"}, documento{" "}
                    {formatarDocumento(detalhe.comprador?.cpf_cnpj)}.
                  </p>
                  <p>
                    <b>CLÁUSULA PRIMEIRA — DO IMÓVEL.</b> O presente contrato tem por objeto o
                    imóvel {detalhe.imovel?.codigo} — {detalhe.imovel?.titulo}, situado em{" "}
                    {[
                      detalhe.imovel?.logradouro,
                      detalhe.imovel?.numero,
                      detalhe.imovel?.cidade,
                      detalhe.imovel?.uf,
                    ]
                      .filter(Boolean)
                      .join(", ") || "endereço a confirmar"}
                    .
                  </p>
                  <p>
                    <b>CLÁUSULA SEGUNDA — DO PREÇO E PAGAMENTO.</b> O valor ajustado é de{" "}
                    <b>{brl(detalhe.valor_venda)}</b>, com entrada de {brl(detalhe.entrada_valor)},
                    na modalidade {formaLabel[detalhe.forma_pagamento].toLowerCase()}, em{" "}
                    {detalhe.parcelas} parcela(s).
                  </p>
                  <p>
                    <b>CLÁUSULA TERCEIRA — DA TRANSFERÊNCIA.</b> A transferência da propriedade
                    ocorrerá após a quitação das obrigações previstas e apresentação da documentação
                    necessária.
                  </p>
                  <p>
                    <b>CLÁUSULA QUARTA — DAS CONDIÇÕES.</b>{" "}
                    {detalhe.observacoes ||
                      "As condições específicas constam dos anexos e documentos desta negociação."}
                  </p>
                  <div className="mt-16 grid grid-cols-2 gap-12 text-center">
                    <div className="border-t pt-2">
                      VENDEDOR(A)
                      <br />
                      {detalhe.imovel?.imobiliaria_clientes?.nome}
                    </div>
                    <div className="border-t pt-2">
                      COMPRADOR(A)
                      <br />
                      {detalhe.comprador?.nome}
                    </div>
                  </div>
                  <p className="pt-4 text-center text-xs text-muted-foreground">
                    {empresa?.razao_social || empresa?.nome_fantasia || "ERP Obras"}
                  </p>
                </article>
              </TabsContent>
              <TabsContent value="documentos" className="space-y-4 pt-4">
                {podeEditar && (
                  <Card>
                    <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto]">
                      <Input
                        type="file"
                        onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
                      />
                      <Select value={categoriaArquivo} onValueChange={setCategoriaArquivo}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoriaLabel).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => uploadMutation.mutate()}
                        disabled={!arquivo || uploadMutation.isPending}
                      >
                        {uploadMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}{" "}
                        Anexar
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-2">
                  {documentos.length === 0 ? (
                    <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum documento anexado a esta venda.
                    </p>
                  ) : (
                    documentos.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{doc.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoriaLabel[doc.categoria] ?? doc.categoria} ·{" "}
                            {new Date(doc.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openR2File(doc.object_key)}
                          >
                            <FileText className="size-4" /> Abrir
                          </Button>
                          {podeEditar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => excluirDocumento.mutate(doc)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(excluir)} onOpenChange={(open) => !open && setExcluir(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir venda?</DialogTitle>
            <DialogDescription>
              O registro será removido da listagem. Os documentos continuam preservados no histórico
              do banco.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => excluirMutation.mutate()}
              disabled={excluirMutation.isPending}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

