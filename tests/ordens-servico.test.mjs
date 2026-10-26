import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularStatusPrazo,
  gerarLinkWhatsApp,
  ordemServicoSchema,
} from '../src/lib/ordens-servico.schema.ts';

test('calcularStatusPrazo classifica corretamente o status de conclusão e atraso', () => {
  // Concluída
  const concluida = calcularStatusPrazo('2026-10-01', 'concluida');
  assert.equal(concluida.tipo, 'concluida');
  assert.equal(concluida.label, 'Concluída');

  // Cancelada
  const cancelada = calcularStatusPrazo('2026-10-01', 'cancelada');
  assert.equal(cancelada.tipo, 'cancelada');

  // Atrasada (data no passado)
  const atrasada = calcularStatusPrazo('2020-01-01', 'aberta');
  assert.equal(atrasada.tipo, 'atrasada');
  assert.ok(atrasada.diasDiferenca < 0);

  // Vence no futuro distante
  const futuro = calcularStatusPrazo('2035-12-31', 'aberta');
  assert.equal(futuro.tipo, 'no_prazo');
  assert.ok(futuro.diasDiferenca > 3);
});

test('gerarLinkWhatsApp formata número de telefone brasileiro e monta URL wa.me com texto', () => {
  const os = {
    numero: 'OS-0001',
    titulo: 'Conserto de Bomba',
    data_previsao: '2026-10-30',
    status: 'aberta',
    responsavel_nome: 'Carlos Encarregado',
    obra_nome: 'Residencial Aurora',
  };

  // Sem telefone retorna null
  assert.equal(gerarLinkWhatsApp(null, os), null);
  assert.equal(gerarLinkWhatsApp('', os), null);
  assert.equal(gerarLinkWhatsApp('123', os), null);

  // Com telefone comum (11) 98765-4321
  const link = gerarLinkWhatsApp('(11) 98765-4321', os);
  assert.ok(link);
  assert.ok(link.startsWith('https://wa.me/5511987654321?text='));
  assert.ok(link.includes('Carlos'));
  assert.ok(link.includes('OS-0001'));
  assert.ok(link.includes('Residencial%20Aurora'));
});

test('ordemServicoSchema valida campos mínimos obrigatórios', () => {
  // Válido
  const valido = ordemServicoSchema.safeParse({
    titulo: 'Pintura externa',
    data_previsao: '2026-11-15',
    prioridade: 'alta',
    status: 'aberta',
  });
  assert.ok(valido.success);

  // Título muito curto
  const tituloInvalido = ordemServicoSchema.safeParse({
    titulo: 'Oi',
    data_previsao: '2026-11-15',
  });
  assert.equal(tituloInvalido.success, false);

  // Data previsão ausente
  const semData = ordemServicoSchema.safeParse({
    titulo: 'Instalação elétrica',
    data_previsao: '',
  });
  assert.equal(semData.success, false);
});
