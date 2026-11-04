-- Reversão da evolução do Portal do Cliente.
REVOKE ALL ON FUNCTION public.consultar_proposta_portal(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.responder_solicitacao_portal(uuid, text) FROM authenticated;
DROP FUNCTION IF EXISTS public.responder_solicitacao_portal(uuid, text);
DROP FUNCTION IF EXISTS public.consultar_proposta_portal(uuid);
DROP TABLE IF EXISTS public.portal_solicitacoes;
