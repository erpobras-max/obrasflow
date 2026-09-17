import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Folder, Plus, Search, FileText, FileSpreadsheet, Image as ImageIcon,
  FileCode, FileUp, Download, Eye, History, Trash2, X, Loader2
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { uploadR2, getR2Url, deleteManyR2 } from "@/lib/r2";
import {
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_LABELS,
  documentUploadSchema,
  type CategoriaDocumento,
  type DocumentRow,
  type DocumentUploadFormValues
} from "@/lib/documentos.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DocumentosObraProps {
  obra_id: string;
}

const fmtBytes = (bytes: number | null | undefined) => {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = 2;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

function getFileConfig(mimeType: string | null) {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("pdf")) {
    return { color: "bg-red-50 text-red-600 border-red-200", icon: FileText, label: "PDF" };
  }
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) {
    return { color: "bg-green-50 text-green-600 border-green-200", icon: FileSpreadsheet, label: "Excel" };
  }
  if (mime.includes("word") || mime.includes("officedocument.wordprocessingml")) {
    return { color: "bg-blue-100 text-blue-700 border-blue-200", icon: FileText, label: "Word" };
  }
  if (mime.includes("image")) {
    return { color: "bg-blue-50 text-blue-600 border-blue-200", icon: ImageIcon, label: "Imagem" };
  }
  return { color: "bg-gray-50 text-gray-600 border-gray-200", icon: FileCode, label: "Outro" };
}

export function DocumentosObra({ obra_id }: DocumentosObraProps) {
  const { perfil, loading } = useAuth();
  const qc = useQueryClient();

  const [busca, setBusca] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Query documents specifically for this obra_id
  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos", "obra", obra_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("*")
        .eq("obra_id", obra_id)
        .is("parent_id", null) // Get only main documents
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
    enabled: !loading && !!perfil && !!obra_id,
  });

  const filtrados = useMemo(() => {
    if (!documentos) return [];
    let r = documentos;
    if (categoriaFilter !== "all") {
      r = r.filter((d) => d.categoria === categoriaFilter);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      r = r.filter((d) => d.nome.toLowerCase().includes(q));
    }
    return r;
  }, [documentos, categoriaFilter, busca]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: versions } = await (supabase as any)
        .from("documentos")
        .select("bucket_path")
        .or(`id.eq.${id},parent_id.eq.${id}`);

      if (versions && versions.length > 0) {
        const paths = versions.map((v: any) => v.bucket_path).filter(Boolean);
        if (paths.length) await deleteManyR2(paths);
      }

      const { error } = await (supabase as any).from("documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["documentos", "obra", obra_id] });
      setViewDoc(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 min-w-[200px] gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIAS_DOCUMENTO.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-1.5 h-9 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
          <Plus className="size-4" /> Enviar Arquivo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="border border-dashed rounded-lg py-10 text-center flex flex-col items-center justify-center space-y-2">
          <Folder className="size-8 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Nenhum documento anexado a esta obra.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map((doc) => {
            const config = getFileConfig(doc.mime_type);
            const FileIcon = config.icon;
            return (
              <Card
                key={doc.id}
                onClick={() => setViewDoc(doc)}
                className="group cursor-pointer hover:shadow-sm hover:border-primary/50 transition-all duration-200"
              >
                <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`size-10 rounded-lg border flex items-center justify-center shrink-0 ${config.color}`}>
                      <FileIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-xs leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={doc.nome}>
                        {doc.nome}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        v{doc.versao} • {fmtBytes(doc.tamanho_bytes)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          {CATEGORIA_LABELS[doc.categoria]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground border-t pt-1.5 flex items-center justify-between">
                    <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary font-medium flex items-center gap-1">
                      <Eye className="size-3" /> Visualizar
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <UploadObraDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        obra_id={obra_id}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["documentos", "obra", obra_id] })}
      />

      {/* View & Update Modal */}
      {viewDoc && (
        <ViewObraDialog
          doc={viewDoc}
          open={!!viewDoc}
          onOpenChange={(open) => !open && setViewDoc(null)}
          onDeleteClick={(id) => setDeleteId(id)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["documentos", "obra", obra_id] })}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá o documento e todas as suas versões antigas do banco de dados e do armazenamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Dialog de Upload adaptado para obra
interface UploadObraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra_id: string;
  onSuccess: () => void;
  parentDocId?: string;
  nextVersion?: number;
}

function UploadObraDialog({
  open,
  onOpenChange,
  obra_id,
  onSuccess,
  parentDocId = undefined,
  nextVersion = 1,
}: UploadObraDialogProps) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const form = useForm<any>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      nome: "",
      categoria: "OUTRO",
      obra_id: obra_id,
      versao: nextVersion,
    },
  });

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setProgress(0);
      setUploading(false);
      form.reset({
        nome: "",
        categoria: "OUTRO",
        obra_id: obra_id,
        versao: nextVersion,
      });
    }
  }, [open, obra_id, nextVersion, form]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo excede o limite máximo de 50MB");
      return;
    }
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "dwg"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      toast.error(`Tipo de arquivo não suportado. Permitidos: ${allowedExtensions.join(", ").toUpperCase()}`);
      return;
    }

    setSelectedFile(file);
    const baseName = file.name.substring(0, file.name.lastIndexOf("."));
    form.setValue("nome", baseName);
  };

  const onSubmit = async (values: DocumentUploadFormValues) => {
    if (!selectedFile) {
      toast.error("Por favor, selecione um arquivo.");
      return;
    }
    setUploading(true);
    setProgress(10);

    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const storagePath = await uploadR2(selectedFile, "documentos/obras");

      setProgress(100);

      const dbPayload = {
        nome: values.nome,
        categoria: values.categoria,
        obra_id: obra_id,
        versao: values.versao,
        bucket_path: storagePath,
        tamanho_bytes: selectedFile.size,
        mime_type: selectedFile.type || ext || "application/octet-stream",
        uploaded_by: user?.id ?? null,
        parent_id: parentDocId || null,
      };

      const { error: dbError } = await (supabase as any)
        .from("documentos")
        .insert(dbPayload);

      if (dbError) throw dbError;

      if (parentDocId) {
        await (supabase as any)
          .from("documentos")
          .update({
            versao: values.versao,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parentDocId);
      }

      toast.success(parentDocId ? "Nova versão enviada" : "Documento enviado com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{parentDocId ? "Nova versão do documento" : "Upload de Documento para a Obra"}</DialogTitle>
          <DialogDescription>
            Anexe o arquivo diretamente a este projeto de obra. Limite de 50MB.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <input
                type="file"
                id="file-upload-obra"
                className="hidden"
                onChange={handleFileInput}
                disabled={uploading}
              />
              <label htmlFor="file-upload-obra" className="cursor-pointer">
                <FileUp className="size-10 mx-auto text-muted-foreground mb-2" />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground truncate max-w-sm mx-auto">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtBytes(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">Arraste ou clique para selecionar arquivo</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOCX, XLSX, DWG (Máx. 50MB)</p>
                  </div>
                )}
              </label>
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Enviando...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <FormField
              control={form.control as any}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do documento *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do arquivo" {...field} disabled={uploading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!parentDocId && (
              <FormField
                control={form.control as any}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={uploading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIAS_DOCUMENTO.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || !selectedFile} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                {uploading ? "Salvando..." : "Salvar documento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Dialog de Visualização adaptado para obra
interface ViewObraDialogProps {
  doc: DocumentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteClick: (id: string) => void;
  onSuccess: () => void;
}

function ViewObraDialog({
  doc,
  open,
  onOpenChange,
  onDeleteClick,
  onSuccess,
}: ViewObraDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [uploadVersionOpen, setUploadVersionOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DocumentRow>(doc);

  const { data: versions, isLoading: loadingVersions } = useQuery({
    queryKey: ["documento-versoes", doc.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("*")
        .or(`id.eq.${doc.id},parent_id.eq.${doc.id}`)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
    enabled: open,
  });

  useEffect(() => {
    setSelectedVersion(doc);
  }, [doc]);

  useEffect(() => {
    if (selectedVersion?.bucket_path) {
      setSignedUrl(getR2Url(selectedVersion.bucket_path));
      setLoadingUrl(false);
    }
  }, [selectedVersion]);

  const isPdf = (selectedVersion.mime_type || "").toLowerCase().includes("pdf");
  const isImage = (selectedVersion.mime_type || "").toLowerCase().includes("image");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b pb-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold text-foreground truncate">
                {selectedVersion.nome}
              </DialogTitle>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {CATEGORIA_LABELS[selectedVersion.categoria]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Versão {selectedVersion.versao}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 mr-6 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadVersionOpen(true)}>
                <Plus className="size-3.5" /> Nova versão
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => onDeleteClick(doc.id)}>
                <Trash2 className="size-3.5" /> Excluir
              </Button>
            </div>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center justify-center border-b min-h-[300px]">
            {loadingUrl ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando arquivo...</span>
              </div>
            ) : isPdf && signedUrl ? (
              <iframe src={signedUrl} title={selectedVersion.nome} className="w-full h-[450px] rounded border" />
            ) : isImage && signedUrl ? (
              <img src={signedUrl} alt={selectedVersion.nome} className="max-h-[450px] max-w-full rounded border object-contain" />
            ) : (
              <div className="text-center p-6 bg-muted/30 rounded border w-full flex flex-col items-center justify-center gap-3">
                <FileText className="size-16 text-muted-foreground opacity-50" />
                <div>
                  <h4 className="font-semibold text-sm">Visualização direta indisponível</h4>
                  <p className="text-xs text-muted-foreground mt-1">Arquivos Word, Excel ou DWG devem ser baixados para visualização.</p>
                </div>
                {signedUrl && (
                  <Button asChild className="mt-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                    <a href={signedUrl} download target="_blank" rel="noreferrer" className="gap-2">
                      <Download className="size-4" /> Baixar Arquivo ({fmtBytes(selectedVersion.tamanho_bytes)})
                    </a>
                  </Button>
                )}
              </div>
            )}

            {signedUrl && (isPdf || isImage) && (
              <div className="w-full flex justify-end mt-3">
                <Button asChild size="sm" variant="outline">
                  <a href={signedUrl} download target="_blank" rel="noreferrer" className="gap-1.5">
                    <Download className="size-3.5" /> Baixar Arquivo ({fmtBytes(selectedVersion.tamanho_bytes)})
                  </a>
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground mb-3">
              <History className="size-4" /> Histórico de Versões
            </h3>

            {loadingVersions ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="border rounded-md divide-y overflow-hidden">
                {(versions ?? []).map((v) => {
                  const isSelected = selectedVersion.id === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      className={`flex items-center justify-between p-3 cursor-pointer text-xs transition-colors ${
                        isSelected ? "bg-primary/5 font-medium border-l-2 border-primary" : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-sm">Versão {v.versao}</span>
                        <span className="text-muted-foreground ml-3">Enviado em {new Date(v.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-muted-foreground">{fmtBytes(v.tamanho_bytes)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadObraDialog
        open={uploadVersionOpen}
        onOpenChange={setUploadVersionOpen}
        obra_id={doc.obra_id || ""}
        onSuccess={() => {
          onSuccess();
          onOpenChange(false);
        }}
        parentDocId={doc.id}
        nextVersion={doc.versao + 1}
      />
    </>
  );
}
