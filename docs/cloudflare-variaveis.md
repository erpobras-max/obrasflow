# Variáveis do Cloudflare Workers

Configure estas variáveis no ambiente de **build** do projeto Cloudflare Workers antes de publicar:

| Nome | Visibilidade | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | pública | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pública | chave publishable/anon do Supabase |
| `VITE_NEW_RELIC_ACCOUNT_ID` | pública, opcional | monitoramento do navegador |
| `VITE_NEW_RELIC_APPLICATION_ID` | pública, opcional | monitoramento do navegador |
| `VITE_NEW_RELIC_BROWSER_LICENSE_KEY` | pública, opcional | monitoramento do navegador |

As variáveis abaixo devem ser cadastradas como **secrets** ou variáveis privadas de runtime. Nunca use o prefixo `VITE_` nelas:

- `MY_SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`

Depois de alterar uma variável de build, faça um novo deploy.