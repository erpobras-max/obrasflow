import { supabase } from "@/lib/supabase";

export interface ResultadoSincronizacaoProposta {
  sucesso: boolean;
  propostaId: string;
  totalItens: number;
  valorTotalReais: number;
  mensagem: string;
}

/**
 * Sincroniza uma proposta comercial em status 'rascunho' com o orçamento mais recente da obra.
 * Busca tanto etapas/atividades analíticas (com insumos e BDI) quanto itens do orçamento padrão/legado.
 */
export async function sincronizarPropostaComOrcamento(
  propostaId: string,
  obraId?: string
): Promise<ResultadoSincronizacaoProposta> {
  // 1. Verificar proposta
  const { data: prop, error: propErr } = await supabase
    .from("propostas")
    .select("id, titulo, status, cliente_id")
    .eq("id", propostaId)
    .single();

  if (propErr || !prop) {
    throw new Error("Proposta não encontrada.");
  }

  if (prop.status !== "rascunho") {
    throw new Error(
      `Apenas propostas em status 'rascunho' podem ser sincronizadas automaticamente (status atual: ${prop.status}).`
    );
  }

  // 2. Determinar a obra vinculada
  let targetObraId = obraId;
  if (!targetObraId) {
    const { data: obraDireta } = await supabase
      .from("obras")
      .select("id")
      .eq("proposta_id", propostaId)
      .maybeSingle();
    if (obraDireta?.id) {
      targetObraId = obraDireta.id;
    } else if (prop.titulo) {
      const match = prop.titulo.match(/Proposta Comercial - (.+)/i);
      const nomeObra = match ? match[1]?.trim() : prop.titulo.trim();
      if (nomeObra) {
        const { data: obraPorNome } = await supabase
          .from("obras")
          .select("id")
          .ilike("nome", `%${nomeObra}%`)
          .limit(1)
          .maybeSingle();
        if (obraPorNome?.id) {
          targetObraId = obraPorNome.id;
        }
      }
    }
  }

  if (!targetObraId) {
    throw new Error("Nenhuma obra vinculada a esta proposta foi identificada.");
  }

  // 3. Buscar orçamento da obra
  const { data: orc, error: orcErr } = await supabase
    .from("orcamentos")
    .select("id, bdi_geral, total_estimado")
    .eq("obra_id", targetObraId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orcErr || !orc?.id) {
    throw new Error("Nenhum orçamento encontrado para a obra vinculada.");
  }

  const bdiGeral = Number(orc.bdi_geral ?? 25);
  const itensPayload: any[] = [];
  let totalReais = 0;

  // 3a. Tentar buscar analítico
  const { data: etapasAnaliticas } = await supabase
    .from("orcamento_etapas")
    .select("id, codigo, nome, ordem")
    .eq("orcamento_id", orc.id)
    .order("ordem");

  if (etapasAnaliticas && etapasAnaliticas.length > 0) {
    const etapaIds = etapasAnaliticas.map((e) => e.id);
    const { data: ativs } = await supabase
      .from("orcamento_atividades")
      .select("id, etapa_id, codigo, descricao, unidade, quantidade, bdi_percentual")
      .in("etapa_id", etapaIds)
      .order("ordem");

    if (ativs && ativs.length > 0) {
      const ativIds = ativs.map((a) => a.id);
      const { data: insumosDb } = await supabase
        .from("orcamento_atividade_insumos")
        .select("atividade_id, preco_unitario_centavos, coeficiente")
        .in("atividade_id", ativIds);

      const insumosPorAtiv = insumosDb ?? [];
      const etapaPorId = new Map(etapasAnaliticas.map((e) => [e.id, e]));

      ativs.forEach((a, idx) => {
        const ep = etapaPorId.get(a.etapa_id);
        const qtd = Number(a.quantidade ?? 1);
        const bdiAtiv = a.bdi_percentual != null ? Number(a.bdi_percentual) : bdiGeral;

        const insumosDestaAtiv = insumosPorAtiv.filter((i) => i.atividade_id === a.id);
        const custoInsumosCentavos = insumosDestaAtiv.reduce(
          (sum, i) => sum + Math.round(Number(i.coeficiente ?? 1) * Number(i.preco_unitario_centavos ?? 0)),
          0
        );

        let precoUnit = 0;
        if (custoInsumosCentavos > 0) {
          const precoTotCentavos = Math.round(custoInsumosCentavos * (1 + bdiAtiv / 100));
          precoUnit = precoTotCentavos / 100;
        }

        const subtotal = Math.round(qtd * (precoUnit * 100)) / 100;
        totalReais += subtotal;

        itensPayload.push({
          proposta_id: propostaId,
          descricao: a.descricao,
          unidade: a.unidade || "un",
          quantidade: qtd,
          valor_unitario: precoUnit,
          valor_total: subtotal,
          etapa_codigo: ep?.codigo || "01",
          etapa_nome: ep?.nome || "Etapa",
          codigo_referencia: a.codigo || `${ep?.codigo || "01"}.${String(idx + 1).padStart(2, "0")}`,
          ordem: idx,
        });
      });
    }
  }

  // 3b. Se analítico vazio, buscar itens legados
  if (itensPayload.length === 0) {
    const { data: legados } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_id", orc.id)
      .order("etapa", { ascending: true })
      .order("created_at", { ascending: true });

    if (legados && legados.length > 0) {
      legados.forEach((leg, idx) => {
        const qtd = Number(leg.quantidade ?? 1);
        const precoUnit = Number(leg.valor_unitario ?? 0) / 100;
        const subtotal = Math.round(qtd * (precoUnit * 100)) / 100;
        totalReais += subtotal;

        itensPayload.push({
          proposta_id: propostaId,
          descricao: leg.descricao,
          unidade: leg.unidade || "un",
          quantidade: qtd,
          valor_unitario: precoUnit,
          valor_total: subtotal,
          etapa_codigo: leg.etapa ? String(leg.etapa).slice(0, 2) : "01",
          etapa_nome: leg.etapa || "Geral",
          codigo_referencia: leg.codigo || `${idx + 1}`,
          ordem: idx,
        });
      });
    }
  }

  // Se nenhum item foi encontrado nem analítico nem legado, usa o total_estimado do orçamento se houver
  if (totalReais === 0 && orc.total_estimado) {
    totalReais = Number(orc.total_estimado) / 100;
  }

  // 4. Persistir na proposta e nos itens da proposta
  await supabase
    .from("propostas")
    .update({ valor_total: totalReais })
    .eq("id", propostaId);

  // Substituir itens
  await supabase.from("propostas_itens").delete().eq("proposta_id", propostaId);
  if (itensPayload.length > 0) {
    await supabase.from("propostas_itens").insert(itensPayload);
  }

  return {
    sucesso: true,
    propostaId,
    totalItens: itensPayload.length,
    valorTotalReais: totalReais,
    mensagem: `Proposta sincronizada: ${itensPayload.length} item(ns) atualizado(s), total R$ ${totalReais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
  };
}
