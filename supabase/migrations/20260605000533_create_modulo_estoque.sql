
CREATE TYPE public.status_obra AS ENUM ('planejamento','em_andamento','pausada','concluida','cancelada');

CREATE SEQUENCE IF NOT EXISTS public.obras_numero_seq;

CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.status_obra NOT NULL DEFAULT 'planejamento',
  orcamento numeric(14,2) NOT NULL DEFAULT 0,
  valor_executado numeric(14,2) NOT NULL DEFAULT 0,
  progresso int NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  data_inicio_prevista date,
  data_fim_prevista date,
  data_inicio_real date,
  data_fim_real date,
  cep text,
  logradouro text,
  numero_endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Obras visiveis" ON public.obras FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
  OR public.has_role(auth.uid(),'almoxarifado')
);
CREATE POLICY "Obras insert" ON public.obras FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Obras update" ON public.obras FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Obras delete" ON public.obras FOR DELETE TO authenticated
USING ( public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') );

-- Equipe da obra
CREATE TABLE public.obras_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funcao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obra_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras_equipe TO authenticated;
GRANT ALL ON public.obras_equipe TO service_role;
ALTER TABLE public.obras_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe visivel" ON public.obras_equipe FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
);
CREATE POLICY "Equipe insert" ON public.obras_equipe FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);
CREATE POLICY "Equipe delete" ON public.obras_equipe FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
);

CREATE TRIGGER trg_obras_updated_at BEFORE UPDATE ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gerar_numero_obra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'OBRA-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.obras_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_obra() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_obras_numero BEFORE INSERT ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_obra();
