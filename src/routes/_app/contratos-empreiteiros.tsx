import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  FileCheck,
  Plus,
  Search,
  Building2,
  HardHat,
  DollarSign,
  ChevronRight,
  Filter,
} from "lucide-react";
import { ContratoStatusBadge } from "@/components/contratos-empreiteiros/contrato-status-badge";
import { ContratoEditorDialog } from "@/components/contratos-empreiteiros/contrato-editor-dialog";
import { ContratoDetalheView } from "@/components/contratos-empreiteiros/contrato-detalhe-view";
import { listarContratosEmpreiteiros } from "@/lib/contratos-empreiteiros.functions";

export const Route = createFileRoute("/_app/contratos-empreiteiros")({
  validateSearch: (search: Record<string, unknown>) => ({
    obraId: typeof search.obraId === "string" ? search.obraId : undefined,
    contratoId: typeof search.contratoId === "string" ? search.contratoId : undefined,
  }),
  component: ContratosEmpreiteirosPage,
});

function ContratosEmpreiteirosPage() {
  const searchParams = Route.useSearch();
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string | null>(
    searchParams.contratoId || null
  );

  const [filtroObraId, setFiltroObraId] = useState<string>(searchParams.obraId || "todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [termoBusca, setTermoBusca] = useState("");
  const [openNovoContrato, setOpenNovoContrato] = useState(false);

  // Obras para filtro
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-filtro-contratos"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, nome").order("nome");
      return data || [];
    },
  });

  // Lista de contratos
  const {
    data: contratos = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["contratos-empreiteiros-lista", filtroObraId, filtroStatus],
    queryFn: () =>
      listarContratosEmpreiteiros({
        obraId: filtroObraId === "todos" ? undefined : filtroObraId,
        status: filtroStatus === "todos" ? undefined : filtroStatus,
      }),
  });

  // Filtro em memória por busca textual
  const contratosFiltrados = contratos.filter((c: any) => {
    if (!termoBusca.trim()) return true;
    const busca = termoBusca.toLowerCase();
    return (
      c.numero?.toLowerCase().includes(busca) ||
      c.objeto?.toLowerCase().includes(busca) ||
      c.fornecedores?.nome?.toLowerCase().includes(busca) ||
      c.obras?.nome?.toLowerCase().includes(busca)
    );
  });

  // Totais agregados
  const totalContratado = contratosFiltrados.reduce(
    (acc: number, c: any) => acc + Number(c.valor_total_atual_centavos || 0) / 100,
    0
  );
  const totalMedido = contratosFiltrados.reduce(
    (acc: number, c: any) => acc + Number(c.totalMedidoBrutoCentavos || 0) / 100,
    0
  );
  const totalSaldo = Math.max(0, totalContratado - totalMedido);
  const percentualGeral = totalContratado > 0 ? (totalMedido / totalContratado) * 100 : 0;

  if (contratoSelecionadoId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ContratoDetalheView
          contratoId={contratoSelecionadoId}
          onVoltar={() => {
            setContratoSelecionadoId(null);
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Contratos de Empreiteiros
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de contratos com prestadores terceirizados, boletins de medição com avanço físico-financeiro, retenções técnicas e integração com contas a pagar.
          </p>
        </div>

        <Button
          onClick={() => setOpenNovoContrato(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Contrato
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Contratos Listados</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {contratosFiltrados.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {contratosFiltrados.filter((c: any) => c.status === "ativo").length} ativos
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Contratado</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {totalContratado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Empreiteiros e terceirizados
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Medido Bruto</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {totalMedido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {percentualGeral.toFixed(1)}% do total contratado
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Saldo a Medir</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {totalSaldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Saldo físico-financeiro
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="p-4 bg-white border rounded-lg shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xs">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
          <Input
            placeholder="Buscar por nº, objeto ou prestador..."
            className="pl-8 h-9 text-xs"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Select value={filtroObraId} onValueChange={setFiltroObraId}>
            <SelectTrigger className="h-9 text-xs w-[180px]">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Obras</SelectItem>
              {obras.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="rascunho">Rascunhos</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Contratos */}
      <div className="border rounded-lg bg-white overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-28">Número</TableHead>
              <TableHead>Objeto / Obra</TableHead>
              <TableHead className="w-48">Empreiteiro</TableHead>
              <TableHead className="w-32 text-right">Contratado</TableHead>
              <TableHead className="w-32 text-right">Medido Bruto</TableHead>
              <TableHead className="w-32 text-right">Saldo a Medir</TableHead>
              <TableHead className="w-28 text-center">% Medido</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-xs text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Carregando contratos...
                  </div>
                </TableCell>
              </TableRow>
            ) : contratosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-xs text-slate-400">
                  Nenhum contrato de empreiteiro encontrado. Clique em "+ Novo Contrato" para iniciar.
                </TableCell>
              </TableRow>
            ) : (
              contratosFiltrados.map((c: any) => {
                const totalAtual = Number(c.valor_total_atual_centavos || 0) / 100;
                const medido = Number(c.totalMedidoBrutoCentavos || 0) / 100;
                const saldo = Number(c.saldoCentavos || 0) / 100;
                const pct = Number(c.percentualMedido || 0);

                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => setContratoSelecionadoId(c.id)}
                  >
                    <TableCell className="font-bold font-mono text-xs text-blue-700">
                      {c.numero}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900">{c.objeto}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {c.obras?.nome || "Sem obra vinculada"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium">
                      {c.fornecedores?.nome || c.fornecedores?.razao_social || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-slate-900">
                      {totalAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-blue-700 font-medium">
                      {medido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-emerald-600 font-semibold">
                      {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <Progress value={pct} className="h-1.5 w-12" />
                        <span className="text-[11px] font-mono text-slate-600">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ContratoStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Criação de Contrato */}
      <ContratoEditorDialog
        open={openNovoContrato}
        onOpenChange={setOpenNovoContrato}
        onContratoCriado={(id) => {
          refetch();
          setContratoSelecionadoId(id);
        }}
      />
    </div>
  );
}

