import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import {
  uploadFotoEvidenciaMedicao,
  excluirFotoEvidenciaMedicao,
  gerarLinkPublicoMedicao,
  listarLinksPublicosMedicao,
} from "@/lib/medicao-empreiteiro-publica.functions";
import { getR2Url } from "@/lib/r2";

interface MedicaoAnexosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicaoId: string;
  numeroMedicao: number;
}

export function MedicaoAnexos({
  open,
  onOpenChange,
  medicaoId,
  numeroMedicao,
}: MedicaoAnexosProps) {
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  // Buscar anexos existentes
  const {
    data: anexos = [],
    isLoading,
    refetch: refetchAnexos,
  } = useQuery({
    queryKey: ["medicao-anexos-fotos", medicaoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicao_empreiteiro_anexos")
        .select("*")
        .eq("medicao_empreiteiro_id", medicaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        url: getR2Url(a.r2_key),
      }));
    },
  });

  // Buscar link público existente
  const { data: links = [], refetch: refetchLinks } = useQuery({
    queryKey: ["medicao-links-publicos", medicaoId],
    enabled: open,
    queryFn: () => listarLinksPublicosMedicao(medicaoId),
  });

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setEnviando(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadFotoEvidenciaMedicao(medicaoId, file);
      }
      toast.success("Foto(s) de evidência anexadas com sucesso!");
      refetchAnexos();
    } catch (err: any) {
      toast.error(`Falha no upload de foto: ${err.message}`);
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  };

  const handleExcluir = async (anexoId: string, r2Key: string) => {
    try {
      await excluirFotoEvidenciaMedicao(anexoId, r2Key);
      toast.success("Foto removida.");
      refetchAnexos();
    } catch (err: any) {
      toast.error(`Erro ao remover foto: ${err.message}`);
    }
  };

  const handleGerarLink = async () => {
    try {
      const res = await gerarLinkPublicoMedicao(medicaoId);
      setLinkGerado(res.url);
      await refetchLinks();
      navigator.clipboard.writeText(res.url);
      setCopiado(true);
      toast.success("Link público copiado para a área de transferência!");
      setTimeout(() => setCopiado(false), 3000);
    } catch (err: any) {
      toast.error(`Falha ao gerar link: ${err.message}`);
    }
  };

  const linkAtivo = links.find((l: any) => !l.revogado);
  const urlPublica = linkGerado || (linkAtivo ? `${window.location.origin}/medicao-empreiteiro/${linkAtivo.token_hash}` : null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Evidências Fotográficas — Medição nº {numeroMedicao}
            </DialogTitle>
            <DialogDescription>
              Adicione fotos do avanço físico e compartilhe o link somente leitura com o empreiteiro.
            </DialogDescription>
          </DialogHeader>

          {/* Compartilhamento com Empreiteiro */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                <Share2 className="h-4 w-4 text-blue-600" />
                Link Compartilhável para o Empreiteiro
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarLink}
                className="h-7 text-xs bg-white text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                {copiado ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {urlPublica ? "Copiar Link" : "Gerar Link Público"}
                  </>
                )}
              </Button>
            </div>
            {urlPublica && (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={urlPublica}
                  className="h-7 text-[11px] bg-white font-mono text-slate-600"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => window.open(urlPublica, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                </Button>
              </div>
            )}
          </div>

          {/* Upload e Grid de Fotos */}
          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Fotos Anexadas ({anexos.length})
              </span>
              <label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUploadFoto}
                  disabled={enviando}
                />
                <Button
                  asChild
                  size="sm"
                  disabled={enviando}
                  className="h-7 text-xs bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
                >
                  <span>
                    {enviando ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        + Anexar Fotos
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            <div className="flex-1 border rounded-md p-3 overflow-y-auto">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Carregando fotos...</div>
              ) : anexos.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                  <span>Nenhuma foto anexada a este boletim de medição.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {anexos.map((anexo: any) => (
                    <div
                      key={anexo.id}
                      className="group relative border rounded-md overflow-hidden bg-slate-100 flex flex-col"
                    >
                      <div
                        className="h-28 w-full bg-cover bg-center cursor-pointer"
                        style={{ backgroundImage: `url(${anexo.url})` }}
                        onClick={() => setFotoAmpliada(anexo.url)}
                      />
                      <div className="p-1.5 bg-white text-[10px] text-slate-600 truncate flex justify-between items-center">
                        <span className="truncate">{anexo.nome_arquivo}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-slate-400 hover:text-rose-600"
                          onClick={() => handleExcluir(anexo.id, anexo.r2_key)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Foto Ampliada */}
      {fotoAmpliada && (
        <Dialog open={Boolean(fotoAmpliada)} onOpenChange={() => setFotoAmpliada(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/90 border-0 flex flex-col items-center justify-center">
            <img
              src={fotoAmpliada}
              alt="Evidência da medição"
              className="max-h-[80vh] w-auto object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

