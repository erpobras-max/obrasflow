import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { useCotacao } from "@/hooks/use-cotacoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Resposta = {
  cotacao_item_id: string;
  valor_unitario: number;
  disponivel: boolean;
  quantidade_ofertada?: number | null;
};
type Proposta = {
  frete?: number | null;
  prazo_entrega_dias?: number | null;
  condicao_pagamento?: string | null;
  validade_proposta?: string | null;
  observacoes?: string | null;
};
type Item = { id: string; descricao: string; quantidade: number; unidade: string };
type FornecedorCotacao = {
  id: string;
  status: string;
  respondido_em?: string | null;
  token: string;
  fornecedores?: { razao_social?: string | null } | null;
  cotacoes_propostas?: Proposta[];
  cotacoes_respostas?: Resposta[];
};
type CotacaoHistorico = { id: string; created_at: string; descricao?: string | null; acao: string };
type Cotacao = {
  numero: number;
  prazo_resposta: string;
  obras?: { numero: string; nome: string } | null;
  cotacoes_fornecedores?: FornecedorCotacao[];
  cotacoes_itens?: Item[];
  cotacoes_historico?: CotacaoHistorico[];
};

export const Route = createFileRoute("/_app/cotacoes/$cotacaoId")({
  component: CotacaoDetalhePage,
});
function CotacaoDetalhePage() {
  const { cotacaoId } = Route.useParams();
  const { data: c, isLoading, error } = useCotacao(cotacaoId);
  if (isLoading) return <p>Carregando cotação...</p>;
  if (error || !c) return <p className="text-destructive">Cotação não encontrada.</p>;
  const cotacao = c as Cotacao;
  const copy = (token: string) => {
    const url = `${window.location.origin}/cotacao/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };
  const responded = (cotacao.cotacoes_fornecedores || []).filter((f) => f.status === "respondido");
  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cotação #{cotacao.numero}</p>
          <h1 className="text-2xl font-bold">
            {cotacao.obras
              ? `${cotacao.obras.numero} — ${cotacao.obras.nome}`
              : "Cotação de compra"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Prazo: {new Date(`${cotacao.prazo_resposta}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/cotacoes/$cotacaoId/comparativo" params={{ cotacaoId }}>
            <Button className="gap-2" disabled={responded.length === 0}>
              <FileSearch className="size-4" />
              Comparar respostas ({responded.length})
            </Button>
          </Link>
          <Link to="/cotacoes">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Fornecedores convidados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Respondido em</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cotacao.cotacoes_fornecedores || []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.fornecedores?.razao_social}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "respondido" ? "default" : "secondary"}>
                        {f.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {f.respondido_em ? new Date(f.respondido_em).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => copy(f.token)}>
                        <Copy className="mr-1 size-3" />
                        Copiar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Itens solicitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(cotacao.cotacoes_itens || []).map((i) => (
              <div key={i.id} className="flex justify-between border-b py-2 text-sm">
                <span>{i.descricao}</span>
                <span className="text-muted-foreground">
                  {i.quantidade} {i.unidade}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {responded.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Respostas recebidas</h2>
            <p className="text-sm text-muted-foreground">
              Consulte os valores e condições informados por cada fornecedor.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {responded.map((f) => {
              const proposal = f.cotacoes_propostas?.[0];
              const answers = f.cotacoes_respostas || [];
              const subtotal = answers
                .filter((r) => r.disponivel)
                .reduce((sum, r) => {
                  const item = (cotacao.cotacoes_itens || []).find(
                    (i) => i.id === r.cotacao_item_id,
                  );
                  return (
                    sum +
                    Number(r.valor_unitario || 0) *
                      Number(item?.quantidade || r.quantidade_ofertada || 0)
                  );
                }, 0);
              return (
                <Card key={f.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle>{f.fornecedores?.razao_social || "Fornecedor"}</CardTitle>
                      <Badge>Respondida</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Preço unitário</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(cotacao.cotacoes_itens || []).map((item) => {
                            const answer = answers.find((r) => r.cotacao_item_id === item.id);
                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.descricao}</TableCell>
                                <TableCell>
                                  {item.quantidade} {item.unidade}
                                </TableCell>
                                <TableCell>
                                  {answer?.disponivel ? brl(Number(answer.valor_unitario)) : "—"}
                                </TableCell>
                                <TableCell>
                                  {answer?.disponivel ? (
                                    brl(Number(answer.valor_unitario) * Number(item.quantidade))
                                  ) : (
                                    <span className="text-muted-foreground">Indisponível</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
                      <p>
                        Subtotal dos itens: <strong>{brl(subtotal)}</strong>
                      </p>
                      <p>
                        Frete: <strong>{brl(Number(proposal?.frete || 0))}</strong>
                      </p>
                      <p>
                        Total da proposta:{" "}
                        <strong>{brl(subtotal + Number(proposal?.frete || 0))}</strong>
                      </p>
                      <p>
                        Prazo de entrega:{" "}
                        <strong>
                          {proposal?.prazo_entrega_dias ?? "Não informado"}
                          {proposal?.prazo_entrega_dias != null ? " dias" : ""}
                        </strong>
                      </p>
                      <p>
                        Pagamento:{" "}
                        <strong>{proposal?.condicao_pagamento || "Não informado"}</strong>
                      </p>
                      <p>
                        Validade:{" "}
                        <strong>
                          {proposal?.validade_proposta
                            ? new Date(`${proposal.validade_proposta}T12:00:00`).toLocaleDateString(
                                "pt-BR",
                              )
                            : "Não informada"}
                        </strong>
                      </p>
                      {proposal?.observacoes && (
                        <p className="sm:col-span-2">Observações: {proposal.observacoes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(cotacao.cotacoes_historico || [])
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((h) => (
              <div key={h.id} className="flex gap-3 text-sm">
                <span className="text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
                <span>{h.descricao || h.acao}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

