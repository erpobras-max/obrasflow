import { EmpresaLogo } from "@/components/empresa-logo";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client.custom";
import {
  AssinaturasContrato,
  AssinaturasImpressao,
  useAssinaturasContrato,
  type SignatarioContrato,
} from "@/components/contratos/assinaturas-contrato";

type Contrato = { id: string; numero: string; titulo: string; objeto: string | null; valor_total: number; data_inicio: string | null; data_fim: string | null; observacoes: string | null; cliente_id: string };
type Cliente = { nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null };
type Empresa = { razao_social: string; nome_fantasia: string | null; cnpj: string; inscricao_estadual: string | null; email: string | null; telefone: string | null; endereco: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; logo_url: string | null; clausula_padrao: string | null };

const brl = (valor: number) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) => valor ? new Date(valor + "T00:00").toLocaleDateString("pt-BR") : "A definir";
const endereco = (dados: Pick<Empresa, "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "cep" | "endereco"> | Cliente | null | undefined) =>
  dados ? [dados.logradouro, dados.numero, "complemento" in dados ? dados.complemento : null, dados.bairro, dados.cidade, dados.uf, dados.cep].filter(Boolean).join(", ") || ("endereco" in dados ? dados.endereco : "") || "—" : "—";

export function ContratoImpressao({ contrato, open, onOpenChange }: { contrato: Contrato | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: documento, isLoading } = useQuery({
    queryKey: ["contrato-impressao", contrato?.id],
    enabled: Boolean(contrato && open),
    queryFn: async () => {
      const [cliente, empresa] = await Promise.all([
        supabase.from("clientes").select("nome,cpf_cnpj,email,telefone,logradouro,numero,bairro,cidade,uf,cep").eq("id", contrato!.cliente_id).maybeSingle(),
        supabase.from("configuracoes_empresa").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (cliente.error) throw cliente.error;
      if (empresa.error) throw empresa.error;
      return { cliente: cliente.data as Cliente | null, empresa: empresa.data as Empresa | null };
    },
  });
  const { data: assinaturas = [] } = useAssinaturasContrato({
    contratoId: contrato?.id,
    enabled: Boolean(contrato && open),
  });
  const signatarios: SignatarioContrato[] = [
    {
      papel: "contratada",
      label: "CONTRATADA",
      nome: documento?.empresa?.razao_social || documento?.empresa?.nome_fantasia,
      documento: documento?.empresa?.cnpj,
    },
    {
      papel: "contratante",
      label: "CONTRATANTE",
      nome: documento?.cliente?.nome,
      documento: documento?.cliente?.cpf_cnpj,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Contrato pronto para emissão</DialogTitle>
          <DialogDescription>Use a impressão do navegador para salvar uma cópia em PDF ou enviar para assinatura.</DialogDescription>
        </DialogHeader>
        <div className="print:hidden flex flex-wrap items-center gap-3">
          <Button onClick={() => window.print()}><Printer className="size-4" /> Imprimir / Salvar PDF</Button>
        </div>
        {contrato && <AssinaturasContrato contratoId={contrato.id} signatarios={signatarios} />}
        {isLoading || !contrato ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>
        ) : (
          <article className="contract-print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-[12px] text-slate-900 shadow print:max-w-none print:p-10 print:shadow-none">
            <style>{`@media print { @page { size:A4; margin:12mm; } html,body { background:#fff!important; } .contract-print-sheet { position:relative!important; display:block!important; width:100%!important; max-width:none!important; margin:0!important; box-shadow:none!important; } }`}</style>
            <header className="border-b-2 border-slate-800 pb-5">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-3">
                  {documento?.empresa?.logo_url && <EmpresaLogo value={documento.empresa.logo_url} className="h-12 w-auto object-contain rounded shadow-sm" />}
                  <div>
                    <h1 className="text-lg font-bold">{documento?.empresa?.nome_fantasia || documento?.empresa?.razao_social || "Empresa"}</h1>
                    <p>{documento?.empresa?.razao_social}</p>
                    <p>CNPJ: {documento?.empresa?.cnpj || "Não informado"}{documento?.empresa?.inscricao_estadual ? ` · IE: ${documento.empresa.inscricao_estadual}` : ""}</p>
                    <p>{endereco(documento?.empresa)}</p>
                    <p>{[documento?.empresa?.telefone, documento?.empresa?.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="text-right"><h2 className="text-2xl font-bold">CONTRATO</h2><p><b>Nº:</b> {contrato.numero}</p><p><b>Emissão:</b> {new Date().toLocaleDateString("pt-BR")}</p></div>
              </div>
            </header>
            <h2 className="mt-6 text-center text-base font-bold uppercase">Contrato de prestação de serviços</h2>
            <section className="mt-5 space-y-3 leading-6">
              <p><b>CONTRATANTE:</b> {documento?.cliente?.nome || "Cliente"}, documento {documento?.cliente?.cpf_cnpj || "não informado"}, com endereço em {endereco(documento?.cliente)}.</p>
              <p><b>CONTRATADA:</b> {documento?.empresa?.razao_social || "Empresa"}, CNPJ {documento?.empresa?.cnpj || "não informado"}, com endereço em {endereco(documento?.empresa)}.</p>
              <h3 className="pt-2 font-bold uppercase">Cláusula primeira — objeto</h3>
              <p><b>1.1.</b> O presente contrato tem por objeto a prestação de serviços de mão de obra descritos em <b>{contrato.objeto || contrato.titulo}</b>, conforme os projetos, memoriais e demais documentos aceitos pelas partes.</p>
              <p><b>1.2.</b> Os serviços serão executados em conformidade com este contrato, os projetos aplicáveis e as normas técnicas pertinentes.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula segunda — escopo dos serviços</h3>
              <p><b>2.1.</b> Os serviços compreenderão as especificações contratuais, os critérios de medição e os documentos técnicos relacionados à obra.</p>
              <p><b>2.2.</b> Cada parte assumirá as obrigações necessárias à execução dos serviços, conforme a divisão prevista neste instrumento.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula terceira — documentos do contrato</h3>
              <p><b>3.1.</b> Integram este contrato, quando existentes, a proposta comercial, o cronograma físico-financeiro, os projetos e os memoriais descritivos.</p>
              <p><b>3.2.</b> Em caso de divergência, as partes formalizarão por escrito a interpretação aplicável. Alterações de escopo, prazo ou valor somente terão validade por termo aditivo assinado pelas partes.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula quarta — obrigações da contratada</h3>
              <p><b>4.1.</b> A CONTRATADA executará os serviços com diligência, observando as boas práticas, a legislação e as normas técnicas aplicáveis.</p>
              <p><b>4.2.</b> A CONTRATADA responderá pela qualidade, solidez e segurança dos serviços sob sua responsabilidade e refará, sem ônus para a CONTRATANTE, a parte comprovadamente executada em desacordo com o contratado.</p>
              <p><b>4.3.</b> A CONTRATADA entregará os documentos usuais de acompanhamento dos serviços quando solicitados pela fiscalização.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula quinta — obrigações da contratante</h3>
              <p><b>5.1.</b> A CONTRATANTE fornecerá, quando previsto no escopo, os materiais necessários, bem como energia, água, esgoto e acesso às áreas de trabalho em condições adequadas.</p>
              <p><b>5.2.</b> A CONTRATANTE realizará os pagamentos na forma e nos prazos estabelecidos neste contrato. A ausência de materiais, projetos ou liberação da frente de trabalho poderá suspender o cronograma pelo período correspondente.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula sexta — prazo</h3>
              <p><b>6.1.</b> Os serviços serão executados de {data(contrato.data_inicio)} até {data(contrato.data_fim)}, conforme o cronograma físico-financeiro.</p>
              <p><b>6.2.</b> O prazo poderá ser prorrogado por força maior, caso fortuito, paralisação, alterações de projeto, atraso na disponibilização de materiais ou informações, greve, chuvas que afetem os serviços ou acordo formal entre as partes.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula sétima — preço contratual</h3>
              <p><b>7.1.</b> Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de <b>{brl(contrato.valor_total)}</b>, conforme a proposta comercial e as medições aceitas.</p>
              <p><b>7.2.</b> O preço inclui mão de obra, ferramentas de pequeno porte e serviços auxiliares necessários ao escopo contratado. Modificações solicitadas pela CONTRATANTE que alterem preço ou prazo deverão ser formalizadas por termo aditivo.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula oitava — medição, faturamento e pagamento</h3>
              <p><b>8.1.</b> Os pagamentos serão realizados por depósito, transferência, PIX ou outro meio acordado, conforme as medições e o cronograma físico-financeiro.</p>
              <p><b>8.2.</b> A CONTRATANTE efetuará o pagamento dos serviços efetivamente executados e aceitos, observando os prazos definidos entre as partes.</p>

              <h3 className="pt-2 font-bold uppercase">Cláusula nona — rescisão e multa</h3>
              <p><b>9.1.</b> Este contrato poderá ser rescindido por qualquer das partes em caso de descumprimento contratual, mediante comunicação prévia.</p>
              <p><b>9.2.</b> Na rescisão sem justa causa por iniciativa da CONTRATANTE, serão devidos os serviços executados até a última medição, acrescidos de multa rescisória de 2% sobre o saldo remanescente. Em caso de abandono injustificado pela CONTRATADA, incidirá multa de 2% sobre o valor total do contrato, sem prejuízo das perdas e danos comprovados.</p>
              {documento?.empresa?.clausula_padrao && <p><b>CONDIÇÕES ESPECÍFICAS.</b> {documento.empresa.clausula_padrao}</p>}
              {contrato.observacoes && <p><b>OBSERVAÇÕES.</b> {contrato.observacoes}</p>}
            </section>
            <AssinaturasImpressao assinaturas={assinaturas} signatarios={signatarios} />
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
