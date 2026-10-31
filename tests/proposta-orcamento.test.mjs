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

test('fotografia preserva preço comercial unitário e remove somente custo interno', () => {
  const revisao = {
    id: 'r1', numero: 1,
    fotografia: { etapas: [{ atividades: [{ precoUnitarioCentavos: 2500, precoTotalCentavos: 5000, custoUnitarioCentavos: 1200 }] }] },
  };
  const foto = criarFotografiaProposta(revisao, configuracaoPropostaPadrao);
  assert.equal(foto.etapas[0].atividades[0].precoUnitarioCentavos, 2500);
  assert.equal(foto.etapas[0].atividades[0].precoTotalCentavos, 5000);
  assert.equal('custoUnitarioCentavos' in foto.etapas[0].atividades[0], false);
});

test('converte a fotografia analítica plana real em etapas comerciais com preço e BDI', () => {
  const revisao = {
    id: 'r-real', numero: 3,
    fotografia: {
      orcamento: { bdi_geral: 25 },
      etapas: [{ id: 'e1', codigo: '01', nome: 'Fundação', ordem: 0 }],
      atividades: [{ id: 'a1', etapa_id: 'e1', codigo: '01.01', descricao: 'Concreto', unidade: 'm³', quantidade: 2, ordem: 0 }],
      insumos: [{ atividade_id: 'a1', categoria: 'material', coeficiente: 1.5, preco_unitario_centavos: 1000 }],
    },
  };
  const foto = criarFotografiaProposta(revisao, configuracaoPropostaPadrao);
  assert.equal(foto.etapas[0].atividades.length, 1);
  assert.equal(foto.etapas[0].atividades[0].precoUnitarioCentavos, 1875);
  assert.equal(foto.etapas[0].atividades[0].precoTotalCentavos, 3750);
  assert.equal(foto.etapas[0].valorTotalCentavos, 3750);
  assert.equal(foto.totalPrecoCentavos, 3750);
  assert.doesNotMatch(JSON.stringify(foto.etapas), /insumos|coeficiente|custo/i);
});

test('numera revisão e bloqueia nova fotografia após aceite', () => {
  assert.equal(proximaRevisaoProposta([{ numero: 1, status: 'rejeitada' }, { numero: 2, status: 'enviada' }]), 3);
  assert.throws(() => proximaRevisaoProposta([{ numero: 1, status: 'aceita' }]), /aceita/i);
});

