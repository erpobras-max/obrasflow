-- Ensure all necessary columns for documents and versioning exist on the documentos table
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS bucket_path text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tamanho_bytes bigint;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.documentos(id) ON DELETE CASCADE;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Grant DML access on documentos to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

-- Enable RLS and create policy for authenticated users to manage documents
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_authenticated_all" ON public.documentos;
CREATE POLICY "documentos_authenticated_all" ON public.documentos 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
