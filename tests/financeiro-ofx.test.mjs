import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfx, normalizarDataOfx, valorParaCentavos, sugerirConciliacaoParaTransacao } from '../src/lib/financeiro-ofx.ts';

test('normalizarDataOfx converte strings com fuso ou simples para YYYY-MM-DD', () => {
  assert.equal(normalizarDataOfx('20261028120000[-3:BRT]'), '2026-10-28');
  assert.equal(normalizarDataOfx('20260515'), '2026-05-15');
  assert.equal(normalizarDataOfx('20260101000000'), '2026-01-01');
});

test('valorParaCentavos converte formatos decimais com precisão', () => {
  assert.equal(valorParaCentavos('1500.50'), 150050);
  assert.equal(valorParaCentavos('-320.00'), -32000);
  assert.equal(valorParaCentavos('1.500,50'), 150050);
  assert.equal(valorParaCentavos('45,90'), 4590);
  assert.equal(valorParaCentavos('0'), 0);
});

test('parseOfx lê extrato SGML com crédito e débito', () => {
  const ofxSgml = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <BANKID>0341
          <BRANCHID>1234
          <ACCTID>56789-0
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20261001000000
          <DTEND>20261031235959
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261015120000[-3:BRT]
            <TRNAMT>1500.50
            <FITID>FIT-001
            <CHECKNUM>NF-9001
            <MEMO>PIX RECEBIDO JOAO
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261016140000[-3:BRT]
            <TRNAMT>-450.00
            <FITID>FIT-002
            <MEMO>PAGTO BOLETO FORNECEDOR
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>15250.75
          <DTASOF>20261031235959
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

  const extrato = parseOfx(ofxSgml);
  assert.equal(extrato.bancoId, '0341');
  assert.equal(extrato.agencia, '1234');
  assert.equal(extrato.conta, '56789-0');
  assert.equal(extrato.dataInicio, '2026-10-01');
  assert.equal(extrato.dataFim, '2026-10-31');
  assert.equal(extrato.saldoFinalCentavos, 1525075);

  assert.equal(extrato.transacoes.length, 2);

  // Transação 1: Crédito
  const t1 = extrato.transacoes[0];
  assert.equal(t1.fitid, 'FIT-001');
  assert.equal(t1.tipo, 'credito');
  assert.equal(t1.valorCentavos, 150050);
  assert.equal(t1.data, '2026-10-15');
  assert.equal(t1.documento, 'NF-9001');
  assert.equal(t1.descricao, 'PIX RECEBIDO JOAO');

  // Transação 2: Débito
  const t2 = extrato.transacoes[1];
  assert.equal(t2.fitid, 'FIT-002');
  assert.equal(t2.tipo, 'debito');
  assert.equal(t2.valorCentavos, 45000);
  assert.equal(t2.data, '2026-10-16');
  assert.equal(t2.descricao, 'PAGTO BOLETO FORNECEDOR');
});

test('sugerirConciliacaoParaTransacao identifica correspondência exata e por data próxima', () => {
  const transacaoCredito = {
    id: '1',
    fitid: 'F1',
    tipo: 'credito',
    valorCentavos: 500000,
    data: '2026-10-20',
    descricao: 'RECEBIMENTO CLIENTE',
    documento: 'NF-100',
  };

  const contas = [
    {
      id: 'cr-1',
      tipo: 'receber',
      descricao: 'Etapa 1 Obra',
      valorCentavos: 500000,
      dataVencimento: '2026-10-20',
      documento: 'NF-100',
    },
    {
      id: 'cp-1',
      tipo: 'pagar',
      descricao: 'Cimento',
      valorCentavos: 500000,
      dataVencimento: '2026-10-20',
      documento: 'NF-100',
    },
  ];

  const match = sugerirConciliacaoParaTransacao(transacaoCredito, contas);
  assert.notEqual(match, null);
  assert.equal(match.contaId, 'cr-1');
  assert.equal(match.score, 'exato');
});



test('financeiro.tsx importa Layers e icones necessarios de lucide-react', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/routes/_app/financeiro.tsx', 'utf8');
  assert.match(src, /import\s*\{[^}]*Layers[^}]*\}\s*from\s*["']lucide-react["']/);
  assert.match(src, /import\s*\{[^}]*ArrowRightLeft[^}]*\}\s*from\s*["']lucide-react["']/);
});
