import type { Ambiente, DadosProjetoBIM, Ponto2D } from "@/types/projeto3d";

export type TipoElementoCad = "parede" | "ambiente" | "movel";

export interface SelecaoElementoCad {
  tipo: TipoElementoCad;
  id: string;
}

interface Limites2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TransformacaoCad {
  deslocamento?: Ponto2D;
  rotacaoGraus?: number;
  centroRotacao?: Ponto2D;
}

function limitesPontos(pontos: Ponto2D[]): Limites2D {
  return {
    minX: Math.min(...pontos.map((p) => p.x)),
    minY: Math.min(...pontos.map((p) => p.y)),
    maxX: Math.max(...pontos.map((p) => p.x)),
    maxY: Math.max(...pontos.map((p) => p.y)),
  };
}

function limitesMovel(movel: NonNullable<DadosProjetoBIM["moveis"]>[number]): Limites2D {
  const angulo = ((movel.rotacao || 0) * Math.PI) / 180;
  const largura = Math.abs(Math.cos(angulo)) * movel.largura + Math.abs(Math.sin(angulo)) * movel.comprimento;
  const comprimento =
    Math.abs(Math.sin(angulo)) * movel.largura + Math.abs(Math.cos(angulo)) * movel.comprimento;
  return {
    minX: movel.x - largura / 2,
    minY: movel.y - comprimento / 2,
    maxX: movel.x + largura / 2,
    maxY: movel.y + comprimento / 2,
  };
}

function contem(janela: Limites2D, elemento: Limites2D) {
  return (
    elemento.minX >= janela.minX &&
    elemento.maxX <= janela.maxX &&
    elemento.minY >= janela.minY &&
    elemento.maxY <= janela.maxY
  );
}

function cruza(janela: Limites2D, elemento: Limites2D) {
  // shortcut: usa caixas envolventes, trocar por interseção geométrica ao adicionar polígonos côncavos editáveis.
  return !(
    elemento.maxX < janela.minX ||
    elemento.minX > janela.maxX ||
    elemento.maxY < janela.minY ||
    elemento.minY > janela.maxY
  );
}

export function selecionarElementosNaJanela(
  dados: DadosProjetoBIM,
  inicio: Ponto2D,
  fim: Ponto2D,
  modo: "conter" | "cruzar" = "conter"
): SelecaoElementoCad[] {
  const janela = limitesPontos([inicio, fim]);
  const corresponde = modo === "conter" ? contem : cruza;
  const selecionados: SelecaoElementoCad[] = [];

  for (const parede of dados.paredes) {
    if (corresponde(janela, limitesPontos([parede.p1, parede.p2]))) {
      selecionados.push({ tipo: "parede", id: parede.id });
    }
  }
  for (const ambiente of dados.ambientes) {
    if (ambiente.pontos.length > 0 && corresponde(janela, limitesPontos(ambiente.pontos))) {
      selecionados.push({ tipo: "ambiente", id: ambiente.id });
    }
  }
  for (const movel of dados.moveis ?? []) {
    if (corresponde(janela, limitesMovel(movel))) {
      selecionados.push({ tipo: "movel", id: movel.id });
    }
  }

  return selecionados;
}

function transformarPonto(
  ponto: Ponto2D,
  deslocamento: Ponto2D,
  rotacaoGraus: number,
  centro: Ponto2D
): Ponto2D {
  if (rotacaoGraus === 0) {
    return { x: ponto.x + deslocamento.x, y: ponto.y + deslocamento.y };
  }
  const angulo = (rotacaoGraus * Math.PI) / 180;
  const dx = ponto.x - centro.x;
  const dy = ponto.y - centro.y;
  return {
    x: centro.x + dx * Math.cos(angulo) - dy * Math.sin(angulo) + deslocamento.x,
    y: centro.y + dx * Math.sin(angulo) + dy * Math.cos(angulo) + deslocamento.y,
  };
}

function atualizarMetricasAmbiente(ambiente: Ambiente): Ambiente {
  let areaDupla = 0;
  let perimetro = 0;
  for (let i = 0; i < ambiente.pontos.length; i++) {
    const atual = ambiente.pontos[i];
    const proximo = ambiente.pontos[(i + 1) % ambiente.pontos.length];
    areaDupla += atual.x * proximo.y - proximo.x * atual.y;
    perimetro += Math.hypot(proximo.x - atual.x, proximo.y - atual.y);
  }
  return { ...ambiente, area: Math.abs(areaDupla) / 2, perimetro };
}

export function transformarSelecao(
  dados: DadosProjetoBIM,
  selecao: SelecaoElementoCad[],
  transformacao: TransformacaoCad
): DadosProjetoBIM {
  const ids = new Map<TipoElementoCad, Set<string>>([
    ["parede", new Set(selecao.filter((item) => item.tipo === "parede").map((item) => item.id))],
    ["ambiente", new Set(selecao.filter((item) => item.tipo === "ambiente").map((item) => item.id))],
    ["movel", new Set(selecao.filter((item) => item.tipo === "movel").map((item) => item.id))],
  ]);
  const deslocamento = transformacao.deslocamento ?? { x: 0, y: 0 };
  const rotacaoGraus = transformacao.rotacaoGraus ?? 0;
  const centro = transformacao.centroRotacao ?? { x: 0, y: 0 };

  return {
    ...dados,
    paredes: dados.paredes.map((parede) =>
      ids.get("parede")!.has(parede.id)
        ? {
            ...parede,
            p1: transformarPonto(parede.p1, deslocamento, rotacaoGraus, centro),
            p2: transformarPonto(parede.p2, deslocamento, rotacaoGraus, centro),
          }
        : parede
    ),
    ambientes: dados.ambientes.map((ambiente) =>
      ids.get("ambiente")!.has(ambiente.id)
        ? atualizarMetricasAmbiente({
            ...ambiente,
            pontos: ambiente.pontos.map((ponto) =>
              transformarPonto(ponto, deslocamento, rotacaoGraus, centro)
            ),
          })
        : ambiente
    ),
    moveis: (dados.moveis ?? []).map((movel) => {
      if (!ids.get("movel")!.has(movel.id)) return movel;
      const posicao = transformarPonto(
        { x: movel.x, y: movel.y },
        deslocamento,
        rotacaoGraus,
        centro
      );
      return {
        ...movel,
        x: posicao.x,
        y: posicao.y,
        rotacao: ((movel.rotacao + rotacaoGraus) % 360 + 360) % 360,
      };
    }),
  };
}

export function duplicarSelecao(
  dados: DadosProjetoBIM,
  selecao: SelecaoElementoCad[],
  deslocamento: Ponto2D,
  criarId: (tipo: TipoElementoCad | "abertura", originalId: string) => string
): { dados: DadosProjetoBIM; selecao: SelecaoElementoCad[] } {
  const idsParede = new Set(selecao.filter((item) => item.tipo === "parede").map((item) => item.id));
  const idsAmbiente = new Set(selecao.filter((item) => item.tipo === "ambiente").map((item) => item.id));
  const idsMovel = new Set(selecao.filter((item) => item.tipo === "movel").map((item) => item.id));
  const mapaParedes = new Map<string, string>();

  const paredes = dados.paredes.filter((parede) => idsParede.has(parede.id)).map((parede) => {
    const id = criarId("parede", parede.id);
    mapaParedes.set(parede.id, id);
    return { ...parede, id };
  });
  const ambientes = dados.ambientes
    .filter((ambiente) => idsAmbiente.has(ambiente.id))
    .map((ambiente) => ({ ...ambiente, id: criarId("ambiente", ambiente.id) }));
  const moveis = (dados.moveis ?? [])
    .filter((movel) => idsMovel.has(movel.id))
    .map((movel) => ({ ...movel, id: criarId("movel", movel.id) }));
  const aberturas = dados.aberturas
    .filter((abertura) => mapaParedes.has(abertura.paredeId))
    .map((abertura) => ({
      ...abertura,
      id: criarId("abertura", abertura.id),
      paredeId: mapaParedes.get(abertura.paredeId)!,
    }));
  const novaSelecao: SelecaoElementoCad[] = [
    ...paredes.map((parede) => ({ tipo: "parede" as const, id: parede.id })),
    ...ambientes.map((ambiente) => ({ tipo: "ambiente" as const, id: ambiente.id })),
    ...moveis.map((movel) => ({ tipo: "movel" as const, id: movel.id })),
  ];
  const combinado: DadosProjetoBIM = {
    ...dados,
    paredes: [...dados.paredes, ...paredes],
    aberturas: [...dados.aberturas, ...aberturas],
    ambientes: [...dados.ambientes, ...ambientes],
    moveis: [...(dados.moveis ?? []), ...moveis],
  };

  return {
    dados: transformarSelecao(combinado, novaSelecao, { deslocamento }),
    selecao: novaSelecao,
  };
}

