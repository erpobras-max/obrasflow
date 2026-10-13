import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.custom";

export type CotacaoFiltro = { status?: string; obraId?: string; desde?: string; ate?: string };

async function queryOrThrow(query: PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useCotacoes(filtros: CotacaoFiltro = {}) {
  return useQuery({
    queryKey: ["cotacoes-compra", filtros],
    queryFn: async () => {
      let q = (supabase as any).from("cotacoes_compra").select("*, obras(id,numero,nome), cotacoes_fornecedores(id,status,fornecedor_id,fornecedores(razao_social)), cotacoes_itens(id)").order("created_at", { ascending: false });
      if (filtros.status) q = q.eq("status", filtros.status);
      if (filtros.obraId) q = q.eq("obra_id", filtros.obraId);
      if (filtros.desde) q = q.gte("created_at", filtros.desde);
      if (filtros.ate) q = q.lte("created_at", `${filtros.ate}T23:59:59`);
      return queryOrThrow(q);
    },
  });
}

export function useCotacao(id?: string) {
  return useQuery({
    queryKey: ["cotacao-compra", id], enabled: Boolean(id),
    queryFn: async () => queryOrThrow((supabase as any).from("cotacoes_compra").select("*, obras(id,numero,nome), cotacoes_fornecedores(*,fornecedores(id,razao_social,email,telefone),cotacoes_propostas(*),cotacoes_respostas(*)), cotacoes_itens(*), cotacoes_historico(*)").eq("id", id).single()),
  });
}

export function useCreateCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { solicitacaoId: string; prazo: string; observacoes?: string; fornecedores: string[] }) => queryOrThrow((supabase as any).rpc("criar_cotacao_compra", { p_solicitacao_id: input.solicitacaoId, p_prazo: input.prazo, p_observacoes: input.observacoes || null, p_fornecedores: input.fornecedores })),
    onSuccess: () => { toast.success("Cotação criada e enviada aos fornecedores"); qc.invalidateQueries({ queryKey: ["cotacoes-compra"] }); qc.invalidateQueries({ queryKey: ["solicitacoes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cotacaoId: string) => queryOrThrow((supabase as any).rpc("admin_excluir_cotacao_compra", { p_cotacao_id: cotacaoId })),
    onSuccess: () => { toast.success("Cotação excluída"); qc.invalidateQueries({ queryKey: ["cotacoes-compra"] }); },
    onError: (e: Error) => toast.error(`Não foi possível excluir a cotação: ${e.message}`),
  });
}

export function useSelecionarVencedores(cotacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (selecoes: { cotacao_item_id: string; cotacao_fornecedor_id: string }[]) => queryOrThrow((supabase as any).rpc("confirmar_selecao_cotacao", { p_cotacao_id: cotacaoId, p_selecoes: selecoes })),
    onSuccess: () => { toast.success("Seleção confirmada e pedidos gerados"); qc.invalidateQueries({ queryKey: ["cotacao-compra", cotacaoId] }); qc.invalidateQueries({ queryKey: ["cotacoes-compra"] }); qc.invalidateQueries({ queryKey: ["pedidos-cotacao"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePedidosCotacao() {
  return useQuery({ queryKey: ["pedidos-cotacao"], queryFn: async () => queryOrThrow((supabase as any).from("cotacoes_pedidos").select("*, fornecedores(razao_social), obras(numero,nome), cotacoes_pedidos_itens(*)").order("created_at", { ascending: false })) });
}

export function useRegistrarRecebimento(pedidoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itens: { pedido_item_id: string; quantidade_recebida: number; observacao?: string }[]; observacoes?: string }) => queryOrThrow((supabase as any).rpc("registrar_recebimento_cotacao", { p_pedido_id: pedidoId, p_itens: input.itens, p_observacoes: input.observacoes || null })),
    onSuccess: () => { toast.success("Recebimento registrado e enviado ao Financeiro"); qc.invalidateQueries({ queryKey: ["pedidos-cotacao"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResponderCotacao(token?: string) {
  return useQuery({ queryKey: ["cotacao-publica", token], enabled: Boolean(token), queryFn: async () => queryOrThrow((supabase as any).rpc("obter_cotacao_publica", { p_token: token })) });
}
