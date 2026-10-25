import React from "react";
import type { DadosProjetoBIM, ConfiguracaoBDI } from "@/types/projeto3d";
import {
  calcularQuantitativosBIM,
  formatarMoeda,
  formatarM2,
  formatarMetros,
} from "@/lib/projeto3d.utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Building,
  Calendar,
  MapPin,
  User,
  ShieldCheck,
  FileText,
  CheckCircle2,
  HardHat,
  Info,
} from "lucide-react";

interface DossieTecnicoViewProps {
  obra: any;
  dados: DadosProjetoBIM;
  configBdi: ConfiguracaoBDI;
  fotoCapa: string | null;
}

export function DossieTecnicoView({
  obra,
  dados,
  configBdi,
  fotoCapa,
}: DossieTecnicoViewProps) {
  const resumo = calcularQuantitativosBIM(dados, configBdi);
  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleImprimir = () => {
    window.print();
  };

  const enderecoCompleto = [
    obra?.logradouro,
    obra?.numero_end,
    obra?.bairro,
    obra?.cidade ? `${obra.cidade} - ${obra.uf || ""}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="h-full bg-slate-200/70 p-4 lg:p-8 overflow-y-auto">
      {/* Barra Superior de Ações do Documento (Ocultada na Impressão) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Dossiê Técnico & Memorial Descritivo
          </h2>
          <p className="text-xs text-slate-500">
            Documento executivo pronto para apresentação e impressão para o cliente final.
          </p>
        </div>

        <Button onClick={handleImprimir} className="gap-2 shadow-sm font-medium">
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </Button>
      </div>

      {/* Alerta de Obra sem paredes modeladas */}
      {dados.paredes.length === 0 && (
        <div className="max-w-4xl mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-3 print:hidden">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Obra em modelagem inicial:</strong> Esta obra ainda não possui paredes traçadas. As tabelas de áreas e quantitativos abaixo refletem o estado zerado. Desenhe a planta no estúdio 2D para popular o memorial técnico automaticamente.
          </div>
        </div>
      )}

      {/* Container das Páginas Estilo Folha A4 */}
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-0 print:max-w-none">
        {/* ========================================================== */}
        {/* PÁGINA 1: CAPA DE ALTO PADRÃO */}
        {/* ========================================================== */}
        <div className="bg-white rounded-lg shadow-md p-10 min-h-[1050px] flex flex-col justify-between border border-slate-200 print:shadow-none print:border-none print:p-8 print:m-0 print:break-after-page">
          {/* Topo da Capa */}
          <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                ObrasFlow ERP
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                Engenharia & Construção Civil
              </div>
            </div>
            <Badge className="bg-slate-900 text-white font-mono text-xs px-3 py-1">
              PROJETO #{obra?.numero || "OBRA"}
            </Badge>
          </div>

          {/* Imagem 3D Principal da Fachada / Maquete */}
          <div className="my-6">
            <div className="w-full h-[400px] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center relative">
              {fotoCapa ? (
                <img
                  src={fotoCapa}
                  alt="Maquete 3D da Obra"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-8 text-slate-400 space-y-3">
                  <Building className="w-16 h-16 mx-auto opacity-40 text-slate-500" />
                  <p className="text-sm font-medium">Maquete Arquitetônica 3D</p>
                  <span className="text-xs text-slate-400 block">
                    (Dica: Vá na aba 3D e clique em "Capturar para Capa" para fixar o render da sua maquete aqui)
                  </span>
                </div>
              )}

              <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-3 py-1 rounded-md font-mono">
                Modelagem Paramétrica BIM
              </div>
            </div>
          </div>

          {/* Título da Obra */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-primary uppercase tracking-wider">
              Dossiê Técnico & Caderno de Encargos
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
              {obra?.nome || "Projeto Residencial"}
            </h1>
            <p className="text-sm text-slate-600">
              Memorial descritivo de materiais, levantamento de quantitativos, memória de cálculo e planilha orçamentária executiva.
            </p>
          </div>

          {/* Rodapé da Capa com Metadados Oficiais */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Local da Obra:
              </div>
              <p className="pl-5 text-slate-600">{enderecoCompleto || "Endereço em cadastramento"}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Data de Emissão:
              </div>
              <p className="pl-5 text-slate-600">{dataHoje}</p>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* PÁGINA 2: QUADRO GERAL DE ÁREAS & ESPECIFICAÇÕES */}
        {/* ========================================================== */}
        <div className="bg-white rounded-lg shadow-md p-10 min-h-[1050px] border border-slate-200 print:shadow-none print:border-none print:p-8 print:m-0 print:break-after-page space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Dossiê Técnico • Seção 01
            </div>
            <div className="text-xs text-slate-500 font-mono">Página 02</div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">1. Resumo Executivo & Parâmetros Físicos</h2>
            <p className="text-xs text-slate-500 mt-1">
              Informações métricas extraídas diretamente da modelagem da planta baixa e elevações.
            </p>
          </div>

          {/* Quadro de Áreas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Área Construída (Útil)</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {formatarM2(resumo.areaTotalPisos)}
              </div>
              <span className="text-[10px] text-slate-400">Soma dos cômodos</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Área de Cobertura</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {formatarM2(resumo.areaTotalCobertura)}
              </div>
              <span className="text-[10px] text-slate-400">Com beirais e inclinação</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Paredes (Alvenaria Líquida)</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {formatarM2(resumo.areaTotalAlvenariaLiquida)}
              </div>
              <span className="text-[10px] text-slate-400">Descontando portas e janelas</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Pé-Direito Padrão</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {formatarMetros(dados.config.peDireito)}
              </div>
              <span className="text-[10px] text-slate-400">Piso ao forro</span>
            </div>
          </div>

          {/* Tabela de Ambientes e Acabamentos */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              2. Ficha de Ambientes e Acabamentos Previstos
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Ambiente / Cômodo</th>
                    <th className="p-3 text-right">Área</th>
                    <th className="p-3 text-right">Perímetro</th>
                    <th className="p-3">Piso Especificado</th>
                    <th className="p-3">Parede / Pintura</th>
                    <th className="p-3">Teto / Forro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dados.ambientes.map((amb) => (
                    <tr key={amb.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{amb.nome}</td>
                      <td className="p-3 text-right font-mono font-semibold">{amb.area.toFixed(2)} m²</td>
                      <td className="p-3 text-right font-mono text-slate-600">{amb.perimetro.toFixed(2)} m</td>
                      <td className="p-3 text-slate-700">{amb.pisoAcabamento || "Porcelanato Retificado 84x84"}</td>
                      <td className="p-3 text-slate-700">{amb.paredeAcabamento || "Pintura acrílica"}</td>
                      <td className="p-3 text-slate-700">{amb.tetoAcabamento || "Forro de Gesso c/ Pintura"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Especificações das Esquadrias */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              3. Relação de Esquadrias (Portas & Janelas)
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Portas de Madeira / Alumínio</span>
                  <Badge variant="outline">{resumo.totalPortas} un</Badge>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Portas de passagem com acabamento em pintura esmalte ou laca, incluindo fechaduras e alizares.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Janelas em Alumínio / Vidro</span>
                  <Badge variant="outline">{resumo.totalJanelas} un</Badge>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Esquadrias de alumínio linha Suprema/Gold com vidro float 6mm incolor e pingadeiras.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* PÁGINA 3: PLANILHA ORÇAMENTÁRIA & BDI */}
        {/* ========================================================== */}
        <div className="bg-white rounded-lg shadow-md p-10 min-h-[1050px] border border-slate-200 print:shadow-none print:border-none print:p-8 print:m-0 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Dossiê Técnico • Seção 02
            </div>
            <div className="text-xs text-slate-500 font-mono">Página 03</div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">4. Planilha Orçamentária com BDI</h2>
            <p className="text-xs text-slate-500 mt-1">
              Demonstrativo de custos diretos, memória de cálculo e aplicação de taxa de BDI.
            </p>
          </div>

          {/* Tabela Sintética de Custos */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Código</th>
                  <th className="p-2.5">Serviço / Composição</th>
                  <th className="p-2.5 text-right">Qtd.</th>
                  <th className="p-2.5 text-right">Preço Unit.</th>
                  <th className="p-2.5 text-right">Custo Direto</th>
                  <th className="p-2.5 text-right font-bold">Total c/ BDI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumo.itens.map((item) => {
                  const subtotal = item.quantidade * item.precoUnitario;
                  const totalComBdi = subtotal * (1 + resumo.bdiTaxa / 100);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-slate-500">{item.codigo}</td>
                      <td className="p-2.5 font-medium text-slate-900">
                        {item.descricao}
                        <div className="text-[10px] text-slate-400 font-mono">{item.memoriaCalculo}</div>
                      </td>
                      <td className="p-2.5 text-right font-mono font-medium">
                        {item.quantidade.toFixed(2)} {item.unidade}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        {formatarMoeda(item.precoUnitario)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {formatarMoeda(subtotal)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatarMoeda(totalComBdi)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quadro de Demonstração do BDI */}
          <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Demonstrativo de Composição da Taxa de BDI ({resumo.bdiTaxa.toFixed(2)}%)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Lucro Líquido:</span>
                <div className="font-semibold text-slate-900 font-mono">{configBdi.lucroLiquido.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-slate-500">Impostos / Tributos:</span>
                <div className="font-semibold text-slate-900 font-mono">{configBdi.impostos.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-slate-500">Adm. Central:</span>
                <div className="font-semibold text-slate-900 font-mono">{configBdi.administracaoCentral.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-slate-500">Custos Indiretos:</span>
                <div className="font-semibold text-slate-900 font-mono">{configBdi.custoIndiretoObra.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-slate-500">Riscos / Contingência:</span>
                <div className="font-semibold text-slate-900 font-mono">{configBdi.contingencia.toFixed(1)}%</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-sm">
              <div className="text-slate-600">
                Custo Direto: <span className="font-mono font-semibold">{formatarMoeda(resumo.custoDiretoTotal)}</span> + BDI: <span className="font-mono font-semibold">{formatarMoeda(resumo.valorBdiTotal)}</span>
              </div>
              <div className="text-base font-extrabold text-primary font-mono">
                VALOR TOTAL DA OBRA: {formatarMoeda(resumo.precoVendaTotal)}
              </div>
            </div>
          </div>

          {/* Campo de Assinaturas */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
            <div className="space-y-1">
              <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
                {obra?.nome || "Responsável Técnico"}
              </div>
              <p className="text-[11px] text-slate-500">Engenharia / Construtora</p>
            </div>

            <div className="space-y-1">
              <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
                Contratante / Cliente Final
              </div>
              <p className="text-[11px] text-slate-500">De acordo com o memorial</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

