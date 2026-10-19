import type { DadosProjetoBIM, Ponto2D, Parede, Abertura } from "@/types/projeto3d";

export const PROJETO_PADRAO_INICIAL: DadosProjetoBIM = {
  config: {
    peDireito: 2.80,
    espessuraParedePadrao: 0.15,
    unidade: "m",
  },
  paredes: [
    // Quatro paredes formando um cômodo inicial de 6.0m x 4.0m
    {
      id: "parede_1",
      p1: { x: 0, y: 0 },
      p2: { x: 6.0, y: 0 },
      espessura: 0.15,
      altura: 2.80,
      tipo: "alvenaria_vedacao",
    },
    {
      id: "parede_2",
      p1: { x: 6.0, y: 0 },
      p2: { x: 6.0, y: 4.0 },
      espessura: 0.15,
      altura: 2.80,
      tipo: "alvenaria_vedacao",
    },
    {
      id: "parede_3",
      p1: { x: 6.0, y: 4.0 },
      p2: { x: 0, y: 4.0 },
      espessura: 0.15,
      altura: 2.80,
      tipo: "alvenaria_vedacao",
    },
    {
      id: "parede_4",
      p1: { x: 0, y: 4.0 },
      p2: { x: 0, y: 0 },
      espessura: 0.15,
      altura: 2.80,
      tipo: "alvenaria_vedacao",
    },
  ],
  aberturas: [
    {
      id: "abertura_porta_1",
      paredeId: "parede_1",
      tipo: "porta",
      nome: "P1 - Entrada",
      largura: 0.80,
      altura: 2.10,
      peitoril: 0.0,
      distanciaP1: 1.50,
    },
    {
      id: "abertura_janela_1",
      paredeId: "parede_3",
      tipo: "janela",
      nome: "J1 - Janela Principal",
      largura: 1.50,
      altura: 1.20,
      peitoril: 1.00,
      distanciaP1: 3.00,
    },
  ],
  ambientes: [
    {
      id: "amb_1",
      nome: "Ambiente Principal",
      pontos: [
        { x: 0, y: 0 },
        { x: 6.0, y: 0 },
        { x: 6.0, y: 4.0 },
        { x: 0, y: 4.0 },
      ],
      area: 24.0,
      perimetro: 20.0,
      pisoAcabamento: "Porcelanato Retificado 84x84",
      tetoAcabamento: "Forro de Gesso com Pintura Branca",
      paredeAcabamento: "Pintura Acrílica Fosca Lavável",
    },
  ],
  cobertura: {
    tipo: "colonial_duas_aguas",
    inclinacao: 30,
    beiral: 0.60,
    corTelha: "#b94a32",
  },
  layers: {
    telhado: true,
    forro: true,
    paredes: true,
    esquadrias: true,
    piso: true,
    estrutura: true,
  },
};

export function calcularComprimentoParede(p1: Ponto2D, p2: Ponto2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function snapAoGrid(valor: number, passo = 0.10): number {
  return Math.round(valor / passo) * passo;
}

export function formatarMetros(valor: number, casas = 2): string {
  return `${valor.toFixed(casas)} m`;
}

export function formatarM2(valor: number, casas = 2): string {
  return `${valor.toFixed(casas)} m²`;
}
