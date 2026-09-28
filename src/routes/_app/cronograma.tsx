import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cronograma")({
  component: CronogramaPage,
});

type Etapa = {
  id: string;
  obra_id: string;
  nome: string;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  progresso: number;
  percentual_planejado: number;
};

type Obra = { id: string; nome: string; numero: string };

function fmtDate(v: string | null) {
  return v ? new Date(v + "T00:00").toLocaleDateString("pt-BR") : "—";
}

function barraPct(pct: number, status: string) {
  const cor = status === "concluido" ? "bg-emerald-500" : status === "executando" ? "bg-amber-500" : status === "atrasado" ? "bg-rose-500" : "bg-slate-300";
  return <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${cor}`} style={{ width: `${pct}%` }} /></div>;
}

function CronogramaPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [obraId, setObraId] = useState("");
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [percentualPlanejado, setPercentualPlanejado] = useState("");

  const { data: obras } = useQuery({
    queryKey: ["obras-select"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id,nome,numero").order("nome").limit(50);
      return (data || []) as Obra[];
    },
  });

  const { data: etapas, isLoading } = useQuery({
    queryKey: ["cronograma-obra", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_cronograma").select("*").eq("obra_id", obraId).order("ordem");
      if (error) throw error;
      return (data || []) as Etapa[];
    },
  });

  const adicionar = useMutation({
    mutationFn: async () => {
      const percentual = Number(percentualPlanejado.replace(",", "."));
      if (!obraId || !nome.trim() || !inicio || !fim || !Number.isFinite(percentual) || percentual <= 0) {
        throw new Error("Informe a etapa, o percentual planejado e as datas previstas.");
      }
      if (inicio > fim) throw new Error("A data de início prevista não pode ser posterior à data de fim.");
      const totalPlanejado = (etapas ?? []).reduce((total, etapa) => total + Number(etapa.percentual_planejado ?? 0), 0);
      if (totalPlanejado + percentual > 100) throw new Error(`O percentual planejado ultrapassa 100%. Saldo disponível: ${(100 - totalPlanejado).toLocaleString("pt-BR")}%`);
      const { error } = await supabase.from("obra_cronograma").insert({
        obra_id: obraId,
        nome: nome.trim(),
        ordem: (etapas?.length || 0) + 1,
        data_inicio: inicio || null,
        data_fim: fim || null,
        percentual_planejado: percentual,
        status: "planejado",
        progresso: 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa adicionada"); qc.invalidateQueries({ queryKey: ["cronograma-obra", obraId] }); setNome(""); setInicio(""); setFim(""); setPercentualPlanejado(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cronograma da obra</h1>
        <p className="text-sm text-muted-foreground">Criado junto com a obra aprovada. Defina as etapas, percentuais e datas previstas.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nova etapa</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <select className="rounded-md border px-3 py-2 text-sm" value={obraId} onChange={e => setObraId(e.target.value)}>
              <option value="">Obra</option>
              {obras?.map(o => <option key={o.id} value={o.id}>{o.numero} — {o.nome}</option>)}
            </select>
            <Input placeholder="Nome da etapa" value={nome} onChange={e => setNome(e.target.value)} />
            <Input type="text" inputMode="decimal" placeholder="% planejado" value={percentualPlanejado} onChange={e => setPercentualPlanejado(e.target.value.replace(",", "."))} />
            <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
            <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
          <Button onClick={() => adicionar.mutate()} disabled={adicionar.isPending || !obraId || !nome.trim() || !inicio || !fim || !percentualPlanejado}><Plus className="size-4" /> Adicionar etapa</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Etapas</CardTitle></CardHeader>
        <CardContent>
          {!obraId && <p className="text-sm text-muted-foreground">Selecione uma obra para ver etapas.</p>}
          {isLoading && <Loader2 className="size-5 animate-spin" />}
          {etapas && etapas.length === 0 && obraId && <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>}
          <div className="space-y-3">
            {etapas?.map((e) => (
              <div key={e.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{e.ordem}. {e.nome}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(e.data_inicio)} → {fmtDate(e.data_fim)}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-white ${e.status === "concluido" ? "bg-emerald-500" : e.status === "executando" ? "bg-amber-500" : e.status === "atrasado" ? "bg-rose-500" : "bg-slate-400"}`}>{e.status}</span>
                  <span>Planejado: {Number(e.percentual_planejado ?? 0).toLocaleString("pt-BR")}%</span>
                  <span>Realizado: {e.progresso}%</span>
                </div>
                {barraPct(e.progresso, e.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
