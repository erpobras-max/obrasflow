import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Medicao = {
  id: string;
  numero: string;
  obra_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  percentual_total: number;
  percentual_anterior?: number;
  valor_total: number;
  status: string;
  observacoes: string | null;
};

type Item = {
  id: string;
  descricao: string;
  unidade: string | null;
  qtd_contratada: number;
  qtd_executada: number;
  valor_unitario: number;
  valor_total: number;
};

type Obra = {
  id: string;
  numero: string;
  nome: string;
  cliente_id: string;
  orcamento: number;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

type Cliente = { id: string; nome: string };

type HistoricoMedicao = {
  id: string;
  numero: string;
  periodo_inicio: string;
  periodo_fim: string;
  percentual_total: number;
  valor_total: number;
  status: string;
};

const brl = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const percent = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const dateBR = (value: string | null | undefined) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const cleanFileName = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");

export function MedicaoRelatorio({
  medicao,
  open,
  onOpenChange,
}: {
  medicao: Medicao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["medicao-relatorio", medicao?.id],
    enabled: !!medicao && open,
    queryFn: async () => {
      const { data: itens, error: itensError } = await supabase
        .from("medicoes_itens")
        .select("id,descricao,unidade,qtd_contratada,qtd_executada,valor_unitario,valor_total")
        .eq("medicao_id", medicao!.id)
        .order("created_at");
      if (itensError) throw itensError;

      const { data: obra, error: obraError } = await supabase
        .from("obras")
        .select("id,numero,nome,cliente_id,orcamento,logradouro,numero_endereco,complemento,bairro,cidade,uf")
        .eq("id", medicao!.obra_id)
        .single();
      if (obraError) throw obraError;

      const { data: historico, error: historicoError } = await supabase
        .from("medicoes")
        .select("id,numero,periodo_inicio,periodo_fim,percentual_total,valor_total,status")
        .eq("obra_id", medicao!.obra_id)
        .order("periodo_fim");
      if (historicoError) throw historicoError;

      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("id,nome")
        .eq("id", obra.cliente_id)
        .maybeSingle();
      if (clienteError) throw clienteError;

      return {
        itens: (itens ?? []) as Item[],
        historico: (historico ?? []) as HistoricoMedicao[],
        obra: obra as Obra,
        cliente: cliente as Cliente | null,
      };
    },
  });

  const gerarExcel = () => {
    if (!medicao || !data) return;
    const valorAnterior = Number(data.obra.orcamento ?? 0) * Number(medicao.percentual_anterior ?? 0) / 100;
    const percentualAcumulado = Number(medicao.percentual_anterior ?? 0) + Number(medicao.percentual_total ?? 0);
    const endereco = [
      data.obra.logradouro,
      data.obra.numero_endereco,
      data.obra.complemento,
      data.obra.bairro,
      data.obra.cidade,
      data.obra.uf,
    ].filter(Boolean).join(", ") || "—";

    const linhas: (string | number)[][] = [
      ["CRONOGRAMA FÍSICO-FINANCEIRO"],
      ["Medição", medicao.numero, "", "Obra", data.obra.nome],
      ["Cliente", data.cliente?.nome ?? "—", "", "Local", endereco],
      ["Período", dateBR(medicao.periodo_inicio) + " a " + dateBR(medicao.periodo_fim)],
      [],
      ["Resumo financeiro"],
      ["Valor contratado", Number(data.obra.orcamento ?? 0)],
      ["Executado anteriormente", valorAnterior],
      ["Valor desta medição", Number(medicao.valor_total ?? 0)],
      ["Valor acumulado", valorAnterior + Number(medicao.valor_total ?? 0)],
      ["Percentual desta medição", Number(medicao.percentual_total ?? 0) / 100],
      ["Percentual acumulado", percentualAcumulado / 100],
      ["Prazo para pagamento", dateBR(medicao.periodo_fim)],
      ["Status", medicao.status],
      [],
      ["ITEM", "DESCRIÇÃO", "UN.", "QTD. CONTRATADA", "QTD. EXECUTADA", "VALOR UNIT.", "VALOR MEDIDO"],
      ...data.itens.map((item, index) => [
        index + 1,
        item.descricao,
        item.unidade ?? "—",
        Number(item.qtd_contratada ?? 0),
        Number(item.qtd_executada ?? 0),
        Number(item.valor_unitario ?? 0),
        Number(item.valor_total ?? Number(item.qtd_executada ?? 0) * Number(item.valor_unitario ?? 0)),
      ]),
      [],
      ["TOTAL DA MEDIÇÃO", "", "", "", "", "", Number(medicao.valor_total ?? 0)],
      ["OBSERVAÇÕES", medicao.observacoes ?? "—"],
      [],
      ["HISTÓRICO DE MEDIÇÕES"],
      ["MEDIÇÃO", "PERÍODO", "% EXECUTADO", "% ACUMULADO", "VALOR MEDIDO", "VENCIMENTO", "STATUS"],
      ...data.historico.reduce<{ acumulado: number; linhas: (string | number)[][] }>((acc, registro) => {
        const acumulado = acc.acumulado + Number(registro.percentual_total ?? 0);
        acc.linhas.push([
          registro.numero,
          dateBR(registro.periodo_inicio) + " a " + dateBR(registro.periodo_fim),
          Number(registro.percentual_total ?? 0) / 100,
          acumulado / 100,
          Number(registro.valor_total ?? 0),
          dateBR(registro.periodo_fim),
          registro.status,
        ]);
        return { acumulado, linhas: acc.linhas };
      }, { acumulado: 0, linhas: [] }).linhas,
    ];

    const sheet = XLSX.utils.aoa_to_sheet(linhas);
    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 6 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
      { s: { r: linhas.length - 2, c: 0 }, e: { r: linhas.length - 2, c: 5 } },
      { s: { r: 20 + data.historico.length, c: 0 }, e: { r: 20 + data.historico.length, c: 6 } },
      { s: { r: linhas.length - data.historico.length - 2, c: 0 }, e: { r: linhas.length - data.historico.length - 2, c: 6 } },
    ];
    sheet["!cols"] = [
      { wch: 10 }, { wch: 45 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];

    const moneyRows = [6, 7, 8, 9, totalRow];
    moneyRows.forEach((row) => {
      const cell = XLSX.utils.encode_cell({ r: row, c: row === totalRow ? 6 : 1 });
      if (sheet[cell]) sheet[cell].z = '"R$" #,##0.00';
    });
    [10, 11].forEach((row) => {
      const cell = XLSX.utils.encode_cell({ r: row, c: 1 });
      if (sheet[cell]) sheet[cell].z = "0.00%";
    });
    data.itens.forEach((_, index) => {
      const row = 16 + index;
      [5, 6].forEach((column) => {
        const cell = XLSX.utils.encode_cell({ r: row, c: column });
        if (sheet[cell]) sheet[cell].z = '"R$" #,##0.00';
      });
    });

    const historicoInicio = historicoInicioRow;
    data.historico.forEach((_, index) => {
      [2, 3].forEach((column) => {
        const cell = XLSX.utils.encode_cell({ r: historicoInicio + index, c: column });
        if (sheet[cell]) sheet[cell].z = "0.00%";
      });
      const cell = XLSX.utils.encode_cell({ r: historicoInicio + index, c: 4 });
      if (sheet[cell]) sheet[cell].z = '"R$" #,##0.00';
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Medição");
    XLSX.writeFile(workbook, "cronograma_" + cleanFileName(medicao.numero) + ".xlsx");
  };

  const valorAnterior = data ? Number(data.obra.orcamento ?? 0) * Number(medicao?.percentual_anterior ?? 0) / 100 : 0;
  const percentualAcumulado = Number(medicao?.percentual_anterior ?? 0) + Number(medicao?.percentual_total ?? 0);
  const endereco = data ? [
    data.obra.logradouro,
    data.obra.numero_endereco,
    data.obra.complemento,
    data.obra.bairro,
    data.obra.cidade,
    data.obra.uf,
  ].filter(Boolean).join(", ") || "—" : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Cronograma físico-financeiro</DialogTitle>
          <DialogDescription>Gere o arquivo Excel ou use Imprimir para salvar este relatório em PDF e enviar ao cliente.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer className="size-4" /> Imprimir / Salvar PDF
          </Button>
          <Button variant="outline" onClick={gerarExcel} disabled={!data}>
            <FileSpreadsheet className="size-4" /> Baixar Excel
          </Button>
        </div>

        {isLoading || !medicao ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando relatório...</p>
        ) : error || !data ? (
          <p className="py-10 text-center text-sm text-destructive">Não foi possível carregar os dados da medição.</p>
        ) : (
          <article className="medicao-print-sheet mx-auto w-full max-w-[1123px] bg-white p-8 text-[11px] text-slate-900 shadow print:max-w-none print:p-8 print:shadow-none">
            <style>{`@media print {
              body * { visibility: hidden !important; }
              .medicao-print-sheet, .medicao-print-sheet * { visibility: visible !important; }
              .medicao-print-sheet { position: absolute; inset: 0; width: 100%; }
              @page { size: landscape; margin: 10mm; }
            }`}</style>

            <header className="border-b-2 border-slate-800 pb-4">
              <div className="flex items-start justify-between gap-8">
                <div>
                  <h1 className="text-xl font-bold tracking-wide">CRONOGRAMA FÍSICO-FINANCEIRO</h1>
                  <p className="mt-1 text-slate-600">Boletim de medição para acompanhamento e pagamento</p>
                </div>
                <div className="text-right">
                  <p><b>MEDIÇÃO:</b> {medicao.numero}</p>
                  <p><b>EMISSÃO:</b> {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded border p-3">
              <p><b>CLIENTE:</b> {data.cliente?.nome ?? "—"}</p>
              <p><b>OBRA:</b> {data.obra.numero} — {data.obra.nome}</p>
              <p><b>LOCAL:</b> {endereco}</p>
              <p><b>PERÍODO:</b> {dateBR(medicao.periodo_inicio)} a {dateBR(medicao.periodo_fim)}</p>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Valor contratado</p><p className="mt-1 text-base font-bold">{brl(data.obra.orcamento)}</p></div>
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Valor desta medição</p><p className="mt-1 text-base font-bold">{brl(medicao.valor_total)}</p></div>
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Valor acumulado</p><p className="mt-1 text-base font-bold">{brl(valorAnterior + Number(medicao.valor_total ?? 0))}</p></div>
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Executado anteriormente</p><p className="mt-1 text-base font-bold">{percent(medicao.percentual_anterior)}</p></div>
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Executado nesta medição</p><p className="mt-1 text-base font-bold">{percent(medicao.percentual_total)}</p></div>
              <div className="rounded border p-3"><p className="text-[10px] uppercase text-slate-500">Percentual acumulado</p><p className="mt-1 text-base font-bold">{percent(percentualAcumulado)}</p></div>
            </section>

            <section className="mt-5">
              <h2 className="border-b-2 border-slate-800 pb-2 text-sm font-bold">ATIVIDADES MEDIDAS</h2>
              <table className="mt-3 w-full border-collapse">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="border p-2 text-center">Item</th>
                    <th className="border p-2">Discriminação</th>
                    <th className="border p-2 text-center">Un.</th>
                    <th className="border p-2 text-right">Qtd. contratada</th>
                    <th className="border p-2 text-right">Qtd. executada</th>
                    <th className="border p-2 text-right">Valor unitário</th>
                    <th className="border p-2 text-right">Valor medido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border p-2 text-center">{index + 1}</td>
                      <td className="border p-2">{item.descricao}</td>
                      <td className="border p-2 text-center">{item.unidade ?? "—"}</td>
                      <td className="border p-2 text-right">{Number(item.qtd_contratada ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="border p-2 text-right">{Number(item.qtd_executada ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="border p-2 text-right">{brl(item.valor_unitario)}</td>
                      <td className="border p-2 text-right font-medium">{brl(item.valor_total ?? Number(item.qtd_executada ?? 0) * Number(item.valor_unitario ?? 0))}</td>
                    </tr>
                  ))}
                  {data.itens.length === 0 && (
                    <tr><td colSpan={7} className="border p-5 text-center text-slate-500">Nenhum item registrado nesta medição.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={6} className="border p-2 text-right">TOTAL DA MEDIÇÃO</td>
                    <td className="border p-2 text-right">{brl(medicao.valor_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-8 border-t pt-4">
              <div>
                <h2 className="font-bold uppercase">Prazo de pagamento</h2>
                <p className="mt-1">Vencimento: <b>{dateBR(medicao.periodo_fim)}</b></p>
                <p className="text-slate-600">O pagamento corresponde ao valor medido no período acima.</p>
              </div>
              <div>
                <h2 className="font-bold uppercase">Situação da medição</h2>
                <p className="mt-1 capitalize">{medicao.status}</p>
              </div>
            </section>

            <section className="mt-5">
              <h2 className="border-b-2 border-slate-800 pb-2 text-sm font-bold">HISTÓRICO DE MEDIÇÕES</h2>
              <table className="mt-3 w-full border-collapse">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="border p-2">Medição</th>
                    <th className="border p-2">Período</th>
                    <th className="border p-2 text-right">% executado</th>
                    <th className="border p-2 text-right">% acumulado</th>
                    <th className="border p-2 text-right">Valor</th>
                    <th className="border p-2">Vencimento</th>
                    <th className="border p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.historico.map((registro, index) => {
                    const acumulado = data.historico
                      .slice(0, index + 1)
                      .reduce((total, item) => total + Number(item.percentual_total ?? 0), 0);
                    return (
                      <tr key={registro.id}>
                        <td className="border p-2 font-mono">{registro.numero}</td>
                        <td className="border p-2">{dateBR(registro.periodo_inicio)} a {dateBR(registro.periodo_fim)}</td>
                        <td className="border p-2 text-right">{percent(registro.percentual_total)}</td>
                        <td className="border p-2 text-right">{percent(acumulado)}</td>
                        <td className="border p-2 text-right">{brl(registro.valor_total)}</td>
                        <td className="border p-2">{dateBR(registro.periodo_fim)}</td>
                        <td className="border p-2 capitalize">{registro.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {medicao.observacoes && (
              <section className="mt-4 border-t pt-4">
                <h2 className="font-bold uppercase">Observações</h2>
                <p className="mt-1 whitespace-pre-wrap">{medicao.observacoes}</p>
              </section>
            )}

            <footer className="mt-14 grid grid-cols-2 gap-16 text-center">
              <div className="border-t pt-2">Responsável técnico</div>
              <div className="border-t pt-2">{data.cliente?.nome ?? "Cliente"}</div>
            </footer>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
