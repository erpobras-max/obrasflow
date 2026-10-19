import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Viewport3D } from "@/components/projeto3d/Viewport3D";
import { DossieTecnicoView } from "@/components/projeto3d/DossieTecnicoView";
import type { DadosProjetoBIM, ConfiguracaoBDI } from "@/types/projeto3d";
import { PROJETO_PADRAO_INICIAL, BDI_PADRAO_INICIAL } from "@/lib/projeto3d.utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Boxes,
  FileText,
  Building,
  Sparkles,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/portal/projeto")({
  component: PortalProjetoPage,
});

function PortalProjetoPage() {
  const { selectedObraId } = usePortalContext();
  const [visualizacao, setVisualizacao] = useState<"3d" | "dossie">("3d");

  // 1. Buscar Dados da Obra Selecionada
  const { data: obra, isLoading: loadingObra } = useQuery({
    queryKey: ["portal_obra_detalhe", selectedObraId],
    queryFn: async () => {
      if (!selectedObraId) return null;
      const { data, error } = await supabase
        .from("obras")
        .select("id, numero, nome, descricao, status, logradouro, numero_end, bairro, cidade, uf")
        .eq("id", selectedObraId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedObraId,
  });

  // 2. Buscar Projeto CAD / BIM da Obra
  const { data: projeto, isLoading: loadingProjeto } = useQuery({
    queryKey: ["portal_obra_projeto", selectedObraId],
    queryFn: async () => {
      if (!selectedObraId) return null;
      const { data, error } = await supabase
        .from("obra_projetos_cad")
        .select("*")
        .eq("obra_id", selectedObraId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!selectedObraId,
  });

  if (!selectedObraId) {
    return (
      <div className="container px-4 py-8 text-center text-slate-500">
        <Building className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Selecione uma obra no topo para visualizar a maquete 3D e o memorial.</p>
      </div>
    );
  }

  if (loadingObra || loadingProjeto) {
    return (
      <div className="container px-4 py-6 space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-[550px] w-full rounded-lg" />
      </div>
    );
  }

  const dadosBim: DadosProjetoBIM | null =
    (projeto?.dados_projeto as DadosProjetoBIM) || null;
  const configBdi: ConfiguracaoBDI =
    (projeto?.config_bdi as ConfiguracaoBDI) || BDI_PADRAO_INICIAL;
  const fotoCapa = projeto?.foto_capa_3d || null;

  const temProjeto = dadosBim && dadosBim.paredes && dadosBim.paredes.length > 0;

  if (!temProjeto) {
    return (
      <div className="container px-4 py-12 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
          <Boxes className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Projeto 3D em Elaboração</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            A equipe de engenharia responsável pela obra <strong className="text-slate-700">{obra?.nome}</strong> ainda está desenvolvendo a modelagem tridimensional e o memorial descritivo.
          </p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 inline-block text-left max-w-md">
          <p className="font-medium text-slate-700 mb-1">O que você poderá acompanhar aqui?</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Maquete 3D interativa com visão interna e externa</li>
            <li>Cortes técnicos e dimensões dos ambientes</li>
            <li>Dossiê técnico e memorial de acabamentos em PDF</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-6 space-y-4 max-w-6xl mx-auto">
      {/* Cabeçalho da Maquete no Portal */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold text-slate-900">{obra?.nome}</h1>
            <Badge variant="outline" className="text-xs font-mono font-normal">
              #{obra?.numero}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Explore a maquete interativa da sua construção ou baixe o memorial descritivo completo.
          </p>
        </div>

        {/* Alternador de Visualização (3D vs Dossiê) */}
        <Tabs value={visualizacao} onValueChange={(v) => setVisualizacao(v as any)}>
          <TabsList className="bg-slate-100 p-0.5">
            <TabsTrigger value="3d" className="gap-1.5 text-xs px-3 py-1.5">
              <Boxes className="w-3.5 h-3.5" /> Maquete 3D
            </TabsTrigger>
            <TabsTrigger value="dossie" className="gap-1.5 text-xs px-3 py-1.5">
              <FileText className="w-3.5 h-3.5" /> Dossiê & Memorial (PDF)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conteúdo: 3D Interativo ou Memorial Descritivo */}
      {visualizacao === "3d" ? (
        <div className="space-y-3">
          <div className="h-[550px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm">
            <Viewport3D dados={dadosBim} somenteLeitura={true} />
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <span>
              <strong>Dica de visualização:</strong> Clique e arraste para girar a maquete, use a roda do mouse para aproximar, e clique no botão <strong>"Telhado"</strong> para ver a divisão interna dos cômodos da sua obra!
            </span>
          </div>
        </div>
      ) : (
        <div className="h-[800px] rounded-lg overflow-hidden border border-slate-200">
          <DossieTecnicoView
            obra={obra}
            dados={dadosBim}
            configBdi={configBdi}
            fotoCapa={fotoCapa}
          />
        </div>
      )}
    </div>
  );
}
