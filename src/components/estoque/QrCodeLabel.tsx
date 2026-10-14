import { useMemo } from "react";

export type QrCodeLabelKind = "produto" | "prateleira";

interface QrCodeLabelProps {
  kind: QrCodeLabelKind;
  token: string;
  title: string;
  code?: string | null;
  subtitle?: string | null;
  unidade?: string | null;
}

export function getEstoqueQrUrl(kind: QrCodeLabelKind, token: string): string {
  const path =
    kind === "produto" ? "/estoque/movimentacao?produto=" : "/estoque/movimentacao?prateleira=";
  const origin =
    typeof window === "undefined"
      ? "https://obrasflow.erpobras.workers.dev"
      : window.location.origin;
  return `${origin}${path}${encodeURIComponent(token)}`;
}

export function QrCodeLabel({ kind, token, title, code, subtitle, unidade }: QrCodeLabelProps) {
  const targetUrl = useMemo(() => getEstoqueQrUrl(kind, token), [kind, token]);
  const imageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(targetUrl)}`,
    [targetUrl],
  );

  return (
    <article className="qr-print-label flex min-h-[250px] flex-col items-center justify-between rounded-lg border bg-white p-4 text-center text-slate-950 shadow-sm">
      <div className="w-full text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {kind === "produto" ? "Produto" : "Prateleira"}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold">{title}</h3>
        {code && <p className="mt-1 font-mono text-xs text-slate-600">{code}</p>}
      </div>

      <img
        src={imageUrl}
        alt={`QR Code de ${title}`}
        className="my-3 size-36 object-contain"
        loading="eager"
      />

      <div className="w-full text-left text-[10px] text-slate-600">
        {subtitle && <p>{subtitle}</p>}
        {unidade && <p>Unidade: {unidade}</p>}
        <p className="mt-1 break-all font-mono text-[8px] leading-tight text-slate-400">
          {targetUrl}
        </p>
      </div>
    </article>
  );
}
