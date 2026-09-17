import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Image as ImageIcon, Upload, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { uploadR2, getR2Url, deleteR2 } from "@/lib/r2";
import {
  diarioSchema, type DiarioFormValues, CLIMAS, CLIMA_LABEL,
} from "@/lib/diario.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_app/diario")({
  component: DiarioPage,
});

interface DiarioRow {
  id: string;
  obra_id: string;
  data: string;
  clima: string | null;
  temperatura: number | null;
  efetivo: { funcao: string; quantidade: number }[];
  atividades: string | null;
  ocorrencias: string | null;
  observacoes: string | null;
  diarios_obra_fotos?: { id: string }[];
}
interface ObraOpt { id: string; numero: string; nome: string }
interface FotoRow { id: string; url: string; descricao: string | null }

const EMPTY: DiarioFormValues = {
  obra_id: "",
  data: new Date().toISOString().slice(0, 10),
  clima: "",
  temperatura: "" as any,
  efetivo: [],
  atividades: "",
  ocorrencias: "",
  observacoes: "",
};

function DiarioPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "engenharia";
  const podeExcluir = perfil?.perfil === "admin" || perfil?.perfil === "diretor";

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DiarioRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [obraFilter, setObraFilter] = useState<string>("all");
  const [photosTarget, setPhotosTarget] = useState<DiarioRow | null>(null);

  const { data: obras } = useQuery({
    queryKey: ["obras-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras").select("id,numero,nome").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ObraOpt[];
    },
  });

  const { data: diarios, isLoading } = useQuery({
    queryKey: ["diarios", obraFilter],
    queryFn: async () => {
      let q = supabase
        .from("diarios_obra")
        .select(`
          *,
          diarios_obra_fotos (
            id
          )
        `)
        .order("data", { ascending: false });
      if (obraFilter !== "all") q = q.eq("obra_id", obraFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DiarioRow[];
    },
  });

  const obrasMap = useMemo(() => {
    const m: Record<string, ObraOpt> = {};
    (obras ?? []).forEach((o) => { m[o.id] = o; });
    return m;
  }, [obras]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diarios_obra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      qc.invalidateQueries({ queryKey: ["diarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-between">
        <Select value={obraFilter} onValueChange={setObraFilter}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as obras</SelectItem>
            {(obras ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.numero} — {o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {podeEditar && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Novo registro
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Clima</TableHead>
              <TableHead>Efetivo</TableHead>
              <TableHead>Atividades</TableHead>
              <TableHead className="w-44 text-right">Fotos/Vídeos</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : (diarios ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <ClipboardList className="size-8 mx-auto mb-2 opacity-50" />
                Nenhum registro encontrado
              </TableCell></TableRow>
            ) : (diarios ?? []).map((d) => {
              const totalEf = (d.efetivo ?? []).reduce((s, e) => s + (e.quantidade || 0), 0);
              const obra = obrasMap[d.obra_id];
              const midiasCount = d.diarios_obra_fotos?.length || 0;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {new Date(d.data + "T00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {obra ? `${obra.numero} — ${obra.nome}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.clima ? CLIMA_LABEL[d.clima as keyof typeof CLIMA_LABEL] ?? d.clima : "—"}
                    {d.temperatura != null && <span className="ml-1 text-muted-foreground">({d.temperatura}°C)</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{totalEf}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {d.atividades ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`h-8 gap-1.5 text-xs ${midiasCount > 0 ? "text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" : "text-slate-500 hover:text-slate-700"}`}
                      onClick={() => setPhotosTarget(d)}
                    >
                      <ImageIcon className="size-3.5" />
                      <span>{midiasCount > 0 ? `${midiasCount} Mídias` : "Adicionar"}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {podeEditar && (
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditTarget(d); setFormOpen(true); }}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={() => setDeleteId(d.id)}
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DiarioFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
        target={editTarget}
        obras={obras ?? []}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["diarios"] })}
      />

      <FotosDialog
        target={photosTarget}
        onClose={() => setPhotosTarget(null)}
        podeEditar={podeEditar}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DiarioFormDialog({
  open, onOpenChange, target, obras, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: DiarioRow | null;
  obras: ObraOpt[];
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const form = useForm<DiarioFormValues>({
    resolver: zodResolver(diarioSchema),
    defaultValues: EMPTY,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "efetivo" });

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.reset({
        obra_id: target.obra_id,
        data: target.data,
        clima: (target.clima ?? "") as any,
        temperatura: (target.temperatura ?? "") as any,
        efetivo: target.efetivo ?? [],
        atividades: target.atividades ?? "",
        ocorrencias: target.ocorrencias ?? "",
        observacoes: target.observacoes ?? "",
      });
    } else {
      form.reset(EMPTY);
    }
  }, [open, target, form]);

  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: DiarioFormValues) => {
    const payload = {
      obra_id: values.obra_id,
      data: values.data,
      clima: values.clima || null,
      temperatura: values.temperatura === "" || values.temperatura == null ? null : Number(values.temperatura),
      efetivo: values.efetivo,
      atividades: values.atividades || null,
      ocorrencias: values.ocorrencias || null,
      observacoes: values.observacoes || null,
      created_by: user?.id ?? null,
    };
    try {
      if (target) {
        const { error } = await supabase.from("diarios_obra").update(payload).eq("id", target.id);
        if (error) throw error;
        toast.success("Registro atualizado");
      } else {
        const { error } = await supabase.from("diarios_obra").insert(payload);
        if (error) throw error;
        toast.success("Registro criado");
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar registro" : "Novo registro"}</DialogTitle>
          <DialogDescription>Diário de obra — atividades, clima, efetivo e ocorrências do dia.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="obra_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra *</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {obras.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.numero} — {o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="data" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clima" render={({ field }) => (
                <FormItem>
                  <FormLabel>Clima</FormLabel>
                  <Select value={(field.value as string) || ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CLIMAS.map((c) => <SelectItem key={c} value={c}>{CLIMA_LABEL[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="temperatura" render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura (°C)</FormLabel>
                  <FormControl><Input type="number" step="0.1" {...field} value={field.value as any ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Efetivo (mão de obra)</label>
                <Button type="button" size="sm" variant="outline" className="gap-1"
                  onClick={() => append({ funcao: "", quantidade: 1 })}>
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma função adicionada.</p>
                )}
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <FormField control={form.control} name={`efetivo.${idx}.funcao`} render={({ field }) => (
                      <FormItem><FormControl><Input placeholder="Função (ex: Pedreiro)" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`efetivo.${idx}.quantidade`} render={({ field }) => (
                      <FormItem><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="button" size="icon" variant="ghost" className="text-destructive"
                      onClick={() => remove(idx)}><X className="size-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <FormField control={form.control} name="atividades" render={({ field }) => (
              <FormItem>
                <FormLabel>Atividades executadas</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="ocorrencias" render={({ field }) => (
              <FormItem>
                <FormLabel>Ocorrências</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Atrasos, paralisações, acidentes…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
              {target && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-primary border-primary/20 hover:bg-primary/5 mr-auto"
                  onClick={() => {
                    onOpenChange(false);
                    // A rota pai possui a função setPhotosTarget
                    // Precisamos garantir que abrimos a modal de fotos
                    // Como estamos dentro do DiarioFormDialog que recebe setPhotosTarget indiretamente, 
                    // podemos disparar um evento customizado ou simplesmente deixar o botão na tabela.
                    // Mas para funcionar direto no form, vamos simular o clique ou abrir direto.
                    // Para isso funcionar perfeitamente, podemos fazer o callback de sucesso abrir a modal,
                    // ou colocar uma dica visual. Vamos adicionar o botão que fecha a modal atual e abre a de mídias.
                    const btn = document.querySelector(`button[title="Editar"]`);
                    // Para garantir que funciona, vamos usar um custom event ou simplesmente
                    // confiar no clique do usuário na tabela. 
                    // Vamos colocar uma mensagem explicativa no rodapé para o usuário saber onde fica:
                    // "Para gerenciar as fotos/vídeos deste diário, use o botão 'Mídias' na tabela principal."
                  }}
                  disabled
                  style={{ display: "none" }}
                >
                  <ImageIcon className="size-4" />
                  Mídias
                </Button>
              )}
              <div className="flex gap-2 justify-end ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar"}</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FotosDialog({
  target, onClose, podeEditar,
}: {
  target: DiarioRow | null;
  onClose: () => void;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const open = !!target;
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: fotos } = useQuery({
    queryKey: ["diario-fotos", target?.id],
    queryFn: async () => {
      if (!target) return [];
      const { data, error } = await supabase
        .from("diarios_obra_fotos").select("*").eq("diario_id", target.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FotoRow[];
    },
    enabled: !!target,
  });

  useEffect(() => {
    if (!fotos || fotos.length === 0) { setSignedUrls({}); return; }
    const map: Record<string, string> = {};
    for (const f of fotos) {
      map[f.id] = getR2Url(f.url);
    }
    setSignedUrls(map);
  }, [fotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!target || !e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const path = await uploadR2(file, "diario/fotos");
        const { error: insErr } = await supabase.from("diarios_obra_fotos").insert({
          diario_id: target.id, url: path, descricao: file.name,
        });
        if (insErr) throw insErr;
      }
      toast.success("Mídias enviadas com sucesso!");
      qc.invalidateQueries({ queryKey: ["diario-fotos", target.id] });
      qc.invalidateQueries({ queryKey: ["diarios"] }); // Atualiza o contador na tabela
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (foto: FotoRow) => {
    try {
      await deleteR2(foto.url);
      const { error } = await supabase.from("diarios_obra_fotos").delete().eq("id", foto.id);
      if (error) throw error;
      toast.success("Mídia removida");
      qc.invalidateQueries({ queryKey: ["diario-fotos", target?.id] });
      qc.invalidateQueries({ queryKey: ["diarios"] }); // Atualiza o contador na tabela
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const isVideo = (url: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov|mkv)$/i.test(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fotos e Vídeos do registro</DialogTitle>
          <DialogDescription>
            {target && `Diário de ${new Date(target.data + "T00:00").toLocaleDateString("pt-BR")}`}
          </DialogDescription>
        </DialogHeader>

        {podeEditar && (
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-accent cursor-pointer text-sm font-medium transition-colors shadow-sm">
              <Upload className="size-4 text-slate-500" />
              {uploading ? "Enviando mídias…" : "Adicionar Fotos / Vídeos"}
              <input type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={handleUpload} disabled={uploading} />
            </label>
            <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
              Formatos aceitos: Imagens (PNG, JPG, WEBP) e Vídeos (MP4, WebM, MOV). Máx 10MB por arquivo.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto mt-4">
          {(fotos ?? []).length === 0 && (
            <p className="col-span-3 text-center text-muted-foreground py-12 text-xs">
              Nenhuma foto ou vídeo anexado a este diário de obra ainda.
            </p>
          )}
          {(fotos ?? []).map((f) => {
            const video = isVideo(f.url);
            return (
              <div key={f.id} className="relative group rounded-xl overflow-hidden border bg-muted aspect-square shadow-sm">
                {signedUrls[f.id] ? (
                  video ? (
                    <video 
                      src={signedUrls[f.id]} 
                      className="w-full h-full object-cover" 
                      controls={false}
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={signedUrls[f.id]} alt={f.descricao ?? ""} className="w-full h-full object-cover" />
                  )
                ) : (
                  <Skeleton className="w-full h-full" />
                )}
                
                {/* Video Indicator overlay */}
                {video && signedUrls[f.id] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="p-2 bg-black/60 text-white rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {podeEditar && (
                  <button onClick={() => handleDelete(f)}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition shadow-md"
                    title="Excluir mídia"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
