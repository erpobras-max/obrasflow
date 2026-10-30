import test from 'node:test';
import assert from 'node:assert/strict';
import {
  converterEntradaMedicao,
  calcularSaldoItem,
  calcularResumoMedicao,
  validarPlanilhaContrato,
} from '../src/lib/contratos-empreiteiros.ts';

test('converterEntradaMedicao: por quantidade calcula valor e percentual com precisão', () => {
  const item = {
    descricao: 'Alvenaria de vedação 14x19x39 cm',
    unidade: 'm²',
    quantidadeContratada: 100,
    precoUnitarioCentavos: 5000, // R$ 50,00
  }; // Total = R$ 5.000,00 (500000 centavos)

  const res = converterEntradaMedicao(item, { modo: 'quantidade', quantidade: 25.5 });
  assert.equal(res.quantidade, 25.5);
  assert.equal(res.valorCentavos, 127500); // 25.5 * 5000 = 127500 centavos (R$ 1.275,00)
  assert.equal(res.percentual, 25.5);
});

test('converterEntradaMedicao: por percentual calcula valor e quantidade com precisão', () => {
  const item = {
    descricao: 'Pintura acrílica interna',
    unidade: 'm²',
    quantidadeContratada: 200,
    precoUnitarioCentavos: 3000, // R$ 30,00 -> Total R$ 6.000,00 (600000 centavos)
  };

  const res = converterEntradaMedicao(item, { modo: 'percentual', percentual: 33.3333 });
  assert.equal(res.percentual, 33.3333);
  // (33.3333 / 100) * 600000 = 199999.8 -> 200000 centavos
  assert.equal(res.valorCentavos, 200000);
  // 200000 / 3000 = 66.666667
  assert.ok(Math.abs(res.quantidade - 66.666667) < 0.001);
});

test('converterEntradaMedicao: por valor em centavos calcula quantidade e percentual', () => {
  const item = {
    descricao: 'Piso cerâmico',
    unidade: 'm²',
    quantidadeContratada: 80,
    precoUnitarioCentavos: 4000, // R$ 40,00 -> Total = 320000 centavos (R$ 3.200,00)
  };

  const res = converterEntradaMedicao(item, { modo: 'valor', valorCentavos: 160000 });
  assert.equal(res.valorCentavos, 160000);
  assert.equal(res.quantidade, 40);
  assert.equal(res.percentual, 50.0);
});

test('calcularSaldoItem: acumula medição anterior e atual e detecta estouro de saldo', () => {
  const item = {
    id: 's1',
    descricao: 'Estrutura metálica',
    unidade: 'kg',
    quantidadeContratada: 1000,
    precoUnitarioCentavos: 1200, // Total = 1.200.000 centavos
  };

  const anterior = { quantidade: 600, centavos: 720000 };
  const atualValido = { quantidade: 300, centavos: 360000 };

  const res = calcularSaldoItem(item, anterior, atualValido);
  assert.equal(res.acumuladoQuantidade, 900);
  assert.equal(res.acumuladoCentavos, 1080000);
  assert.equal(res.saldoQuantidade, 100);
  assert.equal(res.saldoCentavos, 120000);
  assert.equal(res.estouroSaldo, false);

  // Agora testando estouro
  const atualComEstouro = { quantidade: 450, centavos: 540000 };
  const resEstouro = calcularSaldoItem(item, anterior, atualComEstouro);
  assert.equal(resEstouro.acumuladoQuantidade, 1050);
  assert.equal(resEstouro.estouroSaldo, true);
});

test('calcularResumoMedicao: calcula bruto, retenção técnica independente, descontos e líquido', () => {
  const itens = [
    { valorAtualCentavos: 1000000 }, // R$ 10.000,00
    { valorAtualCentavos: 500000 },  // R$ 5.000,00 -> Bruto = R$ 15.000,00
  ];

  const ajustes = [
    {
      tipo: 'retencao_tecnica',
      descricao: 'Retenção Técnica 5%',
      percentual: 5.0,
      valorCentavos: 0,
    },
    {
      tipo: 'desconto',
      descricao: 'Desconto por compra de EPI',
      valorCentavos: 35000, // R$ 350,00
    },
    {
      tipo: 'adiantamento',
      descricao: 'Amortização de Adiantamento',
      valorCentavos: 150000, // R$ 1.500,00
    },
  ];

  const resumo = calcularResumoMedicao(itens, ajustes);
  assert.equal(resumo.valorBrutoCentavos, 1500000); // R$ 15.000,00
  assert.equal(resumo.totalRetencoesCentavos, 75000); // 5% de 15.000,00 = R$ 750,00
  assert.equal(resumo.totalDescontosCentavos, 35000); // R$ 350,00
  assert.equal(resumo.totalAmortizacoesCentavos, 150000); // R$ 1.500,00
  assert.equal(resumo.totalDeducoesCentavos, 260000); // 75000 + 35000 + 150000 = 260000 (R$ 2.600,00)
  // Líquido = 15.000,00 - 2.600,00 = R$ 12.400,00 (1240000 centavos)
  assert.equal(resumo.valorLiquidoCentavos, 1240000);
  assert.equal(resumo.liquidoNegativo, false);
});

test('calcularResumoMedicao: sinaliza líquido negativo se deduções superam o bruto', () => {
  const itens = [{ valorAtualCentavos: 100000 }]; // R$ 1.000,00
  const ajustes = [
    { tipo: 'desconto', descricao: 'Reparo de avaria', valorCentavos: 150000 }, // R$ 1.500,00
  ];

  const resumo = calcularResumoMedicao(itens, ajustes);
  assert.equal(resumo.valorBrutoCentavos, 100000);
  assert.equal(resumo.totalDeducoesCentavos, 150000);
  assert.equal(resumo.valorLiquidoCentavos, 0); // Bloqueia em zero
  assert.equal(resumo.liquidoNegativo, true);
});

test('validarPlanilhaContrato: valida obrigatoriedade de campos e calcula total em centavos', () => {
  const itensValidos = [
    { descricao: 'Item 1', unidade: 'm²', quantidadeContratada: 10, precoUnitarioCentavos: 5000 },
    { descricao: 'Item 2', unidade: 'un', quantidadeContratada: 5, precoUnitarioCentavos: 20000 },
  ];
  const rValido = validarPlanilhaContrato(itensValidos);
  assert.equal(rValido.valido, true);
  assert.equal(rValido.totalCentavos, 150000); // 10*5000 + 5*20000 = 50000 + 100000 = 150000

  const itensInvalidos = [
    { descricao: '', unidade: 'm²', quantidadeContratada: -2, precoUnitarioCentavos: -10 },
  ];
  const rInvalido = validarPlanilhaContrato(itensInvalidos);
  assert.equal(rInvalido.valido, false);
  assert.ok(rInvalido.erros.length >= 3);
});

