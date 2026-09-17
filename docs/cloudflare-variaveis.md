# Variáveis do Cloudflare Workers

As variáveis públicas obrigatórias do Supabase ficam em `.env.production` e são
carregadas automaticamente pelo Vite em qualquer build de produção:

| Nome | Visibilidade | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | pública | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pública | chave publishable do Supabase |
| `VITE_NEW_RELIC_ACCOUNT_ID` | pública, opcional | monitoramento do navegador |
| `VITE_NEW_RELIC_APPLICATION_ID` | pública, opcional | monitoramento do navegador |
| `VITE_NEW_RELIC_BROWSER_LICENSE_KEY` | pública, opcional | monitoramento do navegador |

As variáveis abaixo devem ser cadastradas como **secrets** ou variáveis privadas de runtime. Nunca use o prefixo `VITE_` nelas:

- `MY_SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`

O workflow publica a saída completa do Nitro em um Cloudflare Worker. As chaves
privadas continuam configuradas somente como secrets no ambiente de execução.
Depois de alterar uma variável pública de build, faça um novo deploy.
