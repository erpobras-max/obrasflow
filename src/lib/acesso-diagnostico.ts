const stages: Record<string, string> = {
  documento_invalido: "Informe um CPF com 11 números ou CNPJ com 14 números, conforme a área escolhida.",
  cadastro_nao_encontrado: "Não foi encontrado um cadastro ativo nesta área para o documento informado. Peça à empresa para conferir o documento e a situação do cadastro.",
  sem_contato: "O cadastro está sem e-mail ou telefone válido para vincular a conta. Peça à empresa para completar o cadastro.",
  perfil_inativo: "O acesso deste usuário está desativado. Solicite a reativação à empresa.",
  auth_sem_email: "A conta de acesso está sem e-mail e o acesso direto atual exige esse vínculo. A empresa precisa corrigir a conta de acesso.",
  configurar_servidor: "A configuração de autenticação do servidor está ausente ou inválida. Avise o administrador.",
  buscar_cliente_civil: "Não foi possível consultar o cadastro de clientes da área civil.",
  buscar_cadastro: "Não foi possível consultar o cadastro da área selecionada.",
  buscar_perfil_existente: "Não foi possível consultar o vínculo da conta de acesso.",
  criar_usuario: "Não foi possível criar a conta de acesso vinculada ao cadastro.",
  vincular_usuario: "Não foi possível salvar o vínculo entre o cadastro e a conta de acesso.",
  validar_perfil: "Não foi possível consultar as permissões da conta.",
  criar_perfil: "Não foi possível criar o perfil de acesso.",
  atribuir_cargo: "Não foi possível atribuir o cargo necessário para esta área.",
  buscar_usuario_auth: "A conta vinculada ao cadastro não pôde ser consultada. Solicite a revisão do vínculo à empresa.",
  preparar_acesso_direto: "Não foi possível preparar a autenticação da conta.",
  criar_sessao_direta: "Não foi possível iniciar a sessão da conta.",
  salvar_sessao: "O servidor autorizou o acesso, mas o navegador não conseguiu iniciar a sessão. Tente novamente.",
};

const causes: Record<string, string> = {
  "42501": "O banco negou permissão nesta operação. O administrador precisa revisar as permissões e a credencial do servidor.",
  "23505": "Já existe um registro com os mesmos dados. O administrador precisa revisar os vínculos duplicados.",
  "23503": "O cadastro aponta para um registro que não existe mais. Solicite a revisão do vínculo.",
  "42703": "Uma coluna necessária não existe no banco. O administrador precisa conferir as migrações.",
  "42P01": "Uma tabela necessária não existe no banco. O administrador precisa conferir as migrações.",
  PGRST204: "O banco não reconhece uma coluna necessária. Confira as migrações e o cache do esquema.",
  PGRST205: "O banco não reconhece uma tabela necessária. Confira as migrações e o cache do esquema.",
  PGRST116: "Foram encontrados vínculos duplicados ou um registro obrigatório não retornou. Solicite a revisão do cadastro.",
  email_not_confirmed: "O e-mail da conta de acesso ainda não está confirmado.",
  phone_not_confirmed: "O celular da conta de acesso ainda não está confirmado.",
  invalid_credentials: "O serviço de autenticação recusou as credenciais da conta vinculada.",
  email_exists: "O e-mail já está vinculado a outra conta de acesso.",
  user_already_exists: "Já existe uma conta de acesso com esses dados. Solicite a revisão do vínculo.",
  user_not_found: "A conta de acesso vinculada ao cadastro não existe mais.",
  user_banned: "A conta está bloqueada no serviço de autenticação.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
  weak_password: "O serviço de autenticação rejeitou a preparação do acesso. Avise o administrador.",
};

export function accessDiagnostic(stage: string, error?: unknown) {
  const failure = error as { code?: unknown; status?: unknown } | undefined;
  // Only allowlisted provider codes leave the server; never forward raw messages or SQL details.
  const rawCode = typeof failure?.code === "string" ? failure.code : "";
  const code = Object.hasOwn(causes, rawCode) ? rawCode : "ACESSO_FALHOU";
  const status = typeof failure?.status === "number" ? failure.status : undefined;
  const cause = causes[code] ?? (status === 401 || status === 403
    ? "O serviço recusou a autorização do servidor. O administrador precisa revisar a credencial de acesso."
    : status === 429 ? "Muitas tentativas em pouco tempo. Aguarde e tente novamente." : "");
  return {
    code,
    stage: Object.hasOwn(stages, stage) ? stage : "processar_acesso",
    message: [stages[stage] ?? "Ocorreu uma falha ao processar o acesso. Avise o administrador com a referência abaixo.", cause].filter(Boolean).join(" "),
  };
}
