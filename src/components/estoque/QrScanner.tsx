import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, ScanLine } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
  }
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

interface QrScannerProps {
  onScan: (value: string) => void;
  onClose?: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastValueRef = useRef({ value: "", at: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Solicitando acesso à câmera...");

  useEffect(() => {
    let active = true;

    const stopCamera = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const detect = async (detector: BarcodeDetectorInstance) => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue?.trim();
        const now = Date.now();
        if (
          value &&
          (value !== lastValueRef.current.value || now - lastValueRef.current.at > 2500)
        ) {
          lastValueRef.current = { value, at: now };
          onScan(value);
        }
      } catch {
        // A frame can fail while the camera is changing focus; continue scanning.
      }

      if (active) frameRef.current = requestAnimationFrame(() => void detect(detector));
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("Este navegador não oferece acesso à câmera. Use a inserção manual abaixo.");
        return;
      }

      if (!window.BarcodeDetector) {
        setStatus("error");
        setMessage(
          "A leitura automática de QR não é compatível neste navegador. Use a inserção manual abaixo.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("ready");
        setMessage("Aponte a câmera para a etiqueta QR.");
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        frameRef.current = requestAnimationFrame(() => void detect(detector));
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Permissão da câmera negada. Libere o acesso no navegador ou use a inserção manual."
            : "Não foi possível iniciar a câmera. Use a inserção manual abaixo.",
        );
      }
    };

    void startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [onScan]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
          aria-label="Leitor de QR Code"
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white">
            <Loader2 className="size-7 animate-spin" />
            <span>{message}</span>
          </div>
        )}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-52 rounded-2xl border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white">
            <CameraOff className="size-7" />
            <span>{message}</span>
          </div>
        )}
      </div>

      <Alert>
        <ScanLine className="size-4" />
        <AlertTitle>Leitura segura</AlertTitle>
        <AlertDescription>
          O QR apenas identifica o produto ou a prateleira. A movimentação só é gravada após sua
          confirmação.
        </AlertDescription>
      </Alert>

      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onClose}>
        <Camera className="mr-2 size-4" /> Fechar câmera
      </Button>
    </div>
  );
}
