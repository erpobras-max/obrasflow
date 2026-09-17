# Observabilidade

## Browser Monitoring

O monitoramento de navegador é iniciado somente quando as variáveis públicas de build estiverem configuradas:

- `VITE_NEW_RELIC_BROWSER_LICENSE_KEY`
- `VITE_NEW_RELIC_APPLICATION_ID`
- `VITE_NEW_RELIC_ACCOUNT_ID`

A chave `NEW_RELIC_LICENSE_KEY` é exclusiva do servidor. Ela nunca deve receber o prefixo `VITE_`, ser adicionada ao código-fonte ou aparecer nos logs.

## OpenTelemetry no Cloudflare Workers

O Cloudflare Workers exporta traces e logs no padrão OpenTelemetry diretamente para o endpoint OTLP do New Relic. A configuração do destino deve ser feita no painel da Cloudflare, usando os endpoints `https://otlp.nr-data.net/v1/traces` e `https://otlp.nr-data.net/v1/logs`, com o cabeçalho `api-key` contendo a chave de licença armazenada como segredo.

Antes de ativar a exportação, confirme a disponibilidade do recurso no plano Cloudflare, pois a exportação externa de OpenTelemetry pode exigir Workers Paid. Enquanto isso, o Browser Monitoring continua ativo independentemente desse recurso.

## Dados que não devem ser enviados

Nunca enviar senhas, tokens, CPF/CNPJ completos, conteúdo de documentos, dados bancários ou chaves de serviço como atributos de telemetria.

