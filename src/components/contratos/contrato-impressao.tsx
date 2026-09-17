import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client.custom";

type Contrato = { id: string; numero: string; titulo: string; objeto: string | null; valor_total: number; data_inicio: string | null; data_fim: string | null; observacoes: string | null; cliente_id: string };
type Cliente = { nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null };
type Empresa = { razao_social: string; nome_fantasia: string | null; cnpj: string; inscricao_estadual: string | null; email: string | null; telefone: string | null; endereco: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; logo_url: string | null };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Contrato pronto para emissão</DialogTitle>
          <DialogDescription>Use a impressão do navegador para salvar uma cópia em PDF ou enviar para assinatura.</DialogDescription>
        </DialogHeader>
        <div className="print:hidden"><Button onClick={() => window.print()}><Printer className="size-4" /> Imprimir / Salvar PDF</Button></div>
        {isLoading || !contrato ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>
        ) : (
          <article className="contract-print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-[12px] text-slate-900 shadow print:max-w-none print:p-10 print:shadow-none">
            <style>{`@media print { body * { visibility:hidden!important } .contract-print-sheet,.contract-print-sheet * { visibility:visible!important } .contract-print-sheet { position:absolute; inset:0; width:100% } @page { size:A4; margin:12mm @top-left { content: "OBRASFLOW — CONTRATO"; font-size: 8pt; } @bottom-left { content: "Page " counter(page); font-size: 8pt; } } }`}</style>
            <header className="border-b-2 border-slate-800 pb-5">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-3">
                  {documento?.empresa?.logo_url && <img src={documento.empresa.logo_url} alt="Logo" className="h-12 w-auto object-contain rounded shadow-sm" />}
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
              <p><b>CLÁUSULA 1ª — OBJETO.</b> {documento?.empresa?.clausula_padrao || (contrato.objeto || contrato.titulo)}.</p>
              <p><b>CLÁUSULA 2ª — VALOR.</b> Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor total de <b>{brl(contrato.valor_total)}</b>.</p>
              <p><b>CLÁUSULA 3ª — VIGÊNCIA.</b> O contrato terá vigência de {data(contrato.data_inicio)} até {data(contrato.data_fim)}.</p>
              <p><b>CLÁUSULAS GERAIS.</b> {documento?.empresa?.clausula_padrao ? documento.empresa.clausula_padrao : "As condições específicas, prazos e responsabilidades serão executados conforme o objeto deste contrato e as normas aplicáveis."}</p>
              {contrato.observacoes && <p><b>OBSERVAÇÕES.</b> {contrato.observacoes}</p>}
            </section>
            <section className="mt-8 rounded border p-4"><h3 className="font-bold uppercase">Dados para contato</h3><p className="mt-2">Contratante: {[documento?.cliente?.email, documento?.cliente?.telefone].filter(Boolean).join(" · ") || "—"}</p></section>
            <footer className="mt-20 grid grid-cols-2 gap-12 text-center"><div className="border-t pt-2">{documento?.empresa?.razao_social || "Contratada"}</div><div className="border-t pt-2">{documento?.cliente?.nome || "Contratante"}</div></footer>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
