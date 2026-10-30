import test from 'node:test';
import assert from 'node:assert/strict';
import { configuracaoPropostaPadrao, criarFotografiaProposta, proximaRevisaoProposta } from '../src/lib/proposta-orcamento.functions.ts';

test('proposta padrão expõe etapas e atividades sem custos internos, BDI ou insumos', () => {
  assert.deepEqual(configuracaoPropostaPadrao, {
    mostrarEtapas: true, mostrarAtividades: true, mostrarQuantidades: true,
    mostrarUnidades: true, mostrarPrecoUnitario: false, mostrarComposicoes: false,
    mostrarCustosInternos: false, mostrarBdi: false,
  });
});

test('fotografia comercial é imutável em relação à revisão de origem', () => {
  const revisao = { id: 'r1', numero: 2, fotografia: { etapas: [{ nome: 'Fundação' }], totalPrecoCentavos: 12300 } };
  const foto = criarFotografiaProposta(revisao, configuracaoPropostaPadrao);
  revisao.fotografia.etapas[0].nome = 'Alterada';
  assert.equal(foto.etapas[0].nome, 'Fundação');
  assert.equal(foto.orcamentoRevisaoId, 'r1');
});

test('numera revisão e bloqueia nova fotografia após aceite', () => {
  assert.equal(proximaRevisaoProposta([{ numero: 1, status: 'rejeitada' }, { numero: 2, status: 'enviada' }]), 3);
  assert.throws(() => proximaRevisaoProposta([{ numero: 1, status: 'aceita' }]), /aceita/i);
});

