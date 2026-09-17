import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client.custom";

type Proposta = { id:string; numero:string; titulo:string; descricao:string|null; condicoes_pagamento:string|null; observacoes:string|null; validade:string|null; valor_total:number; cliente_id:string };
type Linha = { id:string; descricao:string; unidade:string|null; quantidade:number; valor_unitario:number; etapa_codigo:string|null; etapa_nome:string|null; item_codigo:string|null; item_nome:string|null; subitem_codigo:string|null };
type Empresa = { razao_social:string; nome_fantasia:string|null; cnpj:string; inscricao_estadual:string|null; email:string|null; telefone:string|null; cep:string|null; logradouro:string|null; numero:string|null; complemento:string|null; bairro:string|null; cidade:string|null; uf:string|null; endereco:string; logo_url:string|null };
const brl=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const enderecoEmpresa=(e:Empresa|null|undefined)=>e?[e.logradouro,e.numero,e.complemento,e.bairro,e.cidade,e.uf,e.cep].filter(Boolean).join(", ")||e.endereco:"";

export function PropostaImpressao({proposta,open,onOpenChange}:{proposta:Proposta|null;open:boolean;onOpenChange:(open:boolean)=>void}) {
 const {data,isLoading}=useQuery({
  queryKey:["proposta-impressao",proposta?.id],enabled:!!proposta&&open,
  queryFn:async()=>{
   const [cliente,itens,empresa]=await Promise.all([
    supabase.from("clientes").select("nome,logradouro,numero,bairro,cidade,uf,cep").eq("id",proposta!.cliente_id).maybeSingle(),
    (supabase as any).from("propostas_itens").select("id,descricao,unidade,quantidade,valor_unitario,etapa_codigo,etapa_nome,item_codigo,item_nome,subitem_codigo").eq("proposta_id",proposta!.id).order("ordem"),
    supabase.from("configuracoes_empresa").select("*").eq("id",1).maybeSingle()
   ]);
   if(cliente.error)throw cliente.error;if(itens.error)throw itens.error;if(empresa.error)throw empresa.error;
   return{cliente:cliente.data,itens:(itens.data??[]) as Linha[],empresa:empresa.data as Empresa|null};
  }
 });
 const total=data?.itens.reduce((s,i)=>s+Number(i.quantidade)*Number(i.valor_unitario),0)??0;
 const empresa=data?.empresa;
 return (
  <Dialog open={open} onOpenChange={onOpenChange}>
   <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
    <DialogHeader className="print:hidden"><DialogTitle>Proposta pronta para envio</DialogTitle><DialogDescription>Use Imprimir para salvar em PDF ou enviar ao cliente.</DialogDescription></DialogHeader>
    <div className="print:hidden"><Button onClick={()=>window.print()}><Printer className="size-4"/> Imprimir / Salvar PDF</Button></div>
    {isLoading||!proposta ? <div className="space-y-3"><Skeleton className="h-20 w-full"/><Skeleton className="h-64 w-full"/></div> : (
     <article className="proposal-print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-[12px] text-slate-900 shadow print:max-w-none print:p-10 print:shadow-none">
      <style>{`@media print { body * { visibility:hidden!important } .proposal-print-sheet,.proposal-print-sheet *{visibility:visible!important}.proposal-print-sheet{position:absolute;inset:0;width:100%}@page{size:A4;margin:12mm @top-left{content:"OBRASFLOW — PROPOSTA";font-size:8pt;} @bottom-left{content:"Page " counter(page);font-size:8pt;}}}`}</style>
      <header className="border-b-2 border-slate-800 pb-5">
       <div className="flex items-start justify-between gap-8">
        <div className="flex items-start gap-3">
         {empresa?.logo_url && <img src={empresa.logo_url} alt="Logo" className="h-14 w-auto object-contain rounded shadow-sm" />}
         <div>
          <h1 className="text-lg font-bold">{empresa?.nome_fantasia||empresa?.razao_social||"Empresa"}</h1>
          <p>{empresa?.razao_social}</p>
          <p>CNPJ: {empresa?.cnpj||"Não informado"}{empresa?.inscricao_estadual?` · IE: ${empresa.inscricao_estadual}`:""}</p>
          <p>{enderecoEmpresa(empresa)}</p>
          <p>{[empresa?.telefone,empresa?.email].filter(Boolean).join(" · ")}</p>
         </div>
        </div>
        <div className="text-right"><h2 className="text-2xl font-bold">PROPOSTA COMERCIAL</h2><p><b>Nº:</b> {proposta.numero}</p><p><b>Emissão:</b> {new Date().toLocaleDateString("pt-BR")}</p></div>
       </div>
      </header>
      <section className="mt-5 rounded border p-4"><h2 className="mb-2 font-bold uppercase">Dados do cliente</h2><div className="grid grid-cols-2 gap-2"><p><b>Nome:</b> {data?.cliente?.nome??"—"}</p><p><b>Obra:</b> {proposta.titulo}</p><p className="col-span-2"><b>Endereço:</b> {[data?.cliente?.logradouro,data?.cliente?.numero,data?.cliente?.bairro,data?.cliente?.cidade,data?.cliente?.uf,data?.cliente?.cep].filter(Boolean).join(", ")||"—"}</p></div></section>
      {proposta.descricao&&<p className="mt-5">{proposta.descricao}</p>}
      <section className="mt-6"><h2 className="border-b-2 border-slate-800 pb-2 text-base font-bold">SERVIÇOS CONTRATADOS</h2><div className="mt-3 overflow-hidden rounded border"><table className="w-full border-collapse"><thead className="bg-slate-100 text-left"><tr><th className="p-2">Código / descrição</th><th className="p-2">Un.</th><th className="p-2 text-right">Qtd.</th><th className="p-2 text-right">Valor unit.</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{data?.itens.map((item,index)=><><tr key={`e-${item.id}`} className="border-t bg-slate-200 font-bold"><td className="p-2" colSpan={5}>{item.etapa_codigo||index+1}. {item.etapa_nome||"Etapa não informada"}{item.item_nome?` › ${item.item_codigo||""} ${item.item_nome}`:""}</td></tr><tr key={item.id} className="border-t"><td className="p-2"><b>{item.subitem_codigo||index+1}</b> — {item.descricao}</td><td className="p-2">{item.unidade||"un"}</td><td className="p-2 text-right">{Number(item.quantidade)}</td><td className="p-2 text-right">{brl(item.valor_unitario)}</td><td className="p-2 text-right font-medium">{brl(Number(item.quantidade)*Number(item.valor_unitario))}</td></tr></>)}</tbody></table></div><div className="mt-3 ml-auto w-72 border-t-2 border-slate-800 pt-2 text-right text-lg font-bold">TOTAL: {brl(proposta.valor_total||total)}</div></section>
      <section className="mt-8 grid grid-cols-2 gap-8 border-t pt-5"><div><h2 className="font-bold uppercase">Condição de pagamento</h2><p className="mt-2 whitespace-pre-wrap">{proposta.condicoes_pagamento||"A definir"}</p></div><div><h2 className="font-bold uppercase">Validade</h2><p className="mt-2">{proposta.validade?new Date(proposta.validade+"T00:00").toLocaleDateString("pt-BR"):"A definir"}</p></div></section>
      <section className="mt-5"><h2 className="font-bold uppercase">Observações gerais</h2><p className="mt-2 whitespace-pre-wrap">{proposta.observacoes||"—"}</p></section>
      <footer className="mt-16 grid grid-cols-2 gap-12 text-center"><div className="border-t pt-2">{empresa?.razao_social||"Responsável pela proposta"}</div><div className="border-t pt-2">{data?.cliente?.nome??"Cliente"}</div></footer>
     </article>
    )}
   </DialogContent>
  </Dialog>
 );
}
