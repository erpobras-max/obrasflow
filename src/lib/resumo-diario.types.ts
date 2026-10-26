export interface OSCriticaResumo {
  numero: string;
  titulo: string;
  obra_nome?: string | null;
  responsavel_nome?: string | null;
  status_prazo: 'atrasada' | 'vence_hoje' | 'em_breve';
  data_previsao: string;
  prioridade: string;
}

export interface ContaResumoItem {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'pagar' | 'receber';
  obra_nome?: string | null;
}

export interface DadosResumoExecutivo {
  empresa_nome: string;
  data_referencia: string; // YYYY-MM-DD
  data_formatada: string;
  
  // Ordens de Serviço
  os_stats: {
    vencendo_hoje: number;
    atrasadas: number;
    em_andamento: number;
    criticas: OSCriticaResumo[];
  };

  // Financeiro do Dia
  financeiro_stats: {
    pagar_hoje_total: number;
    pagar_hoje_qtd: number;
    receber_hoje_total: number;
    receber_hoje_qtd: number;
    saldo_projetado_dia: number;
    contas_criticas: ContaResumoItem[];
  };

  // Operacional & Obras
  operacional_stats: {
    obras_ativas_qtd: number;
    pontos_registrados_hoje: number;
  };

  // Estoque
  estoque_stats: {
    itens_criticos_qtd: number;
  };

  // Destinatários padrão (admin / diretor)
  destinatarios: Array<{
    nome: string;
    email: string;
    perfil: string;
  }>;
}

export interface ResultadoDisparoResumo {
  sucesso: boolean;
  total_destinatarios: number;
  enviados: string[];
  falhas: string[];
  detalhes?: string;
}
