import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmpresaLogo } from "@/components/empresa-logo";
import { supabase as client } from "@/integrations/supabase/client.custom";
import { Printer, X } from "lucide-react";

const supabase = client as any;

interface MedicaoRelatorioImprimirProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: any;
  medicao: any;
  itens: any[];
  empresa?: any;
}

export function MedicaoRelatorioImprimir({
  open,
  onOpenChange,
  contrato,
  medicao,
  itens,
  empresa,
}: MedicaoRelatorioImprimirProps) {
  const handlePrint = () => {
    window.print();
  };

  const bruto = Number(medicao?.valor_bruto_centavos || 0) / 100;
  const descontos = Number(medicao?.valor_descontos_centavos || 0) / 100;
  const amortizacao = Number(medicao?.valor_amortizacao_centavos || 0) / 100;
  const retencao = Number(medicao?.valor_retencao_centavos || 0) / 100;
  const liquido = Number(medicao?.valor_liquido_centavos || 0) / 100;

  // Carregar dados reais das medições deste boletim e histórico acumulado
  const { data: itensCompletos } = useQuery({
    queryKey: ["itens-relatorio-medicao", medicao?.id, contrato?.id],
    enabled: Boolean(open && medicao?.id),
    queryFn: async () => {
      // 1. Itens medidos deste boletim
      const { data: itensDesteBoletim } = await supabase
        .from("medicoes_terceirizados")
        .select("*")
        .eq("medicao_empreiteiro_id", medicao.id);

      const mapMedidos = new Map(
        (itensDesteBoletim || []).map((m: any) => [m.servico_id, m])
      );

      // 2. Acumulado de boletins anteriores aprovados
      const { data: anteriores } = await supabase
        .from("medicoes_empreiteiros")
        .select("id")
        .eq("contrato_empreiteiro_id", contrato.id)
        .lt("numero", medicao.numero)
        .in("status", ["aprovada", "paga"]);

      const idsAnt = (anteriores || []).map((m: any) => m.id);
      const mapQtdAnt = new Map<string, number>();
      if (idsAnt.length > 0) {
        const { data: itensAnt } = await supabase
          .from("medicoes_terceirizados")
          .select("servico_id, quantidade_executada")
          .in("medicao_empreiteiro_id", idsAnt);
        (itensAnt || []).forEach((ia: any) => {
          const prev = mapQtdAnt.get(ia.servico_id) || 0;
          mapQtdAnt.set(ia.servico_id, prev + Number(ia.quantidade_executada || 0));
        });
      }

      return (itens || []).map((it: any) => {
        const qtdContratada = Number(it.quantidadeContratada || it.quantidade_total || it.quantidade || 0);
        const precoUnitCentavos = Number(it.precoUnitarioCentavos || Math.round(Number(it.valor_unitario || 0) * 100));
        const precoUnit = precoUnitCentavos / 100;
        const regMed = mapMedidos.get(it.id);
        const qtdAtual = regMed ? Number(regMed.quantidade_executada || 0) : Number(it.quantidadeAtual || it.quantidadeMedida || 0);
        const qtdAnterior = mapQtdAnt.get(it.id) || Number(it.quantidadeAnterior || 0);
        const qtdAcumulada = qtdAnterior + qtdAtual;
        const saldoQtd = Math.max(0, qtdContratada - qtdAcumulada);
        const medidoValor = regMed && regMed.valor_centavos != null
          ? Number(regMed.valor_centavos) / 100
          : (qtdAtual * precoUnit);

        return {
          ...it,
          quantidadeContratada: qtdContratada,
          precoUnitarioCentavos: precoUnitCentavos,
          quantidadeAnterior: qtdAnterior,
          quantidadeAtual: qtdAtual,
          quantidadeAcumulada: qtdAcumulada,
          saldoQuantidade: saldoQtd,
          medidoValor,
        };
      });
    },
  });

  const listaItensExibir = itensCompletos || itens;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        {/* ESTILOS DE IMPRESSÃO A4 */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body * {
              visibility: hidden !important;
            }
            .printable-sheet,
            .printable-sheet * {
              visibility: visible !important;
            }
            .printable-sheet {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              border: none !important;
              box-shadow: none !important;
              overflow: visible !important;
              z-index: 999999 !important;
            }
            .no-print,
            button,
            [role="dialog"] > button {
              display: none !important;
            }
          }
        `}</style>
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <DialogTitle className="text-base flex items-center gap-2">
            <Printer className="h-4 w-4 text-blue-600" />
            Boletim de Medição de Empreiteiro — Relatório para Impressão
          </DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Folha A4 formatada para impressão */}
        <div className="flex-1 overflow-y-auto p-4 bg-white border rounded-md text-slate-800 text-xs printable-sheet">
          {/* Cabeçalho Construtora */}
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            <div className="flex items-center gap-3">
              <EmpresaLogo value={empresa?.logo_url} className="h-12 w-auto max-w-[140px] object-contain" />
              <div>
                <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                  {empresa?.nome_fantasia || empresa?.razao_social || "ObrasFlow Engenharia & Construções"}
                </h1>
                <p className="text-[11px] text-slate-500">
                  {empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : ""}
                  {empresa?.cidade ? ` • ${empresa.cidade}/${empresa.estado}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase font-semibold text-slate-400">Boletim de Medição</div>
              <div className="text-xl font-black text-blue-700">
                BM nº {String(medicao?.numero || 1).padStart(2, "0")}
              </div>
              <div className="text-[11px] text-slate-500">Contrato: {contrato?.numero}</div>
            </div>
          </div>

          {/* Dados da Obra e do Empreiteiro */}
          <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 border rounded-md">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Obra / Local:</div>
              <div className="font-semibold text-slate-900">{contrato?.obras?.nome}</div>
              <div className="text-[11px] text-slate-600">{contrato?.obras?.logradouro ? `${contrato.obras.logradouro}${contrato.obras.cidade ? ` • ${contrato.obras.cidade}/${contrato.obras.uf || ''}` : ''}` : '—'}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Objeto: <span className="text-slate-800">{contrato?.objeto}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Contratado / Empreiteiro:</div>
              <div className="font-semibold text-slate-900">
                {contrato?.fornecedores?.nome_fantasia || contrato?.fornecedores?.razao_social || '—'}
              </div>
              <div className="text-[11px] text-slate-600">
                {contrato?.fornecedores?.cnpj ? `CNPJ: ${contrato.fornecedores.cnpj}` : contrato?.fornecedores?.cpf ? `CPF: ${contrato.fornecedores.cpf}` : ''}
                {contrato?.fornecedores?.telefone ? ` • Tel: ${contrato.fornecedores.telefone}` : ""}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Período: {medicao?.periodo_inicio || "—"} a {medicao?.periodo_fim || "—"}
              </div>
            </div>
          </div>

          {/* Tabela de Itens Medidos */}
          <table className="w-full border-collapse text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 text-[11px] font-semibold text-slate-700">
                <th className="py-1.5 px-2 text-left w-8">#</th>
                <th className="py-1.5 px-2 text-left">Descrição do Serviço</th>
                <th className="py-1.5 px-1 text-center w-10">Un.</th>
                <th className="py-1.5 px-2 text-right w-16">Contrat.</th>
                <th className="py-1.5 px-2 text-right w-20">Unit. (R$)</th>
                <th className="py-1.5 px-2 text-right w-16">Ant.</th>
                <th className="py-1.5 px-2 text-right w-16 bg-blue-50">Atual</th>
                <th className="py-1.5 px-2 text-right w-20 bg-blue-50">Medido (R$)</th>
                <th className="py-1.5 px-2 text-right w-16">Acum.</th>
                <th className="py-1.5 px-2 text-right w-16">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {listaItensExibir.map((it, idx) => {
                const preco = Number(it.precoUnitarioCentavos || 0) / 100;
                const medidoValor = it.medidoValor !== undefined ? it.medidoValor : (Number(it.quantidadeAtual || it.quantidadeMedida || it.quantidade || 0) * preco);
                return (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-1.5 px-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-medium">
                      {it.descricao}
                      <span className="text-[10px] text-slate-400 ml-1">({it.etapa || "Geral"})</span>
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono text-[11px]">{it.unidade}</td>
                    <td className="py-1.5 px-2 text-right">{Number(it.quantidadeContratada || 0).toLocaleString("pt-BR")}</td>
                    <td className="py-1.5 px-2 text-right">{preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{Number(it.quantidadeAnterior || 0).toLocaleString("pt-BR")}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-blue-700 bg-blue-50/50">
                      {Number(it.quantidadeAtual || it.quantidadeMedida || 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-blue-700 bg-blue-50/50">
                      {medidoValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right">{Number(it.quantidadeAcumulada || 0).toLocaleString("pt-BR")}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{Number(it.saldoQuantidade || 0).toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Resumo Financeiro */}
          <div className="flex justify-end mb-8">
            <div className="w-72 border rounded-md p-3 bg-slate-50 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Bruto Medido:</span>
                <span className="font-semibold">{bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              {retencao > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>(-) Retenção Técnica:</span>
                  <span>-{retencao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              )}
              {amortizacao > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>(-) Amortização de Adiantamento:</span>
                  <span>-{amortizacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              )}
              {descontos > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>(-) Descontos Diversos:</span>
                  <span>-{descontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                <span>Valor Líquido a Pagar:</span>
                <span className="text-emerald-700">{liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            </div>
          </div>

          {/* Linhas de Assinatura */}
          <div className="grid grid-cols-2 gap-12 pt-8 mt-8 border-t border-slate-300">
            <div className="text-center">
              <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
              <div className="font-semibold text-xs text-slate-900">
                {empresa?.nome_fantasia || "ObrasFlow Engenharia & Construções"}
              </div>
              <div className="text-[10px] text-slate-500">Engenharia / Fiscalização da Obra</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
              <div className="font-semibold text-xs text-slate-900">
                {contrato?.fornecedores?.nome_fantasia || contrato?.fornecedores?.razao_social || '—'}
              </div>
              <div className="text-[10px] text-slate-500">Representante do Empreiteiro</div>
            </div>
          </div>
        </div>

        <DialogFooter className="no-print pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

