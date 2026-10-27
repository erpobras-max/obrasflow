# Ativação do OneSignal no ObrasFlow

O ObrasFlow usa um único aplicativo OneSignal para Web Push, e-mail e SMS. As chaves privadas ficam somente nos Secrets do Cloudflare Worker.

## 1. Segurança antes de ativar

A chave REST que existia no código deve ser revogada no painel OneSignal. Gere uma nova chave em **Settings → Keys & IDs** e nunca a coloque em arquivo versionado.

Cadastre os seguintes Secrets no Worker `obrasflow`:

```text
ONESIGNAL_REST_KEY=<nova chave REST>
CRON_SECRET=<valor longo e aleatório>
```

`ONESIGNAL_APP_ID` é opcional porque o App ID atual é público e já está configurado no cliente. Cadastre-o como variável caso o aplicativo OneSignal seja trocado.

## 2. Web Push

No painel OneSignal, configure a plataforma **Web** com a origem exata usada em produção:

```text
https://obrasflow.erpobras.workers.dev
```

O SDK usa:

- worker: `/push/onesignal/OneSignalSDKWorker.js`;
- escopo: `/push/onesignal/`;
- identificação: UUID do usuário autenticado como `external_id`.

Depois da publicação, entre no ObrasFlow, abra **Ordens de Serviço**, clique em **Ativar Push no Celular** e aceite a permissão do navegador. O teste envia apenas para o usuário conectado, não para todos os assinantes.

## 3. E-mail

Ative **Email** no mesmo app OneSignal. Use um endereço em domínio próprio e conclua a validação DNS solicitada pelo OneSignal; Gmail e Outlook não servem como domínio remetente. Configure o nome e o endereço padrão do remetente no painel.

Os e-mails de prazo e o resumo matinal passam a usar a API do OneSignal. `RESEND_API_KEY` deixa de ser necessária para esses fluxos.

## 4. SMS

Para baixo volume e testes, conecte uma conta Twilio ao OneSignal e configure um Messaging Service com remetente habilitado para SMS. O serviço direto OneSignal SMS exige plano pago e é indicado pelo fornecedor para volumes acima de 5.000 SMS/mês.

Os telefones das Ordens de Serviço devem ter DDD. O sistema converte números brasileiros para E.164 (`+55...`) antes do envio.

## 5. Agendamento

- `0 10 * * *`: resumo matinal às 07:00 de Brasília;
- `*/15 11-23 * * *`: verificação de prazos a cada 15 minutos, das 08:00 às 20:45 de Brasília.

As rotas de execução aceitam somente um usuário autenticado ou o header interno `x-cron-secret`. Cada canal é registrado separadamente para não repetir um envio bem-sucedido no mesmo dia.

## 6. Ordem de ativação

1. Executar a migration `20261027000001_onesignal_omnichannel.sql` no Supabase.
2. Rotacionar a chave REST exposta e cadastrar `ONESIGNAL_REST_KEY` no Cloudflare.
3. Cadastrar `CRON_SECRET` no Cloudflare.
4. Configurar Web Push, domínio de e-mail e Twilio/SMS no painel OneSignal.
5. Publicar a branch aprovada e mesclada em `main`.
6. Testar push com um usuário; depois criar uma OS de teste com e-mail e celular próprios e executar **Disparar Alertas**.
