import { useCallback, useEffect, useState } from "react";
import { Expand, ImageOff } from "lucide-react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PublicPhoto = { object_key: string; ordem: number };

type PublicPropertyGalleryProps = {
  token: string;
  title: string;
  photos: PublicPhoto[];
};

type LoadedPhoto = PublicPhoto & { url: string | null; failed: boolean };

export function PublicPropertyGallery({ token, title, photos }: PublicPropertyGalleryProps) {
  const [loadedPhotos, setLoadedPhotos] = useState<LoadedPhoto[]>(
    photos.map((photo) => ({ ...photo, url: null, failed: false })),
  );
  const [api, setApi] = useState<CarouselApi>();
  const [lightboxApi, setLightboxApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setLoadedPhotos(photos.map((photo) => ({ ...photo, url: null, failed: false })));

    void import("@/lib/r2.functions").then(async ({ readPublicPropertyImageServerFn }) => {
      await Promise.all(
        photos.map(async (photo, index) => {
          try {
            const result = await readPublicPropertyImageServerFn({
              data: { token, key: photo.object_key },
            });
            const binary = atob(result.bodyBase64);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
            if (!active) {
              URL.revokeObjectURL(url);
              return;
            }
            objectUrls.push(url);
            setLoadedPhotos((current) =>
              current.map((item, itemIndex) => (itemIndex === index ? { ...item, url } : item)),
            );
          } catch {
            if (!active) return;
            setLoadedPhotos((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, failed: true } : item,
              ),
            );
          }
        }),
      );
    });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos, token]);

  const updateSelection = useCallback((carouselApi: CarouselApi) => {
    if (carouselApi) setSelectedIndex(carouselApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    updateSelection(api);
    api.on("select", updateSelection);
    api.on("reInit", updateSelection);
    return () => {
      api.off("select", updateSelection);
      api.off("reInit", updateSelection);
    };
  }, [api, updateSelection]);

  useEffect(() => {
    if (lightboxOpen) lightboxApi?.scrollTo(selectedIndex, true);
  }, [lightboxApi, lightboxOpen, selectedIndex]);

  useEffect(() => {
    if (!lightboxApi) return;
    const syncLightboxSelection = () => {
      const index = lightboxApi.selectedScrollSnap();
      setSelectedIndex(index);
      api?.scrollTo(index);
    };
    lightboxApi.on("select", syncLightboxSelection);
    return () => {
      lightboxApi.off("select", syncLightboxSelection);
    };
  }, [api, lightboxApi]);

  const selectPhoto = (index: number) => {
    setSelectedIndex(index);
    api?.scrollTo(index);
  };

  const openLightbox = (index: number) => {
    selectPhoto(index);
    setLightboxOpen(true);
  };

  if (photos.length === 0) return null;

  return (
    <section aria-label={`Galeria de fotos de ${title}`} className="space-y-3">
      <Carousel
        setApi={setApi}
        opts={{ loop: photos.length > 1 }}
        className="group overflow-hidden rounded-2xl bg-stone-200"
      >
        <CarouselContent className="ml-0">
          {loadedPhotos.map((photo, index) => (
            <CarouselItem key={photo.object_key} className="pl-0">
              <button
                type="button"
                onClick={() => openLightbox(index)}
                className="relative block w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600 focus-visible:ring-inset"
                aria-label={`Ampliar foto ${index + 1} de ${photos.length}`}
              >
                <Photo
                  photo={photo}
                  alt={`Foto ${index + 1} de ${title}`}
                  className="aspect-[16/10] sm:aspect-[16/9]"
                />
                <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm">
                  <Expand className="size-4" /> Ampliar
                </span>
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {photos.length > 1 && (
          <>
            <CarouselPrevious className="left-3 size-10 border-0 bg-white/90 shadow-md hover:bg-white disabled:hidden" />
            <CarouselNext className="right-3 size-10 border-0 bg-white/90 shadow-md hover:bg-white disabled:hidden" />
          </>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          {selectedIndex + 1} / {photos.length}
        </span>
      </Carousel>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Miniaturas das fotos">
          {loadedPhotos.map((photo, index) => (
            <button
              key={photo.object_key}
              type="button"
              onClick={() => selectPhoto(index)}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg border-2 bg-stone-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2",
                selectedIndex === index
                  ? "border-emerald-600 opacity-100"
                  : "border-transparent opacity-65 hover:opacity-100",
              )}
              aria-label={`Exibir foto ${index + 1}`}
              aria-current={selectedIndex === index ? "true" : undefined}
            >
              <Photo photo={photo} alt="" className="h-16 w-24 sm:h-20 sm:w-28" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="h-[100dvh] max-w-none border-0 bg-black/95 p-4 text-white shadow-none sm:h-[96dvh] sm:w-[96vw] sm:rounded-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-white/15 [&>button]:p-2 [&>button]:text-white [&>button]:opacity-100">
          <DialogTitle className="sr-only">Fotos ampliadas de {title}</DialogTitle>
          <Carousel
            setApi={setLightboxApi}
            opts={{ loop: photos.length > 1 }}
            className="flex min-h-0 items-center px-2 sm:px-12"
          >
            <CarouselContent className="ml-0 h-[calc(100dvh-5rem)] sm:h-[calc(96dvh-3rem)]">
              {loadedPhotos.map((photo, index) => (
                <CarouselItem
                  key={photo.object_key}
                  className="flex h-full items-center justify-center pl-0"
                >
                  <Photo
                    photo={photo}
                    alt={`Foto ampliada ${index + 1} de ${title}`}
                    className="max-h-full w-full object-contain"
                    contain
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious className="left-0 size-11 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:hidden sm:left-2" />
                <CarouselNext className="right-0 size-11 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:hidden sm:right-2" />
              </>
            )}
          </Carousel>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            {selectedIndex + 1} / {photos.length}
          </span>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Photo({
  photo,
  alt,
  className,
  contain = false,
}: {
  photo: LoadedPhoto;
  alt: string;
  className?: string;
  contain?: boolean;
}) {
  if (photo.failed) {
    return (
      <div
        className={cn("flex items-center justify-center bg-stone-200 text-stone-500", className)}
      >
        <ImageOff className="size-8" />
        <span className="sr-only">Imagem indisponível</span>
      </div>
    );
  }
  if (!photo.url) {
    return (
      <div
        className={cn("animate-pulse bg-stone-200", className)}
        aria-label={`Carregando ${alt}`}
      />
    );
  }
  return (
    <img
      src={photo.url}
      alt={alt}
      className={cn("h-full w-full", contain ? "object-contain" : "object-cover", className)}
    />
  );
}
