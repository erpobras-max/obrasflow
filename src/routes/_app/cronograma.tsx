import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { situacaoEtapa, validarLancamentoCronograma, type EtapaCronograma } from "@/lib/cronograma";

export const Route = createFileRoute("/_app/cronograma")({ component: CronogramaPage });

function EtapaEditor({ etapa, podeEditar }: { etapa: EtapaCronograma; podeEditar: boolean }) {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState(etapa.data_inicio ?? "");
  const [fim, setFim] = useState(etapa.data_fim ?? "");
  const [meta, setMeta] = useState(String(etapa.meta_percentual ?? 100));
  const [realizado, setRealizado] = useState(String(etapa.progresso ?? 0));
  const situacao = situacaoEtapa(etapa, format(new Date(), "yyyy-MM-dd"));
  const salvar = useMutation({
    mutationFn: async () => {
      const dados = validarLancamentoCronograma(inicio, fim, meta, realizado);
      const { error } = await supabase.from("obra_cronograma").update({
        ...dados,
        status: dados.progresso >= 100 ? "concluido" : dados.progresso > 0 ? "executando" : "planejado",
        updated_at: new Date().toISOString(),
      }).eq("id", etapa.id).eq("obra_id", etapa.obra_id).eq("updated_at", etapa.updated_at).select("id").single();
      if (error) throw new Error(error.code === "PGRST116" ? "A etapa foi alterada por outra pessoa ou você não tem permissão. Atualize a página antes de salvar." : error.message);
    },
    onSuccess: async () => {
      toast.success("Prazo e avanço da etapa salvos");
      await qc.invalidateQueries({ queryKey: ["cronograma-obra", etapa.obra_id] });
      await qc.invalidateQueries({ queryKey: ["portal-cronograma", etapa.obra_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Card>
    <CardHeader className="pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="text-base">{etapa.nome}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{etapa.etapa_origem_key ? "Etapa da proposta aceita" : "Etapa cadastrada anteriormente"}</p>
        </div>
        <Badge variant={situacao === "Prazo vencido" ? "destructive" : "secondary"}>{situacao}</Badge>
      </div>
    </CardHeader>
    <CardContent>
      <form onSubmit={(event) => { event.preventDefault(); salvar.mutate(); }}>
        <fieldset disabled={!podeEditar || salvar.isPending} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2 text-sm">Início previsto<Input required type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
          <label className="space-y-2 text-sm">Fim previsto<Input required type="date" min={inicio || undefined} value={fim} onChange={e => setFim(e.target.value)} /></label>
          <label className="space-y-2 text-sm">Meta até o fim (%)<Input required inputMode="decimal" value={meta} onChange={e => setMeta(e.target.value)} /></label>
          <label className="space-y-2 text-sm">Realizado (%)<Input required inputMode="decimal" value={realizado} onChange={e => setRealizado(e.target.value)} /></label>
          {podeEditar && <Button type="submit"><Save className="size-4" />{salvar.isPending ? "Salvando…" : "Salvar etapa"}</Button>}
        </fieldset>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">O realizado é informado pela equipe. Meta e datas são do planejamento desta etapa.</p>
    </CardContent>
  </Card>;
}

function CronogramaPage() {
  const { roles } = useAuth();
  const podeEditar = roles.some(role => ["admin", "diretor", "engenharia"].includes(role));
  const [obraId, setObraId] = useState("");
  const obras = useQuery({
    queryKey: ["obras-cronograma-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id,nome,numero,proposta_id").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const etapas = useQuery({
    queryKey: ["cronograma-obra", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_cronograma").select("*").eq("obra_id", obraId).order("ordem");
      if (error) throw error;
      return (data ?? []) as EtapaCronograma[];
    },
  });
  const hoje = format(new Date(), "yyyy-MM-dd");
  const pendentes = etapas.data?.filter(e => !e.data_inicio || !e.data_fim).length ?? 0;
  const atrasadas = etapas.data?.filter(e => situacaoEtapa(e, hoje) === "Prazo vencido").length ?? 0;
  return <div className="mx-auto max-w-6xl space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Cronograma da obra</h1>
      <p className="text-sm text-muted-foreground">Planeje as etapas da proposta aceita e acompanhe sua execução com o proprietário.</p>
    </div>
    <Card><CardContent className="pt-6">
      <label className="space-y-2 text-sm font-medium">Obra
        <select className="block w-full rounded-md border bg-background px-3 py-2 text-sm" value={obraId} onChange={e => setObraId(e.target.value)}>
          <option value="">Selecione a obra</option>
          {obras.data?.map(o => <option key={o.id} value={o.id}>{o.numero} — {o.nome}</option>)}
        </select>
      </label>
      <p className="mt-3 text-sm text-muted-foreground">As etapas vêm da proposta. Em cada uma, defina o período e quanto deve estar executado até o fim. Etapas diferentes podem ter meta de 100%.</p>
      {obras.error && <p role="alert" className="mt-3 text-destructive">Não foi possível carregar as obras: {obras.error.message}</p>}
    </CardContent></Card>
    {obraId && <>
      {etapas.isLoading && <Loader2 aria-label="Carregando etapas" className="size-5 animate-spin" />}
      {etapas.error && <p role="alert" className="text-destructive">Não foi possível carregar o cronograma: {etapas.error.message}</p>}
      {etapas.data && <p className="text-sm">{etapas.data.length} etapas · {pendentes} com prazo a definir · {atrasadas} com prazo vencido</p>}
      {etapas.data?.length === 0 && <p className="rounded-md border p-5 text-sm text-muted-foreground">Nenhuma etapa disponível. O cronograma recebe as etapas quando a proposta vinculada à obra é aceita.</p>}
      {etapas.data?.map(etapa => <EtapaEditor key={`${etapa.id}:${etapa.updated_at}`} etapa={etapa} podeEditar={podeEditar} />)}
    </>}
  </div>;
}
