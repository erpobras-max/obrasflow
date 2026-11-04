import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, ReceiptText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/portal/proposta")({ component: PortalProposta });

type AtividadeComercial = {
  codigo?: string;
  descricao?: string;
  unidade?: string;
  quantidade?: number;
  precoUnitarioCentavos?: number;
  precoTotalCentavos?: number;
};

type PropostaPortal = {
  propostaId?: string;
  numero?: string;
  titulo?: string;
  revisaoNumero?: number;
  enviadaEm?: string;
  fotografia?: {
    totalPrecoCentavos?: number;
    etapas?: Array<{ nome?: string; precoTotalCentavos?: number; atividades?: AtividadeComercial[] }>;
  };
};

const moeda = (centavos?: number) =>
  ((centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PortalProposta() {
  const { obraId } = usePortalContext();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-proposta", obraId],
    queryFn: async () => {
      const { data: result, error: rpcError } = await supabase.rpc(
        "consultar_proposta_portal" as never,
        { p_obra_id: obraId } as never,
      );
      if (rpcError) throw rpcError;
      return (result ?? {}) as PropostaPortal;
    },
    enabled: !!obraId,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (error) return <Card><CardContent className="p-8 text-center text-destructive">Não foi possível carregar a proposta comercial.</CardContent></Card>;

  const proposta = data ?? {};
  const etapas = proposta.fotografia?.etapas ?? [];
  if (!proposta.propostaId) {
    return <Card className="border-dashed"><CardContent className="py-14 text-center"><FileText className="mx-auto mb-3 size-10 text-slate-300" /><h1 className="font-semibold">Proposta ainda não disponível</h1><p className="mt-1 text-sm text-muted-foreground">Quando a proposta comercial for aceita e vinculada à obra, ela aparecerá aqui.</p></CardContent></Card>;
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Proposta comercial</h1><p className="mt-1 text-sm text-muted-foreground">Escopo e valores comerciais acordados para esta obra.</p></div>
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aceita</Badge>
    </div>
    <Card><CardHeader className="border-b bg-slate-50/70"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs text-muted-foreground">{proposta.numero}</p><CardTitle className="mt-1">{proposta.titulo}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Revisão comercial {proposta.revisaoNumero ?? 1}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Valor contratado</p><p className="text-xl font-bold text-primary">{moeda(proposta.fotografia?.totalPrecoCentavos)}</p></div></div></CardHeader>
      <CardContent className="space-y-5 p-5">{etapas.length === 0 ? <p className="text-sm text-muted-foreground">O escopo detalhado não foi informado nesta proposta.</p> : etapas.map((etapa, index) => <section key={`${etapa.nome}-${index}`} className="rounded-xl border"><div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3"><h2 className="font-semibold">{etapa.nome || `Etapa ${index + 1}`}</h2><span className="text-sm font-semibold">{moeda(etapa.precoTotalCentavos)}</span></div><div className="divide-y">{(etapa.atividades ?? []).map((atividade, atividadeIndex) => <div key={`${atividade.codigo}-${atividadeIndex}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm"><div><p className="font-medium">{atividade.descricao || "Serviço"}</p><p className="mt-0.5 text-xs text-muted-foreground">{atividade.quantidade ?? 0} {atividade.unidade || "un"}</p></div><p className="font-medium">{moeda(atividade.precoTotalCentavos)}</p></div>)}</div></section>)}</CardContent>
    </Card>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ReceiptText className="size-4" /> Para alterações de escopo ou valores, acompanhe as solicitações em Decisões.</p>
  </div>;
}
