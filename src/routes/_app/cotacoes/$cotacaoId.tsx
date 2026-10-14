import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, FileSearch, Pause, Play, Printer } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCotacao } from "@/hooks/use-cotacoes";
import { supabase } from "@/integrations/supabase/client.custom";
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
  id: string;
  numero: number;
  prazo_resposta: string;
  respostas_habilitadas?: boolean;
  obras?: { numero: string; nome: string } | null;
  cotacoes_fornecedores?: FornecedorCotacao[];
  cotacoes_itens?: Item[];
  cotacoes_historico?: CotacaoHistorico[];
};
const escapeHtml = (value: unknown) => {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
};

export const Route = createFileRoute("/_app/cotacoes/$cotacaoId")({
  component: CotacaoDetalhePage,
});
function CotacaoDetalhePage() {
  const { cotacaoId } = Route.useParams();
  const { data: c, isLoading, error } = useCotacao(cotacaoId);
  const queryClient = useQueryClient();
  const alternarRespostas = useMutation({
    mutationFn: async (habilitadas: boolean) => {
      // Esta coluna será incorporada ao schema quando a migration for aplicada.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("cotacoes_compra")
        .update({ respostas_habilitadas: habilitadas })
        .eq("id", cotacaoId);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, habilitadas) => {
      toast.success(
        habilitadas ? "Respostas da cotação ativadas" : "Cotação desativada para respostas",
      );
      queryClient.invalidateQueries({ queryKey: ["cotacao-compra", cotacaoId] });
      queryClient.invalidateQueries({ queryKey: ["cotacoes-compra"] });
    },
    onError: (updateError: Error) =>
      toast.error(`Não foi possível atualizar a cotação: ${updateError.message}`),
  });
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
  const imprimirProposta = (fornecedor: FornecedorCotacao) => {
    const proposta = fornecedor.cotacoes_propostas?.[0];
    const respostas = fornecedor.cotacoes_respostas || [];
    const linhas = (cotacao.cotacoes_itens || [])
      .map((item) => {
        const resposta = respostas.find((r) => r.cotacao_item_id === item.id);
        const unitario = Number(resposta?.valor_unitario || 0);
        const total = resposta?.disponivel ? unitario * Number(item.quantidade) : 0;
        return `<tr><td>${escapeHtml(item.descricao)}</td><td>${item.quantidade} ${escapeHtml(item.unidade)}</td><td>${resposta?.disponivel ? brl(unitario) : "Indisponível"}</td><td>${resposta?.disponivel ? brl(total) : "—"}</td></tr>`;
      })
      .join("");
    const subtotal = respostas
      .filter((r) => r.disponivel)
      .reduce((sum, r) => {
        const item = (cotacao.cotacoes_itens || []).find((i) => i.id === r.cotacao_item_id);
        return (
          sum +
          Number(r.valor_unitario || 0) * Number(item?.quantidade || r.quantidade_ofertada || 0)
        );
      }, 0);
    const frete = Number(proposta?.frete || 0);
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("Permita pop-ups para imprimir ou salvar a proposta em PDF.");
      return;
    }
    popup.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta - Cotação #${cotacao.numero}</title><style>body{font:14px Arial,sans-serif;color:#172b3a;margin:36px}h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cbd5e1;padding:9px;text-align:left}th{background:#f1f5f9}.total{font-size:18px;font-weight:bold;margin-top:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.muted{color:#526273}@media print{body{margin:18mm}}</style></head><body><h1>Proposta do fornecedor</h1><p><b>Cotação #${cotacao.numero}</b> · ${escapeHtml(cotacao.obras ? `${cotacao.obras.numero} — ${cotacao.obras.nome}` : "Compra")}</p><p>Fornecedor: <b>${escapeHtml(fornecedor.fornecedores?.razao_social || "Fornecedor")}</b></p><p class="muted">Emitida em ${new Date().toLocaleDateString("pt-BR")}</p><h2>Itens cotados</h2><table><thead><tr><th>Item</th><th>Quantidade</th><th>Valor unitário</th><th>Total</th></tr></thead><tbody>${linhas}</tbody></table><div class="grid"><p>Subtotal: <b>${brl(subtotal)}</b></p><p>Frete: <b>${brl(frete)}</b></p><p>Condição de pagamento: <b>${escapeHtml(proposta?.condicao_pagamento || "Não informada")}</b></p><p>Prazo de entrega: <b>${proposta?.prazo_entrega_dias ?? "Não informado"}${proposta?.prazo_entrega_dias != null ? " dias" : ""}</b></p><p>Validade: <b>${proposta?.validade_proposta ? new Date(`${proposta.validade_proposta}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</b></p></div><p class="total">Total da proposta: ${brl(subtotal + frete)}</p>${proposta?.observacoes ? `<h2>Observações</h2><p>${escapeHtml(proposta.observacoes)}</p>` : ""}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`,
    );
    popup.document.close();
  };
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
          <Badge
            variant={cotacao.respostas_habilitadas === false ? "destructive" : "default"}
            className="self-center"
          >
            {cotacao.respostas_habilitadas === false
              ? "Respostas desativadas"
              : "Respostas ativadas"}
          </Badge>
          <Button
            variant="outline"
            className="gap-2"
            disabled={alternarRespostas.isPending}
            onClick={() => alternarRespostas.mutate(cotacao.respostas_habilitadas === false)}
          >
            {cotacao.respostas_habilitadas === false ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
            {cotacao.respostas_habilitadas === false ? "Ativar respostas" : "Desativar respostas"}
          </Button>
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
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => imprimirProposta(f)}
                      >
                        <Printer className="size-4" />
                        Imprimir / Salvar PDF
                      </Button>
                    </div>
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

