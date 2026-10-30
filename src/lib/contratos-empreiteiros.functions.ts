export function extrairUnidadeItem(item: any): string {
  if (item.unidade && typeof item.unidade === "string") return item.unidade;
  if (item.origem && typeof item.origem === "string" && item.origem.includes("unidade:")) {
    const match = item.origem.match(/unidade:([^|;]+)/);
    if (match?.[1]) return match[1].trim();
  }
  return "un";
}

import { supabase } from "@/lib/supabase";
import type {
  ContratoEmpreiteiro,
  ContratoItem,
  MedicaoEmpreiteiro,
  MedicaoItem,
  AjusteMedicao,
  AditivoContrato,
  RetencaoEmpreiteiro,
} from "./contratos-empreiteiros.schema";

export interface FiltrosContratos {
  obraId?: string;
  fornecedorId?: string;
  status?: string;
  busca?: string;
}

/**
 * Lista todos os contratos de empreiteiros com resumo acumulado.
 */
export async function listarContratosEmpreiteiros(filtros?: FiltrosContratos) {
  let query = supabase
    .from("contratos_empreiteiros")
    .select(
      `
      id,
      numero,
      obra_id,
      fornecedor_id,
      tipo,
      objeto,
      status,
      data_inicio,
      data_fim_prevista,
      retencao_padrao_percentual,
      adiantamento_previsto_centavos,
      adiantamento_concedido_centavos,
      adiantamento_amortizado_centavos,
      valor_total_original_centavos,
      valor_total_aditivos_centavos,
      valor_total_atual_centavos,
      origem_legada,
      observacoes,
      created_at,
      obras:obra_id ( id, nome ),
      fornecedores:fornecedor_id ( id, razao_social, nome_fantasia )
    `
    )
    .order("created_at", { ascending: false });

  if (filtros?.obraId) {
    query = query.eq("obra_id", filtros.obraId);
  }
  if (filtros?.fornecedorId) {
    query = query.eq("fornecedor_id", filtros.fornecedorId);
  }
  if (filtros?.status && filtros.status !== "todos") {
    query = query.eq("status", filtros.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Buscar totais medidos de cada contrato para calcular saldo financeiro
  const contratosComMedido = await Promise.all(
    (data || []).map(async (contrato: any) => {
      const { data: medicoes } = await supabase
        .from("medicoes_empreiteiros")
        .select("valor_bruto_centavos, valor_liquido_centavos, status")
        .eq("contrato_empreiteiro_id", contrato.id)
        .in("status", ["aprovada", "paga"]);

      const totalMedidoBrutoCentavos = (medicoes || []).reduce(
        (acc, m) => acc + Number(m.valor_bruto_centavos || 0),
        0
      );
      const totalMedidoLiquidoCentavos = (medicoes || []).reduce(
        (acc, m) => acc + Number(m.valor_liquido_centavos || 0),
        0
      );
      const valorAtual = Number(contrato.valor_total_atual_centavos || 0);
      const saldoCentavos = Math.max(0, valorAtual - totalMedidoBrutoCentavos);
      const percentualMedido =
        valorAtual > 0 ? (totalMedidoBrutoCentavos / valorAtual) * 100 : 0;

      return {
        ...contrato,
        totalMedidoBrutoCentavos,
        totalMedidoLiquidoCentavos,
        saldoCentavos,
        percentualMedido: Math.min(100, Math.round(percentualMedido * 100) / 100),
      };
    })
  );

  return contratosComMedido;
}

/**
 * Obtém detalhes completos de um contrato (itens, medições, aditivos, retenções).
 */
export async function obterDetalhesContrato(contratoId: string) {
  const { data: contrato, error: errContrato } = await supabase
    .from("contratos_empreiteiros")
    .select(
      `
      *,
      obras:obra_id ( id, nome, logradouro, cidade, uf ),
      fornecedores:fornecedor_id ( id, razao_social, nome_fantasia, cnpj, cpf, telefone, email )
    `
    )
    .eq("id", contratoId)
    .single();

  if (errContrato) throw errContrato;

  // Itens do contrato (servicos_terceirizados vinculados)
  const { data: itens, error: errItens } = await supabase
    .from("servicos_terceirizados")
    .select("*")
    .eq("contrato_empreiteiro_id", contratoId)
    .order("created_at", { ascending: true });

  if (errItens) throw errItens;

  // Medições realizadas
  const { data: medicoes, error: errMedicoes } = await supabase
    .from("medicoes_empreiteiros")
    .select(
      `
      *,
      contas_pagar:conta_pagar_id ( id, numero_documento, status, data_vencimento, data_pagamento )
    `
    )
    .eq("contrato_empreiteiro_id", contratoId)
    .order("numero", { ascending: true });

  if (errMedicoes) throw errMedicoes;

  // Aditivos
  const { data: aditivos, error: errAditivos } = await supabase
    .from("contrato_empreiteiro_aditivos")
    .select("*")
    .eq("contrato_empreiteiro_id", contratoId)
    .order("numero", { ascending: true });

  if (errAditivos) throw errAditivos;

  // Retenções
  const { data: retencoes, error: errRetencoes } = await supabase
    .from("retencoes_empreiteiros")
    .select(
      `
      *,
      medicoes_empreiteiros:medicao_empreiteiro_id ( numero, periodo_fim )
    `
    )
    .eq("contrato_empreiteiro_id", contratoId)
    .order("created_at", { ascending: false });

  if (errRetencoes) throw errRetencoes;

  // Buscar medições dos itens desse contrato para calcular acumulado medido
  const itemIds = (itens || []).map((i: any) => i.id);
  const mapMedido = new Map<string, number>();

  if (itemIds.length > 0) {
    const { data: itensMedidos } = await supabase
      .from("medicoes_terceirizados")
      .select("servico_id, quantidade, quantidade_executada, status")
      .in("servico_id", itemIds);

    (itensMedidos || []).forEach((m: any) => {
      if (["aprovada", "paga", "financeiro_gerado"].includes(m.status)) {
        const qtd = Number(m.quantidade || m.quantidade_executada || 0);
        mapMedido.set(m.servico_id, (mapMedido.get(m.servico_id) || 0) + qtd);
      }
    });
  }

  // Calcular acumulado físico e financeiro por item
  const itensComAcumulado = (itens || []).map((item: any) => {
    const qtdContratada = Number(item.quantidade || 0);
    const qtdMedida = mapMedido.get(item.id) || 0;
    const saldoQtd = Math.max(0, qtdContratada - qtdMedida);
    const pctExecutado = qtdContratada > 0 ? Math.min(100, (qtdMedida / qtdContratada) * 100) : 0;

    return {
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: extrairUnidadeItem(item),
      etapa: item.etapa || "Geral",
      quantidadeContratada: qtdContratada,
      precoUnitarioCentavos: Number(
        item.preco_unitario_centavos || item.valor_unitario || 0
      ),
      precoTotalCentavos: Number(
        item.preco_total_centavos || item.valor_total || 0
      ),
      quantidadeMedida: qtdMedida,
      saldoQuantidade: saldoQtd,
      percentualExecutado: pctExecutado,
    };
  });

  return {
    contrato,
    itens: itensComAcumulado,
    medicoes: medicoes || [],
    aditivos: aditivos || [],
    retencoes: retencoes || [],
  };
}

/**
 * Cria um novo contrato de empreiteiro com seus itens de escopo.
 */
export async function criarContratoComItens(params: {
  obraId: string;
  fornecedorId: string;
  tipo: "preco_unitario" | "empreitada_global";
  objeto: string;
  dataInicio?: string | null;
  dataFimPrevista?: string | null;
  retencaoPadraoPercentual?: number;
  adiantamentoPrevistoCentavos?: number;
  observacoes?: string | null;
  itens: ContratoItem[];
}) {
  const { data: user } = await supabase.auth.getUser();

  // 1. Gerar número sequencial amigável: CONTR-YYYY-NNNN
  const ano = new Date().getFullYear();
  const { count } = await supabase
    .from("contratos_empreiteiros")
    .select("*", { count: "exact", head: true });
  const numeroSeq = (count || 0) + 1;
  const numeroContrato = `CTE-${ano}-${String(numeroSeq).padStart(4, "0")}`;

  // 2. Calcular valor total dos itens
  const valorTotalOriginal = params.itens.reduce((acc, item) => {
    return acc + Math.round(item.quantidadeContratada * item.precoUnitarioCentavos);
  }, 0);

  // 3. Inserir cabeçalho do contrato
  const { data: novoContrato, error: errCabecalho } = await supabase
    .from("contratos_empreiteiros")
    .insert({
      numero: numeroContrato,
      obra_id: params.obraId,
      fornecedor_id: params.fornecedorId,
      tipo: params.tipo,
      objeto: params.objeto,
      status: "ativo", // Já inicia ativo para permitir medições imediatas
      data_inicio: params.dataInicio || null,
      data_fim_prevista: params.dataFimPrevista || null,
      retencao_padrao_percentual: params.retencaoPadraoPercentual || 0,
      adiantamento_previsto_centavos: params.adiantamentoPrevistoCentavos || 0,
      valor_total_original_centavos: valorTotalOriginal,
      valor_total_atual_centavos: valorTotalOriginal,
      observacoes: params.observacoes || null,
      created_by: user.user?.id || null,
    })
    .select()
    .single();

  if (errCabecalho) throw errCabecalho;

  // 4. Inserir itens em servicos_terceirizados vinculados
  if (params.itens.length > 0) {
    const itensParaInserir = params.itens.map((item, idx) => ({
      contrato_empreiteiro_id: novoContrato.id,
      obra_id: params.obraId,
      fornecedor_id: params.fornecedorId,
      tipo_servico: item.etapa || item.descricao || "Geral",
      descricao: item.descricao,
      quantidade: item.quantidadeContratada,
      valor_unitario: Math.max(1, Math.round(item.precoUnitarioCentavos)),
      valor_total: Math.max(1, Math.round(item.quantidadeContratada * item.precoUnitarioCentavos)),
      preco_unitario_centavos: item.precoUnitarioCentavos,
      preco_total_centavos: Math.round(item.quantidadeContratada * item.precoUnitarioCentavos),
      codigo: item.codigo || null,
      etapa: item.etapa || "Geral",
      origem: `unidade:${item.unidade || "un"}|origem:${item.origemTipo || "manual"}`,
      data_inicio: params.dataInicio || new Date().toISOString().split("T")[0],
      data_fim: params.dataFimPrevista || null,
      status: "aprovado",
      ordem: idx,
    }));

    const { error: errItens } = await supabase
      .from("servicos_terceirizados")
      .insert(itensParaInserir);

    if (errItens) throw errItens;
  }

  return novoContrato;
}

/**
 * Cria um novo boletim de medição para o contrato.
 */
export async function criarBoletimMedicao(contratoId: string, dados: {
  periodoInicio?: string | null;
  periodoFim?: string | null;
  dataVencimento?: string | null;
  observacoes?: string | null;
}) {
  const { data: user } = await supabase.auth.getUser();

  // Calcular próximo número sequencial da medição para o contrato
  const { data: ultimas } = await supabase
    .from("medicoes_empreiteiros")
    .select("numero")
    .eq("contrato_empreiteiro_id", contratoId)
    .order("numero", { ascending: false })
    .limit(1);

  const proximoNumero = (ultimas?.[0]?.numero || 0) + 1;

  const { data: novaMedicao, error } = await supabase
    .from("medicoes_empreiteiros")
    .insert({
      contrato_empreiteiro_id: contratoId,
      numero: proximoNumero,
      periodo_inicio: dados.periodoInicio || null,
      periodo_fim: dados.periodoFim || null,
      data_vencimento: dados.dataVencimento || null,
      observacoes: dados.observacoes || null,
      status: "rascunho",
      created_by: user.user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return novaMedicao;
}

/**
 * Salva as medições de itens e os ajustes (descontos, retenção, amortização).
 */
export async function salvarItensBoletimMedicao(
  medicaoId: string,
  contratoId: string,
  itensMedicao: Array<{
    itemServicoId: string;
    modoEntrada: "quantidade" | "percentual" | "valor";
    quantidadeAtual: number;
    percentualAtual: number;
    valorCentavos: number;
    quantidadeAnterior: number;
    quantidadeAcumulada: number;
    saldoQuantidade: number;
  }>,
  ajustes: Array<{
    tipo: "desconto" | "amortizacao_adiantamento" | "retencao_tecnica" | "tributo" | "outro";
    descricao: string;
    baseCalculoCentavos?: number;
    percentual?: number;
    valorCentavos: number;
  }>
) {
  // 1. Calcular totais
  const valorBrutoCentavos = itensMedicao.reduce((acc, i) => acc + i.valorCentavos, 0);

  let valorDescontos = 0;
  let valorAmortizacao = 0;
  let valorRetencao = 0;
  let valorTributos = 0;

  for (const aj of ajustes) {
    if (aj.tipo === "desconto") valorDescontos += aj.valorCentavos;
    else if (aj.tipo === "amortizacao_adiantamento") valorAmortizacao += aj.valorCentavos;
    else if (aj.tipo === "retencao_tecnica") valorRetencao += aj.valorCentavos;
    else if (aj.tipo === "tributo") valorTributos += aj.valorCentavos;
  }

  const valorLiquidoCentavos = Math.max(
    0,
    valorBrutoCentavos - (valorDescontos + valorAmortizacao + valorRetencao + valorTributos)
  );

  // 2. Atualizar cabeçalho da medição
  const { error: errCabecalho } = await supabase
    .from("medicoes_empreiteiros")
    .update({
      valor_bruto_centavos: valorBrutoCentavos,
      valor_descontos_centavos: valorDescontos,
      valor_amortizacao_centavos: valorAmortizacao,
      valor_retencao_centavos: valorRetencao,
      valor_tributos_centavos: valorTributos,
      valor_liquido_centavos: valorLiquidoCentavos,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicaoId);

  if (errCabecalho) throw errCabecalho;

  // 3. Deletar medições anteriores desse boletim em medicoes_terceirizados e reinserir
  await supabase.from("medicoes_terceirizados").delete().eq("medicao_empreiteiro_id", medicaoId);

  if (itensMedicao.length > 0) {
    const dataVenc = new Date().toISOString().split("T")[0];
    const rows = itensMedicao.map((item) => ({
      medicao_empreiteiro_id: medicaoId,
      servico_id: item.itemServicoId,
      quantidade_executada: item.quantidadeAtual > 0 ? item.quantidadeAtual : 0.001,
      valor_unitario: Math.max(1, Math.round(item.valorCentavos / (item.quantidadeAtual || 1))),
      valor_total: Math.max(1, item.valorCentavos),
      data_medicao: new Date().toISOString().split("T")[0],
      data_vencimento: dataVenc,
      modo_entrada: item.modoEntrada,
      percentual_atual: item.percentualAtual,
      valor_centavos: item.valorCentavos,
      quantidade_anterior: item.quantidadeAnterior,
      quantidade_acumulada: item.quantidadeAcumulada,
      saldo_quantidade: item.saldoQuantidade,
      status: "rascunho",
    }));

    const { error: errItens } = await supabase.from("medicoes_terceirizados").insert(rows);
    if (errItens) throw errItens;
  }

  // 4. Salvar ajustes em medicao_empreiteiro_ajustes
  await supabase.from("medicao_empreiteiro_ajustes").delete().eq("medicao_empreiteiro_id", medicaoId);

  if (ajustes.length > 0) {
    const rowsAjustes = ajustes.map((a) => ({
      medicao_empreiteiro_id: medicaoId,
      tipo: a.tipo,
      descricao: a.descricao,
      base_calculo_centavos: a.baseCalculoCentavos || null,
      percentual: a.percentual || null,
      valor_centavos: a.valorCentavos,
    }));

    const { error: errAj } = await supabase
      .from("medicao_empreiteiro_ajustes")
      .insert(rowsAjustes);
    if (errAj) throw errAj;
  }

  return { valorBrutoCentavos, valorLiquidoCentavos };
}

/**
 * Chama a RPC transacional para aprovar o boletim e gerar conta a pagar.
 */
export async function aprovarMedicaoEmpreiteiroRPC(medicaoId: string) {
  const { data, error } = await supabase.rpc("aprovar_medicao_empreiteiro", {
    p_medicao_id: medicaoId,
  });
  if (error) throw error;
  return data;
}

/**
 * Cancela medição aprovada estornando saldo e conta a pagar.
 */
export async function cancelarMedicaoEmpreiteiroRPC(medicaoId: string, motivo: string) {
  const { data, error } = await supabase.rpc("cancelar_medicao_empreiteiro", {
    p_medicao_id: medicaoId,
    p_motivo: motivo,
  });
  if (error) throw error;
  return data;
}

/**
 * Libera retenção técnica gerando conta a pagar para o empreiteiro.
 */
export async function liberarRetencaoEmpreiteiroRPC(
  retencaoId: string,
  valorLiberarCentavos: number,
  dataVencimento: string,
  observacoes?: string
) {
  const { data, error } = await supabase.rpc("liberar_retencao_empreiteiro", {
    p_retencao_id: retencaoId,
    p_valor_liberar_centavos: valorLiberarCentavos,
    p_data_vencimento: dataVencimento,
    p_observacoes: observacoes || null,
  });
  if (error) throw error;
  return data;
}


export interface AtualizarContratoParams {
  id: string;
  obraId?: string;
  fornecedorId?: string;
  tipo?: "preco_unitario" | "empreitada_global";
  objeto?: string;
  status?: "rascunho" | "em_aprovacao" | "ativo" | "concluido" | "cancelado";
  dataInicio?: string | null;
  dataFimPrevista?: string | null;
  retencaoPadraoPercentual?: number;
  adiantamentoPrevistoCentavos?: number;
  observacoes?: string | null;
  itens?: ContratoItem[];
}

/**
 * Atualiza um contrato de empreiteiro existente e gerencia seus itens de escopo.
 */
export async function atualizarContratoEmpreiteiro(params: AtualizarContratoParams) {
  // 1. Obter contrato atual
  const { data: contratoAtual, error: errBusca } = await supabase
    .from("contratos_empreiteiros")
    .select("id, numero, obra_id, fornecedor_id, valor_total_aditivos_centavos")
    .eq("id", params.id)
    .single();

  if (errBusca || !contratoAtual) {
    throw new Error("Contrato não encontrado para edição.");
  }

  // 2. Se obra_id ou fornecedor_id estiverem sendo alterados, verificar se existem medições aprovadas
  if (
    (params.obraId && params.obraId !== contratoAtual.obra_id) ||
    (params.fornecedorId && params.fornecedorId !== contratoAtual.fornecedor_id)
  ) {
    const { data: medicoesAprovadas } = await supabase
      .from("medicoes_empreiteiros")
      .select("id")
      .eq("contrato_empreiteiro_id", params.id)
      .in("status", ["aprovada", "paga"]);

    if (medicoesAprovadas && medicoesAprovadas.length > 0) {
      throw new Error(
        "Não é possível alterar a obra ou o empreiteiro deste contrato pois ele já possui medições aprovadas."
      );
    }
  }

  // 3. Gerenciar itens do contrato caso informados
  let valorTotalOriginal: number | undefined;
  let valorTotalAtual: number | undefined;

  const finalObraId = params.obraId || contratoAtual.obra_id;
  const finalFornecedorId = params.fornecedorId || contratoAtual.fornecedor_id;

  if (params.itens) {
    // Calcular novo valor total
    valorTotalOriginal = params.itens.reduce((acc, item) => {
      return acc + Math.round(item.quantidadeContratada * item.precoUnitarioCentavos);
    }, 0);

    const valorAditivos = Number(contratoAtual.valor_total_aditivos_centavos || 0);
    valorTotalAtual = valorTotalOriginal + valorAditivos;

    // Buscar itens atuais salvos em servicos_terceirizados
    const { data: itensAtuais, error: errItensAtuais } = await supabase
      .from("servicos_terceirizados")
      .select("id, descricao")
      .eq("contrato_empreiteiro_id", params.id);

    if (errItensAtuais) throw errItensAtuais;

    const idsAtuais = new Set((itensAtuais || []).map((i) => i.id));
    const idsEnviados = new Set(
      params.itens.filter((i) => i.id).map((i) => i.id as string)
    );

    // Itens que foram excluídos
    const itensParaRemover = (itensAtuais || []).filter((i) => !idsEnviados.has(i.id));

    if (itensParaRemover.length > 0) {
      const idsParaRemover = itensParaRemover.map((i) => i.id);

      // Verificar se algum item removido possui medição aprovada
      const { data: medicoesItens } = await supabase
        .from("medicoes_terceirizados")
        .select("servico_id, status")
        .in("servico_id", idsParaRemover)
        .in("status", ["aprovada", "paga", "financeiro_gerado"]);

      if (medicoesItens && medicoesItens.length > 0) {
        const itemComMedicao = itensParaRemover.find((it) =>
          medicoesItens.some((m) => m.servico_id === it.id)
        );
        throw new Error(
          `O item "${itemComMedicao?.descricao || "selecionado"}" não pode ser excluído pois já possui medições aprovadas.`
        );
      }

      // Deletar medições rascunho vinculadas a esses itens removidos
      await supabase
        .from("medicoes_terceirizados")
        .delete()
        .in("servico_id", idsParaRemover);

      // Deletar itens
      const { error: errDelItens } = await supabase
        .from("servicos_terceirizados")
        .delete()
        .in("id", idsParaRemover);

      if (errDelItens) throw errDelItens;
    }

    // Atualizar itens existentes ou inserir novos
    for (let idx = 0; idx < params.itens.length; idx++) {
      const item = params.itens[idx];
      const payloadItem = {
        contrato_empreiteiro_id: params.id,
        obra_id: finalObraId,
        fornecedor_id: finalFornecedorId,
        tipo_servico: item.etapa || item.descricao || "Geral",
        descricao: item.descricao,
        quantidade: item.quantidadeContratada,
        valor_unitario: Math.max(1, Math.round(item.precoUnitarioCentavos)),
        valor_total: Math.max(1, Math.round(item.quantidadeContratada * item.precoUnitarioCentavos)),
        preco_unitario_centavos: item.precoUnitarioCentavos,
        preco_total_centavos: Math.round(item.quantidadeContratada * item.precoUnitarioCentavos),
        codigo: item.codigo || null,
        etapa: item.etapa || "Geral",
        origem: `unidade:${item.unidade || "un"}|origem:${item.origemTipo || "manual"}`,
        data_inicio: params.dataInicio || new Date().toISOString().split("T")[0],
        data_fim: params.dataFimPrevista || null,
        ordem: idx,
      };

      if (item.id && idsAtuais.has(item.id)) {
        // Atualizar item existente
        const { error: errUpdItem } = await supabase
          .from("servicos_terceirizados")
          .update(payloadItem)
          .eq("id", item.id);
        if (errUpdItem) throw errUpdItem;
      } else {
        // Inserir novo item
        const { error: errInsItem } = await supabase
          .from("servicos_terceirizados")
          .insert({
            ...payloadItem,
            status: "aprovado",
          });
        if (errInsItem) throw errInsItem;
      }
    }
  }

  // 4. Montar campos para atualizar no cabeçalho
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };

  if (params.objeto !== undefined) updatePayload.objeto = params.objeto;
  if (params.tipo !== undefined) updatePayload.tipo = params.tipo;
  if (params.status !== undefined) updatePayload.status = params.status;
  if (params.dataInicio !== undefined) updatePayload.data_inicio = params.dataInicio || null;
  if (params.dataFimPrevista !== undefined) updatePayload.data_fim_prevista = params.dataFimPrevista || null;
  if (params.retencaoPadraoPercentual !== undefined) updatePayload.retencao_padrao_percentual = params.retencaoPadraoPercentual;
  if (params.adiantamentoPrevistoCentavos !== undefined) updatePayload.adiantamento_previsto_centavos = params.adiantamentoPrevistoCentavos;
  if (params.observacoes !== undefined) updatePayload.observacoes = params.observacoes || null;
  if (params.obraId !== undefined) updatePayload.obra_id = params.obraId;
  if (params.fornecedorId !== undefined) updatePayload.fornecedor_id = params.fornecedorId;
  if (valorTotalOriginal !== undefined) {
    updatePayload.valor_total_original_centavos = valorTotalOriginal;
    updatePayload.valor_total_atual_centavos = valorTotalAtual;
  }

  const { data: contratoAtualizado, error: errUpdate } = await supabase
    .from("contratos_empreiteiros")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .single();

  if (errUpdate) throw errUpdate;

  return contratoAtualizado;
}

/**
 * Exclui um contrato de empreiteiro caso não possua medições aprovadas ou contas a pagar vinculadas.
 */
export async function excluirContratoEmpreiteiro(contratoId: string) {
  // 1. Verificar se existem medições aprovadas ou pagas
  const { data: medicoes, error: errMedicoes } = await supabase
    .from("medicoes_empreiteiros")
    .select("id, numero, status")
    .eq("contrato_empreiteiro_id", contratoId);

  if (errMedicoes) throw errMedicoes;

  const medicoesAprovadas = (medicoes || []).filter(
    (m) => m.status === "aprovada" || m.status === "paga"
  );

  if (medicoesAprovadas.length > 0) {
    throw new Error(
      `Não é possível excluir este contrato porque ele possui ${medicoesAprovadas.length} medição(ões) aprovada(s) ou paga(s). Para encerrá-lo, cancele as medições previamente ou altere o status do contrato para 'cancelado'.`
    );
  }

  // 2. Verificar retenções liberadas
  const { data: retencoes, error: errRet } = await supabase
    .from("retencoes_empreiteiros")
    .select("id, status")
    .eq("contrato_empreiteiro_id", contratoId);

  if (errRet) throw errRet;

  const retencoesLiberadas = (retencoes || []).filter((r) =>
    r.status ? r.status.includes("liberada") : false
  );
  if (retencoesLiberadas.length > 0) {
    throw new Error(
      "Não é possível excluir este contrato porque ele possui retenções técnicas já liberadas no Financeiro."
    );
  }

  // 3. Deletar dependências das medições rascunho / canceladas / reprovadas
  const medicaoIds = (medicoes || []).map((m) => m.id);
  if (medicaoIds.length > 0) {
    await supabase.from("medicoes_terceirizados").delete().in("medicao_empreiteiro_id", medicaoIds);
    await supabase.from("medicao_empreiteiro_ajustes").delete().in("medicao_empreiteiro_id", medicaoIds);
    await supabase.from("medicao_empreiteiro_anexos").delete().in("medicao_empreiteiro_id", medicaoIds);
    await supabase.from("medicao_empreiteiro_links").delete().in("medicao_empreiteiro_id", medicaoIds);
  }

  // 4. Deletar retenções, medições, aditivos e auditoria do contrato
  await supabase.from("retencoes_empreiteiros").delete().eq("contrato_empreiteiro_id", contratoId);
  await supabase.from("medicoes_empreiteiros").delete().eq("contrato_empreiteiro_id", contratoId);
  await supabase.from("contrato_empreiteiro_aditivos").delete().eq("contrato_empreiteiro_id", contratoId);
  await supabase.from("contrato_empreiteiro_auditoria").delete().eq("contrato_empreiteiro_id", contratoId);

  // 5. Deletar itens do contrato em servicos_terceirizados
  await supabase.from("servicos_terceirizados").delete().eq("contrato_empreiteiro_id", contratoId);

  // 6. Deletar o cabeçalho do contrato
  const { error: errDel } = await supabase
    .from("contratos_empreiteiros")
    .delete()
    .eq("id", contratoId);

  if (errDel) throw errDel;

  return { success: true };
}
