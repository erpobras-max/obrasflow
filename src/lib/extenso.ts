// Utilitário para conversão de valores monetários em reais para texto por extenso (Português do Brasil)

const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

const ESPECIAIS_10_A_19 = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function converterGrupoAte999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const cent = Math.floor(n / 100);
  const restoCent = n % 100;
  const dez = Math.floor(restoCent / 10);
  const un = restoCent % 10;

  const partes: string[] = [];

  if (cent > 0) {
    partes.push(CENTENAS[cent]);
  }

  if (restoCent >= 10 && restoCent <= 19) {
    partes.push(ESPECIAIS_10_A_19[restoCent - 10]);
  } else {
    if (dez > 1) {
      partes.push(DEZENAS[dez]);
    }
    if (un > 0) {
      partes.push(UNIDADES[un]);
    }
  }

  return partes.join(" e ");
}

/**
 * Converte um valor em centavos ou reais para formato por extenso monetário brasileiro.
 * Exemplo: 1250.50 -> "um mil, duzentos e cinquenta reais e cinquenta centavos"
 */
export function valorPorExtenso(valorEmReaisOuCentavos: number, entradaEmCentavos = false): string {
  const centavosTotais = Math.round(
    entradaEmCentavos ? valorEmReaisOuCentavos : valorEmReaisOuCentavos * 100
  );

  if (centavosTotais === 0) {
    return "zero reais";
  }

  const ehNegativo = centavosTotais < 0;
  const absCentavos = Math.abs(centavosTotais);

  const inteiros = Math.floor(absCentavos / 100);
  const centavos = absCentavos % 100;

  const partesTexto: string[] = [];

  if (inteiros > 0) {
    const bilhoes = Math.floor(inteiros / 1_000_000_000);
    const milhoes = Math.floor((inteiros % 1_000_000_000) / 1_000_000);
    const milhares = Math.floor((inteiros % 1_000_000) / 1_000);
    const unidades = inteiros % 1_000;

    const blocos: { texto: string; valor: number; tipo: string }[] = [];

    if (bilhoes > 0) {
      const txt = converterGrupoAte999(bilhoes);
      blocos.push({ texto: `${txt} ${bilhoes === 1 ? "bilhão" : "bilhões"}`, valor: bilhoes, tipo: "bilhao" });
    }
    if (milhoes > 0) {
      const txt = converterGrupoAte999(milhoes);
      blocos.push({ texto: `${txt} ${milhoes === 1 ? "milhão" : "milhões"}`, valor: milhoes, tipo: "milhao" });
    }
    if (milhares > 0) {
      const txt = converterGrupoAte999(milhares);
      blocos.push({ texto: txt === "um" ? "um mil" : `${txt} mil`, valor: milhares, tipo: "milhar" });
    }
    if (unidades > 0) {
      const txt = converterGrupoAte999(unidades);
      blocos.push({ texto: txt, valor: unidades, tipo: "unidade" });
    }

    let textoInteiro = "";
    if (blocos.length === 1) {
      textoInteiro = blocos[0].texto;
    } else {
      // Regra de ligação:
      // Se o último bloco for unidade e ele for < 100 ou múltiplo de 100 (ex: 200, 500), liga com 'e'
      // Caso contrário, separa com vírgula
      const ultimoBloco = blocos[blocos.length - 1];
      const blocosAnteriores = blocos.slice(0, -1).map((b) => b.texto).join(", ");
      
      const usaE =
        (ultimoBloco.tipo === "unidade" || ultimoBloco.tipo === "milhar") &&
        (ultimoBloco.valor < 100 || ultimoBloco.valor % 100 === 0);

      if (usaE) {
        textoInteiro = `${blocosAnteriores} e ${ultimoBloco.texto}`;
      } else {
        textoInteiro = `${blocosAnteriores}, ${ultimoBloco.texto}`;
      }
    }

    const unidadeMoeda = inteiros === 1 ? "real" : "reais";
    const precisaDe =
      (milhoes > 0 && milhares === 0 && unidades === 0) ||
      (bilhoes > 0 && milhoes === 0 && milhares === 0 && unidades === 0);

    partesTexto.push(`${textoInteiro} ${precisaDe ? "de " : ""}${unidadeMoeda}`);
  }

  if (centavos > 0) {
    const textoCentavos = converterGrupoAte999(centavos);
    const unidadeCentavos = centavos === 1 ? "centavo" : "centavos";
    if (partesTexto.length > 0) {
      partesTexto.push(`e ${textoCentavos} ${unidadeCentavos}`);
    } else {
      partesTexto.push(`${textoCentavos} ${unidadeCentavos}`);
    }
  }

  const resultado = partesTexto.join(" ");
  return ehNegativo ? `menos ${resultado}` : resultado;
}
