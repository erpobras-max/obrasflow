import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmpresaLogo } from "@/components/empresa-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Ruler,
  Building2,
  Calendar,
  CheckCircle2,
  Printer,
  Camera,
  AlertCircle,
  HardHat,
  FileText,
} from "lucide-react";
import { buscarDadosMedicaoPorToken } from "@/lib/medicao-empreiteiro-publica.functions";

export const Route = createFileRoute("/medicao-empreiteiro/$token")({
  component: MedicaoEmpreiteiroPublicaPage,
});

function MedicaoEmpreiteiroPublicaPage() {
  const { token } = Route.useParams();
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["medicao-publica-view", token],
    queryFn: () => buscarDadosMedicaoPorToken(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-slate-500 mt-3 font-medium">Carregando boletim de medição...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Link Inacessível</h2>
          <p className="text-xs text-slate-600 mt-2">
            {(error as any)?.message || "Este link de medição não foi encontrado, já expirou ou foi revogado pela administração."}
          </p>
          <div className="mt-6 text-xs text-slate-400">
            Entre em contato com a equipe de engenharia da construtora para solicitar um novo link.
          </div>
        </div>
      </div>
    );
  }

  const { medicao, contrato, itens, ajustes, anexos, empresa } = data;

  const bruto = Number(medicao.valor_bruto_centavos || 0) / 100;
  const deducoes =
    (Number(medicao.valor_descontos_centavos || 0) +
      Number(medicao.valor_amortizacao_centavos || 0) +
      Number(medicao.valor_retencao_centavos || 0) +
      Number(medicao.valor_tributos_centavos || 0)) /
    100;
  const liquido = Number(medicao.valor_liquido_centavos || 0) / 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
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
          button {
            display: none !important;
          }
        }
      `}</style>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Barra superior de ações */}
        <div className="flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <EmpresaLogo value={empresa?.logo_url} className="h-8 w-auto max-w-[120px] object-contain" />
            <span className="text-xs font-semibold text-slate-700">
              {empresa?.nome_fantasia || "ObrasFlow ERP"}
            </span>
          </div>
          <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Cartão Principal do Boletim */}
        <div className="bg-white border rounded-xl shadow-xs overflow-hidden printable-sheet medicao-print-sheet">
          {/* Header */}
          <div className="p-6 border-b bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-400">
                  Boletim de Medição de Empreiteiro
                </span>
                <Badge
                  variant="outline"
                  className={
                    medicao.status === "aprovada" || medicao.status === "paga"
                      ? "border-emerald-500 text-emerald-400 bg-emerald-950/50"
                      : "border-amber-500 text-amber-400 bg-amber-950/50"
                  }
                >
                  {medicao.status === "aprovada" ? "Aprovada" : medicao.status === "paga" ? "Paga" : "Em Análise"}
                </Badge>
              </div>
              <h1 className="text-2xl font-black mt-1">
                BM nº {String(medicao.numero).padStart(2, "0")} — {contrato.numero}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Objeto: {contrato.objeto}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-slate-400 font-medium">Valor Líquido da Medição</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-0.5">
                {liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              {medicao.data_vencimento && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Previsão de Pagamento: {medicao.data_vencimento}
                </div>
              )}
            </div>
          </div>

          {/* Dados da Obra e do Empreiteiro */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50/70 border-b text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Obra / Local:</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{contrato.obras?.nome}</div>
              <div className="text-slate-600 mt-0.5">{contrato.obras?.endereco || "Endereço não informado"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Contratado / Prestador:</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {contrato.fornecedores?.nome || contrato.fornecedores?.razao_social}
              </div>
              <div className="text-slate-600 mt-0.5">
                {contrato.fornecedores?.cnpj_cpf ? `Documento: ${contrato.fornecedores.cnpj_cpf}` : ""}
                {contrato.fornecedores?.telefone ? ` • Tel: ${contrato.fornecedores.telefone}` : ""}
              </div>
            </div>
          </div>

          {/* Tabela de Itens Medidos */}
          <div className="p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <HardHat className="h-4 w-4 text-blue-600" />
              Detalhamento dos Serviços Medidos
            </h2>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 text-xs">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Descrição do Serviço</TableHead>
                    <TableHead className="w-16 text-center">Un.</TableHead>
                    <TableHead className="w-24 text-right">Contratado</TableHead>
                    <TableHead className="w-24 text-right">Preço Unit.</TableHead>
                    <TableHead className="w-24 text-right bg-blue-50 text-blue-900">Qtd. Medida</TableHead>
                    <TableHead className="w-28 text-right bg-blue-50 text-blue-900 font-bold">
                      Valor Medido
                    </TableHead>
                    <TableHead className="w-24 text-right">Acumulado</TableHead>
                    <TableHead className="w-24 text-right">Saldo Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {itens.map((it: any, idx: number) => {
                    const servico = it.servicos_terceirizados;
                    const preco = Number(servico?.preco_unitario_centavos || 0) / 100;
                    const qtdMedida = Number(it.quantidade || 0);
                    const valorMedido = Number(it.valor_centavos || 0) / 100;

                    return (
                      <TableRow key={it.id}>
                        <TableCell className="text-slate-400 font-mono">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{servico?.descricao}</div>
                          {servico?.etapa && (
                            <div className="text-[10px] text-slate-400">{servico.etapa}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">{servico?.unidade}</TableCell>
                        <TableCell className="text-right">
                          {Number(servico?.quantidade_total || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700 bg-blue-50/40">
                          {qtdMedida.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700 bg-blue-50/40">
                          {valorMedido.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(it.quantidade_acumulada || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-slate-600">
                          {Number(it.saldo_quantidade || 0).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Resumo Financeiro */}
            <div className="flex justify-end mt-4">
              <div className="w-80 border rounded-lg p-4 bg-slate-50 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Valor Bruto Medido:</span>
                  <span className="font-bold text-slate-900">
                    {bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                {ajustes.map((aj: any, i: number) => (
                  <div key={i} className="flex justify-between text-rose-600">
                    <span>(-) {aj.descricao}:</span>
                    <span>
                      -
                      {(Number(aj.valor_centavos || 0) / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-extrabold text-sm text-slate-900">
                  <span>Valor Líquido a Receber:</span>
                  <span className="text-emerald-600">
                    {liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Galeria de Fotos / Evidências */}
            {anexos.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  Evidências Fotográficas da Medição ({anexos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {anexos.map((anexo: any) => (
                    <div
                      key={anexo.id}
                      className="border rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setFotoAmpliada(anexo.url)}
                    >
                      <div
                        className="h-32 w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${anexo.url})` }}
                      />
                      <div className="p-2 text-[10px] text-slate-600 truncate bg-white">
                        {anexo.nome_arquivo}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="text-center text-xs text-slate-400 py-4">
          Emitido via ObrasFlow ERP • Documento de controle físico-financeiro
        </div>
      </div>

      {/* Lightbox / Foto Ampliada */}
      {fotoAmpliada && (
        <Dialog open={Boolean(fotoAmpliada)} onOpenChange={() => setFotoAmpliada(null)}>
          <DialogContent className="max-w-4xl p-2 bg-black/90 border-0 flex flex-col items-center justify-center">
            <img
              src={fotoAmpliada}
              alt="Evidência ampliada"
              className="max-h-[85vh] w-auto object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

