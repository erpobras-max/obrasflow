-- Permite que o cliente administrativo atualize o vínculo do cadastro civil
-- durante o acesso direto por CPF/CNPJ. A atualização revalida o CHECK de
-- CPF/CNPJ e executa o gatilho de auditoria, portanto ambas as funções
-- precisam aceitar chamadas da role de serviço.
GRANT EXECUTE ON FUNCTION public.validar_cpf_cnpj(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_clientes() TO service_role;

