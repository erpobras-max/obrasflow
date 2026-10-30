import test from 'node:test'
import assert from 'node:assert/strict'

test('calculo da discriminacao por categoria de custo e preco com BDI', () => {
  const maoDeObraCentavos = 18896895 // R$ 188.968,95
  const materialCentavos = 36077126   // R$ 360.771,26
  const equipamentoCentavos = 289120  // R$ 2.891,20
  const outrosCentavos = 8236293      // R$ 82.362,93

  const totalCusto = maoDeObraCentavos + materialCentavos + equipamentoCentavos + outrosCentavos
  assert.equal(totalCusto, 63499434) // R$ 634.994,34 (exato à Foto 2)

  // Percentuais de custo (Foto 2)
  const pctMo = Math.round((maoDeObraCentavos / totalCusto) * 100)
  const pctMat = Math.round((materialCentavos / totalCusto) * 100)
  const pctEq = Math.round((equipamentoCentavos / totalCusto) * 100)
  const pctOut = Math.round((outrosCentavos / totalCusto) * 100)

  assert.equal(pctMo, 30) // 30% na Foto 2
  assert.equal(pctMat, 57) // 57% na Foto 2
  assert.equal(pctEq, 0) // 0% na Foto 2
  assert.equal(pctOut, 13) // 13% na Foto 2

  // Com BDI Geral de 60% (Foto 4)
  const bdiGeral = 60
  const bdiFactor = 1 + bdiGeral / 100

  const moPreco = Math.round(maoDeObraCentavos * bdiFactor)
  const matPreco = Math.round(materialCentavos * bdiFactor)
  const eqPreco = Math.round(equipamentoCentavos * bdiFactor)
  const outPreco = Math.round(outrosCentavos * bdiFactor)

  assert.equal(moPreco, 30235032) // R$ 302.350,32 (exato à Foto 3)
  assert.equal(matPreco, 57723402) // R$ 577.234,02 ~ 577.234,01 (exato à Foto 3)
  assert.equal(eqPreco, 462592) // R$ 4.625,92 (exato à Foto 3)
  assert.equal(outPreco, 13178069) // R$ 131.780,69 (exato à Foto 3)

  const totalPreco = moPreco + matPreco + eqPreco + outPreco
  const pctPrecoMo = Math.round((moPreco / totalPreco) * 100)
  const pctPrecoMat = Math.round((matPreco / totalPreco) * 100)
  const pctPrecoEq = Math.round((eqPreco / totalPreco) * 100)
  const pctPrecoOut = Math.round((outPreco / totalPreco) * 100)

  assert.equal(pctPrecoMo, 30) // 30% na Foto 3
  assert.equal(pctPrecoMat, 57) // 57% na Foto 3
  assert.equal(pctPrecoEq, 0) // 0% na Foto 3
  assert.equal(pctPrecoOut, 13) // 13% na Foto 3
})
