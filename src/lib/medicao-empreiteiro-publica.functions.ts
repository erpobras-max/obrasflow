import { supabase } from "@/lib/supabase";
import { uploadR2, deleteR2, getR2Url } from "@/lib/r2";

/**
 * Gera um token seguro e link público para o empreiteiro visualizar o boletim.
 */
export async function gerarLinkPublicoMedicao(medicaoId: string) {
  const { data: user } = await supabase.auth.getUser();

  // Gerar token aleatório seguro de 32 caracteres hex
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");

  // Expira em 30 dias por padrão
  const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("medicao_empreiteiro_links")
    .insert({
      medicao_empreiteiro_id: medicaoId,
      token_hash: token,
      expira_em: expiraEm,
      revogado: false,
      created_by: user.user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;

  const url = `${window.location.origin}/medicao-empreiteiro/${token}`;
  return { token, url, id: data.id, expiraEm };
}

/**
 * Revoga um link público para impedir acesso futuro.
 */
export async function revogarLinkPublicoMedicao(linkId: string) {
  const { error } = await supabase
    .from("medicao_empreiteiro_links")
    .update({
      revogado: true,
      revogado_em: new Date().toISOString(),
    })
    .eq("id", linkId);

  if (error) throw error;
}

/**
 * Busca links públicos ativos gerados para esta medição.
 */
export async function listarLinksPublicosMedicao(medicaoId: string) {
  const { data, error } = await supabase
    .from("medicao_empreiteiro_links")
    .select("*")
    .eq("medicao_empreiteiro_id", medicaoId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Valida o token e carrega os dados completos para visualização pública pelo empreiteiro.
 */
export async function buscarDadosMedicaoPorToken(token: string) {
  // 1. Validar link
  const { data: link, error: errLink } = await supabase
    .from("medicao_empreiteiro_links")
    .select("*")
    .eq("token_hash", token)
    .eq("revogado", false)
    .single();

  if (errLink || !link) {
    throw new Error("Link de medição inválido ou revogado.");
  }

  if (new Date(link.expira_em) < new Date()) {
    throw new Error("Este link de medição expirou.");
  }

  const medicaoId = link.medicao_empreiteiro_id;

  // 2. Buscar cabeçalho da medição
  const { data: medicao, error: errMedicao } = await supabase
    .from("medicoes_empreiteiros")
    .select("*")
    .eq("id", medicaoId)
    .single();

  if (errMedicao || !medicao) {
    throw new Error("Boletim de medição não encontrado.");
  }

  // 3. Buscar contrato, obra e prestador
  const { data: contrato, error: errContrato } = await supabase
    .from("contratos_empreiteiros")
    .select(
      `
      *,
      obras:obra_id ( id, nome, endereco ),
      fornecedores:fornecedor_id ( id, nome, razao_social, cnpj_cpf, telefone, email )
    `
    )
    .eq("id", medicao.contrato_empreiteiro_id)
    .single();

  if (errContrato || !contrato) {
    throw new Error("Contrato associado não encontrado.");
  }

  // 4. Buscar itens medidos
  const { data: medItens, error: errItens } = await supabase
    .from("medicoes_terceirizados")
    .select(
      `
      *,
      servicos_terceirizados:servico_id ( id, descricao, unidade, codigo, etapa, preco_unitario_centavos, quantidade_total )
    `
    )
    .eq("medicao_empreiteiro_id", medicaoId);

  if (errItens) throw errItens;

  // 5. Buscar deduções e ajustes
  const { data: ajustes } = await supabase
    .from("medicao_empreiteiro_ajustes")
    .select("*")
    .eq("medicao_empreiteiro_id", medicaoId);

  // 6. Buscar fotos / anexos de evidências
  const { data: anexos } = await supabase
    .from("medicao_empreiteiro_anexos")
    .select("*")
    .eq("medicao_empreiteiro_id", medicaoId)
    .order("created_at", { ascending: false });

  // 7. Dados cadastrais da empresa
  const { data: empresa } = await supabase
    .from("configuracoes_empresa")
    .select("*")
    .limit(1)
    .single();

  return {
    medicao,
    contrato,
    itens: medItens || [],
    ajustes: ajustes || [],
    anexos: (anexos || []).map((a: any) => ({
      ...a,
      url: getR2Url(a.r2_key),
    })),
    empresa: empresa || null,
  };
}

/**
 * Faz upload de evidência fotográfica da medição e registra em medicao_empreiteiro_anexos.
 */
export async function uploadFotoEvidenciaMedicao(
  medicaoId: string,
  file: File,
  descricao?: string
) {
  const { data: user } = await supabase.auth.getUser();

  // Upload para R2
  const r2Key = await uploadR2(file, "medicoes-empreiteiros");

  const { data, error } = await supabase
    .from("medicao_empreiteiro_anexos")
    .insert({
      medicao_empreiteiro_id: medicaoId,
      r2_key: r2Key,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      mime_type: file.type,
      descricao: descricao || null,
      created_by: user.user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, url: getR2Url(r2Key) };
}

/**
 * Exclui anexo fotográfico do R2 e do banco de dados.
 */
export async function excluirFotoEvidenciaMedicao(anexoId: string, r2Key: string) {
  await deleteR2(r2Key);
  const { error } = await supabase.from("medicao_empreiteiro_anexos").delete().eq("id", anexoId);
  if (error) throw error;
}

