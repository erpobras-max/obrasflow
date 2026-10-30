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
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContratoStatusBadge } from "@/components/contratos-empreiteiros/contrato-status-badge";
import { ContratoEditorDialog } from "@/components/contratos-empreiteiros/contrato-editor-dialog";
import { ContratoDetalheView } from "@/components/contratos-empreiteiros/contrato-detalhe-view";
import {
  listarContratosEmpreiteiros,
  excluirContratoEmpreiteiro,
} from "@/lib/contratos-empreiteiros.functions";

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
  const [contratoParaEditar, setContratoParaEditar] = useState<any | null>(null);
  const [contratoParaExcluir, setContratoParaExcluir] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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
    isError,
    error,
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
      c.obras?.nome?.toLowerCase().includes(busca) ||
      c.fornecedores?.nome_fantasia?.toLowerCase().includes(busca) ||
      c.fornecedores?.razao_social?.toLowerCase().includes(busca)
    );
  });

  // Indicadores consolidados
  const totalContratadoCentavos = contratos.reduce(
    (acc: number, c: any) => acc + Number(c.valor_total_atual_centavos || 0),
    0
  );
  const totalMedidoCentavos = contratos.reduce(
    (acc: number, c: any) => acc + Number(c.totalMedidoBrutoCentavos || 0),
    0
  );
  const totalSaldoCentavos = Math.max(0, totalContratadoCentavos - totalMedidoCentavos);
  const percentualGeral =
    totalContratadoCentavos > 0 ? (totalMedidoCentavos / totalContratadoCentavos) * 100 : 0;

  const handleExcluirContrato = async () => {
    if (!contratoParaExcluir) return;
    try {
      setExcluindo(true);
      await excluirContratoEmpreiteiro(contratoParaExcluir.id);
      toast.success(`Contrato ${contratoParaExcluir.numero} excluído com sucesso.`);
      setContratoParaExcluir(null);
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir contrato.");
    } finally {
      setExcluindo(false);
    }
  };

  if (contratoSelecionadoId) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
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
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-blue-600" />
            Contratos de Empreiteiros
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de contratos com prestadores terceirizados, boletins de medição com avanço físico-financeiro, retenções técnicas e integração com contas a pagar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setOpenNovoContrato(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Contratos Listados</span>
            <FileCheck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{contratos.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {contratos.filter((c: any) => c.status === "ativo").length} ativos
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Contratado</span>
            <DollarSign className="h-4 w-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {(totalContratadoCentavos / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Empreiteiros e terceirizados</div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Medido Bruto</span>
            <HardHat className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2">
            {(totalMedidoCentavos / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {percentualGeral.toFixed(1)}% do total contratado
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Saldo a Medir</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {(totalSaldoCentavos / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Saldo físico-financeiro</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº, objeto ou prestador..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Select value={filtroObraId} onValueChange={setFiltroObraId}>
            <SelectTrigger className="h-9 text-xs w-full sm:w-48">
              <SelectValue placeholder="Todas as Obras" />
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
            <SelectTrigger className="h-9 text-xs w-full sm:w-36">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="em_aprovacao">Em Aprovação</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
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
              <TableHead className="w-24 text-right">Ações</TableHead>
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
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-red-600">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span>Ocorreu um erro ao carregar os contratos: {String((error as any)?.message || error)}</span>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
                      Tentar novamente
                    </Button>
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
                      {c.fornecedores?.nome_fantasia || c.fornecedores?.razao_social || "—"}
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar Contrato"
                          onClick={() => setContratoParaEditar(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Excluir Contrato"
                          onClick={() => setContratoParaExcluir(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                          title="Abrir Detalhes"
                          onClick={() => setContratoSelecionadoId(c.id)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Dialog de Edição de Contrato */}
      <ContratoEditorDialog
        open={Boolean(contratoParaEditar)}
        onOpenChange={(op) => {
          if (!op) setContratoParaEditar(null);
        }}
        contratoParaEditar={contratoParaEditar}
        onContratoSalvo={async () => {
          await refetch();
          setContratoParaEditar(null);
        }}
      />

      {/* Confirmação de Exclusão do Contrato */}
      <AlertDialog
        open={Boolean(contratoParaExcluir)}
        onOpenChange={(op) => {
          if (!op) setContratoParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Excluir Contrato de Empreiteiro</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir o contrato{" "}
                <strong>{contratoParaExcluir?.numero}</strong> ({contratoParaExcluir?.objeto})?
              </p>
              <p className="text-xs text-slate-500">
                Esta ação apagará permanentemente o contrato e todos os seus itens cadastrados. Contratos com medições aprovadas ou contas geradas no financeiro não podem ser excluídos.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirContrato}
              disabled={excluindo}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
