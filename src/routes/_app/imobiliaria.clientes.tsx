import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Eye, Loader2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  imobiliariaClienteSchema,
  type ImobiliariaClienteFormValues,
  STATUS_CLIENTE_LABEL,
  STATUS_CLIENTE_BADGE,
} from "@/lib/imobiliaria.schema";
import { UFS } from "@/lib/clientes.schema";
import { buscarCep } from "@/lib/cep";
import { buscarCnpj } from "@/lib/cnpj";
import { formatCep, formatCpfCnpj, formatTelefone } from "@/lib/validacao-documento";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/imobiliaria/clientes")({
  component: ImobClientesPage,
});

interface ImobClienteRow {
  id: string;
  tipo: "pf" | "pj";
  status: "ativo" | "inativo";
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  rg_ie: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  created_at: string;
}

const EMPTY_FORM: ImobiliariaClienteFormValues = {
  tipo: "pf",
  status: "ativo",
  nome: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  rg_ie: "",
  email: "",
  telefone: "",
  celular: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "" as any,
  observacoes: "",
};

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function ImobClientesPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ImobClienteRow | null>(null);
  const [viewTarget, setViewTarget] = useState<ImobClienteRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImobClienteRow | null>(null);

  // Queries
  const { data: clientes, isLoading } = useQuery({
    queryKey: ["imob_clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("id, tipo, status, nome, nome_fantasia, cpf_cnpj, email, telefone, celular, cidade, uf, created_at")
        .is("deleted_at", null)
        .order("nome", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar clientes da imobiliária: " + error.message);
        throw error;
      }
      return (data ?? []) as unknown as ImobClienteRow[];
    },
  });

  const filteredClientes = useMemo(() => {
    return (clientes ?? []).filter((c) => {
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        const searchBlob = `${c.nome} ${c.nome_fantasia ?? ""} ${c.cpf_cnpj} ${c.email ?? ""}`.toLowerCase();
        if (!searchBlob.includes(s)) return false;
      }
      return true;
    });
  }, [clientes, debouncedSearch, filterTipo, filterStatus]);

  // Form Setup
  const form = useForm<ImobiliariaClienteFormValues>({
    resolver: zodResolver(imobiliariaClienteSchema),
    defaultValues: EMPTY_FORM,
  });

  const tipo = form.watch("tipo");
  const [cnpjLoading, setCnpjLoading] = useState(false);

  // Open Form for Create
  const handleCreate = () => {
    setEditTarget(null);
    form.reset(EMPTY_FORM);
    setFormOpen(true);
  };

  // Open Form for Edit
  const handleEdit = async (c: ImobClienteRow) => {
    try {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("*")
        .eq("id", c.id)
        .single();

      if (error) throw error;

      setEditTarget(c);
      form.reset({
        tipo: data.tipo as "pf" | "pj",
        status: data.status as "ativo" | "inativo",
        nome: data.nome,
        nome_fantasia: data.nome_fantasia ?? "",
        cpf_cnpj: formatCpfCnpj(data.cpf_cnpj),
        rg_ie: data.rg_ie ?? "",
        email: data.email ?? "",
        telefone: formatTelefone(data.telefone ?? ""),
        celular: formatTelefone(data.celular ?? ""),
        cep: formatCep(data.cep ?? ""),
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? "",
        bairro: data.bairro ?? "",
        cidade: data.cidade ?? "",
        uf: (data.uf as any) ?? "",
        observacoes: data.observacoes ?? "",
      });
      setFormOpen(true);
    } catch (e: any) {
      toast.error("Erro ao carregar dados do cliente: " + e.message);
    }
  };

  // Open View Details Dialog
  const handleView = async (c: ImobClienteRow) => {
    try {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("*")
        .eq("id", c.id)
        .single();
      if (error) throw error;
      setViewTarget(data as any);
    } catch (e: any) {
      toast.error("Erro ao carregar detalhes: " + e.message);
    }
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("imobiliaria_clientes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente imobiliário removido com sucesso");
      qc.invalidateQueries({ queryKey: ["imob_clientes"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao remover cliente: " + e.message);
    },
  });

  // Save Mutation (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async (values: ImobiliariaClienteFormValues) => {
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
      };

      if (editTarget) {
        const { error } = await supabase
          .from("imobiliaria_clientes")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("imobiliaria_clientes")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? "Cliente atualizado" : "Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["imob_clientes"] });
      setFormOpen(false);
      form.reset(EMPTY_FORM);
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar cliente: " + e.message);
    },
  });

  const onSubmit = (values: ImobiliariaClienteFormValues) => {
    saveMutation.mutate(values);
  };

  const handleCnpjBlur = async () => {
    if (tipo !== "pj") return;
    const cnpj = form.getValues("cpf_cnpj");
    if (cnpj.replace(/\D/g, "").length !== 14) return;
    setCnpjLoading(true);
    const empresa = await buscarCnpj(cnpj);
    setCnpjLoading(false);
    if (!empresa) {
      toast.error("CNPJ não encontrado na base pública.");
      return;
    }
    form.setValue("nome", empresa.razaoSocial || form.getValues("nome"));
    form.setValue("nome_fantasia", empresa.nomeFantasia || form.getValues("nome_fantasia"));
    form.setValue("rg_ie", empresa.inscricaoEstadual || form.getValues("rg_ie"));
    form.setValue("email", empresa.email || form.getValues("email"));
    form.setValue("telefone", empresa.telefone ? formatTelefone(empresa.telefone) : form.getValues("telefone"));
    form.setValue("cep", empresa.cep ? formatCep(empresa.cep) : form.getValues("cep"));
    form.setValue("logradouro", empresa.logradouro || form.getValues("logradouro"));
    form.setValue("numero", empresa.numero || form.getValues("numero"));
    form.setValue("complemento", empresa.complemento || form.getValues("complemento"));
    form.setValue("bairro", empresa.bairro || form.getValues("bairro"));
    form.setValue("cidade", empresa.cidade || form.getValues("cidade"));
    form.setValue("uf", (empresa.uf || form.getValues("uf")) as any);
    toast.success("Dados do CNPJ preenchidos. Revise antes de salvar.");
  };

  // CEP Lookup
  const handleCepBlur = async () => {
    const cep = form.getValues("cep")?.replace(/\D/g, "");
    if (cep && cep.length === 8) {
      try {
        const info = await buscarCep(cep);
        if (info) {
          form.setValue("logradouro", info.logradouro || "");
          form.setValue("bairro", info.bairro || "");
          form.setValue("cidade", info.cidade || "");
          form.setValue("uf", (info.uf as any) || "");
        }
      } catch {}
    }
  };

  // Export to Excel
  const handleExport = () => {
    if (filteredClientes.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const wsData = filteredClientes.map((c) => ({
      "Tipo": c.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica",
      "Status": c.status === "ativo" ? "Ativo" : "Inativo",
      "Nome / Razão Social": c.nome,
      "Nome Fantasia": c.nome_fantasia || "",
      "CPF / CNPJ": formatCpfCnpj(c.cpf_cnpj),
      "E-mail": c.email || "",
      "Telefone": formatTelefone(c.telefone || ""),
      "Celular": formatTelefone(c.celular || ""),
      "Cidade": c.cidade || "",
      "UF": c.uf || "",
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes Imobiliários");
    XLSX.writeFile(wb, `clientes-imobiliaria-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes Imobiliários</h1>
          <p className="text-muted-foreground">
            Gerencie proprietários e locatários de imóveis cadastrados no sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <FileSpreadsheet className="size-4" />
            Exportar
          </Button>
          {podeEditar && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="size-4" />
              Novo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhum cliente imobiliário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Localidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div>
                        {c.nome}
                        {c.nome_fantasia && (
                          <div className="text-xs text-muted-foreground">{c.nome_fantasia}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatCpfCnpj(c.cpf_cnpj)}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell className="text-xs space-y-0.5">
                      {c.celular && <div>Cel: {formatTelefone(c.celular)}</div>}
                      {c.telefone && <div>Tel: {formatTelefone(c.telefone)}</div>}
                      {!c.celular && !c.telefone && "—"}
                    </TableCell>
                    <TableCell>
                      {c.cidade ? `${c.cidade} / ${c.uf}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs font-semibold", STATUS_CLIENTE_BADGE[c.status])}>
                        {STATUS_CLIENTE_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(c)} title="Ver Detalhes">
                          <Eye className="size-4" />
                        </Button>
                        {podeEditar && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
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

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Editar Cliente Imobiliário" : "Cadastrar Cliente Imobiliário"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para cadastrar ou atualizar o cliente.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Pessoa</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                          <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
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
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
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

                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>{tipo === "pf" ? "Nome Completo" : "Razão Social"}</FormLabel>
                      <FormControl>
                        <Input placeholder={tipo === "pf" ? "João da Silva" : "Imobiliária XYZ Ltda"} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {tipo === "pj" && (
                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem className="col-span-1 md:col-span-2">
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome Comercial" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="cpf_cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pf" ? "CPF" : "CNPJ"}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                          {...field}
                          onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                          onBlur={handleCnpjBlur}
                        />
                      </FormControl>
                      {tipo === "pj" && cnpjLoading && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline size-3 animate-spin" />Consultando CNPJ...</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rg_ie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pf" ? "RG" : "Inscrição Estadual"}</FormLabel>
                      <FormControl>
                        <Input placeholder="Apenas números/letras" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="cliente@provedor.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="celular"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular (WhatsApp)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          {...field}
                          onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Fixo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 0000-0000"
                          {...field}
                          onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address Section */}
                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Endereço</h3>
                </div>

                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-000"
                          {...field}
                          onChange={(e) => field.onChange(formatCep(e.target.value))}
                          onBlur={handleCepBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logradouro"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Paulista" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto 45" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Centro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado (UF)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UFS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
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
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informações adicionais sobre o cliente..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewTarget !== null} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente Imobiliário</DialogTitle>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-4 text-sm mt-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b pb-4">
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Razão / Nome</span>
                  <span>{viewTarget.nome}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Documento</span>
                  <span>{formatCpfCnpj(viewTarget.cpf_cnpj)}</span>
                </div>
                {viewTarget.nome_fantasia && (
                  <div className="col-span-2 mt-2">
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Nome Fantasia</span>
                    <span>{viewTarget.nome_fantasia}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b pb-4">
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Celular</span>
                  <span>{formatTelefone(viewTarget.celular ?? "") || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Telefone</span>
                  <span>{formatTelefone(viewTarget.telefone ?? "") || "—"}</span>
                </div>
                <div className="col-span-2 mt-2">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">E-mail</span>
                  <span>{viewTarget.email || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b pb-4">
                <div className="col-span-2">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Endereço</span>
                  <span>
                    {viewTarget.logradouro ? (
                      <>
                        {viewTarget.logradouro}, nº {viewTarget.numero}
                        {viewTarget.complemento && ` - ${viewTarget.complemento}`}
                        <br />
                        {viewTarget.bairro} - {viewTarget.cidade} / {viewTarget.uf}
                        <br />
                        CEP: {formatCep(viewTarget.cep ?? "")}
                      </>
                    ) : (
                      "Sem endereço cadastrado"
                    )}
                  </span>
                </div>
              </div>

              {viewTarget.observacoes && (
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Observações</span>
                  <p className="bg-muted p-3 rounded-lg text-xs mt-1 whitespace-pre-wrap">{viewTarget.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setViewTarget(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o cliente <strong>{deleteTarget?.nome}</strong> do sistema.
              Os imóveis vinculados a ele não serão excluídos, mas perderão a associação direta com proprietários.
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
    </div>
  );
}
