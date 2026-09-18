import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bath, Bed, Building2, Car, Home, MapPin, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/imovel-publico/$token")({ component: ImovelPublicoPage });

type Foto = { object_key: string; ordem: number };
type ImovelPublico = {
  codigo: string; titulo: string; descricao?: string | null; tipo: string; status: string;
  valor_locacao?: number | null; valor_venda?: number | null; valor_condominio?: number | null;
  valor_iptu?: number | null; logradouro?: string | null; numero?: string | null;
  complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
  quartos: number; banheiros: number; suites: number; vagas: number;
  area_privativa?: number | null; area_total?: number | null; fotos: Foto[];
};

const moeda = (valor?: number | null) => valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function ImovelPublicoPage() {
  const { token } = Route.useParams();
  const { data: imovel, isLoading } = useQuery({
    queryKey: ["imovel-publico", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_imovel_publico" as any, { _token: token } as any);
      if (error) throw error;
      return (data || null) as ImovelPublico | null;
    },
    retry: false,
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">Carregando imóvel…</div>;
  if (!imovel) return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <Building2 className="mx-auto size-10 text-stone-400" />
        <h1 className="mt-4 text-xl font-semibold">Link indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este anúncio expirou, foi revogado ou não existe.</p>
      </CardContent></Card>
    </main>
  );

  const fotos = [...(imovel.fotos || [])].sort((a, b) => a.ordem - b.ordem);
  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/auth" className="font-semibold tracking-tight">ObrasFlow</Link>
        <Badge variant="outline">{imovel.codigo}</Badge>
      </div></header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-700">{imovel.tipo}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{imovel.titulo}</h1>
          <p className="mt-3 flex items-center gap-2 text-stone-600"><MapPin className="size-4" /> {imovel.bairro ? `${imovel.bairro}, ` : ""}{imovel.cidade}/{imovel.uf}</p>
        </section>

        {fotos.length > 0 && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fotos.map((foto, index) => <div key={foto.object_key} className={index === 0 ? "overflow-hidden rounded-xl bg-stone-200 sm:col-span-2 lg:row-span-2" : "overflow-hidden rounded-xl bg-stone-200"}>
            <PublicPropertyImage token={token} objectKey={foto.object_key} alt={`Foto ${index + 1} de ${imovel.titulo}`} />
          </div>)}
        </section>}

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card><CardContent className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-5">
              <Info icon={Bed} label="Quartos" value={imovel.quartos} />
              <Info icon={Bath} label="Banheiros" value={imovel.banheiros} />
              <Info icon={Home} label="Suítes" value={imovel.suites} />
              <Info icon={Car} label="Vagas" value={imovel.vagas} />
              <Info icon={Maximize2} label="Área" value={imovel.area_privativa ? `${imovel.area_privativa} m²` : "—"} />
            </CardContent></Card>
            {imovel.descricao && <Card><CardContent className="p-6"><h2 className="text-lg font-semibold">Sobre o imóvel</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-stone-600">{imovel.descricao}</p></CardContent></Card>}
            <Card><CardContent className="p-6"><h2 className="text-lg font-semibold">Localização</h2><p className="mt-3 text-stone-600">{imovel.logradouro}, {imovel.numero}{imovel.complemento ? ` – ${imovel.complemento}` : ""}<br />{imovel.bairro} – {imovel.cidade}/{imovel.uf}</p></CardContent></Card>
          </div>
          <Card className="h-fit"><CardContent className="space-y-4 p-6">
            {imovel.valor_locacao ? <div><span className="text-sm text-stone-500">Locação mensal</span><p className="text-2xl font-bold text-emerald-700">{moeda(imovel.valor_locacao)}</p></div> : null}
            {imovel.valor_venda ? <div><span className="text-sm text-stone-500">Valor de venda</span><p className="text-2xl font-bold">{moeda(imovel.valor_venda)}</p></div> : null}
            <div className="border-t pt-4 text-sm text-stone-600"><p>Condomínio: {moeda(imovel.valor_condominio)}</p><p>IPTU anual: {moeda(imovel.valor_iptu)}</p></div>
          </CardContent></Card>
        </section>
      </div>
    </main>
  );
}

function PublicPropertyImage({ token, objectKey, alt }: { token: string; objectKey: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    void import("@/lib/r2.functions").then(({ readPublicPropertyImageServerFn }) =>
      readPublicPropertyImageServerFn({ data: { token, key: objectKey } })
    ).then((result) => {
      const binary = atob(result.bodyBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
      if (active) setUrl(objectUrl);
    }).catch(() => active && setUrl(null));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, objectKey]);
  return url ? <img src={url} alt={alt} className="aspect-[4/3] h-full w-full object-cover" /> : <div className="aspect-[4/3] h-full w-full animate-pulse bg-stone-200" aria-label={`Carregando ${alt}`} />;
}

function Info({ icon: Icon, label, value }: { icon: typeof Bed; label: string; value: string | number }) {
  return <div className="flex items-center gap-3"><Icon className="size-5 text-emerald-700" /><div><p className="text-xs text-stone-500">{label}</p><p className="font-semibold">{value}</p></div></div>;
}
