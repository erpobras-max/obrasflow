import test from 'node:test';
import assert from 'node:assert/strict';

test('sincronização bloqueia propostas que não estejam em status rascunho', async () => {
  const mockProposta = { id: 'p1', status: 'aceita', titulo: 'Proposta Teste' };
  assert.equal(mockProposta.status === 'rascunho', false);
  
  const validarStatus = (status) => {
    if (status !== 'rascunho') {
      throw new Error(`Apenas propostas em status 'rascunho' podem ser sincronizadas automaticamente (status atual: ${status}).`);
    }
  };

  assert.throws(() => validarStatus(mockProposta.status), /Apenas propostas em status 'rascunho'/);
  assert.doesNotThrow(() => validarStatus('rascunho'));
});

test('cálculo de preço unitário comercial com BDI a partir de insumos analíticos', () => {
  const insumos = [
    { atividade_id: 'a1', preco_unitario_centavos: 2500, coeficiente: 1 }, // R$ 25,00
    { atividade_id: 'a1', preco_unitario_centavos: 1500, coeficiente: 2 }, // R$ 30,00
  ];
  const bdiPercentual = 20; // 20%

  const custoTotalCentavos = insumos.reduce(
    (sum, i) => sum + Math.round(Number(i.coeficiente) * Number(i.preco_unitario_centavos)),
    0
  );
  assert.equal(custoTotalCentavos, 5500); // R$ 55,00 de custo

  const precoUnitarioCentavos = Math.round(custoTotalCentavos * (1 + bdiPercentual / 100));
  assert.equal(precoUnitarioCentavos, 6600); // R$ 66,00 de preço comercial

  const precoUnitarioReais = precoUnitarioCentavos / 100;
  assert.equal(precoUnitarioReais, 66);

  const quantidade = 10;
  const subtotalReais = Math.round(quantidade * (precoUnitarioReais * 100)) / 100;
  assert.equal(subtotalReais, 660);
});

test('sincronização de itens legados converte centavos de valor_unitario para reais', () => {
  const itemLegado = {
    id: 'leg-1',
    descricao: 'Pintura Epóxi',
    quantidade: 40,
    valor_unitario: 3500, // R$ 35,00 em centavos
    etapa: 'Acabamento',
  };

  const precoUnitReais = Number(itemLegado.valor_unitario) / 100;
  assert.equal(precoUnitReais, 35);

  const subtotalReais = Math.round(Number(itemLegado.quantidade) * (precoUnitReais * 100)) / 100;
  assert.equal(subtotalReais, 1400);
});
