import type {
  DadosProjetoBIM,
  Ponto2D,
  Parede,
  Abertura,
  ConfiguracaoBDI,
  ResumoQuantitativosBIM,
  ItemQuantitativo,
} from "@/types/projeto3d";

export const BDI_PADRAO_INICIAL: ConfiguracaoBDI = {
  lucroLiquido: 12.0, // 12%
  impostos: 8.0, // 8% (Simples Nacional médio)
  administracaoCentral: 4.0, // 4%
  custoIndiretoObra: 5.0, // 5%
  contingencia: 3.0, // 3%
};

export const PROJETO_EM_BRANCO: DadosProjetoBIM = {
  config: {
    peDireito: 2.80,
    espessuraParedePadrao: 0.15,
    unidade: "m",
  },
  paredes: [],
  aberturas: [],
  ambientes: [],
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
    moveis: true,
  },
  moveis: [],
};

// O projeto padrão inicial para qualquer obra sem modelagem é SEMPRE em branco
export const PROJETO_PADRAO_INICIAL: DadosProjetoBIM = PROJETO_EM_BRANCO;

// Modelo demonstrativo caso o usuário deseje carregar um template manualmente
export const PROJETO_DEMO_EXEMPLO: DadosProjetoBIM = {
  config: {
    peDireito: 2.80,
    espessuraParedePadrao: 0.15,
    unidade: "m",
  },
  paredes: [
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

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

// Cálculo da taxa percentual de BDI
export function calcularTaxaBdi(bdi: ConfiguracaoBDI): number {
  const ac = bdi.administracaoCentral / 100;
  const ind = bdi.custoIndiretoObra / 100;
  const r = bdi.contingencia / 100;
  const l = bdi.lucroLiquido / 100;
  const i = bdi.impostos / 100;

  // Fórmula recomendada (TCU/IBEC adaptada para iniciativa privada):
  // ((1 + AC + IND + R) * (1 + L) / (1 - I) - 1) * 100
  const taxa = ((1 + ac + ind + r) * (1 + l)) / Math.max(1 - i, 0.01) - 1;
  return Math.max(taxa * 100, 0);
}

// Motor de Quantitativos e Custos da Modelagem 2D/3D
export function calcularQuantitativosBIM(
  dados: DadosProjetoBIM,
  bdiConfig: ConfiguracaoBDI = BDI_PADRAO_INICIAL
): ResumoQuantitativosBIM {
  let areaTotalAlvenariaBruta = 0;
  let comprimentoTotalParedes = 0;

  dados.paredes.forEach((p) => {
    const comp = calcularComprimentoParede(p.p1, p.p2);
    comprimentoTotalParedes += comp;
    areaTotalAlvenariaBruta += comp * (p.altura || dados.config.peDireito);
  });

  let areaTotalVaos = 0;
  let larguraTotalPortas = 0;
  let totalPortas = 0;
  let totalJanelas = 0;

  dados.aberturas.forEach((ab) => {
    const areaVao = ab.largura * ab.altura;
    areaTotalVaos += areaVao;
    if (ab.tipo === "porta") {
      larguraTotalPortas += ab.largura;
      totalPortas++;
    } else if (ab.tipo === "janela") {
      totalJanelas++;
    }
  });

  const areaTotalAlvenariaLiquida = Math.max(areaTotalAlvenariaBruta - areaTotalVaos, 0);
  const areaTotalReboco = areaTotalAlvenariaLiquida * 2; // Duas faces
  const areaTotalPintura = areaTotalReboco;
  const pisosEspecificados = [...new Set(dados.ambientes.map((a) => a.pisoAcabamento).filter(Boolean))];
  const pinturasEspecificadas = [
    ...new Set([
      ...dados.ambientes.map((a) => a.paredeAcabamento),
      ...dados.paredes.map((p) => p.acabamento),
    ].filter(Boolean)),
  ];

  // Área de piso dos ambientes (ou estimativa baseada nas paredes)
  let areaTotalPisos = dados.ambientes.reduce((acc, a) => acc + a.area, 0);
  let perimetroTotal = dados.ambientes.reduce((acc, a) => acc + a.perimetro, 0);

  if (areaTotalPisos === 0 && dados.paredes.length >= 3) {
    // Estimativa por retângulo envolvente
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    dados.paredes.forEach((p) => {
      minX = Math.min(minX, p.p1.x, p.p2.x);
      maxX = Math.max(maxX, p.p1.x, p.p2.x);
      minY = Math.min(minY, p.p1.y, p.p2.y);
      maxY = Math.max(maxY, p.p1.y, p.p2.y);
    });
    areaTotalPisos = Math.max((maxX - minX) * (maxY - minY), 0);
    perimetroTotal = comprimentoTotalParedes;
  }

  const perimetroTotalRodape = Math.max(perimetroTotal - larguraTotalPortas, 0);

  // Cobertura (projeção + beiral de 0.60m + inclinação de 30% -> fator 1.15)
  const beiral = dados.cobertura.beiral || 0.6;
  const fatorInclinacao = 1 + (dados.cobertura.inclinacao || 30) / 200; // ~1.15
  const areaTotalCobertura = (areaTotalPisos + comprimentoTotalParedes * beiral) * fatorInclinacao;

  // Concreto estimado de vigas e baldrame (seção 0.15m x 0.30m)
  const volumeConcretoEstimado = comprimentoTotalParedes * 0.15 * 0.3;

  // Itens de Quantitativos e Composições de Custo (Referência SINAPI)
  const itens: ItemQuantitativo[] = [
    {
      id: "item_alvenaria",
      codigo: "ALV-01",
      codigoSinapi: "104658",
      descricao: "Alvenaria de vedação de blocos cerâmicos furados 9x19x19 cm c/ argamassa",
      unidade: "m²",
      quantidade: areaTotalAlvenariaLiquida,
      memoriaCalculo: `Área Bruta (${areaTotalAlvenariaBruta.toFixed(2)}m²) - Vãos (${areaTotalVaos.toFixed(2)}m²)`,
      precoUnitario: 68.5,
      tipoItem: "alvenaria",
    },
    {
      id: "item_reboco",
      codigo: "REB-01",
      codigoSinapi: "87529",
      descricao: "Chapisco e emboço para revestimento interno e externo (2 faces)",
      unidade: "m²",
      quantidade: areaTotalReboco,
      memoriaCalculo: `Área Líquida (${areaTotalAlvenariaLiquida.toFixed(2)}m²) x 2 faces`,
      precoUnitario: 42.0,
      tipoItem: "revestimento",
    },
    {
      id: "item_piso",
      codigo: "PIS-01",
      codigoSinapi: "87251",
      descricao: pisosEspecificados.length > 0
        ? `Pisos especificados: ${pisosEspecificados.join(", ")}`
        : "Revestimento cerâmico / porcelanato para piso com argamassa colante e rejunte",
      unidade: "m²",
      quantidade: areaTotalPisos,
      memoriaCalculo: `Soma das áreas de piso dos cômodos (${areaTotalPisos.toFixed(2)}m²)`,
      precoUnitario: 115.0,
      tipoItem: "piso",
    },
    {
      id: "item_rodape",
      codigo: "ROD-01",
      codigoSinapi: "88648",
      descricao: "Rodapé em poliestireno / cerâmica h=10cm",
      unidade: "m",
      quantidade: perimetroTotalRodape,
      memoriaCalculo: `Perímetro (${perimetroTotal.toFixed(2)}m) - Portas (${larguraTotalPortas.toFixed(2)}m)`,
      precoUnitario: 28.0,
      tipoItem: "piso",
    },
    {
      id: "item_pintura",
      codigo: "PIN-01",
      codigoSinapi: "88489",
      descricao: pinturasEspecificadas.length > 0
        ? `Pinturas especificadas: ${pinturasEspecificadas.join(", ")}`
        : "Pintura látex acrílica com selador e duas demãos de acabamento",
      unidade: "m²",
      quantidade: areaTotalPintura,
      memoriaCalculo: `Área de reboco total (${areaTotalReboco.toFixed(2)}m²)`,
      precoUnitario: 32.5,
      tipoItem: "pintura",
    },
    {
      id: "item_cobertura",
      codigo: "COB-01",
      codigoSinapi: "94441",
      descricao: "Estrutura e telhado cerâmico com inclinação e beiral",
      unidade: "m²",
      quantidade: areaTotalCobertura,
      memoriaCalculo: `Área projetada c/ beiral x inclinação ${dados.cobertura.inclinacao}%`,
      precoUnitario: 98.0,
      tipoItem: "cobertura",
    },
    {
      id: "item_concreto",
      codigo: "EST-01",
      codigoSinapi: "92717",
      descricao: "Concreto estrutural FCK 25 MPa para vigas de baldrame e cinta com armadura",
      unidade: "m³",
      quantidade: volumeConcretoEstimado,
      memoriaCalculo: `${comprimentoTotalParedes.toFixed(2)}m linear de viga x seção 0.15 x 0.30m`,
      precoUnitario: 650.0,
      tipoItem: "estrutura",
    },
  ];

  const custoDiretoTotal = itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0);
  const bdiTaxa = calcularTaxaBdi(bdiConfig);
  const valorBdiTotal = custoDiretoTotal * (bdiTaxa / 100);
  const precoVendaTotal = custoDiretoTotal + valorBdiTotal;

  return {
    areaTotalAlvenariaBruta,
    areaTotalVaos,
    areaTotalAlvenariaLiquida,
    areaTotalPisos,
    areaTotalReboco,
    areaTotalPintura,
    perimetroTotalRodape,
    areaTotalCobertura,
    volumeConcretoEstimado,
    totalPortas,
    totalJanelas,
    itens,
    custoDiretoTotal,
    bdiTaxa,
    valorBdiTotal,
    precoVendaTotal,
  };
}

