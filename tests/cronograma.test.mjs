import test from 'node:test';
import assert from 'node:assert/strict';
import { situacaoEtapa, validarLancamentoCronograma } from '../src/lib/cronograma.ts';

const etapa = { data_inicio: '2026-09-01', data_fim: '2026-09-30', meta_percentual: 100, progresso: 20 };
test('período inclui início e fim, atraso somente após o prazo e sem meta atingida', () => {
  assert.equal(situacaoEtapa(etapa, '2026-08-31'), 'Programada');
  assert.equal(situacaoEtapa(etapa, '2026-09-01'), 'Dentro do período previsto');
  assert.equal(situacaoEtapa(etapa, '2026-09-30'), 'Dentro do período previsto');
  assert.equal(situacaoEtapa(etapa, '2026-10-01'), 'Prazo vencido');
  assert.equal(situacaoEtapa({...etapa, progresso: 100}, '2026-10-01'), 'Meta atingida');
  assert.equal(situacaoEtapa({...etapa, data_fim: null}, '2026-10-01'), 'Prazo a definir');
});
test('meta parcial é independente por etapa e aceita decimal brasileiro', () => {
  assert.equal(situacaoEtapa({...etapa, meta_percentual: 50, progresso: 50}, '2026-10-01'), 'Meta atingida');
  assert.deepEqual(validarLancamentoCronograma('2026-09-01','2026-09-30','100','29,5'), {
    data_inicio:'2026-09-01',data_fim:'2026-09-30',meta_percentual:100,progresso:29.5
  });
});
test('rejeita período invertido, prazo vazio e percentuais inválidos', () => {
  assert.throws(() => validarLancamentoCronograma('2026-10-01','2026-09-30','100','0'));
  assert.throws(() => validarLancamentoCronograma('','2026-09-30','100','0'));
  for (const valor of ['', ' ', 'NaN', '-1', '101']) {
    assert.throws(() => validarLancamentoCronograma('2026-09-01','2026-09-30',valor,'0'));
    assert.throws(() => validarLancamentoCronograma('2026-09-01','2026-09-30','100',valor));
  }
});
