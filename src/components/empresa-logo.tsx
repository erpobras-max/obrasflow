import { useEffect, useState } from "react";
import { getSecureR2Url } from "@/lib/r2";
import { companyLogoKey } from "@/lib/empresa-logo";

export function EmpresaLogo({ value, className = "h-16 max-w-48 object-contain", link = false }: {
  value: string | null | undefined; className?: string; link?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ value: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = companyLogoKey(value);
  const external = value && /^https?:\/\//i.test(value) && !key ? value : "";
  const url = loaded?.value === value ? loaded.url : external;

  useEffect(() => {
    let active = true;
    let blobUrl: string | undefined;
    setFailed(null);
    if (key && value) {
      getSecureR2Url(key).then((result) => {
        blobUrl = result;
        if (active) setLoaded({ value, url: result });
        else URL.revokeObjectURL(result);
      }).catch(() => { if (active) setFailed(value); });
    }
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [key, value]);

  if (!value) return null;
  if (failed === value || (!key && !external)) return <span role="status" className="text-xs text-destructive">Não foi possível carregar a logo. Tente enviá-la novamente.</span>;
  if (!url) return <span role="status" className="text-xs text-muted-foreground">Carregando logo…</span>;
  return <span className="inline-flex items-center gap-3">
    <img src={url} alt="Logo da empresa" className={className} onError={() => setFailed(value)} />
    {link && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver</a>}
  </span>;
}
