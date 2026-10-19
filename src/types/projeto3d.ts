export interface Ponto2D {
  x: number;
  y: number;
}

export type TipoAbertura = "porta" | "janela" | "vao_livre";

export interface Abertura {
  id: string;
  paredeId: string;
  tipo: TipoAbertura;
  nome: string;
  largura: number; // em metros
  altura: number; // em metros
  peitoril: number; // em metros (0 para portas)
  distanciaP1: number; // distância do ponto inicial da parede ao centro da abertura
  invertida?: boolean; // inverter o arco/lado da folha da porta
}

export interface Parede {
  id: string;
  p1: Ponto2D;
  p2: Ponto2D;
  espessura: number; // metros (ex: 0.15)
  altura: number; // metros (ex: 2.80)
  tipo: string;
  cor?: string;
}

export interface Ambiente {
  id: string;
  nome: string;
  pontos: Ponto2D[];
  area: number; // m²
  perimetro: number; // m
  pisoAcabamento?: string;
  tetoAcabamento?: string;
  paredeAcabamento?: string;
}

export interface CoberturaConfig {
  tipo: "colonial_duas_aguas" | "embutida_platibanda" | "uma_agua" | "quatro_aguas";
  inclinacao: number; // porcentagem (ex: 30)
  beiral: number; // metros (ex: 0.60)
  corTelha?: string;
}

export interface CamadasVisibilidade {
  telhado: boolean;
  forro: boolean;
  paredes: boolean;
  esquadrias: boolean;
  piso: boolean;
  estrutura: boolean;
  moveis?: boolean;
}

export type TipoMovel =
  | "cama_casal"
  | "cama_solteiro"
  | "sofa"
  | "mesa_jantar"
  | "bancada_pia"
  | "geladeira"
  | "fogao"
  | "vaso_sanitario"
  | "bancada_banheiro";

export interface Movel {
  id: string;
  tipo: TipoMovel;
  nome: string;
  x: number; // posição centro X em metros
  y: number; // posição centro Y em metros (planta 2D)
  largura: number; // metros
  comprimento: number; // metros
  altura: number; // metros
  rotacao: number; // graus: 0, 90, 180, 270
}

export interface ConfigProjeto {
  peDireito: number;
  espessuraParedePadrao: number;
  unidade: "m";
}

export interface DadosProjetoBIM {
  config: ConfigProjeto;
  paredes: Parede[];
  aberturas: Abertura[];
  ambientes: Ambiente[];
  cobertura: CoberturaConfig;
  layers: CamadasVisibilidade;
  moveis?: Movel[];
}

export interface ItemQuantitativo {
  id: string;
  codigo: string;
  descricao: string;
  unidade: "m²" | "m³" | "m" | "un";
  quantidade: number;
  memoriaCalculo: string;
  precoUnitario: number;
  codigoSinapi?: string;
  tipoItem: "alvenaria" | "revestimento" | "piso" | "pintura" | "cobertura" | "esquadria" | "estrutura";
}

export interface ConfiguracaoBDI {
  lucroLiquido: number; // % (ex: 12)
  impostos: number; // % (ex: 8)
  administracaoCentral: number; // % (ex: 4)
  custoIndiretoObra: number; // % (ex: 5)
  contingencia: number; // % (ex: 3)
}

export interface ResumoQuantitativosBIM {
  areaTotalAlvenariaBruta: number;
  areaTotalVaos: number;
  areaTotalAlvenariaLiquida: number;
  areaTotalPisos: number;
  areaTotalReboco: number;
  areaTotalPintura: number;
  perimetroTotalRodape: number;
  areaTotalCobertura: number;
  volumeConcretoEstimado: number;
  totalPortas: number;
  totalJanelas: number;
  itens: ItemQuantitativo[];
  custoDiretoTotal: number;
  bdiTaxa: number;
  valorBdiTotal: number;
  precoVendaTotal: number;
}

export interface ObraProjetoCadRow {
  id: string;
  obra_id: string;
  versao: number;
  titulo: string;
  descricao: string | null;
  dados_projeto: DadosProjetoBIM;
  foto_capa_3d: string | null;
  fotos_adicionais: string[];
  quantitativos_calculados: Record<string, unknown>;
  config_bdi: ConfiguracaoBDI;
  visivel_no_portal: boolean;
  permitir_download_dossie_portal: boolean;
  created_at: string;
  updated_at: string;
}
