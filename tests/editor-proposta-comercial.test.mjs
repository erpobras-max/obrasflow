import test from 'node:test'
import assert from 'node:assert/strict'
import {
  configuracaoPropostaComercialPadrao,
  criarFotografiaProposta,
  proximaRevisaoProposta,
  formatarRegistroEmpresa,
} from '../src/lib/proposta-orcamento.functions.ts'

test('configuracao comercial padrao contem textos executivos e visibilidade padrao', () => {
  assert.equal(configuracaoPropostaComercialPadrao.mostrarQuantidades, true)
  assert.equal(configuracaoPropostaComercialPadrao.mostrarPrecoUnitario, false)
  assert.equal(configuracaoPropostaComercialPadrao.mostrarApenasEtapa, false)
  assert.equal(configuracaoPropostaComercialPadrao.mostrarAssinaturas, true)
  assert.match(configuracaoPropostaComercialPadrao.tituloProposta, /Proposta Comercial/i)
  assert.match(configuracaoPropostaComercialPadrao.condicoesPagamentoTexto, /medições quinzenais/i)
})

test('fotografia comercial permite descricao comercial independente da tecnica', () => {
  const revisao = {
    id: 'rev-01',
    numero: 1,
    fotografia: {
      etapas: [
        {
          id: 'et-1',
          codigo: '01',
          nome: 'SERVIÇOS PRELIMINARES',
          atividades: [
            {
              id: 'atv-1',
              codigo: '98524',
              descricao: '98524 · Limpeza manual de vegetação',
              quantidade: 650.8,
              precoTotalCentavos: 287979,
            },
          ],
        },
      ],
      totalPrecoCentavos: 287979,
    },
  }

  const configCustomizada = {
    ...configuracaoPropostaComercialPadrao,
    descricoesComerciais: {
      'atv-1': 'Limpeza manual de terreno com destocamento e bota-fora',
    },
  }

  const foto = criarFotografiaProposta(revisao, configCustomizada)
  assert.equal(foto.etapas[0].atividades[0].descricaoComercial, 'Limpeza manual de terreno com destocamento e bota-fora')
  // Original description remains preserved
  assert.equal(revisao.fotografia.etapas[0].atividades[0].descricao, '98524 · Limpeza manual de vegetação')
})

test('ocultar etapa ou atividade remove do documento comercial sem alterar o orcamento', () => {
  const revisao = {
    id: 'rev-01',
    numero: 1,
    fotografia: {
      etapas: [
        { id: 'et-1', codigo: '01', nome: 'SERVIÇOS PRELIMINARES', atividades: [{ id: 'a1' }, { id: 'a2' }] },
        { id: 'et-2', codigo: '02', nome: 'INFRAESTRUTURA', atividades: [{ id: 'a3' }] },
      ],
      totalPrecoCentavos: 100000,
    },
  }

  // Oculta a etapa 02 e a atividade a1
  const config = {
    ...configuracaoPropostaComercialPadrao,
    etapasOcultas: ['et-2'],
    atividadesOcultas: ['a1'],
  }

  const foto = criarFotografiaProposta(revisao, config)
  assert.equal(foto.etapas.length, 1)
  assert.equal(foto.etapas[0].codigo, '01')
  assert.equal(foto.etapas[0].atividades.length, 1)
  assert.equal(foto.etapas[0].atividades[0].id, 'a2')
})

test('modo apenas etapa omite atividades da visualizacao', () => {
  const revisao = {
    id: 'rev-01',
    numero: 1,
    fotografia: {
      etapas: [
        { id: 'et-1', codigo: '01', nome: 'SERVIÇOS PRELIMINARES', atividades: [{ id: 'a1' }] },
      ],
      totalPrecoCentavos: 50000,
    },
  }

  const config = {
    ...configuracaoPropostaComercialPadrao,
    mostrarApenasEtapa: true,
  }

  const foto = criarFotografiaProposta(revisao, config)
  assert.equal(foto.etapas[0].atividades.length, 0)
})

test('formatarRegistroEmpresa inclui CREA/CAU quando configurado na empresa', () => {
  const empresaComCrea = {
    razao_social: 'Constagro Construtora Ltda',
    crea_cau: '123456-MG',
    inscricao_estadual: '001234567.00-88',
    inscricao_municipal: '98765',
  }
  const registro = formatarRegistroEmpresa(empresaComCrea)
  assert.equal(registro, 'CREA/CAU: 123456-MG • IE: 001234567.00-88 • Insc. Mun.: 98765')
})

test('formatarRegistroEmpresa nao exibe CREA/CAU nem fallback fixo quando nao informado', () => {
  const empresaSemCrea = {
    razao_social: 'Constagro Construtora Ltda',
    crea_cau: null,
    inscricao_estadual: '001234567.00-88',
    inscricao_municipal: null,
  }
  const registro = formatarRegistroEmpresa(empresaSemCrea)
  assert.equal(registro, 'IE: 001234567.00-88')
  assert.doesNotMatch(registro, /CREA/i)
  assert.doesNotMatch(registro, /194820-SP/)
})

test('formatarRegistroEmpresa lida com empresa nula ou vazia com seguranca', () => {
  assert.equal(formatarRegistroEmpresa(null), '')
  assert.equal(formatarRegistroEmpresa(undefined), '')
  assert.equal(formatarRegistroEmpresa({ crea_cau: '  ', inscricao_estadual: '' }), '')
})
