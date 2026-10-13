import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, FileSearch, Send } from "lucide-react";
import { toast } from "sonner";
import { useCotacao } from "@/hooks/use-cotacoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/cotacoes/$cotacaoId")({ component: CotacaoDetalhePage });
function CotacaoDetalhePage() {
  const { cotacaoId } = Route.useParams(); const { data: c, isLoading, error } = useCotacao(cotacaoId);
  if (isLoading) return <p>Carregando cotação...</p>; if (error || !c) return <p className="text-destructive">Cotação não encontrada.</p>;
  const copy = (token: string) => { const url = `${window.location.origin}/cotacao/${token}`; navigator.clipboard.writeText(url); toast.success("Link copiado"); };
  return <div className="space-y-6"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">Cotação #{c.numero}</p><h1 className="text-2xl font-bold">{c.obras ? `${c.obras.numero} — ${c.obras.nome}` : "Cotação de compra"}</h1><p className="text-sm text-muted-foreground">Prazo: {new Date(`${c.prazo_resposta}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><div className="flex gap-2"><Link to="/cotacoes/$cotacaoId/comparativo" params={{ cotacaoId }}><Button className="gap-2"><FileSearch className="size-4" />Comparar respostas</Button></Link><Link to="/cotacoes"><Button variant="outline">Voltar</Button></Link></div></div>
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]"><Card><CardHeader><CardTitle>Fornecedores convidados</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Status</TableHead><TableHead>Respondido em</TableHead><TableHead className="text-right">Link</TableHead></TableRow></TableHeader><TableBody>{(c.cotacoes_fornecedores || []).map((f: any) => <TableRow key={f.id}><TableCell className="font-medium">{f.fornecedores?.razao_social}</TableCell><TableCell><Badge variant={f.status === "respondido" ? "default" : "secondary"}>{f.status}</Badge></TableCell><TableCell>{f.respondido_em ? new Date(f.respondido_em).toLocaleString("pt-BR") : "—"}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => copy(f.token)}><Copy className="mr-1 size-3" />Copiar</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle>Itens solicitados</CardTitle></CardHeader><CardContent className="space-y-2">{(c.cotacoes_itens || []).map((i: any) => <div key={i.id} className="flex justify-between border-b py-2 text-sm"><span>{i.descricao}</span><span className="text-muted-foreground">{i.quantidade} {i.unidade}</span></div>)}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="space-y-3">{(c.cotacoes_historico || []).sort((a: any,b: any) => b.created_at.localeCompare(a.created_at)).map((h: any) => <div key={h.id} className="flex gap-3 text-sm"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span><span>{h.descricao || h.acao}</span></div>)}</CardContent></Card>
  </div>;
}
