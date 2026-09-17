import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Eye, Loader2, Building, Home, Bed, Bath, Car, Maximize, Upload, Image as ImageIcon } from "lucide-react";
import { uploadR2, getR2Url } from "@/lib/r2";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  imovelSchema,
  type ImovelFormValues,
  TIPO_IMOVEL_LABEL,
  STATUS_IMOVEL_LABEL,
  STATUS_IMOVEL_BADGE,
} from "@/lib/imobiliaria.schema";
import { UFS } from "@/lib/clientes.schema";
import { buscarCep } from "@/lib/cep";
import { formatCep } from "@/lib/validacao-documento";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_app/imobiliaria/imoveis")({
  component: ImoveisPage,
});

interface ImovelRow {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  tipo: "apartamento" | "casa" | "comercial" | "terreno";
  status: "disponivel" | "alugado" | "vendido" | "inativo";
  valor_locacao: number | null;
  valor_venda: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  quartos: number;
  banheiros: number;
  suites: number;
  vagas: number;
  area_privativa: number | null;
  proprietario_id: string;
  foto_url: string | null;
  imobiliaria_clientes: {
    nome: string;
  } | null;
}

const EMPTY_FORM: ImovelFormValues = {
  codigo: "",
  titulo: "",
  descricao: "",
  tipo: "apartamento",
  status: "disponivel",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "" as any,
  quartos: 0,
  banheiros: 0,
  suites: 0,
  vagas: 0,
  area_privativa: 0,
  area_total: 0,
  valor_locacao: 0,
  valor_venda: 0,
  valor_condominio: 0,
  valor_iptu: 0,
  proprietario_id: "",
  foto_url: "",
};

const fmtBRL = (val: number | null | undefined) => {
  if (val === null || val === undefined || val === 0) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function ImoveisPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ImovelRow | null>(null);
  const [viewTarget, setViewTarget] = useState<ImovelRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImovelRow | null>(null);

  // Queries
  const { data: imoveis, isLoading } = useQuery({
    queryKey: ["imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select(`
          id, codigo, titulo, descricao, tipo, status,
          valor_locacao, valor_venda, cidade, uf, quartos, banheiros, vagas, area_privativa,
          proprietario_id, foto_url,
          imobiliaria_clientes ( nome )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar imóveis: " + error.message);
        throw error;
      }
      return (data ?? []) as unknown as ImovelRow[];
    },
  });

  const { data: proprietarios } = useQuery({
    queryKey: ["imob_proprietarios"],
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

  const filteredImoveis = useMemo(() => {
    return (imoveis ?? []).filter((im) => {
      if (filterTipo !== "all" && im.tipo !== filterTipo) return false;
      if (filterStatus !== "all" && im.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        const searchBlob = `${im.titulo} ${im.codigo} ${im.cidade ?? ""} ${im.imobiliaria_clientes?.nome ?? ""}`.toLowerCase();
        if (!searchBlob.includes(s)) return false;
      }
      return true;
    });
  }, [imoveis, search, filterTipo, filterStatus]);

  // Form Setup
  const form = useForm<ImovelFormValues>({
    resolver: zodResolver(imovelSchema) as any,
    defaultValues: EMPTY_FORM as any,
  });

  // Open Form for Create
  const handleCreate = () => {
    setEditTarget(null);
    form.reset(EMPTY_FORM);
    setFormOpen(true);
  };

  // Open Form for Edit
  const handleEdit = async (im: ImovelRow) => {
    try {
      const { data, error } = await supabase
        .from("imoveis")
        .select("*")
        .eq("id", im.id)
        .single();
      if (error) throw error;

      setEditTarget(im);
      form.reset({
        codigo: data.codigo,
        titulo: data.titulo,
        descricao: data.descricao ?? "",
        tipo: data.tipo as any,
        status: data.status as any,
        cep: formatCep(data.cep ?? ""),
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? "",
        bairro: data.bairro ?? "",
        cidade: data.cidade ?? "",
        uf: (data.uf as any) ?? "",
        quartos: data.quartos,
        banheiros: data.banheiros,
        suites: data.suites,
        vagas: data.vagas,
        area_privativa: data.area_privativa ?? 0,
        area_total: data.area_total ?? 0,
        valor_locacao: data.valor_locacao ?? 0,
        valor_venda: data.valor_venda ?? 0,
        valor_condominio: data.valor_condominio ?? 0,
        valor_iptu: data.valor_iptu ?? 0,
        proprietario_id: data.proprietario_id,
        foto_url: data.foto_url ?? "",
      });
      setFormOpen(true);
    } catch (e: any) {
      toast.error("Erro ao carregar dados do imóvel: " + e.message);
    }
  };

  // Open View Details Dialog
  const handleView = async (im: ImovelRow) => {
    try {
      const { data, error } = await supabase
        .from("imoveis")
        .select("*, imobiliaria_clientes ( nome )")
        .eq("id", im.id)
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
        .from("imoveis")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Imóvel removido com sucesso");
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao remover imóvel: " + e.message);
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: ImovelFormValues) => {
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
      };

      if (editTarget) {
        const { error } = await supabase
          .from("imoveis")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("imoveis")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? "Imóvel atualizado" : "Imóvel cadastrado");
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      setFormOpen(false);
      form.reset(EMPTY_FORM);
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar imóvel: " + e.message);
    },
  });

  const onSubmit = (values: ImovelFormValues) => {
    saveMutation.mutate(values);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground">
            Gerencie o catálogo de imóveis da carteira de locação e venda.
          </p>
        </div>
        <div>
          {podeEditar && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="size-4" />
              Novo Imóvel
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, título ou proprietário..."
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
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="alugado">Alugado</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : filteredImoveis.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground">
          Nenhum imóvel encontrado no catálogo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImoveis.map((im) => (
            <Card key={im.id} className="overflow-hidden flex flex-col justify-between group hover:shadow-lg transition-shadow">
              {/* Photo Section */}
              {im.foto_url && (
                <div className="h-40 overflow-hidden bg-muted">
                  <img
                    src={`${import.meta.env.VITE_R2_PUBLIC_URL}/${im.foto_url}`}
                    alt={im.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <CardHeader className={cn("p-4 border-b", !im.foto_url && "pt-4")}>
                <div className="flex justify-between items-start gap-2">
                  <div className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded uppercase">
                    {im.codigo}
                  </div>
                  <Badge className={cn("text-[10px] font-semibold", STATUS_IMOVEL_BADGE[im.status])}>
                    {STATUS_IMOVEL_LABEL[im.status]}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold line-clamp-1 mt-2">
                  {im.titulo}
                </CardTitle>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {im.tipo === "apartamento" || im.tipo === "comercial" ? (
                    <Building className="size-3" />
                  ) : (
                    <Home className="size-3" />
                  )}
                  {TIPO_IMOVEL_LABEL[im.tipo]}
                  {im.cidade && ` • ${im.cidade} / ${im.uf}`}
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-4">
                {/* Valuations */}
                <div className="grid grid-cols-2 gap-2 border-b pb-3 text-xs">
                  {im.valor_locacao && im.valor_locacao > 0 ? (
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Locação / Mês</span>
                      <span className="font-bold text-blue-600 text-sm">{fmtBRL(im.valor_locacao)}</span>
                    </div>
                  ) : null}
                  {im.valor_venda && im.valor_venda > 0 ? (
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Venda</span>
                      <span className="font-bold text-green-600 text-sm">{fmtBRL(im.valor_venda)}</span>
                    </div>
                  ) : null}
                  {!im.valor_locacao && !im.valor_venda && (
                    <div className="col-span-2 text-muted-foreground text-center">Valores não cadastrados</div>
                  )}
                </div>

                {/* Characteristics */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Bed className="size-3.5 text-muted-foreground/60" />
                    {im.quartos} Qts
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="size-3.5 text-muted-foreground/60" />
                    {im.banheiros} Ban
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="size-3.5 text-muted-foreground/60" />
                    {im.vagas} Vgs
                  </span>
                  {im.area_privativa && (
                    <span className="flex items-center gap-1 ml-auto">
                      <Maximize className="size-3.5 text-muted-foreground/60" />
                      {im.area_privativa} m²
                    </span>
                  )}
                </div>

                {/* Proprietario */}
                {im.imobiliaria_clientes && (
                  <div className="text-[11px] bg-muted/50 p-2 rounded text-muted-foreground">
                    Proprietário: <span className="font-medium text-foreground">{im.imobiliaria_clientes.nome}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-muted/10 p-3 border-t flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleView(im)} title="Ver Detalhes">
                  <Eye className="size-4" />
                </Button>
                {podeEditar && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(im)} title="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(im)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Editar Imóvel" : "Cadastrar Imóvel"}
            </DialogTitle>
            <DialogDescription>
              Insira os dados cadastrais, endereço e características físicas do imóvel.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do Imóvel</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: AP-102" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proprietario_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proprietário</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o proprietário" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(proprietarios ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
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
                  name="foto_url"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Foto do Imóvel</FormLabel>
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const key = await uploadR2(file, "imobiliaria/imoveis");
                                field.onChange(key);
                                toast.success("Foto enviada com sucesso!");
                              } catch (err: any) {
                                toast.error("Erro ao enviar foto: " + err.message);
                              }
                            }}
                          />
                          <Button type="button" variant="outline" className="gap-2">
                            <Upload className="size-4" />
                            Upload Foto
                          </Button>
                        </label>
                        {field.value && (
                          <span className="text-xs text-muted-foreground">{field.value}</span>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Título / Anúncio Curto</FormLabel>
                      <FormControl>
                        <Input placeholder="Apartamento de 3 quartos mobiliado no Centro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Imóvel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="apartamento">Apartamento</SelectItem>
                          <SelectItem value="casa">Casa</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="terreno">Terreno</SelectItem>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="disponivel">Disponível</SelectItem>
                          <SelectItem value="alugado">Alugado</SelectItem>
                          <SelectItem value="vendido">Vendido</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel>Descrição Detalhada</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva as características internas do imóvel..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Values Section */}
                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Valores</h3>
                </div>

                <FormField
                  control={form.control}
                  name="valor_locacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Aluguel / Mês (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2500" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_venda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Venda (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="450000" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_condominio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condomínio (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_iptu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IPTU (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="120" step="0.01" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Characteristics Section */}
                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Estrutura & Características</h3>
                </div>

                <FormField
                  control={form.control}
                  name="quartos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quartos</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="banheiros"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banheiros</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suites"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suítes</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vagas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vagas de Garagem</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="area_privativa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Privativa (m²)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="area_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Total (m²)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value || ""} />
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
                        <Input placeholder="Rua do imóvel" {...field} />
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
                        <Input placeholder="Apartamento, Bloco, etc." {...field} />
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
                        <Input placeholder="Bairro" {...field} />
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
                        <Input placeholder="Cidade" {...field} />
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Imóvel</DialogTitle>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-4 text-sm mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
                <div className="col-span-2">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Título</span>
                  <span className="font-bold text-base">{viewTarget.titulo}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Código</span>
                  <span className="font-mono text-sm">{viewTarget.codigo}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Status</span>
                  <Badge className={cn("text-[10px] font-semibold mt-1", STATUS_IMOVEL_BADGE[viewTarget.status])}>
                    {STATUS_IMOVEL_LABEL[viewTarget.status]}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Locação / Mês</span>
                  <span className="font-semibold text-blue-600">{fmtBRL(viewTarget.valor_locacao)}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Venda</span>
                  <span className="font-semibold text-green-600">{fmtBRL(viewTarget.valor_venda)}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Condomínio</span>
                  <span>{fmtBRL(viewTarget.valor_condominio)}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">IPTU / Anual</span>
                  <span>{fmtBRL(viewTarget.valor_iptu)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 border-b pb-4 text-center">
                <div className="bg-muted/40 p-2 rounded">
                  <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Quartos</span>
                  <span className="font-bold text-base">{viewTarget.quartos}</span>
                </div>
                <div className="bg-muted/40 p-2 rounded">
                  <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Suítes</span>
                  <span className="font-bold text-base">{viewTarget.suites}</span>
                </div>
                <div className="bg-muted/40 p-2 rounded">
                  <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Banheiros</span>
                  <span className="font-bold text-base">{viewTarget.banheiros}</span>
                </div>
                <div className="bg-muted/40 p-2 rounded">
                  <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Vagas</span>
                  <span className="font-bold text-base">{viewTarget.vagas}</span>
                </div>
                <div className="bg-muted/40 p-2 rounded col-span-2 md:col-span-2">
                  <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Área Privativa</span>
                  <span className="font-bold text-base">{viewTarget.area_privativa ? `${viewTarget.area_privativa} m²` : "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                <div>
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
                      "Endereço não cadastrado"
                    )}
                  </span>
                </div>
                {viewTarget.imobiliaria_clientes && (
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Proprietário</span>
                    <span className="font-medium text-foreground text-sm">{viewTarget.imobiliaria_clientes.nome}</span>
                  </div>
                )}
              </div>

              {viewTarget.descricao && (
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Descrição Interna</span>
                  <p className="bg-muted p-3 rounded-lg text-xs mt-1 whitespace-pre-wrap">{viewTarget.descricao}</p>
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o imóvel <strong>{deleteTarget?.codigo}</strong> do sistema.
              Contratos de locação ativos ligados a este imóvel serão mantidos, mas o imóvel será ocultado do catálogo.
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
