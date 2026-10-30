# Backup anterior à Issue #197

- Criado em: 29/10/2026 20:49 (America/Sao_Paulo)
- Branch remota de trabalho: `feat/197-orcamento-analitico-proposta`
- Arquivo: `pre-implementation-2026-10-29.zip`
- Conteúdo: `src`, `supabase`, `tests`, `PROGRESS.md`, manifestos de dependências, configuração do Worker, especificação e plano.

## Restaurar

1. Interrompa o servidor local e qualquer build em andamento.
2. Extraia o ZIP para uma pasta temporária.
3. Compare os arquivos extraídos com o checkout atual.
4. Copie de volta somente os caminhos que precisam ser revertidos.
5. Execute testes e build antes de publicar.

O ZIP não contém `.env`, credenciais, `node_modules`, artefatos de build nem dados do banco de produção. Migrations aplicadas em banco exigem o procedimento de rollback documentado na própria migration; restaurar os arquivos não desfaz alterações externas.

