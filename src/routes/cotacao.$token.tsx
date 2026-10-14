import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.custom";
import { useResponderCotacao } from "@/hooks/use-cotacoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cotacao/$token")({ component: CotacaoPublicaPage });
type PublicItem = { id: string; descricao: string; quantidade: number; unidade: string };
type PublicResposta = {
  cotacao_item_id: string;
  disponivel: boolean;
  valor_unitario: number;
  quantidade_ofertada?: number | null;
};
type PublicCotacao = {
  error?: string;
  itens: PublicItem[];
  respostas?: PublicResposta[];
  convite: { status: string };
  cotacao: { id: string; numero: number; prazo_resposta: string; respostas_habilitadas?: boolean };
  fornecedor: { id: string; razao_social: string };
};
type RespostaForm = { disponivel: boolean; valor: string; quantidade: number };
const EMPTY_PUBLIC_ITEMS: PublicItem[] = [];
const parseMoney = (v: string) =>
  Math.round(
    Number(
      v
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, ""),
    ) * 100,
  );
function CotacaoPublicaPage() {
  const { token } = Route.useParams();
  const { data: rawData, isLoading, error } = useResponderCotacao(token);
  const data = rawData as PublicCotacao | undefined;
  const [enviada, setEnviada] = useState(false);
  const [recusada, setRecusada] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [frete, setFrete] = useState("");
  const [prazo, setPrazo] = useState("");
  const [condicao, setCondicao] = useState("");
  const [validade, setValidade] = useState("");
  const [obs, setObs] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; path: string }[]>([]);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const itens = data?.itens ?? EMPTY_PUBLIC_ITEMS;
  const inicial = useMemo(
    () =>
      Object.fromEntries(
        itens.map((item) => {
          const old = (data?.respostas || []).find(
            (resposta) => resposta.cotacao_item_id === item.id,
          );
          return [
            item.id,
            {
              disponivel: old?.disponivel ?? true,
              valor: old ? String(Number(old.valor_unitario) / 100).replace(".", ",") : "",
              quantidade: old?.quantidade_ofertada || item.quantidade,
            },
          ];
        }),
      ),
    [data?.respostas, itens],
  );
  const [respostas, setRespostas] = useState<Record<string, RespostaForm>>({});
  const atual: Record<string, RespostaForm> = Object.keys(respostas).length ? respostas : inicial;
  if (isLoading)
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p>Carregando cotação...</p>
      </main>
    );
  if (error || !data || data.error)
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-3 size-10 text-destructive" />
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data?.error || "Não foi possível carregar esta cotação."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  if (enviada || data.convite?.status === "respondido")
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 size-12 text-green-600" />
            <h1 className="text-2xl font-bold">Proposta enviada</h1>
            <p className="mt-2 text-muted-foreground">
              Sua resposta foi registrada com sucesso. A empresa responsável analisará a proposta.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  if (recusada || data.convite?.status === "recusado")
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-3 size-12 text-amber-600" />
            <h1 className="text-2xl font-bold">Cotação recusada</h1>
            <p className="mt-2 text-muted-foreground">A recusa foi registrada.</p>
          </CardContent>
        </Card>
      </main>
    );
  if (data.cotacao?.respostas_habilitadas === false)
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-3 size-12 text-amber-600" />
            <h1 className="text-2xl font-bold">Cotação encerrada para respostas</h1>
            <p className="mt-2 text-muted-foreground">
              A empresa responsável desativou o recebimento de novas propostas para esta cotação.
              Entre em contato com ela se precisar de orientação.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  const update = (id: string, patch: Partial<RespostaForm>) =>
    setRespostas({ ...atual, [id]: { ...atual[id], ...patch } });
  const enviar = async () => {
    const itensResposta = itens
      .map((item) => ({
        cotacao_item_id: item.id,
        disponivel: atual[item.id]?.disponivel !== false,
        valor_unitario: parseMoney(atual[item.id]?.valor || "0"),
        quantidade_ofertada: atual[item.id]?.quantidade || item.quantidade,
      }))
      .filter((item) => item.disponivel);
    if (itensResposta.some((item) => item.valor_unitario <= 0))
      return toast.error("Informe o valor de todos os itens disponíveis.");
    // RPC pública ainda não está tipada no types.ts gerado pelo Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e } = await (supabase as any).rpc("responder_cotacao_publica", {
      p_token: token,
      p_respostas: itensResposta,
      p_proposta: {
        frete: parseMoney(frete || "0"),
        prazo_entrega_dias: prazo || null,
        condicao_pagamento: condicao,
        validade_proposta: validade || null,
        observacoes: obs,
      },
    });
    if (e) return toast.error(e.message);
    setEnviada(true);
  };
  const recusar = async () => {
    if (motivo.trim().length < 3) return toast.error("Informe o motivo da recusa.");
    // RPC pública ainda não está tipada no types.ts gerado pelo Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e } = await (supabase as any).rpc("recusar_cotacao_publica", {
      p_token: token,
      p_motivo: motivo,
    });
    if (e) return toast.error(e.message);
    setRecusada(true);
  };
  const adicionarAnexo = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (anexos.length + files.length > 5) return toast.error("Você pode enviar até 5 anexos.");
    setEnviandoAnexo(true);
    try {
      for (const file of files) {
        if (
          file.size > 10 * 1024 * 1024 ||
          (!file.type.startsWith("image/") && file.type !== "application/pdf")
        )
          throw new Error("Use PDF ou imagem de até 10 MB.");
        const path = `cotacao/${data.cotacao.id}/${token}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cotacoes-anexos")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        // RPC pública ainda não está tipada no types.ts gerado pelo Supabase.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: registerError } = await (supabase as any).rpc(
          "registrar_anexo_cotacao_publica",
          {
            p_token: token,
            p_nome: file.name,
            p_path: path,
            p_tamanho: file.size,
            p_mime: file.type,
          },
        );
        if (registerError) throw registerError;
        setAnexos((current) => [...current, { nome: file.name, path }]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviandoAnexo(false);
      event.target.value = "";
    }
  };
  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">ObrasFlow · Cotação de compra</p>
          <h1 className="mt-1 text-3xl font-bold">Cotação #{data.cotacao.numero}</h1>
          <p className="text-muted-foreground">
            Olá, {data.fornecedor.razao_social}. Envie sua proposta até{" "}
            {new Date(`${data.cotacao.prazo_resposta}T12:00:00`).toLocaleDateString("pt-BR")}.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Itens solicitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {itens.map((i) => (
              <div
                key={i.id}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_100px_100px_180px] md:items-center"
              >
                <div>
                  <div className="font-medium">{i.descricao}</div>
                  <div className="text-sm text-muted-foreground">
                    Quantidade solicitada: {i.quantidade} {i.unidade}
                  </div>
                </div>
                <div className="text-sm">{i.unidade}</div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={atual[i.id]?.disponivel !== false}
                    onCheckedChange={(v) => update(i.id, { disponivel: v })}
                  />
                  <Label>Disponível</Label>
                </div>
                <Input
                  disabled={atual[i.id]?.disponivel === false}
                  placeholder="Valor unitário"
                  value={atual[i.id]?.valor || ""}
                  onChange={(e) => update(i.id, { valor: e.target.value })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Condições da proposta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Frete (R$)</Label>
              <Input
                className="mt-1"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Prazo de entrega (dias)</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
            <div>
              <Label>Condição de pagamento</Label>
              <Input
                className="mt-1"
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                placeholder="Ex.: 30 dias"
              />
            </div>
            <div>
              <Label>Validade da proposta</Label>
              <Input
                className="mt-1"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea className="mt-1" value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={adicionarAnexo}
              disabled={enviandoAnexo || anexos.length >= 5}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Até 5 arquivos PDF ou imagem, com no máximo 10 MB cada.
            </p>
            {anexos.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm">
                {anexos.map((a) => (
                  <li key={a.path}>{a.nome}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-3">
          <div className="flex min-w-64 gap-2">
            <Input
              placeholder="Motivo da recusa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <Button variant="outline" onClick={recusar}>
              Recusar
            </Button>
          </div>
          <Button onClick={enviar} className="gap-2">
            <Send className="size-4" />
            Enviar proposta
          </Button>
        </div>
      </div>
    </main>
  );
}

