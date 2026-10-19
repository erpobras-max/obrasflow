import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { DadosProjetoBIM, ObraProjetoCadRow, ConfiguracaoBDI } from "@/types/projeto3d";
import {
  PROJETO_PADRAO_INICIAL,
  BDI_PADRAO_INICIAL,
  calcularQuantitativosBIM,
  formatarMoeda,
} from "@/lib/projeto3d.utils";
import { CanvasPlanta2D } from "./CanvasPlanta2D";
import { Viewport3D, type Viewport3DHandle } from "./Viewport3D";
import { PainelQuantitativosBDI } from "./PainelQuantitativosBDI";
import { DossieTecnicoView } from "./DossieTecnicoView";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Save,
  Boxes,
  Compass,
  FileSpreadsheet,
  Building,
  Calculator,
  Coins,
  FileText,
} from "lucide-react";

interface EstudioProjeto3DProps {
  obraId: string;
}

export function EstudioProjeto3D({ obraId }: EstudioProjeto3DProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const viewport3DRef = useRef<Viewport3DHandle>(null);

  const [abaAtiva, setAbaAtiva] = useState<"2d" | "3d" | "elementos" | "quantitativos" | "dossie">("2d");
  const [dadosProjeto, setDadosProjeto] = useState<DadosProjetoBIM | null>(null);
  const [fotoCapa, setFotoCapa] = useState<string | null>(null);
  const [configBdi, setConfigBdi] = useState<ConfiguracaoBDI>(BDI_PADRAO_INICIAL);

  // 1. Buscar Dados da Obra
  const { data: obra, isLoading: loadingObra } = useQuery({
    queryKey: ["obra_detalhe", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, numero, nome, descricao, status, cliente_id, logradouro, numero_end, bairro, cidade, uf")
        .eq("id", obraId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // 2. Buscar Projeto CAD / BIM da Obra
  const { data: projetoCad, isLoading: loadingProjeto } = useQuery({
    queryKey: ["obra_projeto_cad", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_projetos_cad")
        .select("*")
        .eq("obra_id", obraId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setDadosProjeto(data.dados_projeto as DadosProjetoBIM);
        setFotoCapa(data.foto_capa_3d);
        if (data.config_bdi) {
          setConfigBdi(data.config_bdi as ConfiguracaoBDI);
        }
        return data as ObraProjetoCadRow;
      } else {
        setDadosProjeto(PROJETO_PADRAO_INICIAL);
        setConfigBdi(BDI_PADRAO_INICIAL);
        return null;
      }
    },
  });

  // 3. Mutação para Salvar Projeto no Banco
  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!dadosProjeto) return;

      const quantitativos = calcularQuantitativosBIM(dadosProjeto, configBdi);

      const payload = {
        obra_id: obraId,
        titulo: `Projeto 3D - ${obra?.nome || "Obra"}`,
        dados_projeto: dadosProjeto,
        foto_capa_3d: fotoCapa,
        config_bdi: configBdi,
        quantitativos_calculados: quantitativos,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (projetoCad?.id) {
        const { error } = await supabase
          .from("obra_projetos_cad")
          .update(payload)
          .eq("id", projetoCad.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("obra_projetos_cad")
          .insert({
            ...payload,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_projeto_cad", obraId] });
      toast.success("Projeto, quantitativos e BDI salvos com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar projeto: ${err.message}`);
    },
  });

  const handleCapturaFotoCapa = (base64: string) => {
    setFotoCapa(base64);
    toast.success("Foto capturada! Salve o projeto para confirmar.");
  };

  if (loadingObra || loadingProjeto || !dadosProjeto) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    );
  }

  // Estatísticas rápidas
  const totalParedes = dadosProjeto.paredes.length;
  const totalAberturas = dadosProjeto.aberturas.length;
  const resumoFinanceiro = calcularQuantitativosBIM(dadosProjeto, configBdi);

  return (
    <div className="flex flex-col h-[calc(100vh-4.2rem)] bg-slate-100 overflow-hidden">
      {/* Barra Superior do Estúdio (Header) */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600 hover:text-slate-900">
            <Link to="/obras">
              <ArrowLeft className="w-4 h-4" /> Obras
            </Link>
          </Button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            <span className="font-semibold text-slate-900 text-sm">{obra?.nome}</span>
            <Badge variant="outline" className="text-xs font-mono font-normal">
              #{obra?.numero}
            </Badge>
          </div>
        </div>

        {/* Resumo Rápido de Custos e Áreas */}
        <div className="hidden lg:flex items-center gap-5 text-xs text-slate-500">
          <div>
            Paredes: <span className="font-semibold text-slate-800">{totalParedes}</span>
          </div>
          <div>
            Aberturas: <span className="font-semibold text-slate-800">{totalAberturas}</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            Custo Direto:{" "}
            <span className="font-semibold font-mono text-slate-800">
              {formatarMoeda(resumoFinanceiro.custoDiretoTotal)}
            </span>
          </div>
          <div>
            Total c/ BDI:{" "}
            <span className="font-bold font-mono text-primary">
              {formatarMoeda(resumoFinanceiro.precoVendaTotal)}
            </span>
          </div>
        </div>

        {/* Ações: Foto da Capa & Salvar */}
        <div className="flex items-center gap-2">
          {fotoCapa && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 mr-2">
              <img
                src={fotoCapa}
                alt="Foto Capa 3D"
                className="w-7 h-7 rounded object-cover border border-slate-200 shadow-2xs"
              />
              <span className="text-[11px] font-medium text-emerald-600">Capa 3D ativa</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending}
            className="gap-1.5 font-medium shadow-xs"
          >
            <Save className="w-4 h-4" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar Projeto"}
          </Button>
        </div>
      </header>

      {/* Navegação de Abas do Estúdio */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex items-center justify-between">
        <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as any)} className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="bg-slate-100 p-0.5">
              <TabsTrigger value="2d" className="gap-1.5 text-xs px-3 py-1.5">
                <Compass className="w-3.5 h-3.5" /> Planta Baixa (2D)
              </TabsTrigger>
              <TabsTrigger value="3d" className="gap-1.5 text-xs px-3 py-1.5">
                <Boxes className="w-3.5 h-3.5" /> Maquete Interativa (3D)
              </TabsTrigger>
              <TabsTrigger value="quantitativos" className="gap-1.5 text-xs px-3 py-1.5 font-semibold text-slate-900">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Quantitativos & BDI
              </TabsTrigger>
              <TabsTrigger value="dossie" className="gap-1.5 text-xs px-3 py-1.5 font-semibold text-primary">
                <FileText className="w-3.5 h-3.5 text-primary" /> Dossiê Técnico (PDF)
              </TabsTrigger>
              <TabsTrigger value="elementos" className="gap-1.5 text-xs px-3 py-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Ambientes
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Coins className="w-3 h-3 text-emerald-600" /> BDI {resumoFinanceiro.bdiTaxa.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Conteúdo Principal das Abas */}
      <div className="flex-1 p-3 overflow-hidden">
        {abaAtiva === "2d" && (
          <CanvasPlanta2D
            dados={dadosProjeto}
            onChangeDados={(novos) => setDadosProjeto(novos)}
          />
        )}

        {abaAtiva === "3d" && (
          <Viewport3D
            ref={viewport3DRef}
            dados={dadosProjeto}
            onCapturarFotoParaCapa={handleCapturaFotoCapa}
          />
        )}

        {abaAtiva === "quantitativos" && (
          <PainelQuantitativosBDI
            dados={dadosProjeto}
            configBdi={configBdi}
            onChangeBdi={(nova) => setConfigBdi(nova)}
          />
        )}

        {abaAtiva === "dossie" && (
          <DossieTecnicoView
            obra={obra}
            dados={dadosProjeto}
            configBdi={configBdi}
            fotoCapa={fotoCapa}
          />
        )}

        {abaAtiva === "elementos" && (
          <div className="h-full bg-white rounded-lg border border-slate-200 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Relação de Ambientes da Obra</h3>
                <p className="text-xs text-slate-500">
                  Os cômodos identificados automaticamente a partir da planta baixa 2D.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dadosProjeto.ambientes.map((amb) => (
                  <Card key={amb.id} className="border-slate-200 shadow-2xs">
                    <CardContent className="p-4 space-y-2">
                      <div className="font-semibold text-sm text-slate-900">{amb.nome}</div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Área de Piso:</span>
                        <span className="font-semibold text-slate-900">{amb.area.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Perímetro (Rodapé):</span>
                        <span className="font-medium text-slate-700">{amb.perimetro.toFixed(2)} m</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                        <div>Piso: {amb.pisoAcabamento || "Porcelanato Padrão"}</div>
                        <div>Teto: {amb.tetoAcabamento || "Forro de Gesso"}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Parâmetros Gerais do Projeto</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="text-slate-400">Pé-Direito</div>
                    <div className="font-semibold text-slate-800 text-sm">
                      {dadosProjeto.config.peDireito.toFixed(2)} m
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="text-slate-400">Espessura de Parede</div>
                    <div className="font-semibold text-slate-800 text-sm">
                      {dadosProjeto.config.espessuraParedePadrao.toFixed(2)} m
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="text-slate-400">Tipo de Telhado</div>
                    <div className="font-semibold text-slate-800 text-sm capitalize">
                      {dadosProjeto.cobertura.tipo.replace("_", " ")}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="text-slate-400">Beiral</div>
                    <div className="font-semibold text-slate-800 text-sm">
                      {dadosProjeto.cobertura.beiral.toFixed(2)} m
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
