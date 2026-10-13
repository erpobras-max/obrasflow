import { useMemo, useState } from "react";
import { CalendarDays, Check, Search, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useCreateCotacao } from "@/hooks/use-cotacoes";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; solicitacao: any; fornecedores: any[]; itens: any[]; };

export function ModalCriarCotacao({ open, onOpenChange, solicitacao, fornecedores, itens }: Props) {
  const [prazo, setPrazo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); });
  const [observacoes, setObservacoes] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const criar = useCreateCotacao();
  const lista = useMemo(() => fornecedores.filter((f) => `${f.razao_social} ${f.cnpj || ""}`.toLowerCase().includes(busca.toLowerCase())), [fornecedores, busca]);
  const toggle = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const submit = () => {
    if (!solicitacao?.id || !prazo || selecionados.length === 0) return;
    criar.mutate({ solicitacaoId: solicitacao.id, prazo, observacoes, fornecedores: selecionados }, { onSuccess: () => { onOpenChange(false); setSelecionados([]); } });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
      <DialogHeader><DialogTitle>Criar cotação de compra</DialogTitle><DialogDescription>Envie a mesma solicitação para vários fornecedores e compare as propostas recebidas.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <section className="rounded-lg border p-4 space-y-3"><h3 className="font-semibold">Itens da solicitação</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Descrição</th><th className="p-2">Qtd.</th><th className="p-2">Unid.</th></tr></thead><tbody>{itens.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.descricao_livre || item.produto?.nome || item.descricao || "Item"}</td><td className="p-2">{item.quantidade}</td><td className="p-2">{item.unidade}</td></tr>)}</tbody></table></div></section>
        <section className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium">Prazo para resposta *</label><div className="relative mt-1"><CalendarDays className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div></div><div><label className="text-sm font-medium">Observações</label><Textarea className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Instruções para os fornecedores" /></div></section>
        <section className="rounded-lg border p-4 space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Fornecedores</h3><p className="text-xs text-muted-foreground">Cada fornecedor receberá um link exclusivo.</p></div><Badge variant="secondary">{selecionados.length} selecionado(s)</Badge></div><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} /></div><div className="max-h-48 overflow-y-auto space-y-1">{lista.map((f) => <label key={f.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted cursor-pointer"><Checkbox checked={selecionados.includes(f.id)} onCheckedChange={() => toggle(f.id)} /><span className="flex-1 text-sm">{f.razao_social}</span>{selecionados.includes(f.id) && <Check className="size-4 text-green-600" />}</label>)}{lista.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>}</div></section>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!prazo || selecionados.length === 0 || criar.isPending} onClick={submit} className="gap-2"><Send className="size-4" />{criar.isPending ? "Enviando..." : "Criar e enviar cotação"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
