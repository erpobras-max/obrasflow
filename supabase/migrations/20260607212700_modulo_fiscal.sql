-- Migration to create the Fiscal module tables, columns, constraints, RLS policies and storage bucket.

-- 1. Create public.notas_fiscais table
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero text NOT NULL,
  serie text,
  tipo text NOT NULL CHECK (tipo IN ('nfe', 'nfse')),
  chave_acesso text CHECK (length(chave_acesso) = 44 OR chave_acesso IS NULL),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'autorizada', 'cancelada', 'rejeitada')),
  valor_total bigint NOT NULL, -- Valor em centavos
  xml_url text, -- Link para o arquivo XML no Storage
  pdf_url text, -- Link para a DANFE/RPS no Storage
  mensagem_sefaz text, -- Detalhes ou logs de retorno da SEFAZ
  emitido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- 3. Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;

-- 4. Define RLS policies for public.notas_fiscais
CREATE POLICY "notas_fiscais_select" ON public.notas_fiscais FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "notas_fiscais_insert" ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "notas_fiscais_update" ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "notas_fiscais_delete" ON public.notas_fiscais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add updated_at trigger
DROP TRIGGER IF EXISTS trg_notas_fiscais_updated ON public.notas_fiscais;
CREATE TRIGGER trg_notas_fiscais_updated BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Insert storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('fiscais', 'fiscais', false) ON CONFLICT (id) DO NOTHING;

-- 7. Define storage RLS policies for fiscais bucket
DROP POLICY IF EXISTS "fiscais_select_policy" ON storage.objects;
CREATE POLICY "fiscais_select_policy" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiscais' AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'diretor') OR 
      public.has_role(auth.uid(), 'financeiro')
    )
  );

DROP POLICY IF EXISTS "fiscais_insert_policy" ON storage.objects;
CREATE POLICY "fiscais_insert_policy" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiscais' AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'financeiro')
    )
  );

DROP POLICY IF EXISTS "fiscais_delete_policy" ON storage.objects;
CREATE POLICY "fiscais_delete_policy" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiscais' AND (
      public.has_role(auth.uid(), 'admin')
    )
  );
