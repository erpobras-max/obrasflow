import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarHtmlResumoMatinal } from '../src/lib/email-service.server.ts';

test('gerarHtmlResumoMatinal monta template executivo completo com KPIs e formatações', () => {
  const dadosMock = {
    empresa_nome: 'Construtora Exemplo Ltda',
    data_referencia: '2026-10-27',
    data_formatada: '27/10/2026',
    os_stats: {
      vencendo_hoje: 2,
      atrasadas: 1,
      em_andamento: 5,
      criticas: [
        {
          numero: 'OS-0001',
          titulo: 'Impermeabilização da Laje',
          obra_nome: 'Edifício Horizonte',
          responsavel_nome: 'Marcos Encarregado',
          status_prazo: 'atrasada',
          data_previsao: '2026-10-25',
          prioridade: 'urgente',
        },
        {
          numero: 'OS-0002',
          titulo: 'Instalação de Esquadrias',
          obra_nome: 'Residencial Aurora',
          responsavel_nome: 'Juliana Engenheira',
          status_prazo: 'vence_hoje',
          data_previsao: '2026-10-27',
          prioridade: 'alta',
        },
      ],
    },
    financeiro_stats: {
      pagar_hoje_total: 15400.5,
      pagar_hoje_qtd: 3,
      receber_hoje_total: 28900.0,
      receber_hoje_qtd: 2,
      saldo_projetado_dia: 13499.5,
      contas_criticas: [
        {
          id: '1',
          descricao: 'Fornecedor de Aço CA-50',
          valor: 15400.5,
          tipo: 'pagar',
          obra_nome: 'Edifício Horizonte',
        },
        {
          id: '2',
          descricao: 'Medição Cliente Etapa Fundações',
          valor: 28900.0,
          tipo: 'receber',
          obra_nome: 'Residencial Aurora',
        },
      ],
    },
    operacional_stats: {
      obras_ativas_qtd: 4,
      pontos_registrados_hoje: 18,
    },
    estoque_stats: {
      itens_criticos_qtd: 0,
    },
    destinatarios: [
      { nome: 'Diretor Geral', email: 'diretoria@exemplo.com', perfil: 'diretor' },
    ],
  };

  const html = gerarHtmlResumoMatinal(dadosMock, 'Diretor Geral');

  // Validações estruturais e de conteúdo
  assert.ok(html.includes('Construtora Exemplo Ltda'));
  assert.ok(html.includes('27/10/2026'));
  assert.ok(html.includes('Diretor Geral'));
  assert.ok(html.includes('OS-0001'));
  assert.ok(html.includes('Impermeabilização da Laje'));
  assert.ok(html.includes('ATRASADA'));
  assert.ok(html.includes('OS-0002'));
  assert.ok(html.includes('HOJE'));
  assert.ok(html.includes('Fornecedor de Aço CA-50'));
  assert.ok(html.includes('Medição Cliente Etapa Fundações'));
  assert.ok(html.includes('18')); // pontos registrados
  assert.ok(html.includes('4')); // canteiros ativos
});

test('gerarHtmlResumoMatinal trata dias sem OSs ou contas pendentes graciosamente', () => {
  const dadosVazios = {
    empresa_nome: 'ObrasFlow Construtora',
    data_referencia: '2026-10-27',
    data_formatada: '27/10/2026',
    os_stats: {
      vencendo_hoje: 0,
      atrasadas: 0,
      em_andamento: 2,
      criticas: [],
    },
    financeiro_stats: {
      pagar_hoje_total: 0,
      pagar_hoje_qtd: 0,
      receber_hoje_total: 0,
      receber_hoje_qtd: 0,
      saldo_projetado_dia: 0,
      contas_criticas: [],
    },
    operacional_stats: {
      obras_ativas_qtd: 2,
      pontos_registrados_hoje: 8,
    },
    estoque_stats: {
      itens_criticos_qtd: 0,
    },
    destinatarios: [],
  };

  const html = gerarHtmlResumoMatinal(dadosVazios, 'Rodrigo');

  assert.ok(html.includes('Nenhuma Ordem de Serviço em atraso ou vencendo hoje'));
  assert.ok(html.includes('Nenhum pagamento ou recebimento agendado para a data de hoje'));
  assert.ok(html.includes('Rodrigo'));
});
