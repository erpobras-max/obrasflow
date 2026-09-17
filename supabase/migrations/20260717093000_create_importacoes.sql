-- 1. Criar a tabela de logs de importações
CREATE TABLE IF NOT EXISTS public.importacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('clientes', 'produtos', 'pedidos_venda', 'contas_pagar', 'contas_receber')),
  total_linhas integer NOT NULL DEFAULT 0,
  sucesso integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Criar a tabela de erros detalhados de importações
CREATE TABLE IF NOT EXISTS public.importacoes_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.importacoes_log(id) ON DELETE CASCADE,
  linha integer NOT NULL,
  campo text,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.importacoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_erros ENABLE ROW LEVEL SECURITY;

-- 4. Grant de privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_erros TO authenticated;

-- 5. Políticas de RLS
CREATE POLICY "importacoes_log_select" ON public.importacoes_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "importacoes_log_all" ON public.importacoes_log FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro')
);

CREATE POLICY "importacoes_erros_select" ON public.importacoes_erros FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "importacoes_erros_all" ON public.importacoes_erros FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro')
);
