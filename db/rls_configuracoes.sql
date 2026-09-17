-- RLS para configuracoes_empresa (PostgreSQL compatível)
DROP POLICY IF EXISTS config_empresa_rls_select ON configuracoes_empresa;
DROP POLICY IF EXISTS config_empresa_rls_insert ON configuracoes_empresa;
DROP POLICY IF EXISTS config_empresa_rls_update ON configuracoes_empresa;
DROP POLICY IF EXISTS config_empresa_rls_delete ON configuracoes_empresa;

CREATE POLICY config_empresa_rls_select ON configuracoes_empresa FOR SELECT USING (true);
CREATE POLICY config_empresa_rls_insert ON configuracoes_empresa FOR INSERT WITH CHECK (true);
ALTER TABLE configuracoes_empresa ADD COLUMN IF NOT EXISTS clausula_padrao TEXT;
CREATE POLICY config_empresa_rls_update ON configuracoes_empresa FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY config_empresa_rls_delete ON configuracoes_empresa FOR DELETE USING (true);
