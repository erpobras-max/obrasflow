import { onlyDigits } from "@/lib/validacao-documento";

export interface EmpresaCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  situacaoCadastral: string;
  dataAbertura: string;
  atividadePrincipal: string;
}

// Consulta pública via BrasilAPI, que disponibiliza dados cadastrais públicos.
// O usuário pode corrigir qualquer campo antes de salvar.
export async function buscarCnpj(cnpjRaw: string): Promise<EmpresaCnpj | null> {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return null;

  try {
    const response = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + cnpj);
    if (!response.ok) return null;
    const data = await response.json();

    const telefone = [data.ddd_telefone_1, data.ddd_telefone_2]
      .filter(Boolean)
      .map((numero: string) => String(numero).replace(/\D/g, ""))
      .find(Boolean) ?? "";

    return {
      cnpj,
      razaoSocial: data.razao_social ?? "",
      nomeFantasia: data.nome_fantasia ?? "",
      inscricaoEstadual: data.inscricao_estadual ?? "",
      email: data.correio_eletronico ?? "",
      telefone,
      cep: String(data.cep ?? "").replace(/\D/g, ""),
      logradouro: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" "),
      numero: String(data.numero ?? ""),
      complemento: data.complemento ?? "",
      bairro: data.bairro ?? "",
      cidade: data.municipio ?? "",
      uf: data.uf ?? "",
      situacaoCadastral: data.descricao_situacao_cadastral ?? "",
      dataAbertura: data.data_inicio_atividade ?? "",
      atividadePrincipal: data.cnae_fiscal_descricao ?? "",
    };
  } catch {
    return null;
  }
}
