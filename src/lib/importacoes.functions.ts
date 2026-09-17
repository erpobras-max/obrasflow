import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

// Zod schemas for input validation in the Server Functions
const importClientesSchema = z.object({
  logId: z.string().uuid(),
  rows: z.array(z.object({
    tipo: z.enum(["pf", "pj"]),
    nome: z.string().trim().min(1),
    nome_fantasia: z.string().trim().nullable().optional(),
    cpf_cnpj: z.string().trim().min(1),
    rg_ie: z.string().trim().nullable().optional(),
    email: z.string().trim().nullable().optional(),
    telefone: z.string().trim().nullable().optional(),
    celular: z.string().trim().nullable().optional(),
    cep: z.string().trim().nullable().optional(),
    logradouro: z.string().trim().nullable().optional(),
    numero: z.string().trim().nullable().optional(),
    complemento: z.string().trim().nullable().optional(),
    bairro: z.string().trim().nullable().optional(),
    cidade: z.string().trim().nullable().optional(),
    uf: z.string().trim().nullable().optional(),
    observacoes: z.string().trim().nullable().optional(),
  }))
});

const importProdutosSchema = z.object({
  logId: z.string().uuid(),
  rows: z.array(z.object({
    sku: z.string().trim().min(1),
    nome: z.string().trim().min(1),
    categoria: z.string().trim().nullable().optional(),
    unidade: z.string().trim().default("UN"),
    preco_custo: z.coerce.number().default(0),
    preco_venda: z.coerce.number().default(0),
    ncm: z.string().trim().nullable().optional(),
    gtin: z.string().trim().nullable().optional(),
    situacao: z.enum(["ativo", "inativo"]).default("ativo"),
    estoque_min: z.coerce.number().default(0),
    estoque_max: z.coerce.number().default(0),
    estoque_inicial: z.coerce.number().default(0),
  }))
});

const importPedidosVendaSchema = z.object({
  logId: z.string().uuid(),
  rows: z.array(z.object({
    numero: z.coerce.number().int(),
    cliente_cpf_cnpj: z.string().trim().min(1),
    vendedor_email: z.string().trim().nullable().optional(),
    situacao: z.enum(["em_aberto", "atendido", "cancelado"]).default("em_aberto"),
    forma_pagamento: z.string().trim().nullable().optional(),
    valor_frete: z.coerce.number().default(0),
    valor_desconto: z.coerce.number().default(0),
    observacoes: z.string().trim().nullable().optional(),
    itens: z.array(z.object({
      sku: z.string().trim().min(1),
      quantidade: z.coerce.number().min(0.001),
      valor_unitario: z.coerce.number().min(0),
    })).min(1),
  }))
});

const importFinanceiroSchema = z.object({
  logId: z.string().uuid(),
  tipoFinanceiro: z.enum(["pagar", "receber"]),
  rows: z.array(z.object({
    vencimento: z.string().trim(),
    descricao: z.string().trim().min(1),
    categoria: z.string().trim().nullable().optional(),
    documento_doc: z.string().trim().min(1), // CPF/CNPJ ou Razão Social
    valor: z.coerce.number().min(0.01),
    situacao: z.string().trim().default("aberta"),
    numero_documento: z.string().trim().nullable().optional(),
  }))
});

// Help functions to log errors
async function logErroImportacao(supabase: any, logId: string, linha: number, campo: string, mensagem: string) {
  await supabase.from("importacoes_erros").insert({
    importacao_id: logId,
    linha,
    campo,
    mensagem,
  });
}

async function updateLogStats(supabase: any, logId: string, sucessoInc: number, errosInc: number) {
  // We use standard increment
  const { data } = await supabase.from("importacoes_log").select("sucesso, erros").eq("id", logId).single();
  if (data) {
    await supabase.from("importacoes_log").update({
      sucesso: (data.sucesso || 0) + sucessoInc,
      erros: (data.erros || 0) + errosInc,
    }).eq("id", logId);
  }
}

// 1. Server Fn: Import Clientes
export const importarClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importClientesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let sucesso = 0;
    let erros = 0;

    for (let idx = 0; idx < data.rows.length; idx++) {
      const row = data.rows[idx];
      const linhaReal = idx + 1;

      try {
        const cleanCpfCnpj = row.cpf_cnpj.replace(/\D/g, "");

        // Find existing client by CPF/CNPJ
        const { data: existing } = await supabase
          .from("clientes")
          .select("id")
          .eq("cpf_cnpj", cleanCpfCnpj)
          .is("deleted_at", null)
          .maybeSingle();

        const payload = {
          tipo: row.tipo,
          nome: row.nome,
          nome_fantasia: row.nome_fantasia || null,
          cpf_cnpj: cleanCpfCnpj,
          rg_ie: row.rg_ie || null,
          email: row.email || null,
          telefone: row.telefone || null,
          celular: row.celular || null,
          cep: row.cep || null,
          logradouro: row.logradouro || null,
          numero: row.numero || null,
          complemento: row.complemento || null,
          bairro: row.bairro || null,
          cidade: row.cidade || null,
          uf: row.uf || null,
          observacoes: row.observacoes || null,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          const { error } = await supabase.from("clientes").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("clientes").insert({
            ...payload,
            status: "ativo",
          });
          if (error) throw error;
        }
        sucesso++;
      } catch (e: any) {
        erros++;
        await logErroImportacao(supabase, data.logId, linhaReal, "cpf_cnpj", e.message || "Erro desconhecido");
      }
    }

    await updateLogStats(supabase, data.logId, sucesso, erros);
    return { sucesso, erros };
  });

// 2. Server Fn: Import Produtos
export const importarProdutos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importProdutosSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let sucesso = 0;
    let erros = 0;

    // Get default Warehouse
    const { data: dep } = await supabase.from("depositos").select("id").eq("codigo", "DPG").maybeSingle();
    const depositoId = dep?.id;

    for (let idx = 0; idx < data.rows.length; idx++) {
      const row = data.rows[idx];
      const linhaReal = idx + 1;

      try {
        const { data: existing } = await supabase
          .from("produtos")
          .select("id")
          .eq("sku", row.sku)
          .maybeSingle();

        const payload = {
          sku: row.sku,
          nome: row.nome,
          categoria: row.categoria || null,
          unidade: row.unidade,
          preco_custo: row.preco_custo,
          preco_venda: row.preco_venda,
          ncm: row.ncm || null,
          gtin: row.gtin || null,
          situacao: row.situacao,
          estoque_min: row.estoque_min,
          estoque_max: row.estoque_max,
          updated_at: new Date().toISOString(),
        };

        let produtoId = existing?.id;

        if (existing) {
          const { error } = await supabase.from("produtos").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { data: newProd, error } = await supabase.from("produtos").insert(payload).select("id").single();
          if (error) throw error;
          produtoId = newProd.id;
        }

        // Initialize stock balance if requested and default warehouse exists
        if (produtoId && depositoId && row.estoque_inicial > 0) {
          const { error: stockErr } = await supabase.rpc("registrar_movimentacao_produto", {
            p_produto_id: produtoId,
            p_deposito_id: depositoId,
            p_tipo: "ajuste",
            p_quantidade: row.estoque_inicial,
            p_custo_unitario: row.preco_custo,
            p_deposito_destino_id: null,
            p_observacao: "Saldo inicial via importação de dados",
          });
          if (stockErr) console.warn("Erro ao definir saldo inicial de estoque:", stockErr.message);
        }

        sucesso++;
      } catch (e: any) {
        erros++;
        await logErroImportacao(supabase, data.logId, linhaReal, "sku", e.message || "Erro desconhecido");
      }
    }

    await updateLogStats(supabase, data.logId, sucesso, erros);
    return { sucesso, erros };
  });

// 3. Server Fn: Import Pedidos de Venda
export const importarPedidosVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importPedidosVendaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let sucesso = 0;
    let erros = 0;

    // Get default Warehouse
    const { data: dep } = await supabase.from("depositos").select("id").eq("codigo", "DPG").maybeSingle();
    const depositoId = dep?.id;

    if (!depositoId) {
      throw new Error("Depósito Geral (DPG) não configurado no sistema.");
    }

    for (let idx = 0; idx < data.rows.length; idx++) {
      const row = data.rows[idx];
      const linhaReal = idx + 1;

      try {
        // Check if order number already exists
        const { data: existing } = await supabase
          .from("pedidos_venda")
          .select("id")
          .eq("numero", row.numero)
          .maybeSingle();

        if (existing) {
          // Skip order to prevent duplicates
          sucesso++;
          continue;
        }

        // Find customer by CPF/CNPJ
        const cleanDoc = row.cliente_cpf_cnpj.replace(/\D/g, "");
        const { data: client } = await supabase
          .from("clientes")
          .select("id")
          .eq("cpf_cnpj", cleanDoc)
          .is("deleted_at", null)
          .maybeSingle();

        if (!client) {
          throw new Error(`Cliente com documento ${row.cliente_cpf_cnpj} não cadastrado.`);
        }

        // Calculate totals
        let valorProdutos = 0;
        const mappedItens: any[] = [];

        // Validate items and retrieve their DB ids
        for (const item of row.itens) {
          const { data: prod } = await supabase
            .from("produtos")
            .select("id")
            .eq("sku", item.sku)
            .maybeSingle();

          if (!prod) {
            throw new Error(`Produto SKU ${item.sku} não cadastrado.`);
          }

          const itemTotal = item.quantidade * item.valor_unitario;
          valorProdutos += itemTotal;

          mappedItens.push({
            produto_id: prod.id,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: itemTotal,
          });
        }

        const valorTotal = valorProdutos + row.valor_frete - row.valor_desconto;

        // Insert order
        const { data: order, error: orderErr } = await supabase
          .from("pedidos_venda")
          .insert({
            numero: row.numero,
            cliente_id: client.id,
            deposito_id: depositoId,
            situacao: row.situacao,
            forma_pagamento: row.forma_pagamento || null,
            valor_frete: row.valor_frete,
            valor_desconto: row.valor_desconto,
            valor_produtos: valorProdutos,
            valor_total: valorTotal,
            observacoes: row.observacoes || null,
            nfe_status: "rascunho",
          })
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        // Insert items
        const finalItens = mappedItens.map((it) => ({
          ...it,
          pedido_venda_id: order.id,
        }));

        const { error: itemsErr } = await supabase.from("pedidos_venda_itens").insert(finalItens);
        if (itemsErr) throw itemsErr;

        // If marked as 'atendido', trigger automatic stock reduction and billing
        if (row.situacao === "atendido") {
          // The AFTER UPDATE trigger on pedidos_venda handles this. Let's fire it by doing a dummy update.
          await supabase.from("pedidos_venda").update({ updated_at: new Date().toISOString() }).eq("id", order.id);
        }

        sucesso++;
      } catch (e: any) {
        erros++;
        await logErroImportacao(supabase, data.logId, linhaReal, "numero", e.message || "Erro desconhecido");
      }
    }

    await updateLogStats(supabase, data.logId, sucesso, erros);
    return { sucesso, erros };
  });

// 4. Server Fn: Import Contas a Pagar/Receber (Financeiro)
export const importarContasPagarReceber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importFinanceiroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let sucesso = 0;
    let erros = 0;

    for (let idx = 0; idx < data.rows.length; idx++) {
      const row = data.rows[idx];
      const linhaReal = idx + 1;

      try {
        const cleanDoc = row.documento_doc.replace(/\D/g, "");
        const valorCentavos = Math.round(row.valor * 100);

        if (data.tipoFinanceiro === "receber") {
          // Find matching customer
          let clienteId: string | null = null;
          if (cleanDoc) {
            const { data: c } = await supabase.from("clientes").select("id").eq("cpf_cnpj", cleanDoc).is("deleted_at", null).maybeSingle();
            clienteId = c?.id || null;
          }
          if (!clienteId) {
            const { data: c } = await supabase.from("clientes").select("id").ilike("nome", `%${row.documento_doc}%`).is("deleted_at", null).limit(1).maybeSingle();
            clienteId = c?.id || null;
          }

          const { error } = await supabase.from("contas_receber").insert({
            cliente_id: clienteId,
            descricao: row.descricao,
            valor_total: valorCentavos,
            data_vencimento: row.vencimento,
            status: row.situacao === "recebida" || row.situacao === "paga" ? "recebida" : "aberta",
            observacoes: `Importado via Planilha. Documento Origem: ${row.documento_doc}`,
            numero_documento: row.numero_documento || null,
          });
          if (error) throw error;

        } else {
          // Find matching supplier (fornecedores)
          let fornecedorId: string | null = null;
          if (cleanDoc) {
            const { data: f } = await supabase.from("fornecedores").select("id").or(`cnpj.eq.${cleanDoc},cpf.eq.${cleanDoc}`).maybeSingle();
            fornecedorId = f?.id || null;
          }
          if (!fornecedorId) {
            const { data: f } = await supabase.from("fornecedores").select("id").ilike("razao_social", `%${row.documento_doc}%`).limit(1).maybeSingle();
            fornecedorId = f?.id || null;
          }

          const { error } = await supabase.from("contas_pagar").insert({
            fornecedor_id: fornecedorId,
            descricao: row.descricao,
            valor_total: valorCentavos,
            data_vencimento: row.vencimento,
            status: row.situacao === "paga" || row.situacao === "pago" ? "paga" : "aberta",
            observacoes: `Importado via Planilha. Documento Origem: ${row.documento_doc}`,
            numero_documento: row.numero_documento || null,
          });
          if (error) throw error;
        }

        sucesso++;
      } catch (e: any) {
        erros++;
        await logErroImportacao(supabase, data.logId, linhaReal, "descricao", e.message || "Erro desconhecido");
      }
    }

    await updateLogStats(supabase, data.logId, sucesso, erros);
    return { sucesso, erros };
  });
