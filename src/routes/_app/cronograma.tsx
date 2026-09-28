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
import { FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { situacaoEtapa, validarLancamentoCronograma, type EtapaCronograma } from "@/lib/cronograma";
import { CronogramaRelatorio } from "@/components/cronograma/cronograma-relatorio";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/cronograma")({ component: CronogramaPage });

function EtapaEditor({
  etapa,
  podeEditar,
  podeExcluir,
}: {
  etapa: EtapaCronograma;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(etapa.nome);
  const [inicio, setInicio] = useState(etapa.data_inicio ?? "");
  const [fim, setFim] = useState(etapa.data_fim ?? "");
  const [meta, setMeta] = useState(String(etapa.meta_percentual ?? 100));
  const [realizado, setRealizado] = useState(String(etapa.progresso ?? 0));
  const [excluirAberto, setExcluirAberto] = useState(false);
  const situacao = situacaoEtapa(etapa, format(new Date(), "yyyy-MM-dd"));
  const salvar = useMutation({
    mutationFn: async () => {
      const nomeAtualizado = nome.trim();
      if (!nomeAtualizado) throw new Error("Informe o nome da etapa.");
      const dados = validarLancamentoCronograma(inicio, fim, meta, realizado);
      const { error } = await supabase
        .from("obra_cronograma")
        .update({
          nome: nomeAtualizado,
          ...dados,
          status:
            dados.progresso >= 100 ? "concluido" : dados.progresso > 0 ? "executando" : "planejado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", etapa.id)
        .eq("obra_id", etapa.obra_id)
        .eq("updated_at", etapa.updated_at)
        .select("id")
        .single();
      if (error)
        throw new Error(
          error.code === "PGRST116"
            ? "A etapa foi alterada por outra pessoa ou você não tem permissão. Atualize a página antes de salvar."
            : error.message,
        );
    },
    onSuccess: async () => {
      toast.success("Prazo e avanço da etapa salvos");
      await qc.invalidateQueries({ queryKey: ["cronograma-obra", etapa.obra_id] });
      await qc.invalidateQueries({ queryKey: ["portal-cronograma", etapa.obra_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const excluir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("obra_cronograma")
        .delete()
        .eq("id", etapa.id)
        .eq("obra_id", etapa.obra_id)
        .eq("updated_at", etapa.updated_at)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "A etapa foi alterada por outra pessoa ou você não tem permissão. Atualize a página antes de excluir.",
        );
    },
    onSuccess: async () => {
      toast.success("Etapa excluída");
      setExcluirAberto(false);
      await qc.invalidateQueries({ queryKey: ["cronograma-obra", etapa.obra_id] });
      await qc.invalidateQueries({ queryKey: ["portal-cronograma", etapa.obra_id] });
    },
    onError: (e: Error) => toast.error(`Não foi possível excluir a etapa: ${e.message}`),
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {podeEditar ? (
              <label className="block max-w-xl space-y-1 text-sm font-medium">
                Nome da etapa
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  aria-label="Nome da etapa"
                />
              </label>
            ) : (
              <CardTitle className="text-base">{etapa.nome}</CardTitle>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {etapa.etapa_origem_key
                ? "Etapa da proposta aceita"
                : "Etapa cadastrada anteriormente"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={situacao === "Prazo vencido" ? "destructive" : "secondary"}>
              {situacao}
            </Badge>
            {podeExcluir && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Excluir etapa ${etapa.nome}`}
                onClick={() => setExcluirAberto(true)}
                disabled={excluir.isPending}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            salvar.mutate();
          }}
        >
          <fieldset
            disabled={!podeEditar || salvar.isPending}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <label className="space-y-2 text-sm">
              Início previsto
              <Input
                required
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              Fim previsto
              <Input
                required
                type="date"
                min={inicio || undefined}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              Meta até o fim (%)
              <Input
                required
                inputMode="decimal"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              Realizado (%)
              <Input
                required
                inputMode="decimal"
                value={realizado}
                onChange={(e) => setRealizado(e.target.value)}
              />
            </label>
            {podeEditar && (
              <Button type="submit">
                <Save className="size-4" />
                {salvar.isPending ? "Salvando…" : "Salvar etapa"}
              </Button>
            )}
          </fieldset>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          O realizado é informado pela equipe. Meta e datas são do planejamento desta etapa.
        </p>
      </CardContent>
      <AlertDialog open={excluirAberto} onOpenChange={setExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Somente a etapa “{etapa.nome}” e seus lançamentos de prazo e progresso serão
              removidos. As demais etapas, a obra e a proposta serão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={excluir.isPending}
              onClick={(event) => {
                event.preventDefault();
                excluir.mutate();
              }}
            >
              {excluir.isPending ? "Excluindo..." : "Excluir etapa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CronogramaPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const podeEditar = roles.some((role) => ["admin", "diretor", "engenharia"].includes(role));
  const [obraId, setObraId] = useState("");
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [novaEtapaInicio, setNovaEtapaInicio] = useState("");
  const [novaEtapaFim, setNovaEtapaFim] = useState("");
  const [novaEtapaMeta, setNovaEtapaMeta] = useState("100");
  const obras = useQuery({
    queryKey: ["obras-cronograma-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id,nome,numero,proposta_id,cliente_id,responsavel_id")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const etapas = useQuery({
    queryKey: ["cronograma-obra", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_cronograma")
        .select("*")
        .eq("obra_id", obraId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as EtapaCronograma[];
    },
  });
  const adicionarEtapa = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error("Selecione uma obra.");
      const nome = novaEtapaNome.trim();
      if (!nome) throw new Error("Informe o nome da etapa.");
      const dados = validarLancamentoCronograma(novaEtapaInicio, novaEtapaFim, novaEtapaMeta, "0");
      const maiorOrdem = Math.max(
        0,
        ...(etapas.data ?? []).map((etapa) => Number(etapa.ordem) || 0),
      );
      const { error } = await supabase.from("obra_cronograma").insert({
        obra_id: obraId,
        nome,
        ordem: maiorOrdem + 1,
        etapa_origem_key: null,
        ...dados,
        status:
          dados.progresso >= 100 ? "concluido" : dados.progresso > 0 ? "executando" : "planejado",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Etapa adicionada ao cronograma");
      setNovaEtapaNome("");
      setNovaEtapaInicio("");
      setNovaEtapaFim("");
      setNovaEtapaMeta("100");
      await qc.invalidateQueries({ queryKey: ["cronograma-obra", obraId] });
      await qc.invalidateQueries({ queryKey: ["portal-cronograma", obraId] });
    },
    onError: (error: Error) => toast.error(`Não foi possível adicionar a etapa: ${error.message}`),
  });
  const hoje = format(new Date(), "yyyy-MM-dd");
  const pendentes = etapas.data?.filter((e) => !e.data_inicio || !e.data_fim).length ?? 0;
  const atrasadas =
    etapas.data?.filter((e) => situacaoEtapa(e, hoje) === "Prazo vencido").length ?? 0;
  const excluirCronograma = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error("Selecione uma obra.");
      const { error } = await supabase.from("obra_cronograma").delete().eq("obra_id", obraId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cronograma excluído. A obra e a proposta foram preservadas.");
      setExcluirAberto(false);
      await qc.invalidateQueries({ queryKey: ["cronograma-obra", obraId] });
      await qc.invalidateQueries({ queryKey: ["portal-cronograma", obraId] });
    },
    onError: (error: Error) =>
      toast.error(`Não foi possível excluir o cronograma: ${error.message}`),
  });
  const obraSelecionada = obras.data?.find((obra) => obra.id === obraId) ?? null;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cronograma da obra</h1>
        <p className="text-sm text-muted-foreground">
          Planeje as etapas da proposta aceita e acompanhe sua execução com o proprietário.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <label className="space-y-2 text-sm font-medium">
            Obra
            <select
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Selecione a obra</option>
              {obras.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero} — {o.nome}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm text-muted-foreground">
            As etapas vêm da proposta. Em cada uma, defina o período e quanto deve estar executado
            até o fim. Etapas diferentes podem ter meta de 100%.
          </p>
          {obras.error && (
            <p role="alert" className="mt-3 text-destructive">
              Não foi possível carregar as obras: {obras.error.message}
            </p>
          )}
        </CardContent>
      </Card>
      {obraId && (
        <>
          {etapas.isLoading && (
            <Loader2 aria-label="Carregando etapas" className="size-5 animate-spin" />
          )}
          {etapas.error && (
            <p role="alert" className="text-destructive">
              Não foi possível carregar o cronograma: {etapas.error.message}
            </p>
          )}
          {podeEditar && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Adicionar etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    adicionarEtapa.mutate();
                  }}
                  className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <label className="space-y-2 text-sm lg:col-span-2">
                    Nome da etapa
                    <Input
                      required
                      value={novaEtapaNome}
                      onChange={(event) => setNovaEtapaNome(event.target.value)}
                      placeholder="Ex.: Fundação"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    Início previsto
                    <Input
                      required
                      type="date"
                      value={novaEtapaInicio}
                      onChange={(event) => setNovaEtapaInicio(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    Fim previsto
                    <Input
                      required
                      type="date"
                      min={novaEtapaInicio || undefined}
                      value={novaEtapaFim}
                      onChange={(event) => setNovaEtapaFim(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    Meta (%)
                    <Input
                      required
                      inputMode="decimal"
                      value={novaEtapaMeta}
                      onChange={(event) => setNovaEtapaMeta(event.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={adicionarEtapa.isPending}>
                    <Plus className="size-4" />
                    {adicionarEtapa.isPending ? "Adicionando…" : "Adicionar"}
                  </Button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                  A etapa será incluída depois das etapas importadas da proposta. O avanço inicial
                  começa em 0%.
                </p>
              </CardContent>
            </Card>
          )}
          {etapas.data && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                {etapas.data.length} etapas · {pendentes} com prazo a definir · {atrasadas} com
                prazo vencido
              </p>
              {etapas.data.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRelatorioAberto(true)}>
                    <FileText className="size-4" /> Relatório detalhado
                  </Button>
                  {roles.some((role) => ["admin", "diretor"].includes(role)) && (
                    <Button variant="destructive" size="sm" onClick={() => setExcluirAberto(true)}>
                      <Trash2 className="size-4" /> Excluir cronograma
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {etapas.data?.length === 0 && (
            <p className="rounded-md border p-5 text-sm text-muted-foreground">
              Nenhuma etapa disponível. O cronograma recebe as etapas quando a proposta vinculada à
              obra é aceita.
            </p>
          )}
          {etapas.data?.map((etapa) => (
            <EtapaEditor
              key={`${etapa.id}:${etapa.updated_at}`}
              etapa={etapa}
              podeEditar={podeEditar}
              podeExcluir={roles.some((role) => ["admin", "diretor"].includes(role))}
            />
          ))}
          <CronogramaRelatorio
            obra={obraSelecionada}
            etapas={etapas.data ?? []}
            open={relatorioAberto}
            onOpenChange={setRelatorioAberto}
          />
          <AlertDialog open={excluirAberto} onOpenChange={setExcluirAberto}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cronograma desta obra?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá todas as etapas e seus lançamentos de prazo e progresso. A obra, a
                  proposta e as medições serão preservadas. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={excluirCronograma.isPending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={excluirCronograma.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    excluirCronograma.mutate();
                  }}
                >
                  {excluirCronograma.isPending ? "Excluindo..." : "Excluir cronograma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

