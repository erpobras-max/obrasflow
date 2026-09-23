import test from 'node:test';
import assert from 'node:assert/strict';
import { accessDiagnostic } from '../src/lib/acesso-diagnostico.ts';

test('permissão negada informa causa e etapa sem expor a resposta interna', () => {
  const result = accessDiagnostic('vincular_usuario', {
    code: '42501', message: 'secret-token', details: 'cpf=12345678901', status: 403,
  });
  assert.equal(result.code, '42501');
  assert.equal(result.stage, 'vincular_usuario');
  assert.match(result.message, /banco negou permissão/);
  assert.doesNotMatch(JSON.stringify(result), /secret-token|12345678901/);
});

test('confirmação pendente e ausência de email têm diagnósticos distintos', () => {
  assert.match(accessDiagnostic('criar_sessao_direta', { code: 'email_not_confirmed' }).message, /ainda não está confirmado/);
  assert.match(accessDiagnostic('auth_sem_email').message, /conta de acesso está sem e-mail/);
});

test('cadastro ausente, perfil bloqueado e migração faltante são diferenciados', () => {
  assert.match(accessDiagnostic('cadastro_nao_encontrado').message, /cadastro ativo/);
  assert.match(accessDiagnostic('perfil_inativo').message, /desativado/);
  assert.match(accessDiagnostic('buscar_cliente_civil', { code: 'PGRST204' }).message, /migrações/);
});

test('códigos desconhecidos e mensagens arbitrárias não são enviados ao navegador', () => {
  const result = accessDiagnostic('private-stage', { code: 'secret-code', message: 'private-email', status: 401 });
  assert.equal(result.code, 'ACESSO_FALHOU');
  assert.equal(result.stage, 'processar_acesso');
  assert.match(result.message, /credencial/);
  assert.doesNotMatch(JSON.stringify(result), /secret-code|private-email|private-stage/);
});
