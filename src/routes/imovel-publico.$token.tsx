import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bath, Bed, Building2, Car, ExternalLink, Home, MapPin, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PublicPropertyGallery } from "@/components/imobiliaria/public-property-gallery";

export const Route = createFileRoute("/imovel-publico/$token")({ component: ImovelPublicoPage });

type Foto = { object_key: string; ordem: number };
type ImovelPublico = {
  codigo: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  status: string;
  valor_locacao?: number | null;
  valor_venda?: number | null;
  valor_condominio?: number | null;
  valor_iptu?: number | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  quartos: number;
  banheiros: number;
  suites: number;
  vagas: number;
  area_privativa?: number | null;
  area_total?: number | null;
  fotos: Foto[];
};

const moeda = (valor?: number | null) =>
  valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function ImovelPublicoPage() {
  const { token } = Route.useParams();
  const { data: imovel, isLoading } = useQuery({
    queryKey: ["imovel-publico", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "obter_imovel_publico" as never,
        { _token: token } as never,
      );
      if (error) throw error;
      return (data || null) as ImovelPublico | null;
    },
    retry: false,
  });

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">
        Carregando imóvel…
      </div>
    );
  if (!imovel)
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto size-10 text-stone-400" />
            <h1 className="mt-4 text-xl font-semibold">Link indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este anúncio expirou, foi revogado ou não existe.
            </p>
          </CardContent>
        </Card>
      </main>
    );

  const fotos = [...(imovel.fotos || [])].sort((a, b) => a.ordem - b.ordem);
  const endereco = [
    [imovel.logradouro, imovel.numero].filter(Boolean).join(", "),
    imovel.bairro,
    [imovel.cidade, imovel.uf].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");
  const mapsQuery = encodeURIComponent(`${endereco}, Brasil`);
  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/auth" className="font-semibold tracking-tight">
            ObrasFlow
          </Link>
          <Badge variant="outline">{imovel.codigo}</Badge>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-700">
            {imovel.tipo}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{imovel.titulo}</h1>
          <p className="mt-3 flex items-center gap-2 text-stone-600">
            <MapPin className="size-4" /> {imovel.bairro ? `${imovel.bairro}, ` : ""}
            {imovel.cidade}/{imovel.uf}
          </p>
        </section>

        <PublicPropertyGallery token={token} title={imovel.titulo} photos={fotos} />

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card>
              <CardContent className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-5">
                <Info icon={Bed} label="Quartos" value={imovel.quartos} />
                <Info icon={Bath} label="Banheiros" value={imovel.banheiros} />
                <Info icon={Home} label="Suítes" value={imovel.suites} />
                <Info icon={Car} label="Vagas" value={imovel.vagas} />
                <Info
                  icon={Maximize2}
                  label="Área"
                  value={imovel.area_privativa ? `${imovel.area_privativa} m²` : "—"}
                />
              </CardContent>
            </Card>
            {imovel.descricao && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Sobre o imóvel</h2>
                  <p className="mt-3 whitespace-pre-wrap leading-7 text-stone-600">
                    {imovel.descricao}
                  </p>
                </CardContent>
              </Card>
            )}
            {endereco && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Localização</h2>
                      <p className="mt-2 text-stone-600">
                        {imovel.logradouro}, {imovel.numero}
                        {imovel.complemento ? ` – ${imovel.complemento}` : ""}
                        <br />
                        {imovel.bairro} – {imovel.cidade}/{imovel.uf}
                      </p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Abrir no mapa <ExternalLink className="size-4" />
                    </a>
                  </div>
                  <iframe
                    title={`Mapa de ${imovel.titulo}`}
                    src={`https://www.google.com/maps?q=${mapsQuery}&z=17&output=embed`}
                    className="h-80 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </CardContent>
              </Card>
            )}
          </div>
          <Card className="h-fit">
            <CardContent className="space-y-4 p-6">
              {imovel.valor_locacao ? (
                <div>
                  <span className="text-sm text-stone-500">Locação mensal</span>
                  <p className="text-2xl font-bold text-emerald-700">
                    {moeda(imovel.valor_locacao)}
                  </p>
                </div>
              ) : null}
              {imovel.valor_venda ? (
                <div>
                  <span className="text-sm text-stone-500">Valor de venda</span>
                  <p className="text-2xl font-bold">{moeda(imovel.valor_venda)}</p>
                </div>
              ) : null}
              <div className="border-t pt-4 text-sm text-stone-600">
                <p>Condomínio: {moeda(imovel.valor_condominio)}</p>
                <p>IPTU anual: {moeda(imovel.valor_iptu)}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bed;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-emerald-700" />
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
