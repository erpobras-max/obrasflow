import test from 'node:test';
import assert from 'node:assert/strict';
import { descobrirCompetencia } from '../src/lib/sinapi/sinapi-descoberta.ts';
import { validarCompetencia } from '../src/lib/sinapi/sinapi-validacao.ts';
import { parsearLinhasSinapi } from '../src/lib/sinapi/sinapi-parser.ts';

test('descobre a competência XLSX mais recente apenas no domínio oficial', () => {
  const html = `<a href="https://www.caixa.gov.br/Downloads/sinapi-a-partir-jul-2009-mg/SINAPI_Referencias_202609.zip">set</a>
    <a href="https://evil.test/SINAPI_Referencias_202610.zip">out</a>`;
  assert.deepEqual(descobrirCompetencia(html), { competencia: '09/2026', url: 'https://www.caixa.gov.br/Downloads/sinapi-a-partir-jul-2009-mg/SINAPI_Referencias_202609.zip' });
});

test('parser normaliza decimal brasileiro e categorias', () => {
  assert.deepEqual(parsearLinhasSinapi([{ CODIGO: '101', DESCRICAO: 'Cimento', UNIDADE: 'KG', TIPO: 'MATERIAL', COEFICIENTE: '1,2500', PRECO: '32,10' }])[0], {
    codigo: '101', descricao: 'Cimento', unidade: 'KG', categoria: 'material', coeficiente: 1.25, precoUnitarioCentavos: 3210,
  });
});

test('bloqueia competência com preços zerados ou cabeçalho alterado', () => {
  assert.throws(() => validarCompetencia([{ codigo: '1', precoUnitarioCentavos: 0 }]), /zerados/i);
  assert.throws(() => parsearLinhasSinapi([{ CODIGO: '1', DESCRICAO: 'Sem preço' }]), /cabeçalho/i);
  assert.deepEqual(validarCompetencia([{ codigo: '1', precoUnitarioCentavos: 100 }, { codigo: '2', precoUnitarioCentavos: 200 }]), { total: 2, precosZerados: 0, publicavel: true });
});

