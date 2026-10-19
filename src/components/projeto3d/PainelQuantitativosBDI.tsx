import { useState } from "react";
import type { DadosProjetoBIM, ConfiguracaoBDI } from "@/types/projeto3d";
import {
  calcularQuantitativosBIM,
  formatarMoeda,
  BDI_PADRAO_INICIAL,
} from "@/lib/projeto3d.utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calculator,
  Percent,
  Coins,
  FileCheck2,
  TrendingUp,
  RotateCcw,
  Info,
} from "lucide-react";

interface PainelQuantitativosBDIProps {
  dados: DadosProjetoBIM;
  configBdi: ConfiguracaoBDI;
  onChangeBdi: (novaConfig: ConfiguracaoBDI) => void;
  somenteLeitura?: boolean;
}

export function PainelQuantitativosBDI({
  dados,
  configBdi,
  onChangeBdi,
  somenteLeitura = false,
}: PainelQuantitativosBDIProps) {
  const resumo = calcularQuantitativosBIM(dados, configBdi);

  const handleUpdateCampo = (campo: keyof ConfiguracaoBDI, valorStr: string) => {
    const valor = parseFloat(valorStr) || 0;
    onChangeBdi({
      ...configBdi,
      [campo]: valor,
    });
  };

  const handleResetarBdi = () => {
    onChangeBdi(BDI_PADRAO_INICIAL);
  };

  return (
    <div className="h-full bg-slate-50/50 p-4 lg:p-6 overflow-y-auto space-y-6">
      {/* Aviso informativo caso o projeto esteja em branco */}
      {dados.paredes.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs shadow-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Obra sem paredes modeladas:</strong> Os quantitativos e orçamentos abaixo estão zerados porque ainda não há paredes desenhadas nesta obra. Alterne para a aba <strong>Planta Baixa (2D)</strong> para traçar os cômodos ou importe um arquivo DXF para calcular os materiais automaticamente.
          </div>
        </div>
      )}

      {/* 1. Cards de Resumo Financeiro com BDI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Custo Direto (Materiais + MO)</span>
              <Coins className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {formatarMoeda(resumo.custoDiretoTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Calculado a partir das áreas do 3D</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Taxa de BDI Aplicada</span>
              <Percent className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
              {resumo.bdiTaxa.toFixed(2)}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Lucro + Impostos + Indiretos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Valor do BDI (Margem Bruta)</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
              {formatarMoeda(resumo.valorBdiTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Margem operacional da construtora</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 shadow-xs bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-primary text-xs font-semibold">
              <span>Preço Total da Obra</span>
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary mt-2 font-mono">
              {formatarMoeda(resumo.precoVendaTotal)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Valor do Dossiê & Proposta</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Painel de Parametrização do BDI */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Parâmetros de BDI Privado (Construtora)
            </CardTitle>
            <CardDescription className="text-xs">
              Ajuste as margens de lucro, impostos e custos indiretos específicos desta obra.
            </CardDescription>
          </div>

          {!somenteLeitura && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-8 text-slate-600"
              onClick={handleResetarBdi}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Padrão (31.5%)
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Lucro Líquido (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.lucroLiquido}
                onChange={(e) => handleUpdateCampo("lucroLiquido", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Meta líquida da empresa</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Impostos sobre Venda (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.impostos}
                onChange={(e) => handleUpdateCampo("impostos", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Simples / Presumido</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Adm. Central (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.administracaoCentral}
                onChange={(e) => handleUpdateCampo("administracaoCentral", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Escritório & gestão</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Custo Indireto da Obra (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.custoIndiretoObra}
                onChange={(e) => handleUpdateCampo("custoIndiretoObra", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Canteiro, EPIs, água/luz</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Contingência e Riscos (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.contingencia}
                onChange={(e) => handleUpdateCampo("contingencia", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Imprevistos e variações</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tabela de Quantitativos & Memória de Cálculo Auditável */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Memória de Cálculo e Quantitativos BIM
              </CardTitle>
              <CardDescription className="text-xs">
                Quantidades extraídas das paredes, vãos e ambientes com referências SINAPI.
              </CardDescription>
            </div>

            <Badge variant="outline" className="text-xs gap-1.5 text-slate-600 font-normal">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Desconto real de vãos: {resumo.areaTotalVaos.toFixed(2)} m²
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-20">Item</TableHead>
                <TableHead className="w-28">Ref. SINAPI</TableHead>
                <TableHead>Descrição do Serviço / Composição</TableHead>
                <TableHead>Memória de Cálculo (Fórmula)</TableHead>
                <TableHead className="text-right w-24">Qtd.</TableHead>
                <TableHead className="text-right w-28">Preço Unit.</TableHead>
                <TableHead className="text-right w-32">Subtotal Direto</TableHead>
                <TableHead className="text-right w-32 font-semibold">Total c/ BDI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.itens.map((item) => {
                const subtotal = item.quantidade * item.precoUnitario;
                const totalComBdi = subtotal * (1 + resumo.bdiTaxa / 100);

                return (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell className="font-mono font-medium text-slate-700">
                      {item.codigo}
                    </TableCell>
                    <TableCell>
                      {item.codigoSinapi ? (
                        <Badge variant="secondary" className="font-mono text-[11px] font-normal">
                          #{item.codigoSinapi}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {item.descricao}
                    </TableCell>
                    <TableCell className="text-slate-500 text-[11px] font-mono">
                      {item.memoriaCalculo}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.quantidade.toFixed(2)} {item.unidade}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-600">
                      {formatarMoeda(item.precoUnitario)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {formatarMoeda(subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatarMoeda(totalComBdi)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
