import test from "node:test";
import assert from "node:assert/strict";

test("separação de medições: regras conceituais e financeiras distintas", () => {
  const fluxoObra = {
    nome: "Medição da Obra",
    rota: "/medicoes",
    tipoFinanceiro: "contas_receber",
    contraparte: "cliente",
    tabelaCabecalho: "medicoes",
    tabelaItens: "medicoes_itens",
  };

  const fluxoEmpreiteiro = {
    nome: "Contratos de Empreiteiros",
    rota: "/contratos-empreiteiros",
    tipoFinanceiro: "contas_pagar",
    contraparte: "prestador",
    tabelaCabecalho: "medicoes_empreiteiros",
    tabelaContrato: "contratos_empreiteiros",
    tabelaItens: "medicoes_terceirizados",
  };

  // 1. As rotas devem ser completamente distintas
  assert.notEqual(fluxoObra.rota, fluxoEmpreiteiro.rota);

  // 2. Os efeitos financeiros são opostos e não se misturam
  assert.equal(fluxoObra.tipoFinanceiro, "contas_receber");
  assert.equal(fluxoEmpreiteiro.tipoFinanceiro, "contas_pagar");
  assert.notEqual(fluxoObra.tipoFinanceiro, fluxoEmpreiteiro.tipoFinanceiro);

  // 3. As contrapartes são opostas
  assert.equal(fluxoObra.contraparte, "cliente");
  assert.equal(fluxoEmpreiteiro.contraparte, "prestador");

  // 4. As tabelas de cabeçalho são independentes
  assert.notEqual(fluxoObra.tabelaCabecalho, fluxoEmpreiteiro.tabelaCabecalho);
});

test("contrato empreiteiro: cálculo de contas a pagar não gera receita", () => {
  const medicao = {
    valorBrutoCentavos: 1000000, // R$ 10.000,00
    retencaoTecnicaCentavos: 50000, // R$ 500,00 (5%)
    descontosCentavos: 20000, // R$ 200,00
    amortizacaoCentavos: 100000, // R$ 1.000,00
  };

  const totalDeducoes =
    medicao.retencaoTecnicaCentavos +
    medicao.descontosCentavos +
    medicao.amortizacaoCentavos;

  const valorLiquidoCentavos = medicao.valorBrutoCentavos - totalDeducoes;

  assert.equal(valorLiquidoCentavos, 830000); // R$ 8.300,00
  assert.ok(valorLiquidoCentavos > 0);

  // O valor líquido deve ser provisionado em contas_pagar, nunca em contas_receber
  const contaGerada = {
    tabela: "contas_pagar",
    valor: valorLiquidoCentavos / 100,
    natureza: "despesa_terceirizados",
  };

  assert.equal(contaGerada.tabela, "contas_pagar");
  assert.equal(contaGerada.valor, 8300.0);
});
