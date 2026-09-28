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
import { formatarDocumento } from "@/lib/documento";

export const Route = createFileRoute("/assinar/$token")({ component: AssinaturaPublicaPage });

type LinkAssinatura = {
  papel_label: string; nome_esperado?: string | null; documento_esperado?: string | null;
  documento_titulo: string; documento_resumo: string; expira_em: string;
  documento?: DocumentoPublico | null;
};

type DocumentoPublico = {
  tipo: "civil" | "locacao";
  numero: string;
  titulo: string;
  objeto?: string | null;
  valor_total: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  observacoes?: string | null;
  contratante?: PessoaContrato | null;
  contratada?: PessoaContrato | null;
};

type PessoaContrato = { nome?: string | null; documento?: string | null; razao_social?: string | null; nome_fantasia?: string | null; cnpj?: string | null; logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null };

const moeda = (valor: number) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataFormatada = (valor?: string | null) => valor ? new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR") : "A definir";
const endereco = (pessoa?: PessoaContrato | null) => [pessoa?.logradouro, pessoa?.numero, pessoa?.complemento, pessoa?.bairro, pessoa?.cidade, pessoa?.uf, pessoa?.cep].filter(Boolean).join(", ") || "—";

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
            {link!.documento && <DocumentoParaAssinatura documento={link!.documento} />}
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

function DocumentoParaAssinatura({ documento }: { documento: DocumentoPublico }) {
  const contratada = documento.contratada?.nome_fantasia || documento.contratada?.razao_social || "CONTRATADA";
  return <section className="rounded-lg border bg-white p-5 text-justify text-sm leading-6 text-slate-800 sm:p-7">
    <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4">
      <div><p className="font-bold">{contratada}</p><p className="text-xs text-slate-500">{formatarDocumento(documento.contratada?.cnpj)}</p></div>
      <div className="text-right"><p className="font-bold">CONTRATO</p><p className="text-xs">Nº {documento.numero}</p></div>
    </div>
    <h2 className="text-center font-bold uppercase">{documento.tipo === "locacao" ? "Contrato de locação" : "Contrato de prestação de serviços"}</h2>
    <div className="mt-5 space-y-4">
      <p><b>CONTRATANTE:</b> {documento.contratante?.nome || "—"}, {formatarDocumento(documento.contratante?.documento)}, com endereço em {endereco(documento.contratante)}.</p>
      <p><b>CONTRATADA:</b> {contratada}, {formatarDocumento(documento.contratada?.cnpj)}, com endereço em {endereco(documento.contratada)}.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula primeira — objeto</h3>
      <p><b>1.1.</b> O presente contrato tem por objeto a prestação de serviços de mão de obra descritos em <b>{documento.objeto || documento.titulo}</b>, conforme os projetos, memoriais e demais documentos aceitos pelas partes.</p>
      <p><b>1.2.</b> Os serviços serão executados em conformidade com este contrato, os projetos aplicáveis e as normas técnicas pertinentes.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula segunda — escopo dos serviços</h3>
      <p><b>2.1.</b> Os serviços compreenderão as especificações contratuais, os critérios de medição e os documentos técnicos relacionados à obra.</p><p><b>2.2.</b> Cada parte assumirá as obrigações necessárias à execução dos serviços, conforme a divisão prevista neste instrumento.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula terceira — documentos do contrato</h3>
      <p><b>3.1.</b> Integram este contrato, quando existentes, a proposta comercial, o cronograma físico-financeiro, os projetos e os memoriais descritivos.</p><p><b>3.2.</b> Em caso de divergência, as partes formalizarão por escrito a interpretação aplicável. Alterações de escopo, prazo ou valor somente terão validade por termo aditivo assinado pelas partes.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula quarta — obrigações da contratada</h3>
      <p><b>4.1.</b> A CONTRATADA executará os serviços com diligência, observando as boas práticas, a legislação e as normas técnicas aplicáveis.</p><p><b>4.2.</b> A CONTRATADA responderá pela qualidade, solidez e segurança dos serviços sob sua responsabilidade e refará, sem ônus para a CONTRATANTE, a parte comprovadamente executada em desacordo com o contratado.</p><p><b>4.3.</b> A CONTRATADA entregará os documentos usuais de acompanhamento dos serviços quando solicitados pela fiscalização.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula quinta — obrigações da contratante</h3>
      <p><b>5.1.</b> A CONTRATANTE fornecerá, quando previsto no escopo, os materiais necessários, bem como energia, água, esgoto e acesso às áreas de trabalho em condições adequadas.</p><p><b>5.2.</b> A CONTRATANTE realizará os pagamentos na forma e nos prazos estabelecidos neste contrato. A ausência de materiais, projetos ou liberação da frente de trabalho poderá suspender o cronograma pelo período correspondente.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula sexta — prazo</h3>
      <p><b>6.1.</b> Os serviços serão executados de {dataFormatada(documento.data_inicio)} até {dataFormatada(documento.data_fim)}, conforme o cronograma físico-financeiro.</p><p><b>6.2.</b> O prazo poderá ser prorrogado por força maior, caso fortuito, paralisação, alterações de projeto, atraso na disponibilização de materiais ou informações, greve, chuvas que afetem os serviços ou acordo formal entre as partes.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula sétima — preço contratual</h3>
      <p><b>7.1.</b> Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de <b>{moeda(documento.valor_total)}</b>, conforme a proposta comercial e as medições aceitas.</p><p><b>7.2.</b> O preço inclui mão de obra, ferramentas de pequeno porte e serviços auxiliares necessários ao escopo contratado. Modificações solicitadas pela CONTRATANTE que alterem preço ou prazo deverão ser formalizadas por termo aditivo.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula oitava — medição, faturamento e pagamento</h3>
      <p><b>8.1.</b> Os pagamentos serão realizados por depósito, transferência, PIX ou outro meio acordado, conforme as medições e o cronograma físico-financeiro.</p><p><b>8.2.</b> A CONTRATANTE efetuará o pagamento dos serviços efetivamente executados e aceitos, observando os prazos definidos entre as partes.</p>
      <h3 className="pt-2 font-bold uppercase">Cláusula nona — rescisão e multa</h3>
      <p><b>9.1.</b> Este contrato poderá ser rescindido por qualquer das partes em caso de descumprimento contratual, mediante comunicação prévia.</p><p><b>9.2.</b> Na rescisão sem justa causa por iniciativa da CONTRATANTE, serão devidos os serviços executados até a última medição, acrescidos de multa rescisória de 2% sobre o saldo remanescente. Em caso de abandono injustificado pela CONTRATADA, incidirá multa de 2% sobre o valor total do contrato, sem prejuízo das perdas e danos comprovados.</p>
      {documento.observacoes && <p><b>OBSERVAÇÕES.</b> {documento.observacoes}</p>}
    </div>
  </section>;
}

function EmptyState() {
  return <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4"><Card className="max-w-md"><CardContent className="p-8 text-center"><FileSignature className="mx-auto size-10 text-stone-400" /><h1 className="mt-4 text-xl font-semibold">Link indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link expirou, foi revogado ou já foi utilizado.</p></CardContent></Card></main>;
}
