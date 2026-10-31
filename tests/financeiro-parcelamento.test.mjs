import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarParcelasFinanceiras } from '../src/lib/financeiro-parcelamento.ts';

test('gerarParcelasFinanceiras: lançamento único à vista (1x)', () => {
  const parcelas = gerarParcelasFinanceiras({
    valorTotalCentavos: 150000, // R$ 1.500,00
    quantidadeParcelas: 1,
    dataPrimeiroVencimento: '2026-11-10',
    descricaoBase: 'Compra de Tubos PVC',
  });

  assert.equal(parcelas.length, 1);
  assert.equal(parcelas[0].numero, 1);
  assert.equal(parcelas[0].totalParcelas, 1);
  assert.equal(parcelas[0].descricao, 'Compra de Tubos PVC');
  assert.equal(parcelas[0].valorCentavos, 150000);
  assert.equal(parcelas[0].dataVencimento, '2026-11-10');
});

test('gerarParcelasFinanceiras: divisão exata de centavos sem perda ou sobra', () => {
  // R$ 1.000,00 em 3x = 100.000 centavos / 3 = 33.333, resto 1
  const parcelas = gerarParcelasFinanceiras({
    valorTotalCentavos: 100000,
    quantidadeParcelas: 3,
    dataPrimeiroVencimento: '2026-11-05',
    periodicidade: 'mensal',
    descricaoBase: 'Locação de Andaimes',
  });

  assert.equal(parcelas.length, 3);
  assert.equal(parcelas[0].valorCentavos, 33334);
  assert.equal(parcelas[1].valorCentavos, 33333);
  assert.equal(parcelas[2].valorCentavos, 33333);

  // Soma exata
  const total = parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
  assert.equal(total, 100000);

  // Sufixos
  assert.equal(parcelas[0].descricao, 'Locação de Andaimes (1/3)');
  assert.equal(parcelas[1].descricao, 'Locação de Andaimes (2/3)');
  assert.equal(parcelas[2].descricao, 'Locação de Andaimes (3/3)');

  // Datas mensais
  assert.equal(parcelas[0].dataVencimento, '2026-11-05');
  assert.equal(parcelas[1].dataVencimento, '2026-12-05');
  assert.equal(parcelas[2].dataVencimento, '2027-01-05');
});

test('gerarParcelasFinanceiras: passagem de ano e ajuste de fim de mês', () => {
  // Começando em 31 de janeiro
  const parcelas = gerarParcelasFinanceiras({
    valorTotalCentavos: 30000,
    quantidadeParcelas: 3,
    dataPrimeiroVencimento: '2027-01-31',
    periodicidade: 'mensal',
    descricaoBase: 'Seguro da Obra',
  });

  assert.equal(parcelas[0].dataVencimento, '2027-01-31');
  // Fevereiro não tem 31 dias -> ajusta para o último dia de fevereiro (28)
  assert.equal(parcelas[1].dataVencimento, '2027-02-28');
  assert.equal(parcelas[2].dataVencimento, '2027-03-31');
});

test('gerarParcelasFinanceiras: periodicidade quinzenal e semanal', () => {
  const quinzenal = gerarParcelasFinanceiras({
    valorTotalCentavos: 20000,
    quantidadeParcelas: 2,
    dataPrimeiroVencimento: '2026-11-01',
    periodicidade: 'quinzenal',
    descricaoBase: 'Adiantamento empreiteiro',
  });
  assert.equal(quinzenal[0].dataVencimento, '2026-11-01');
  assert.equal(quinzenal[1].dataVencimento, '2026-11-16');

  const semanal = gerarParcelasFinanceiras({
    valorTotalCentavos: 14000,
    quantidadeParcelas: 2,
    dataPrimeiroVencimento: '2026-11-01',
    periodicidade: 'semanal',
    descricaoBase: 'Diárias',
  });
  assert.equal(semanal[0].dataVencimento, '2026-11-01');
  assert.equal(semanal[1].dataVencimento, '2026-11-08');
});

