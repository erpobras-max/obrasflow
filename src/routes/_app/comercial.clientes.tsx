import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Eye, Loader2, FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase, SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@supabase/supabase-js";
import {
  clienteSchema, type ClienteFormValues, STATUS_BADGE, STATUS_LABEL, UFS,
} from "@/lib/clientes.schema";
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

export const Route = createFileRoute("/_app/comercial/clientes")({
  component: ClientesPage,
});

interface ClienteRow {
  id: string;
  tipo: "pf" | "pj";
  status: "ativo" | "inativo" | "prospect";
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cidade: string | null;
  uf: string | null;
  created_at: string;
  auth_user_id?: string | null;
}

const EMPTY: ClienteFormValues = {
  tipo: "pj",
  status: "ativo",
  nome: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  rg_ie: "",
  data_nascimento: "",
  data_fundacao: "",
  email: "",
  telefone: "",
  celular: "",
  website: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "" as any,
  inscricao_municipal: "",
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

function ClientesPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";

  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClienteRow | null>(null);
  const [viewTarget, setViewTarget] = useState<ClienteRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClienteRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes" as any)
        .select(
          "id,tipo,status,nome,nome_fantasia,cpf_cnpj,email,telefone,celular,cidade,uf,created_at,auth_user_id",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteRow[];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((c) => {
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (debounced) {
        const s = debounced.toLowerCase();
        const blob = `${c.nome} ${c.nome_fantasia ?? ""} ${c.cpf_cnpj} ${c.email ?? ""}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [data, debounced, filterTipo, filterStatus]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clientes" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const rows = filtered.map((c) => ({
      "Tipo": c.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica",
      "Status": c.status === "ativo" ? "Ativo" : c.status === "prospect" ? "Prospect" : "Inativo",
      "Nome / Razão Social": c.nome,
      "Nome Fantasia": c.nome_fantasia || "",
      "CPF / CNPJ": c.cpf_cnpj,
      "E-mail": c.email || "",
      "Telefone": c.telefone || "",
      "Celular": c.celular || "",
      "Cidade": c.cidade || "",
      "UF": c.uf || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const idxTipo = headers.indexOf("tipo");
        const idxStatus = headers.indexOf("status");
        const idxNome = headers.indexOf("nome / razão social");
        const idxNomeFantasia = headers.indexOf("nome fantasia");
        const idxCpfCnpj = headers.indexOf("cpf / cnpj");
        const idxEmail = headers.indexOf("e-mail");
        const idxTelefone = headers.indexOf("telefone");
        const idxCelular = headers.indexOf("celular");
        const idxCidade = headers.indexOf("cidade");
        const idxUf = headers.indexOf("uf");

        if (idxNome === -1 || idxCpfCnpj === -1) {
          toast.error("Colunas obrigatórias 'Nome / Razão Social' e 'CPF / CNPJ' não encontradas.");
          return;
        }

        let countSuccess = 0;
        let countError = 0;

        for (const row of dataRows) {
          if (!row || row.length === 0) continue;
          
          const rawCpfCnpj = String(row[idxCpfCnpj] ?? "").replace(/\D/g, "");
          const rawNome = String(row[idxNome] ?? "").trim();
          
          if (!rawCpfCnpj || !rawNome) {
            countError++;
            continue;
          }

          const rawTipo = String(row[idxTipo] ?? "pj").trim().toLowerCase().includes("física") || String(row[idxTipo] ?? "").toLowerCase() === "pf" ? "pf" : "pj";
          const rawStatus = String(row[idxStatus] ?? "ativo").trim().toLowerCase().includes("prospect") ? "prospect" : String(row[idxStatus] ?? "").toLowerCase().includes("inativo") ? "inativo" : "ativo";

          const payload = {
            tipo: rawTipo as "pf" | "pj",
            status: rawStatus as "ativo" | "inativo" | "prospect",
            nome: rawNome,
            nome_fantasia: idxNomeFantasia !== -1 ? String(row[idxNomeFantasia] ?? "").trim() || null : null,
            cpf_cnpj: rawCpfCnpj,
            email: idxEmail !== -1 ? String(row[idxEmail] ?? "").trim() || null : null,
            telefone: idxTelefone !== -1 ? String(row[idxTelefone] ?? "").trim() || null : null,
            celular: idxCelular !== -1 ? String(row[idxCelular] ?? "").trim() || null : null,
            cidade: idxCidade !== -1 ? String(row[idxCidade] ?? "").trim() || null : null,
            uf: idxUf !== -1 ? String(row[idxUf] ?? "").trim().toUpperCase() || null : null,
          };

          const { error } = await supabase.from("clientes").insert(payload);
          if (error) {
            console.warn("Erro ao importar cliente:", error.message);
            countError++;
          } else {
            countSuccess++;
          }
        }

        toast.success(`Importação concluída: ${countSuccess} cadastrados, ${countError} falhas/duplicados.`);
        qc.invalidateQueries({ queryKey: ["clientes"] });
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
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de clientes cadastrados no sistema.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, documento ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="gap-2 h-9"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" /> Exportar
            </Button>
            {podeEditar && (
              <>
                <label className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2 cursor-pointer gap-2">
                  <Upload className="size-4 text-blue-600" /> Importar
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                </label>
                <Button
                  onClick={() => { setEditTarget(null); setFormOpen(true); }}
                  className="gap-2 h-9"
                >
                  <Plus className="size-4" /> Novo cliente
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nome}</div>
                      {c.nome_fantasia && (
                        <div className="text-xs text-muted-foreground">{c.nome_fantasia}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.tipo === "pf" ? "PF" : "PJ"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCpfCnpj(c.cpf_cnpj)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{c.email ?? "—"}</div>
                      {(c.celular || c.telefone) && (
                        <div className="text-xs text-muted-foreground">
                          {formatTelefone(c.celular || c.telefone || "")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0", STATUS_BADGE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewTarget(c)}>
                          <Eye className="size-4" />
                        </Button>
                        {podeEditar && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => { setEditTarget(c); setFormOpen(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            {perfil?.perfil === "admin" && (
                              <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(c)}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ClienteFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
          target={editTarget}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["clientes"] })}
        />

        <ClienteViewDialog target={viewTarget} onClose={() => setViewTarget(null)} />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                O cliente "{deleteTarget?.nome}" será arquivado (soft delete).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ---------- Form Dialog (criar/editar) ----------
function ClienteFormDialog({
  open, onOpenChange, target, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ClienteRow | null;
  onSuccess: () => void;
}) {
  const isEdit = !!target;
  const { user } = useAuth();
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    if (target) {
      // carregar dados completos
      (async () => {
        const { data, error } = await supabase
          .from("clientes" as any)
          .select("*")
          .eq("id", target.id)
          .single();
        if (!error && data) {
          form.reset({
            ...EMPTY,
            ...(data as any),
            cpf_cnpj: formatCpfCnpj((data as any).cpf_cnpj ?? ""),
            cep: formatCep((data as any).cep ?? ""),
            telefone: formatTelefone((data as any).telefone ?? ""),
            celular: formatTelefone((data as any).celular ?? ""),
            email: (data as any).email ?? "",
            nome_fantasia: (data as any).nome_fantasia ?? "",
            rg_ie: (data as any).rg_ie ?? "",
            data_nascimento: (data as any).data_nascimento ?? "",
            data_fundacao: (data as any).data_fundacao ?? "",
            website: (data as any).website ?? "",
            logradouro: (data as any).logradouro ?? "",
            numero: (data as any).numero ?? "",
            complemento: (data as any).complemento ?? "",
            bairro: (data as any).bairro ?? "",
            cidade: (data as any).cidade ?? "",
            uf: ((data as any).uf ?? "") as any,
            inscricao_municipal: (data as any).inscricao_municipal ?? "",
            observacoes: (data as any).observacoes ?? "",
          });
        }
      })();
    } else {
      form.reset(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  const tipo = form.watch("tipo");

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
    form.setValue("data_fundacao", empresa.dataAbertura || form.getValues("data_fundacao"));
    toast.success("Dados do CNPJ preenchidos. Revise antes de salvar.");
  };

  const handleCepBlur = async () => {
    const cep = form.getValues("cep");
    if (!cep) return;
    setCepLoading(true);
    const end = await buscarCep(cep);
    setCepLoading(false);
    if (end) {
      form.setValue("logradouro", end.logradouro);
      form.setValue("bairro", end.bairro);
      form.setValue("cidade", end.cidade);
      form.setValue("uf", end.uf as any);
    } else {
      toast.error("CEP não encontrado");
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: ClienteFormValues) => {
      const cleanDoc = values.cpf_cnpj.replace(/\D/g, "");
      const email = values.email ? values.email.trim() : `cliente_${cleanDoc}@obrasflow.com.br`;
      const password = cleanDoc;

      let authUserId = isEdit && target ? (target as any).auth_user_id : null;

      if (!authUserId) {
        // 1. Verificar se já existe perfil com este email
        const { data: existingPerfil } = await supabase
          .from("perfis_usuarios" as any)
          .select("user_id")
          .eq("email", email)
          .maybeSingle();

        if (existingPerfil) {
          authUserId = (existingPerfil as any).user_id;
        } else {
          // 2. Tentar cadastrar novo usuário no Auth
          const tempSupabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false },
          });
          
          const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                nome: values.nome,
                email: email,
                perfil: "cliente",
              },
            },
          });

          if (signUpError) {
            console.warn("Sign up warning/error:", signUpError.message);
            // Se deu erro de usuário já existente, tentamos buscar no banco novamente
            const { data: retryPerfil } = await supabase
              .from("perfis_usuarios" as any)
              .select("user_id")
              .eq("email", email)
              .maybeSingle();
            if (retryPerfil) {
              authUserId = (retryPerfil as any).user_id;
            } else {
              throw new Error(`Erro ao criar usuário de acesso: ${signUpError.message}`);
            }
          } else if (signUpData?.user) {
            authUserId = signUpData.user.id;
          }
        }
      }

      const payload: any = {
        ...values,
        auth_user_id: authUserId,
        cpf_cnpj: values.cpf_cnpj,
        nome_fantasia: values.nome_fantasia || null,
        rg_ie: values.rg_ie || null,
        data_nascimento: values.data_nascimento || null,
        data_fundacao: values.data_fundacao || null,
        email: email,
        telefone: values.telefone || null,
        celular: values.celular || null,
        website: values.website || null,
        cep: values.cep ? values.cep.replace(/\D/g, "") : null,
        logradouro: values.logradouro || null,
        numero: values.numero || null,
        complemento: values.complemento || null,
        bairro: values.bairro || null,
        cidade: values.cidade || null,
        uf: values.uf || null,
        inscricao_municipal: values.inscricao_municipal || null,
        observacoes: values.observacoes || null,
      };
      if (isEdit && target) {
        const { error } = await supabase.from("clientes" as any).update(payload).eq("id", target.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("clientes" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Cliente atualizado" : "Cliente criado");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"} — preencha os dados abaixo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
            <Tabs defaultValue="dados">
              <TabsList>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tipo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="pf">Pessoa Física</SelectItem>
                          <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tipo === "pf" ? "Nome completo" : "Razão social"} *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {tipo === "pj" && (
                  <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome fantasia</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cpf_cnpj" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pf" ? "CPF" : "CNPJ"} *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={formatCpfCnpj(field.value)}
                          onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                          onBlur={handleCnpjBlur}
                          placeholder={tipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        />
                      </FormControl>
                      {tipo === "pj" && cnpjLoading && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline size-3 animate-spin" />Consultando CNPJ...</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rg_ie" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pf" ? "RG" : "Inscrição Estadual"}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {tipo === "pf" ? (
                    <FormField control={form.control} name="data_nascimento" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={form.control} name="data_fundacao" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de fundação</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  {tipo === "pj" && (
                    <FormField control={form.control} name="inscricao_municipal" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Municipal</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                <FormField control={form.control} name="observacoes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="contato" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl><Input placeholder="https://" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={formatTelefone(field.value ?? "")}
                          onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                          placeholder="(00) 0000-0000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="celular" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={formatTelefone(field.value ?? "")}
                          onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="cep" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP {cepLoading && <Loader2 className="inline size-3 animate-spin" />}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={formatCep(field.value ?? "")}
                          onChange={(e) => field.onChange(formatCep(e.target.value))}
                          onBlur={handleCepBlur}
                          placeholder="00000-000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="logradouro" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="numero" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="complemento" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Complemento</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="bairro" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <Select value={field.value as any} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- View Dialog ----------
function ClienteViewDialog({ target, onClose }: { target: ClienteRow | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["cliente", target?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes" as any).select("*").eq("id", target!.id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!target,
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target?.nome}</DialogTitle>
          <DialogDescription>
            {target?.tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"} · {formatCpfCnpj(target?.cpf_cnpj ?? "")}
          </DialogDescription>
        </DialogHeader>
        {data && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Email" value={data.email} />
            <Info label="Telefone" value={formatTelefone(data.telefone ?? "")} />
            <Info label="Celular" value={formatTelefone(data.celular ?? "")} />
            <Info label="Website" value={data.website} />
            <Info label="RG / IE" value={data.rg_ie} />
            <Info label="Insc. Municipal" value={data.inscricao_municipal} />
            <Info label="CEP" value={formatCep(data.cep ?? "")} />
            <Info label="Cidade / UF" value={data.cidade ? `${data.cidade}${data.uf ? "/" + data.uf : ""}` : null} />
            <Info
              label="Endereço"
              value={[data.logradouro, data.numero, data.complemento, data.bairro]
                .filter(Boolean).join(", ")}
              className="col-span-2"
            />
            <Info label="Observações" value={data.observacoes} className="col-span-2" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
