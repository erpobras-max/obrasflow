import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, FileText, Download, Search, AlertCircle, FileSpreadsheet, FileArchive, Eye, X } from "lucide-react";
import { format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CATEGORIA_LABELS, type DocumentRow } from "@/lib/documentos.schema";
import { openR2File, getR2Url } from "@/lib/r2";

export const Route = createFileRoute("/portal/documentos")({
  component: PortalDocumentos,
});

const fmtBytes = (bytes: number | null | undefined) => {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getCategoryStyles = (cat: string) => {
  switch (cat) {
    case "CONTRATO":
      return "bg-red-50 text-red-700 border-red-200/50";
    case "ART":
      return "bg-blue-50 text-blue-700 border-blue-200/50";
    case "PROJETO":
      return "bg-teal-50 text-teal-700 border-teal-200/50";
    case "LICENCA":
      return "bg-amber-50 text-amber-700 border-amber-200/50";
    case "CERTIDAO":
      return "bg-purple-50 text-purple-700 border-purple-200/50";
    case "FISCAL":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200/50";
  }
};

const getFileIcon = (mime: string | null) => {
  if (!mime) return FileText;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("compressed")) return FileArchive;
  return FileText;
};

function PortalDocumentos() {
  const { obraId } = usePortalContext();
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  // Fetch documents
  const { data: documentos, isLoading, error } = useQuery({
    queryKey: ["portal-obra-documentos", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("*")
        .eq("obra_id", obraId as string)
        .is("parent_id", null) // Fetch only root documents (latest versions)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  const handleDownload = (doc: DocumentRow) => {
    try {
      openR2File(doc.bucket_path);
    } catch (err: any) {
      toast.error("Erro ao abrir arquivo: " + err.message);
    }
  };

  const filteredDocs = documentos?.filter((doc) =>
    doc.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-destructive">Erro ao carregar documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Não conseguimos obter a lista de arquivos da sua obra.
        </p>
      </div>
    );
  }

  const isPreviewable = (mime: string | null) => {
    if (!mime) return false;
    const m = mime.toLowerCase();
    return m.includes("pdf") || m.includes("image") || m.includes("png") || m.includes("jpg") || m.includes("jpeg") || m.includes("webp");
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Pasta de Documentos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acesse e visualize os arquivos oficiais, propostas, ARTs e licenças do seu projeto.
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm bg-slate-50"
          />
        </div>
      </div>

      {filteredDocs && filteredDocs.length === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <AlertCircle className="size-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">Nenhum documento encontrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Nenhum documento coincide com a busca ou está associado a esta obra.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredDocs?.map((doc) => {
            const Icon = getFileIcon(doc.mime_type);
            const catStyle = getCategoryStyles(doc.categoria);
            const canPreview = isPreviewable(doc.mime_type);
            
            return (
              <div
                key={doc.id}
                className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg shrink-0 ${
                    doc.mime_type?.includes("pdf") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                  }`}>
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">{doc.nome}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-medium border ${catStyle}`}>
                        {CATEGORIA_LABELS[doc.categoria] || doc.categoria}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {fmtBytes(doc.tamanho_bytes)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">
                        Modificado em: {format(parseISO(doc.created_at), "dd/MM/yyyy")}
                      </span>
                      {doc.versao > 1 && (
                        <>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <Badge variant="secondary" className="text-[9px] py-0 px-1 font-semibold bg-slate-100 text-slate-600">
                            v{doc.versao}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto">
                  {canPreview && (
                    <Button
                      onClick={() => setPreviewDoc(doc)}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5 flex-1 sm:flex-initial"
                    >
                      <Eye className="size-3.5" />
                      Visualizar
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDownload(doc)}
                    variant={canPreview ? "ghost" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-slate-700 border-slate-200 flex-1 sm:flex-initial"
                  >
                    <Download className="size-3.5" />
                    Baixar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog Modal */}
      <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden bg-slate-900 border-none text-white sm:rounded-2xl flex flex-col">
          <DialogTitle className="sr-only">Visualizar Documento</DialogTitle>
          <DialogDescription className="sr-only">Pré-visualização do arquivo selecionado</DialogDescription>
          
          {previewDoc && (
            <>
              {/* Header */}
              <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded">
                    {(() => {
                      const Icon = getFileIcon(previewDoc.mime_type);
                      return <Icon className="size-4 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold truncate max-w-[50vw] sm:max-w-[60vw]">
                      {previewDoc.nome}
                    </h3>
                    <p className="text-[10px] text-white/60">
                      Versão {previewDoc.versao} • {fmtBytes(previewDoc.tamanho_bytes)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(previewDoc)}
                    className="h-9 w-9 text-white hover:bg-white/10 rounded-full"
                    title="Baixar arquivo"
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewDoc(null)}
                    className="h-9 w-9 text-white hover:bg-white/10 rounded-full"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Viewer Area */}
              <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-auto relative">
                {previewDoc.mime_type?.toLowerCase().includes("pdf") ? (
                  <iframe
                    src={`${getR2Url(previewDoc.bucket_path)}#toolbar=0`}
                    className="w-full h-full border-none"
                    title={previewDoc.nome}
                  />
                ) : previewDoc.mime_type?.toLowerCase().includes("image") || 
                  /\.(jpg|jpeg|png|webp|gif)$/i.test(previewDoc.bucket_path) ? (
                  <img
                    src={getR2Url(previewDoc.bucket_path)}
                    alt={previewDoc.nome}
                    className="max-h-full max-w-full object-contain p-4 rounded-lg"
                  />
                ) : (
                  <div className="text-center p-6 text-white/80">
                    <FileText className="size-16 mx-auto text-white/40 mb-3" />
                    <p className="text-sm font-medium">Este tipo de arquivo não suporta visualização inline.</p>
                    <Button
                      onClick={() => handleDownload(previewDoc)}
                      className="mt-4 gap-2"
                      size="sm"
                    >
                      <Download className="size-4" />
                      Baixar para Visualizar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

