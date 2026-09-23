import test from 'node:test';
import assert from 'node:assert/strict';
import { companyLogoKey, normalizeCompanyLogo } from '../src/lib/empresa-logo.ts';

test('recupera a chave de URLs quebradas salvas pela versão anterior', () => {
  const key = 'outros/dfa84ad4-3693-4bec-9b80-527d62a612ab.png';
  assert.equal(companyLogoKey(`undefined/${key}`), key);
  assert.equal(companyLogoKey(`https://obrasflow.erpobras.workers.dev/undefined/${key}`), key);
  assert.equal(normalizeCompanyLogo(`undefined/${key}`), `r2://${key}`);
});

test('mantém URL externa válida e rejeita caminho arbitrário', () => {
  assert.equal(normalizeCompanyLogo('https://example.com/logo.png'), 'https://example.com/logo.png');
  assert.equal(companyLogoKey('../arquivo.png'), null);
});
