import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client.custom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmpresaLogo } from "@/components/empresa-logo";
import { situacaoEtapa, type EtapaCronograma } from "@/lib/cronograma";
import { imprimirElemento } from "@/lib/impressao";

type Obra = {
  id: string;
  numero: string;
  nome: string;
  cliente_id: string | null;
  responsavel_id: string | null;
};

type Props = {
  obra: Obra | null;
  etapas: EtapaCronograma[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const dataBR = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "A definir";
const percent = (value: number | null | undefined) => `${Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function CronogramaRelatorio({ obra, etapas, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cronograma-relatorio", obra?.id, open],
    enabled: open && !!obra,
    queryFn: async () => {
      if (!obra) return null;
      const [empresaResult, clienteResult, responsavelResult] = await Promise.all([
        supabase.from("configuracoes_empresa").select("razao_social,nome_fantasia,cnpj,logo_url").eq("id", 1).maybeSingle(),
        obra.cliente_id ? supabase.from("clientes").select("nome").eq("id", obra.cliente_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        obra.responsavel_id ? supabase.rpc("listar_responsaveis_tecnicos" as never) : Promise.resolve({ data: [], error: null }),
      ]);
      if (empresaResult.error) throw empresaResult.error;
      if (clienteResult.error) throw clienteResult.error;
      if (responsavelResult.error) throw responsavelResult.error;
      const responsavel = (responsavelResult.data ?? []).find(
        (item: { user_id?: string }) => item.user_id === obra.responsavel_id,
      ) as { nome?: string } | undefined;
      return {
        empresa: empresaResult.data,
        cliente: clienteResult.data,
        responsavel: responsavel?.nome ?? null,
      };
    },
  });

  const hoje = format(new Date(), "yyyy-MM-dd");
  const concluídas = etapas.filter((etapa) => Number(etapa.progresso) >= Number(etapa.meta_percentual)).length;
  const atrasadas = etapas.filter((etapa) => situacaoEtapa(etapa, hoje) === "Prazo vencido").length;
  const semPrazo = etapas.filter((etapa) => !etapa.data_inicio || !etapa.data_fim).length;
  const progressoMedio = etapas.length
    ? etapas.reduce((total, etapa) => total + Number(etapa.progresso ?? 0), 0) / etapas.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2"><FileText className="size-5" />Relatório detalhado do cronograma</DialogTitle>
          <DialogDescription>Resumo do planejamento, prazos, metas e execução das etapas reais da obra.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => imprimirElemento(document.getElementById("cronograma-relatorio-impressao"), `Cronograma ${obra?.numero ?? ""}`)}>
            <Printer className="size-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
        {isLoading || !obra || !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando relatório...</p>
        ) : (
          <article id="cronograma-relatorio-impressao" className="mx-auto w-full max-w-[1123px] bg-white p-8 text-[11px] text-slate-900 shadow print:shadow-none">
            <header className="border-b-2 border-slate-800 pb-4">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-4">
                  {data.empresa?.logo_url && <EmpresaLogo value={data.empresa.logo_url} className="h-14 max-w-44 object-contain" />}
                  <div>
                    <p className="text-base font-bold">{data.empresa?.nome_fantasia || data.empresa?.razao_social || "Empresa"}</p>
                    {data.empresa?.razao_social && data.empresa.razao_social !== data.empresa.nome_fantasia && <p>{data.empresa.razao_social}</p>}
                    {data.empresa?.cnpj && <p>CNPJ: {data.empresa.cnpj}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-bold">RELATÓRIO DO CRONOGRAMA</h1>
                  <p>Emissão: {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            </header>
            <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded border p-3">
              <p><b>OBRA:</b> {obra.numero} — {obra.nome}</p>
              <p><b>CLIENTE:</b> {data.cliente?.nome ?? "—"}</p>
              <p><b>RESPONSÁVEL TÉCNICO:</b> {data.responsavel ?? "Não informado"}</p>
              <p><b>DATA DE REFERÊNCIA:</b> {new Date().toLocaleDateString("pt-BR")}</p>
            </section>
            <section className="mt-4 grid grid-cols-4 gap-3">
              <div className="rounded border p-3"><p className="uppercase text-slate-500">Etapas</p><p className="mt-1 text-base font-bold">{etapas.length}</p></div>
              <div className="rounded border p-3"><p className="uppercase text-slate-500">Progresso médio</p><p className="mt-1 text-base font-bold">{percent(progressoMedio)}</p></div>
              <div className="rounded border p-3"><p className="uppercase text-slate-500">Metas atingidas</p><p className="mt-1 text-base font-bold">{concluídas}</p></div>
              <div className="rounded border p-3"><p className="uppercase text-slate-500">Atrasadas</p><p className="mt-1 text-base font-bold">{atrasadas}</p></div>
            </section>
            {semPrazo > 0 && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">Atenção: {semPrazo} etapa(s) ainda está(ão) sem período previsto.</p>}
            <section className="mt-5">
              <h2 className="border-b-2 border-slate-800 pb-2 text-sm font-bold">ETAPAS E EXECUÇÃO</h2>
              <table className="mt-3 w-full border-collapse">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="border p-2">Ordem</th>
                    <th className="border p-2">Etapa</th>
                    <th className="border p-2">Período previsto</th>
                    <th className="border p-2 text-right">Meta</th>
                    <th className="border p-2 text-right">Realizado</th>
                    <th className="border p-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {etapas.map((etapa) => (
                    <tr key={etapa.id}>
                      <td className="border p-2 text-center">{etapa.ordem}</td>
                      <td className="border p-2 font-medium">{etapa.nome}</td>
                      <td className="border p-2">{dataBR(etapa.data_inicio)} até {dataBR(etapa.data_fim)}</td>
                      <td className="border p-2 text-right">{percent(etapa.meta_percentual)}</td>
                      <td className="border p-2 text-right">{percent(etapa.progresso)}</td>
                      <td className="border p-2">{situacaoEtapa(etapa, hoje)}</td>
                    </tr>
                  ))}
                  {etapas.length === 0 && <tr><td colSpan={6} className="border p-5 text-center">Nenhuma etapa cadastrada.</td></tr>}
                </tbody>
              </table>
            </section>
            <footer className="mt-14 grid grid-cols-2 gap-16 text-center">
              <div className="border-t pt-2"><p>{data.responsavel ?? "Responsável técnico não informado"}</p><p className="text-[10px] text-slate-500">Responsável técnico</p></div>
              <div className="border-t pt-2"><p>{data.cliente?.nome ?? "Cliente"}</p><p className="text-[10px] text-slate-500">Proprietário / cliente</p></div>
            </footer>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
