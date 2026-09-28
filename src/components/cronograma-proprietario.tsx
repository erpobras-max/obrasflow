import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client.custom";
import { situacaoEtapa, type EtapaCronograma } from "@/lib/cronograma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CronogramaProprietario({ obraId }: { obraId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-cronograma", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_cronograma")
        .select("id,obra_id,nome,ordem,data_inicio,data_fim,progresso,meta_percentual,updated_at,etapa_origem_key")
        .eq("obra_id", obraId).order("ordem");
      if (error) throw error;
      return (data ?? []) as EtapaCronograma[];
    },
  });
  const hoje = format(new Date(), "yyyy-MM-dd");
  const dataBR = (v: string | null) => v ? v.split("-").reverse().join("/") : "A definir";
  return <Card>
    <CardHeader><CardTitle>Cronograma das etapas</CardTitle>
      <p className="text-sm text-muted-foreground">Prazos combinados e execução informada pela equipe. Uma etapa fica com prazo vencido quando a data final passa e a meta ainda não foi atingida.</p>
    </CardHeader>
    <CardContent>
      {isLoading && <p>Carregando cronograma…</p>}
      {error && <p role="alert" className="text-destructive">Não foi possível carregar o cronograma. Tente novamente.</p>}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">O planejamento das etapas ainda não foi disponibilizado.</p>}
      <div className="space-y-4">{data?.map(e => {
        const situacao = situacaoEtapa(e, hoje);
        return <section key={e.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{e.nome}</h3><Badge variant={situacao === "Prazo vencido" ? "destructive" : "secondary"}>{situacao}</Badge></div>
          <p className="mt-2 text-sm">Período previsto: {dataBR(e.data_inicio)} até {dataBR(e.data_fim)}</p>
          <p className="mt-2 text-sm">Meta até o fim: <b>{Number(e.meta_percentual).toLocaleString("pt-BR")}%</b> · Realizado: <b>{Number(e.progresso).toLocaleString("pt-BR")}%</b></p>
          <div role="progressbar" aria-label={`Realizado de ${e.nome}`} aria-valuenow={Number(e.progresso)} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, Number(e.progresso)))}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Última atualização: {new Date(e.updated_at).toLocaleString("pt-BR")}</p>
        </section>;
      })}</div>
    </CardContent>
  </Card>;
}
