import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, FileSignature, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.custom";
import { SignatureCanvas } from "@/components/contratos/assinaturas-contrato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/assinar/$token")({ component: AssinaturaPublicaPage });

type LinkAssinatura = {
  papel_label: string; nome_esperado?: string | null; documento_esperado?: string | null;
  documento_titulo: string; documento_resumo: string; expira_em: string;
};

function AssinaturaPublicaPage() {
  const { token } = Route.useParams();
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [resetKey] = useState(0);
  const [concluido, setConcluido] = useState(false);

  const { data: link, isLoading } = useQuery({
    queryKey: ["link-assinatura", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_link_assinatura" as any, { _token: token } as any);
      if (error) throw error;
      const result = (data || null) as LinkAssinatura | null;
      if (result) { setNome(result.nome_esperado || ""); setDocumento(result.documento_esperado || ""); }
      return result;
    },
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!assinatura || nome.trim().length < 2) throw new Error("Informe seu nome e desenhe a assinatura.");
      const { error } = await supabase.rpc("assinar_contrato_publico" as any, {
        _token: token, _nome: nome.trim(), _documento: documento.trim(), _assinatura_data_url: assinatura,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => setConcluido(true),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-stone-50">Carregando solicitação…</div>;
  if (!link && !concluido) return <EmptyState />;
  if (concluido) return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4"><Card className="max-w-lg"><CardContent className="p-10 text-center">
      <CheckCircle2 className="mx-auto size-12 text-emerald-600" /><h1 className="mt-4 text-2xl font-bold">Assinatura concluída</h1>
      <p className="mt-2 text-muted-foreground">A assinatura já foi registrada no ObrasFlow e aparecerá no contrato da empresa.</p>
    </CardContent></Card></main>
  );

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between"><span className="font-semibold tracking-tight">ObrasFlow</span><span className="flex items-center gap-2 text-xs text-stone-600"><ShieldCheck className="size-4 text-emerald-600" /> Link seguro e de uso único</span></header>
        <Card><CardHeader className="border-b"><div className="flex items-start gap-3"><FileSignature className="mt-1 size-6 text-emerald-700" /><div><CardTitle>{link!.documento_titulo}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Assinatura como {link!.papel_label}</p></div></div></CardHeader>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="rounded-lg border bg-stone-50 p-4 text-sm leading-6 text-stone-700">{link!.documento_resumo}</div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="nome">Nome completo</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} /></div><div className="space-y-2"><Label htmlFor="documento">CPF/CNPJ</Label><Input id="documento" value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={30} /></div></div>
            <div><Label className="mb-2 block">Sua assinatura</Label><SignatureCanvas onChange={setAssinatura} resetKey={resetKey} /></div>
            <p className="text-xs leading-5 text-stone-500">Ao confirmar, você declara que revisou o contrato recebido e reconhece esta assinatura como sua manifestação de concordância.</p>
            <Button className="h-11 w-full" disabled={!assinatura || nome.trim().length < 2 || signMutation.isPending} onClick={() => signMutation.mutate()}>
              {signMutation.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar assinatura
            </Button>
          </CardContent></Card>
      </div>
    </main>
  );
}

function EmptyState() {
  return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4"><Card className="max-w-md"><CardContent className="p-8 text-center"><FileSignature className="mx-auto size-10 text-stone-400" /><h1 className="mt-4 text-xl font-semibold">Link indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link expirou, foi revogado ou já foi utilizado.</p></CardContent></Card></main>;
}
