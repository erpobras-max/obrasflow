-- Ensure all required columns for documents and versioning exist on the documentos table
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS bucket_path text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tamanho_bytes bigint;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.documentos(id) ON DELETE CASCADE;
