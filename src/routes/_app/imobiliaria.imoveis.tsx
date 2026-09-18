import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Eye, Loader2, Building, Home, Bed, Bath, Car, Maximize, Upload, Image as ImageIcon, Share2, Link2Off, ArrowLeft, ArrowRight } from "lucide-react";
import { deleteR2, getSecureR2Url, uploadR2, validateFileSize, validateFileType } from "@/lib/r2";

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
import { Label } from "@/components/ui/label";
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
  imovel_fotos?: ImovelFoto[];
  imovel_links_publicos?: Array<{ id: string; token: string; revogado_em: string | null }>;
  imobiliaria_clientes: {
    nome: string;
  } | null;
}

interface ImovelFoto {
  id?: string;
  object_key: string;
  ordem: number;
  isNew?: boolean;
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

const primaryPhoto = (imovel: ImovelRow) =>
  [...(imovel.imovel_fotos ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.object_key ??
  imovel.foto_url;

const allPhotos = (imovel: ImovelRow) => {
  const photos = [...(imovel.imovel_fotos ?? [])].sort((a, b) => a.ordem - b.ordem);
  if (photos.length > 0) return photos;
  return imovel.foto_url ? [{ object_key: imovel.foto_url, ordem: 0 }] : [];
};

function ImoveisPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    roles.includes("admin") ||
    roles.includes("diretor") ||
    roles.includes("financeiro_imobiliaria") ||
    roles.includes("imobiliaria");

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ImovelRow | null>(null);
  const [viewTarget, setViewTarget] = useState<ImovelRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImovelRow | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imovelFotos, setImovelFotos] = useState<ImovelFoto[]>([]);
  const [deletingPhotoKey, setDeletingPhotoKey] = useState<string | null>(null);

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
          imovel_fotos ( id, object_key, ordem ),
          imovel_links_publicos ( id, token, revogado_em ),
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
    setImovelFotos([]);
    form.reset(EMPTY_FORM);
    setFormOpen(true);
  };

  // Open Form for Edit
  const handleEdit = async (im: ImovelRow) => {
    try {
      const [{ data, error }, { data: fotos, error: fotosError }] = await Promise.all([
        supabase.from("imoveis").select("*").eq("id", im.id).single(),
        supabase
          .from("imovel_fotos")
          .select("id,object_key,ordem")
          .eq("imovel_id", im.id)
          .order("ordem"),
      ]);
      if (error) throw error;
      if (fotosError) throw fotosError;

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
      setImovelFotos((fotos ?? []) as ImovelFoto[]);
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
        .select("*, imobiliaria_clientes ( nome ), imovel_fotos ( id, object_key, ordem ), imovel_links_publicos ( id, token, revogado_em )")
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
      const photoKeys = imovelFotos.map((foto) => foto.object_key);
      const payload = {
        ...values,
        foto_url: photoKeys[0] ?? null,
        updated_at: new Date().toISOString(),
      };

      let imovelId = editTarget?.id;

      if (editTarget) {
        const { error } = await supabase
          .from("imoveis")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("imoveis")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        imovelId = data.id;
      }

      const newPhotos = imovelFotos.filter((foto) => foto.isNew);
      if (imovelId && newPhotos.length > 0) {
        const { error } = await supabase.from("imovel_fotos").insert(
          newPhotos.map((foto, index) => ({
            imovel_id: imovelId,
            object_key: foto.object_key,
            ordem: imovelFotos.findIndex((item) => item.object_key === foto.object_key) ?? index,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? "Imóvel atualizado" : "Imóvel cadastrado");
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      setFormOpen(false);
      setImovelFotos([]);
      form.reset(EMPTY_FORM);
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar imóvel: " + e.message);
    },
  });

  const onSubmit = (values: ImovelFormValues) => {
    saveMutation.mutate(values);
  };

  const shareProperty = async (imovel: ImovelRow) => {
    try {
      let link = imovel.imovel_links_publicos?.find((item) => !item.revogado_em);
      if (!link) {
        const { data, error } = await supabase
          .from("imovel_links_publicos" as any)
          .insert({ imovel_id: imovel.id })
          .select("id,token,revogado_em")
          .single();
        if (error) throw error;
        link = data as any;
      }
      const url = `${window.location.origin}/imovel-publico/${link!.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link público copiado.");
      qc.invalidateQueries({ queryKey: ["imoveis"] });
    } catch (error: any) {
      toast.error("Erro ao gerar link público: " + error.message);
    }
  };

  const revokePropertyLink = async (imovel: ImovelRow) => {
    const link = imovel.imovel_links_publicos?.find((item) => !item.revogado_em);
    if (!link) return;
    const { error } = await supabase
      .from("imovel_links_publicos" as any)
      .update({ revogado_em: new Date().toISOString() })
      .eq("id", link.id);
    if (error) return toast.error("Erro ao revogar link: " + error.message);
    toast.success("Link público revogado.");
    setViewTarget((current) => current ? { ...current, imovel_links_publicos: [] } : current);
    qc.invalidateQueries({ queryKey: ["imoveis"] });
  };

  const closeForm = () => {
    const unsavedKeys = imovelFotos.filter((foto) => foto.isNew).map((foto) => foto.object_key);
    setFormOpen(false);
    setImovelFotos([]);
    void Promise.allSettled(unsavedKeys.map((key) => deleteR2(key)));
  };

  const removePhoto = async (foto: ImovelFoto) => {
    setDeletingPhotoKey(foto.object_key);
    try {
      if (foto.id) {
        const { error } = await supabase.from("imovel_fotos").delete().eq("id", foto.id);
        if (error) throw error;
      }
      const nextPhotos = imovelFotos.filter((item) => item.object_key !== foto.object_key);
      setImovelFotos(nextPhotos);
      if (editTarget) {
        const { error } = await supabase
          .from("imoveis")
          .update({ foto_url: nextPhotos[0]?.object_key ?? null })
          .eq("id", editTarget.id);
        if (error) throw error;
      }
      await deleteR2(foto.object_key);
      qc.invalidateQueries({ queryKey: ["imoveis"] });
      toast.success("Foto removida.");
    } catch (error: any) {
      toast.error("Erro ao remover foto: " + error.message);
    } finally {
      setDeletingPhotoKey(null);
    }
  };

  const movePhoto = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= imovelFotos.length) return;
    const reordered = [...imovelFotos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((foto, ordem) => ({ ...foto, ordem }));
    setImovelFotos(normalized);
    try {
      const persisted = normalized.filter((foto) => foto.id);
      await Promise.all(persisted.map(async (foto) => {
        const { error } = await supabase.from("imovel_fotos").update({ ordem: foto.ordem }).eq("id", foto.id!);
        if (error) throw error;
      }));
      if (editTarget) await supabase.from("imoveis").update({ foto_url: normalized[0]?.object_key ?? null }).eq("id", editTarget.id);
      qc.invalidateQueries({ queryKey: ["imoveis"] });
    } catch (error: any) {
      toast.error("Erro ao alterar posição: " + error.message);
      setImovelFotos(imovelFotos);
    }
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

  const uploadPhotos = async (files: File[]) => {
    if (imovelFotos.length + files.length > 10) {
      toast.error(`Selecione no máximo ${10 - imovelFotos.length} foto(s).`);
      return;
    }
    const invalid = files.find(
      (file) => !validateFileType(file, "imagens") || !validateFileSize(file),
    );
    if (invalid) {
      toast.error("Use apenas imagens JPEG, PNG ou WebP de até 10 MB cada.");
      return;
    }

    setUploadingPhoto(true);
    const uploaded: ImovelFoto[] = [];
    try {
      for (const file of files) {
        const key = await uploadR2(file, "imobiliaria/imoveis");
        uploaded.push({
          object_key: key,
          ordem: imovelFotos.length + uploaded.length,
          isNew: true,
        });
      }
      setImovelFotos((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} foto(s) enviada(s).`);
    } catch (error: any) {
      if (uploaded.length > 0) setImovelFotos((current) => [...current, ...uploaded]);
      toast.error("Erro ao enviar fotos: " + error.message);
    } finally {
      setUploadingPhoto(false);
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
              {primaryPhoto(im) && (
                <div className="h-40 overflow-hidden bg-muted">
                  <SecureR2Image objectKey={primaryPhoto(im)!} alt={im.titulo} />
                </div>
              )}
              <CardHeader className={cn("p-4 border-b", !primaryPhoto(im) && "pt-4")}>
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
                <Button variant="ghost" size="icon" onClick={() => void shareProperty(im)} title="Copiar link público">
                  <Share2 className="size-4" />
                </Button>
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
      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
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

                <div className="col-span-1 space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Label>Fotos do imóvel</Label>
                      <p className="text-xs text-muted-foreground">
                        Até 10 imagens JPEG, PNG ou WebP. A primeira será usada como capa.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {imovelFotos.length}/10
                    </span>
                  </div>
                  <input
                    id="imovel-fotos-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={uploadingPhoto || imovelFotos.length >= 10}
                    onChange={(event) => {
                      const input = event.currentTarget;
                      const files = Array.from(input.files ?? []);
                      if (files.length > 0) void uploadPhotos(files);
                      input.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingPhoto || imovelFotos.length >= 10}
                    onClick={() => document.getElementById("imovel-fotos-upload")?.click()}
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploadingPhoto ? "Enviando..." : "Adicionar fotos"}
                  </Button>
                  {imovelFotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {imovelFotos.map((foto, index) => (
                        <div key={foto.object_key} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                          <SecureR2Image objectKey={foto.object_key} alt={`Foto ${index + 1} do imóvel`} />
                          {index === 0 && (
                            <Badge className="absolute left-2 top-2 text-[10px]">Capa</Badge>
                          )}
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            <Button type="button" size="icon" variant="secondary" className="size-7" disabled={index === 0} onClick={() => void movePhoto(index, -1)} aria-label="Mover foto para a esquerda"><ArrowLeft className="size-3.5" /></Button>
                            <Button type="button" size="icon" variant="secondary" className="size-7" disabled={index === imovelFotos.length - 1} onClick={() => void movePhoto(index, 1)} aria-label="Mover foto para a direita"><ArrowRight className="size-3.5" /></Button>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute right-2 top-2 size-7"
                            disabled={deletingPhotoKey === foto.object_key}
                            onClick={() => void removePhoto(foto)}
                            aria-label={`Excluir foto ${index + 1}`}
                          >
                            {deletingPhotoKey === foto.object_key ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
                <Button type="button" variant="outline" onClick={closeForm}>
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
              {allPhotos(viewTarget).length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {allPhotos(viewTarget).map((foto, index) => (
                    <div key={foto.object_key} className="aspect-[4/3] overflow-hidden rounded-md border bg-muted">
                      <SecureR2Image objectKey={foto.object_key} alt={`Foto ${index + 1} de ${viewTarget.titulo}`} />
                    </div>
                  ))}
                </div>
              )}
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
            {viewTarget && (
              <>
                <Button type="button" variant="outline" className="gap-2" onClick={() => void shareProperty(viewTarget)}>
                  <Share2 className="size-4" /> Copiar link público
                </Button>
                {viewTarget.imovel_links_publicos?.some((item) => !item.revogado_em) && (
                  <Button type="button" variant="outline" className="gap-2 text-destructive" onClick={() => void revokePropertyLink(viewTarget)}>
                    <Link2Off className="size-4" /> Revogar link
                  </Button>
                )}
              </>
            )}
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

function SecureR2Image({ objectKey, alt }: { objectKey: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void getSecureR2Url(objectKey)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectKey]);

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <ImageIcon className="size-8 opacity-40" aria-hidden="true" />
        <span className="sr-only">Carregando foto de {alt}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover transition-transform group-hover:scale-105"
    />
  );
}
