import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmpresaLogo } from "@/components/empresa-logo";
import { supabase as client } from "@/integrations/supabase/client.custom";
import { Printer, CheckCircle2 } from "lucide-react";
import { valorPorExtenso } from "@/lib/extenso";

const supabase = client as any;

export interface ContaReciboData {
  id: string;
  tipo: "receber" | "pagar";
  descricao: string;
  obra_id?: string | null;
  obra_nome?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_documento?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  fornecedor_documento?: string | null;
  valor_total: number; // centavos
  valor_liquidado?: number | null; // centavos (recebido ou pago)
  data_vencimento: string;
  data_liquidacao?: string | null; // data_recebimento ou data_pagamento
  forma_pagamento?: string | null;
  numero_documento?: string | null;
  conta_bancaria_nome?: string | null;
  etapa_nome?: string | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
}

interface ReciboFinanceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaReciboData | null;
  empresa?: any;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatarDataExtenso(dataStr?: string | null): string {
  if (!dataStr) return "";
  const parts = dataStr.slice(0, 10).split("-");
  if (parts.length < 3) return dataStr;
  const dia = parseInt(parts[2], 10);
  const mes = MESES[parseInt(parts[1], 10) - 1] || "";
  const ano = parts[0];
  return `${dia} de ${mes} de ${ano}`;
}

function formatarDataBR(dataStr?: string | null): string {
  if (!dataStr) return "—";
  const parts = dataStr.slice(0, 10).split("-");
  if (parts.length < 3) return dataStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function ReciboFinanceiroDialog({
  open,
  onOpenChange,
  conta,
  empresa: empresaProp,
}: ReciboFinanceiroDialogProps) {
  // Carregar dados da empresa se não vierem via props
  const { data: empresaDb } = useQuery({
    queryKey: ["empresa-config-recibo"],
    enabled: open && !empresaProp,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_configuracoes")
        .select("*")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const empresa = empresaProp || empresaDb;

  if (!conta) return null;

  const handlePrint = () => {
    window.print();
  };

  const ehReceber = conta.tipo === "receber";
  const valorEfetivoCentavos =
    conta.valor_liquidado ?? conta.valor_total ?? 0;
  const valorReais = Number(valorEfetivoCentavos) / 100;
  const extenso = valorPorExtenso(valorEfetivoCentavos, true);

  const numeroRecibo = ehReceber
    ? `REC-${conta.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : `PAG-${conta.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const dataLiquidacao = conta.data_liquidacao || conta.data_vencimento;
  const dataHojeStr = new Date().toISOString().slice(0, 10);
  const cidadeEmpresa = empresa?.cidade || "Localidade";
  const ufEmpresa = empresa?.uf ? `/${empresa.uf}` : "";

  const nomeContraparte = ehReceber
    ? conta.cliente_nome || "Cliente Consumidor"
    : conta.fornecedor_nome || "Fornecedor / Prestador";

  const docContraparte = ehReceber
    ? conta.cliente_documento
    : conta.fornecedor_documento;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        {/* CSS para Impressão A4 sem margens indesejadas */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
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
            .printable-receipt,
            .printable-receipt * {
              visibility: visible !important;
            }
            .printable-receipt {
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
            <Printer className="h-4 w-4 text-primary" />
            {ehReceber ? "Recibo de Recebimento" : "Comprovante de Quitação"} — {numeroRecibo}
          </DialogTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Folha do Recibo */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border rounded-md text-slate-800 text-sm printable-receipt font-sans">
          {/* Cabeçalho */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
            <div className="flex items-center gap-4">
              {empresa?.logo_url && (
                <EmpresaLogo value={empresa.logo_url} className="h-16 max-w-44 object-contain" />
              )}
              <div>
                <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {empresa?.razao_social || empresa?.nome_fantasia || "ObrasFlow Engenharia & Construções"}
                </h1>
                <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                  {empresa?.cnpj && <div>CNPJ: <span className="font-medium text-slate-800">{empresa.cnpj}</span></div>}
                  {empresa?.crea_cau && (
                    <div>CREA/CAU: <span className="font-medium text-slate-800">{empresa.crea_cau}</span></div>
                  )}
                  {(empresa?.logradouro || empresa?.cidade) && (
                    <div>
                      {empresa?.logradouro ? `${empresa.logradouro}, ${empresa.numero || "S/N"}` : ""}
                      {empresa?.bairro ? ` - ${empresa.bairro}` : ""}
                      {empresa?.cidade ? ` - ${empresa.cidade}${ufEmpresa}` : ""}
                    </div>
                  )}
                  {(empresa?.telefone || empresa?.email) && (
                    <div>
                      {empresa?.telefone ? `Tel: ${empresa.telefone}` : ""}
                      {empresa?.email ? ` • E-mail: ${empresa.email}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-slate-100 rounded text-[11px] font-bold uppercase tracking-wider text-slate-700 border mb-2">
                {ehReceber ? "Recibo de Pagamento" : "Comprovante de Quitação"}
              </div>
              <div className="text-base font-mono font-bold text-slate-900">
                {numeroRecibo}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2 bg-slate-50 px-3 py-1 rounded border border-slate-300">
                {valorReais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>

          {/* Corpo do Recibo */}
          <div className="space-y-4 my-6">
            {/* Texto de Valor por Extenso */}
            <div className="p-3 bg-slate-50 border rounded text-slate-800 leading-relaxed">
              <span className="font-semibold text-xs uppercase text-slate-500 block mb-1">
                Valor por Extenso:
              </span>
              <span className="font-serif italic font-bold capitalize text-slate-950">
                ({extenso})
              </span>
            </div>

            {/* Partes Envolvidas */}
            <div className="grid grid-cols-2 gap-4 border rounded p-4 bg-white">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  {ehReceber ? "Recebemos de (Pagador):" : "Pago a (Beneficiário):"}
                </span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {nomeContraparte}
                </div>
                {docContraparte && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    CPF/CNPJ: <span className="font-mono">{docContraparte}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  {ehReceber ? "Emitente (Favorecido):" : "Empresa Pagadora:"}
                </span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {empresa?.razao_social || empresa?.nome_fantasia || "ObrasFlow Engenharia & Construções"}
                </div>
                {empresa?.cnpj && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    CNPJ: <span className="font-mono">{empresa.cnpj}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Referência e Objeto */}
            <div className="border rounded p-4 bg-white space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Referente a:
              </span>
              <div className="font-semibold text-slate-900">
                {conta.descricao}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t">
                {conta.obra_nome && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Obra:</span>
                    <span className="font-medium text-slate-800">{conta.obra_nome}</span>
                  </div>
                )}
                {conta.etapa_nome && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Etapa / Centro:</span>
                    <span className="font-medium text-slate-800">{conta.etapa_nome}</span>
                  </div>
                )}
                {conta.parcela_atual && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Parcela:</span>
                    <span className="font-medium text-slate-800">
                      {conta.parcela_atual} de {conta.total_parcelas || conta.parcela_atual}
                    </span>
                  </div>
                )}
                {conta.forma_pagamento && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Forma Pagto:</span>
                    <span className="font-medium text-slate-800 uppercase">{conta.forma_pagamento}</span>
                  </div>
                )}
                {dataLiquidacao && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Data Liquidação:</span>
                    <span className="font-medium text-slate-800">{formatarDataBR(dataLiquidacao)}</span>
                  </div>
                )}
                {conta.numero_documento && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nº Documento / NF:</span>
                    <span className="font-medium text-slate-800 font-mono">{conta.numero_documento}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Declaração de Quitação */}
            <div className="p-3 bg-slate-50 border rounded text-xs text-slate-600 leading-relaxed italic">
              {ehReceber ? (
                <>
                  Damos por este instrumento plena, rasa, geral e irrevogável quitação da quantia acima
                  mencionada, referente aos serviços ou fornecimentos discriminados, nada mais havendo a
                  reclamar a respeito do valor liquidado.
                </>
              ) : (
                <>
                  Declaro(amos) ter recebido da empresa qualificada a quantia integral estipulada neste recibo,
                  dando plena, geral e irrevogável quitação do valor correspondente, declarando satisfeitos os
                  direitos concernentes à presente quitação.
                </>
              )}
            </div>

            {/* Cidade e Data */}
            <div className="text-right text-xs text-slate-700 pt-2">
              {cidadeEmpresa}{ufEmpresa}, {formatarDataExtenso(dataLiquidacao || dataHojeStr)}.
            </div>
          </div>

          {/* Assinaturas */}
          <div className="grid grid-cols-2 gap-12 pt-10 mt-8 border-t border-slate-200">
            {ehReceber ? (
              <>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-4/5 mx-auto mb-1.5"></div>
                  <div className="font-bold text-xs text-slate-900">
                    {empresa?.razao_social || empresa?.nome_fantasia || "ObrasFlow Engenharia & Construções"}
                  </div>
                  <div className="text-[11px] text-slate-500">Emitente / Responsável Financeiro</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-4/5 mx-auto mb-1.5"></div>
                  <div className="font-bold text-xs text-slate-900">
                    {nomeContraparte}
                  </div>
                  <div className="text-[11px] text-slate-500">Cliente / Pagador</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-4/5 mx-auto mb-1.5"></div>
                  <div className="font-bold text-xs text-slate-900">
                    {nomeContraparte}
                  </div>
                  <div className="text-[11px] text-slate-500">Favorecido / Recebedor</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-4/5 mx-auto mb-1.5"></div>
                  <div className="font-bold text-xs text-slate-900">
                    {empresa?.razao_social || empresa?.nome_fantasia || "ObrasFlow Engenharia & Construções"}
                  </div>
                  <div className="text-[11px] text-slate-500">Pagador / Departamento Financeiro</div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="no-print pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
