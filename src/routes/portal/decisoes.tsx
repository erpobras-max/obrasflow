import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/portal/decisoes")({ component: PortalDecisoes });

type Solicitacao = { id: string; tipo: string; titulo: string; descricao: string; prazo_em: string | null; status: string; resposta: string | null; respondido_em: string | null; created_at: string };

function PortalDecisoes() {
  const { obraId } = usePortalContext();
  const client = useQueryClient();
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const { data: solicitacoes = [], isLoading, error } = useQuery({
    queryKey: ["portal_solicitacoes", obraId],
    queryFn: async () => {
      const { data, error: queryError } = await (supabase as any).from("portal_solicitacoes").select("id,tipo,titulo,descricao,prazo_em,status,resposta,respondido_em,created_at").eq("obra_id", obraId).order("created_at", { ascending: false });
      if (queryError) throw queryError;
      return (data ?? []) as Solicitacao[];
    }, enabled: !!obraId,
  });
  const responder = useMutation({
    mutationFn: async ({ id, resposta }: { id: string; resposta: string }) => {
      const { error: rpcError } = await supabase.rpc("responder_solicitacao_portal" as never, { p_solicitacao_id: id, p_resposta: resposta } as never);
      if (rpcError) throw rpcError;
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["portal_solicitacoes", obraId] }); toast.success("Resposta enviada para a equipe."); },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Não foi possível enviar sua resposta."),
  });
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (error) return <Card><CardContent className="p-8 text-center text-destructive">Não foi possível carregar suas decisões.</CardContent></Card>;
  const pendentes = solicitacoes.filter((item) => item.status === "pendente");
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Decisões da obra</h1><p className="mt-1 text-sm text-muted-foreground">Responda às solicitações enviadas pela equipe responsável.</p></div>{solicitacoes.length === 0 ? <Card className="border-dashed"><CardContent className="py-14 text-center"><ClipboardCheck className="mx-auto mb-3 size-10 text-slate-300" /><h2 className="font-semibold">Nenhuma decisão pendente</h2><p className="mt-1 text-sm text-muted-foreground">Novas solicitações sobre escopo, escolhas ou documentos aparecerão aqui.</p></CardContent></Card> : solicitacoes.map((item) => { const podeResponder = item.status === "pendente"; const texto = respostas[item.id] ?? ""; return <Card key={item.id}><CardHeader className="border-b bg-slate-50/70 pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{item.titulo}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{item.tipo} {item.prazo_em ? `· responder até ${new Date(`${item.prazo_em}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}</p></div><Badge variant={podeResponder ? "default" : "secondary"}>{podeResponder ? "Pendente" : "Respondida"}</Badge></div></CardHeader><CardContent className="space-y-3 p-5"><p className="whitespace-pre-line text-sm text-slate-700">{item.descricao}</p>{podeResponder ? <><Textarea value={texto} onChange={(event) => setRespostas((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Escreva sua decisão ou observação..." maxLength={2000} /><div className="flex justify-end"><Button disabled={texto.trim().length < 2 || responder.isPending} onClick={() => responder.mutate({ id: item.id, resposta: texto })}><MessageSquare className="size-4" /> Enviar resposta</Button></div></> : <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" /> Sua resposta</p><p className="mt-1 whitespace-pre-line">{item.resposta}</p></div>}</CardContent></Card>; })}</div>;
}
