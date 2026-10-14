import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Trophy } from "lucide-react";
import { useCotacao, useSelecionarVencedores } from "@/hooks/use-cotacoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/cotacoes/$cotacaoId/comparativo")({
  component: ComparativoPage,
});
type Resposta = { cotacao_item_id: string; valor_unitario: number; disponivel: boolean };
type Proposta = {
  frete?: number | null;
  prazo_entrega_dias?: number | null;
  condicao_pagamento?: string | null;
  validade_proposta?: string | null;
};
type Item = { id: string; descricao: string; quantidade: number; unidade: string };
type FornecedorCotacao = {
  id: string;
  status: string;
  fornecedores?: { razao_social?: string | null } | null;
  cotacoes_propostas?: Proposta[];
  cotacoes_respostas?: Resposta[];
};
type Cotacao = {
  numero: number;
  cotacoes_fornecedores?: FornecedorCotacao[];
  cotacoes_itens?: Item[];
};
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComparativoPage() {
  const { cotacaoId } = Route.useParams();
  const { data, isLoading } = useCotacao(cotacaoId);
  const cotacao = data as Cotacao | undefined;
  const [modo, setModo] = useState("item");
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const confirmar = useSelecionarVencedores(cotacaoId);
  const fornecedores = useMemo(
    () => (cotacao?.cotacoes_fornecedores || []).filter((f) => f.status === "respondido"),
    [cotacao?.cotacoes_fornecedores],
  );
  const itens = useMemo(() => cotacao?.cotacoes_itens || [], [cotacao?.cotacoes_itens]);
  const porItem = useMemo(() => {
    const matriz: Record<string, Record<string, Resposta | undefined>> = {};
    for (const item of itens) {
      matriz[item.id] = {};
      for (const fornecedor of cotacao?.cotacoes_fornecedores || []) {
        matriz[item.id][fornecedor.id] = (fornecedor.cotacoes_respostas || []).find(
          (resposta) => resposta.cotacao_item_id === item.id,
        );
      }
    }
    return matriz;
  }, [cotacao?.cotacoes_fornecedores, itens]);
  const totais = useMemo(
    () =>
      Object.fromEntries(
        fornecedores.map((fornecedor) => {
          const subtotal = itens.reduce((soma, item) => {
            const resposta = porItem[item.id]?.[fornecedor.id];
            return (
              soma +
              (resposta?.disponivel
                ? Number(resposta.valor_unitario || 0) * Number(item.quantidade || 0)
                : 0)
            );
          }, 0);
          const frete = Number(fornecedor.cotacoes_propostas?.[0]?.frete || 0);
          return [fornecedor.id, { subtotal, frete, total: subtotal + frete }];
        }),
      ),
    [fornecedores, itens, porItem],
  );
  const ranking = useMemo(() => {
    const completas = fornecedores.filter(
      (fornecedor) =>
        itens.length > 0 && itens.every((item) => porItem[item.id]?.[fornecedor.id]?.disponivel),
    );
    return [...completas].sort((a, b) => totais[a.id].total - totais[b.id].total);
  }, [fornecedores, itens, porItem, totais]);
  const posicao = new Map(ranking.map((fornecedor, index) => [fornecedor.id, index + 1]));

  if (isLoading) return <p>Carregando comparativo...</p>;
  if (!cotacao) return <p>Cotação não encontrada.</p>;
  const voltar = (
    <Link to="/cotacoes/$cotacaoId" params={{ cotacaoId }}>
      <Button variant="outline">Voltar</Button>
    </Link>
  );
  if (fornecedores.length === 0)
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Cotação #{cotacao.numero}</p>
            <h1 className="text-2xl font-bold">Comparativo de propostas</h1>
          </div>
          {voltar}
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Ainda não há respostas para comparar.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              As propostas aparecerão aqui assim que um fornecedor enviar sua resposta.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  const selecionarFornecedor = (fornecedorId: string) => {
    if (!posicao.has(fornecedorId)) return;
    setSelecoes((atuais) => {
      const proximas = { ...atuais };
      for (const item of itens)
        if (porItem[item.id]?.[fornecedorId]?.disponivel) proximas[item.id] = fornecedorId;
      return proximas;
    });
  };
  const menor = (itemId: string) =>
    Math.min(
      ...fornecedores.map((f) => {
        const resposta = porItem[itemId]?.[f.id];
        return resposta?.disponivel ? Number(resposta.valor_unitario) : Infinity;
      }),
    );
  const confirmarSelecao = () =>
    confirmar.mutate(
      Object.entries(selecoes).map(([cotacao_item_id, cotacao_fornecedor_id]) => ({
        cotacao_item_id,
        cotacao_fornecedor_id,
      })),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cotação #{cotacao.numero}</p>
          <h1 className="text-2xl font-bold">Comparativo de propostas</h1>
          <p className="text-sm text-muted-foreground">
            Os totais consideram a quantidade solicitada e o frete.
          </p>
        </div>
        {voltar}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Valores por item</CardTitle>
            <RadioGroup value={modo} onValueChange={setModo} className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="item" id="modo-item" />
                <Label htmlFor="modo-item">Selecionar por item</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fornecedor" id="modo-fornecedor" />
                <Label htmlFor="modo-fornecedor">Fornecedor único</Label>
              </div>
            </RadioGroup>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                {fornecedores.map((f) => (
                  <TableHead key={f.id} className="min-w-36">
                    {f.fornecedores?.razao_social}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.quantidade} {item.unidade}
                    </div>
                  </TableCell>
                  {fornecedores.map((f) => {
                    const resposta = porItem[item.id]?.[f.id];
                    const menorValor =
                      resposta?.disponivel && Number(resposta.valor_unitario) === menor(item.id);
                    const selecionado = selecoes[item.id] === f.id;
                    return (
                      <TableCell key={f.id} className={menorValor ? "bg-green-50" : ""}>
                        <button
                          type="button"
                          disabled={!resposta?.disponivel}
                          className={`w-full rounded-md border p-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${selecionado ? "border-primary ring-2 ring-primary" : "border-transparent hover:border-muted-foreground"}`}
                          onClick={() =>
                            resposta?.disponivel &&
                            (modo === "fornecedor"
                              ? selecionarFornecedor(f.id)
                              : setSelecoes((atuais) => ({ ...atuais, [item.id]: f.id })))
                          }
                        >
                          {resposta?.disponivel ? (
                            <>
                              <div className="font-semibold">
                                {brl(Number(resposta.valor_unitario))} / {item.unidade}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total:{" "}
                                {brl(Number(resposta.valor_unitario) * Number(item.quantidade))}
                              </div>
                              {menorValor && (
                                <Badge className="mt-1 bg-green-600">
                                  <Trophy className="mr-1 size-3" />
                                  Menor unitário
                                </Badge>
                              )}
                              {selecionado && <CheckCircle2 className="mt-1 size-4 text-primary" />}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Indisponível</span>
                          )}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Resumo por fornecedor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {fornecedores.map((f) => (
            <div key={f.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{f.fornecedores?.razao_social}</div>
                {posicao.has(f.id) ? (
                  <Badge variant={posicao.get(f.id) === 1 ? "default" : "secondary"}>
                    {posicao.get(f.id)}º lugar
                  </Badge>
                ) : (
                  <Badge variant="outline">Não classificada</Badge>
                )}
              </div>
              <div className="mt-2 text-xl font-bold">{brl(totais[f.id]?.total || 0)}</div>
              <div className="text-xs text-muted-foreground">
                Itens: {brl(totais[f.id]?.subtotal || 0)} · Frete: {brl(totais[f.id]?.frete || 0)} ·
                Prazo: {f.cotacoes_propostas?.[0]?.prazo_entrega_dias ?? "—"} dias
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Pagamento: {f.cotacoes_propostas?.[0]?.condicao_pagamento || "Não informado"} ·
                Validade:{" "}
                {f.cotacoes_propostas?.[0]?.validade_proposta
                  ? new Date(
                      `${f.cotacoes_propostas[0].validade_proposta}T12:00:00`,
                    ).toLocaleDateString("pt-BR")
                  : "Não informada"}
              </div>
              {!posicao.has(f.id) && (
                <p className="mt-2 text-xs text-amber-700">
                  Fora do ranking: não informou disponibilidade para todos os itens.
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-4 shadow-lg">
        <span className="text-sm text-muted-foreground">
          {Object.keys(selecoes).length}/{itens.length} itens selecionados
        </span>
        <Button
          disabled={
            itens.length === 0 ||
            Object.keys(selecoes).length !== itens.length ||
            confirmar.isPending
          }
          onClick={confirmarSelecao}
        >
          {confirmar.isPending ? "Gerando pedidos..." : "Confirmar seleção e gerar pedidos"}
        </Button>
      </div>
    </div>
  );
}

