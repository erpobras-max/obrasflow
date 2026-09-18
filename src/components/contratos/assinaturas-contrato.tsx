import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Link2, Loader2, PenLine, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PapelAssinatura =
  | "contratada"
  | "contratante"
  | "locador"
  | "locatario"
  | "testemunha_1"
  | "testemunha_2";

export interface SignatarioContrato {
  papel: PapelAssinatura;
  label: string;
  nome?: string | null;
  documento?: string | null;
}

export interface AssinaturaContrato {
  id: string;
  papel: PapelAssinatura;
  nome_assinante: string;
  documento_assinante: string | null;
  assinatura_data_url: string;
  assinado_em: string;
}

interface DocumentoAssinatura {
  contratoId?: string | null;
  locacaoId?: string | null;
}

function assinaturaQueryKey({ contratoId, locacaoId }: DocumentoAssinatura) {
  return ["contrato-assinaturas", contratoId ? "contrato" : "locacao", contratoId || locacaoId];
}

export function useAssinaturasContrato({
  contratoId,
  locacaoId,
  enabled = true,
}: DocumentoAssinatura & { enabled?: boolean }) {
  return useQuery({
    queryKey: assinaturaQueryKey({ contratoId, locacaoId }),
    enabled: enabled && Boolean(contratoId || locacaoId),
    queryFn: async () => {
      let query = supabase
        .from("contrato_assinaturas" as any)
        .select("id,papel,nome_assinante,documento_assinante,assinatura_data_url,assinado_em")
        .is("deleted_at", null)
        .order("assinado_em", { ascending: true });

      query = contratoId ? query.eq("contrato_id", contratoId) : query.eq("locacao_id", locacaoId!);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AssinaturaContrato[];
    },
  });
}

export function SignatureCanvas({
  onChange,
  resetKey,
}: {
  onChange: (dataUrl: string | null) => void;
  resetKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    if (!context) return;
    const position = point(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    drawing.current = true;
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const position = point(event);
    context.lineTo(position.x, position.y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  };

  const finish = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="h-52 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        aria-label="Área para desenhar a assinatura"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Desenhe dentro da área usando o mouse, caneta ou dedo.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={!hasInk}>
          <Eraser className="size-4" /> Limpar
        </Button>
      </div>
    </div>
  );
}

export function AssinaturasContrato({
  contratoId,
  locacaoId,
  signatarios,
}: DocumentoAssinatura & { signatarios: SignatarioContrato[] }) {
  const queryClient = useQueryClient();
  const { data: assinaturas = [], isLoading } = useAssinaturasContrato({ contratoId, locacaoId });
  const [selected, setSelected] = useState<SignatarioContrato | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const existing = selected ? assinaturas.find((item) => item.papel === selected.papel) : null;
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: assinaturaQueryKey({ contratoId, locacaoId }),
    });

  const openSignature = (signer: SignatarioContrato) => {
    const saved = assinaturas.find((item) => item.papel === signer.papel);
    setSelected(signer);
    setNome(saved?.nome_assinante || signer.nome || "");
    setDocumento(saved?.documento_assinante || signer.documento || "");
    setSignatureData(null);
    setResetKey((value) => value + 1);
  };

  const createPublicLink = async (signer: SignatarioContrato) => {
    try {
      const documentId = contratoId || locacaoId;
      const kind = contratoId ? "Contrato comercial" : "Contrato de locação";
      const filter = contratoId ? { contrato_id: contratoId } : { locacao_id: locacaoId };
      let query = supabase
        .from("contrato_links_assinatura" as any)
        .select("token")
        .eq("papel", signer.papel)
        .is("usado_em", null)
        .is("revogado_em", null)
        .gt("expira_em", new Date().toISOString());
      query = contratoId ? query.eq("contrato_id", contratoId) : query.eq("locacao_id", locacaoId!);
      const { data: current, error: findError } = await query.maybeSingle();
      if (findError) throw findError;
      let token = (current as any)?.token as string | undefined;
      if (!token) {
        const { data, error } = await supabase.from("contrato_links_assinatura" as any).insert({
          ...filter,
          papel: signer.papel,
          papel_label: signer.label,
          nome_esperado: signer.nome || null,
          documento_esperado: signer.documento || null,
          documento_titulo: `${kind} ${documentId}`,
          documento_resumo: `Assinatura solicitada para ${signer.label}. Confirme seus dados e assine somente após revisar o contrato recebido da empresa.`,
        }).select("token").single();
        if (error) throw error;
        token = (data as any).token;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/assinar/${token}`);
      toast.success("Link de assinatura copiado. Válido por 7 dias.");
    } catch (error: any) {
      toast.error("Erro ao gerar link: " + error.message);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !signatureData || nome.trim().length < 2) {
        throw new Error("Informe o nome e desenhe a assinatura.");
      }

      const payload = {
        contrato_id: contratoId || null,
        locacao_id: locacaoId || null,
        papel: selected.papel,
        nome_assinante: nome.trim(),
        documento_assinante: documento.trim() || null,
        assinatura_data_url: signatureData,
        assinado_em: new Date().toISOString(),
        deleted_at: null,
      };

      const operation = existing
        ? supabase
            .from("contrato_assinaturas" as any)
            .update(payload)
            .eq("id", existing.id)
        : supabase.from("contrato_assinaturas" as any).insert(payload);
      const { error } = await operation;
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Assinatura registrada.");
      setSelected(null);
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível salvar a assinatura."),
  });

  const removeMutation = useMutation({
    mutationFn: async (signature: AssinaturaContrato) => {
      const { error } = await supabase
        .from("contrato_assinaturas" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", signature.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Assinatura removida.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível remover a assinatura."),
  });

  return (
    <>
      <section className="print:hidden">
        <div className="mb-3 flex items-center gap-2">
          <PenLine className="size-4" />
          <div>
            <h3 className="text-sm font-semibold">Assinaturas manuscritas</h3>
            <p className="text-xs text-muted-foreground">
              Colete as assinaturas antes de imprimir ou salvar o contrato em PDF.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {signatarios.map((signer) => {
            const saved = assinaturas.find((item) => item.papel === signer.papel);
            return (
              <Card key={signer.papel} className="p-3">
                <div className="flex min-h-24 items-center gap-3">
                  {saved ? (
                    <img
                      src={saved.assinatura_data_url}
                      alt={`Assinatura de ${saved.nome_assinante}`}
                      className="h-20 min-w-0 flex-1 object-contain"
                    />
                  ) : (
                    <div className="flex h-20 flex-1 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                      {isLoading ? "Carregando..." : "Aguardando assinatura"}
                    </div>
                  )}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{signer.label}</p>
                    <p className="max-w-40 truncate text-xs text-muted-foreground">
                      {saved?.nome_assinante || signer.nome || "Nome não informado"}
                    </p>
                    <div className="mt-2 flex justify-end gap-1">
                      {!saved && (
                        <Button type="button" size="icon" variant="ghost" className="size-8" title="Copiar link para assinatura" onClick={() => void createPublicLink(signer)}>
                          <Link2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openSignature(signer)}
                      >
                        {saved ? (
                          <RotateCcw className="size-3.5" />
                        ) : (
                          <PenLine className="size-3.5" />
                        )}
                        {saved ? "Refazer" : "Assinar"}
                      </Button>
                      {saved && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive"
                          title="Remover assinatura"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(saved)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assinar como {selected?.label}</DialogTitle>
            <DialogDescription>
              Confirme os dados e desenhe a assinatura no campo abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signature-name">Nome do assinante</Label>
              <Input
                id="signature-name"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signature-document">CPF/CNPJ (opcional)</Label>
              <Input
                id="signature-document"
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <SignatureCanvas onChange={setSignatureData} resetKey={resetKey} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !signatureData || nome.trim().length < 2}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AssinaturasImpressao({
  assinaturas,
  signatarios,
}: {
  assinaturas: AssinaturaContrato[];
  signatarios: SignatarioContrato[];
}) {
  return (
    <footer className="mt-14 grid grid-cols-2 gap-x-10 gap-y-12 text-center">
      {signatarios.map((signer) => {
        const saved = assinaturas.find((item) => item.papel === signer.papel);
        return (
          <div key={signer.papel} className="flex min-h-28 flex-col justify-end">
            {saved && (
              <img
                src={saved.assinatura_data_url}
                alt=""
                className="mx-auto mb-1 h-20 max-w-full object-contain"
              />
            )}
            <div className="border-t border-slate-700 pt-2">
              <strong>{signer.label}</strong>
              <div className="text-[10px]">{saved?.nome_assinante || signer.nome || "—"}</div>
              {(saved?.documento_assinante || signer.documento) && (
                <div className="text-[9px]">
                  Documento: {saved?.documento_assinante || signer.documento}
                </div>
              )}
              {saved && (
                <div className="text-[8px] text-slate-500">
                  Assinado em {new Date(saved.assinado_em).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </footer>
  );
}
