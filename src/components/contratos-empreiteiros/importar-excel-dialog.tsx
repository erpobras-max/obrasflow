import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { processarPlanilhaExcelContrato } from "@/lib/contratos-empreiteiros-importacao";
import type { ContratoItem } from "@/lib/contratos-empreiteiros.schema";

interface ImportarExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportar: (itens: ContratoItem[]) => void;
}

export function ImportarExcelDialog({
  open,
  onOpenChange,
  onImportar,
}: ImportarExcelDialogProps) {
  const [itensPreview, setItensPreview] = useState<ContratoItem[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  const handleArquivo = async (file: File) => {
    setNomeArquivo(file.name);
    setErros([]);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = processarPlanilhaExcelContrato(buffer);
      setItensPreview(resultado.itens);
      setErros(resultado.erros);
    } catch (err: any) {
      setErros([`Falha ao ler arquivo: ${err.message}`]);
    }
  };

  const handleConfirmar = () => {
    if (itensPreview.length > 0) {
      onImportar(itensPreview);
      setItensPreview([]);
      setErros([]);
      setNomeArquivo(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Importar Itens via Planilha Excel / CSV
          </DialogTitle>
          <DialogDescription>
            Carregue sua planilha (.xlsx ou .csv). As colunas são detectadas automaticamente: Descrição, Unidade, Quantidade e Preço Unitário.
          </DialogDescription>
        </DialogHeader>

        {itensPreview.length === 0 ? (
          <div className="py-8">
            <label className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors">
              <Upload className="h-10 w-10 text-slate-400 mb-3" />
              <span className="text-sm font-medium text-slate-700">
                Clique para selecionar ou arraste sua planilha aqui
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Formatos suportados: .xlsx, .xls, .csv
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleArquivo(file);
                }}
              />
            </label>

            {erros.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {erros.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  Arquivo <strong>{nomeArquivo}</strong>: {itensPreview.length} item(ns) identificados com sucesso.
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-emerald-800 hover:bg-emerald-100"
                onClick={() => {
                  setItensPreview([]);
                  setNomeArquivo(null);
                }}
              >
                Trocar arquivo
              </Button>
            </div>

            {erros.length > 0 && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Avisos: {erros.slice(0, 3).join("; ")}
                  {erros.length > 3 ? ` (+${erros.length - 3} avisos)` : ""}
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-16 text-center">Unid.</TableHead>
                    <TableHead className="w-20 text-right">Qtd.</TableHead>
                    <TableHead className="w-28 text-right">Preço Unit.</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensPreview.map((item, idx) => {
                    const preco = item.precoUnitarioCentavos / 100;
                    const total = (item.quantidadeContratada * item.precoUnitarioCentavos) / 100;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-slate-500">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-slate-900">{item.descricao}</div>
                          {item.etapa && (
                            <div className="text-[11px] text-slate-500">{item.etapa}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">{item.unidade}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {item.quantidadeContratada.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-slate-800">
                          {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t">
          <div className="text-xs text-slate-500">
            {itensPreview.length > 0 &&
              `Total: ${itensPreview
                .reduce((acc, i) => acc + (i.quantidadeContratada * i.precoUnitarioCentavos) / 100, 0)
                .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={itensPreview.length === 0}
              onClick={handleConfirmar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirmar Importação ({itensPreview.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

