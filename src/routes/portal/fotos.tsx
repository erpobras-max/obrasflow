import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Image as ImageIcon, Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { getR2Url } from "@/lib/r2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/portal/fotos")({
  component: PortalFotos,
});

interface PhotoItem {
  id: string;
  url: string;
  legenda: string | null;
  created_at: string;
  diarios_obra: {
    data: string;
    atividades: string | null;
  };
  signedUrl: string;
}

function PortalFotos() {
  const { obraId } = usePortalContext();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Fetch photos
  const { data: photos, isLoading, error } = useQuery({
    queryKey: ["portal-obra-fotos", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarios_obra_fotos")
        .select(`
          id,
          url,
          legenda,
          created_at,
          diarios_obra!inner(obra_id, data, atividades)
        `)
        .eq("diarios_obra.obra_id", obraId as string);

      if (error) throw error;

      const rawList = (data ?? []) as any[];
      const enrichedList: PhotoItem[] = rawList.map((item) => ({
        id: item.id,
        url: item.url,
        legenda: item.legenda,
        created_at: item.created_at,
        diarios_obra: {
          data: item.diarios_obra.data,
          atividades: item.diarios_obra.atividades,
        },
        signedUrl: getR2Url(item.url),
      }));

      // Sort by date descending
      return enrichedList.sort((a, b) => b.diarios_obra.data.localeCompare(a.diarios_obra.data));
    },
  });

  // Unique list of months for filtering
  const months = useMemo(() => {
    if (!photos) return [];
    const set = new Set<string>();
    photos.forEach((p) => {
      const date = parseISO(p.diarios_obra.data);
      const formatted = format(date, "yyyy-MM");
      set.add(formatted);
    });
    return Array.from(set).sort().reverse();
  }, [photos]);

  const monthLabel = (m: string) => {
    const [year, month] = m.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    if (selectedMonth === "all") return photos;
    return photos.filter((p) => p.diarios_obra.data.startsWith(selectedMonth));
  }, [photos, selectedMonth]);

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && filteredPhotos.length > 0) {
      setLightboxIndex((prev) => (prev! + 1) % filteredPhotos.length);
    }
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && filteredPhotos.length > 0) {
      setLightboxIndex((prev) => (prev! - 1 + filteredPhotos.length) % filteredPhotos.length);
    }
  };

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
        <h3 className="font-semibold text-destructive">Erro ao carregar galeria</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Não conseguimos obter as fotos da sua obra.
        </p>
      </div>
    );
  }

  const isVideo = (url: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov|mkv)$/i.test(url);
  };

  const activePhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Fotos e Vídeos da Evolução</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total de <span className="font-semibold text-slate-700">{photos?.length ?? 0}</span> arquivos registrados na obra.
          </p>
        </div>

        {months.length > 0 && (
          <div className="min-w-[200px]">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 py-1 text-xs md:text-sm bg-slate-50">
                <SelectValue placeholder="Filtrar por mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs md:text-sm">Todas as mídias</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs md:text-sm">
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {filteredPhotos.length === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <ImageIcon className="size-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">Nenhuma foto ou vídeo encontrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Nenhuma imagem ou vídeo foi registrado para este período ou obra ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filteredPhotos.map((photo, idx) => {
            const video = isVideo(photo.url);
            return (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(idx)}
                className="group relative aspect-square overflow-hidden rounded-xl border bg-slate-100 cursor-pointer shadow-sm hover:shadow-md transition-all"
              >
                {video ? (
                  <video
                    src={photo.signedUrl}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={photo.signedUrl}
                    alt={photo.legenda || "Foto da Obra"}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                )}
                
                {/* Video Play indicator overlay */}
                {video && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                    <div className="p-3 bg-black/60 text-white rounded-full transition-transform group-hover:scale-110 shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                  <p className="text-[10px] font-semibold flex items-center gap-1">
                    <Calendar className="size-3" />
                    {format(parseISO(photo.diarios_obra.data), "dd/MM/yyyy")}
                  </p>
                  {photo.legenda && <p className="text-[11px] font-medium truncate mt-0.5">{photo.legenda}</p>}
                </div>
                
                {/* Fallback overlay label for mobile users where hover is not active */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white p-1.5 text-[9px] font-medium flex items-center justify-between sm:hidden">
                  <span>{format(parseISO(photo.diarios_obra.data), "dd/MM/yyyy")}</span>
                  {video && <span>[Vídeo]</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Dialog Overlay */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none text-white sm:rounded-2xl">
          <DialogTitle className="sr-only">Visualizar Mídia</DialogTitle>
          <DialogDescription className="sr-only">Foto ou vídeo ampliado da obra com sua data e legenda correspondentes</DialogDescription>
          {activePhoto && (
            <div className="relative flex flex-col items-center justify-center min-h-[60vh] max-h-[85vh]">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLightboxIndex(null)}
                className="absolute top-4 right-4 text-white hover:bg-white/20 z-50 rounded-full"
              >
                <X className="size-5" />
              </Button>

              {/* Navigation Controls */}
              {filteredPhotos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-40 rounded-full size-10"
                  >
                    <ChevronLeft className="size-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-40 rounded-full size-10"
                  >
                    <ChevronRight className="size-6" />
                  </Button>
                </>
              )}

              {/* Central Media Content (Image or Video) */}
              <div className="flex-1 w-full flex items-center justify-center p-4">
                {isVideo(activePhoto.url) ? (
                  <video
                    src={activePhoto.signedUrl}
                    controls
                    autoPlay
                    className="max-h-[65vh] max-w-full rounded-lg shadow-2xl"
                  />
                ) : (
                  <img
                    src={activePhoto.signedUrl}
                    alt={activePhoto.legenda || "Foto da Obra"}
                    className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                )}
              </div>

              {/* Bottom Details Panel */}
              <div className="w-full bg-black/60 p-4 border-t border-white/10 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-xs text-white/60 flex items-center justify-center sm:justify-start gap-1.5">
                    <Calendar className="size-3.5" />
                    Registo em: <span className="font-semibold text-white">{format(parseISO(activePhoto.diarios_obra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </p>
                  <p className="text-sm font-medium mt-1 text-white/95">
                    {activePhoto.legenda || "Evolução física da etapa correspondente."}
                  </p>
                </div>
                <div className="text-[10px] text-white/40 shrink-0">
                  {lightboxIndex! + 1} de {filteredPhotos.length}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
