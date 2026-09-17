-- Migration to create the Equipamentos module tables, columns, constraints and RLS policies.

-- 1. Create public.equipamentos table
CREATE TABLE IF NOT EXISTS public.equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL, -- e.g. 'Máquina', 'Veículo', 'Ferramenta'
  marca text NOT NULL,
  modelo text NOT NULL,
  numero_serie text,
  placa text,
  data_aquisicao date NOT NULL,
  valor_aquisicao numeric,
  custo_hora numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'disponivel',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_valido CHECK (status IN ('disponivel', 'alocado', 'manutencao', 'inativo'))
);

-- 2. Create public.equipamentos_alocacoes table
CREATE TABLE IF NOT EXISTS public.equipamentos_alocacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date,
  custo_hora_efetivo numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create public.equipamentos_manutencoes table
CREATE TABLE IF NOT EXISTS public.equipamentos_manutencoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- e.g. 'preventiva', 'corretiva'
  descricao text NOT NULL,
  data date NOT NULL,
  custo numeric NOT NULL DEFAULT 0,
  realizado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipo_manutencao_valido CHECK (tipo IN ('preventiva', 'corretiva'))
);

-- 4. Create public.equipamentos_custos table
CREATE TABLE IF NOT EXISTS public.equipamentos_custos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  data date NOT NULL,
  tipo_custo text NOT NULL, -- e.g. 'combustivel', 'seguro', 'pecas', 'outros'
  descricao text,
  quantidade numeric, -- e.g. Litros de combustível
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipo_custo_valido CHECK (tipo_custo IN ('combustivel', 'seguro', 'pecas', 'outros'))
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_custos ENABLE ROW LEVEL SECURITY;

-- 6. Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos_alocacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos_manutencoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos_custos TO authenticated;

-- 7. Define RLS policies
-- SELECT (Admin, Diretor, Engenharia, Almoxarifado)
CREATE POLICY "equipamentos_select" ON public.equipamentos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- INSERT (Admin, Engenharia, Almoxarifado)
CREATE POLICY "equipamentos_insert" ON public.equipamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- UPDATE (Admin, Engenharia, Almoxarifado)
CREATE POLICY "equipamentos_update" ON public.equipamentos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- DELETE (Admin, Engenharia, Almoxarifado)
CREATE POLICY "equipamentos_delete" ON public.equipamentos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- Alocacoes policies
CREATE POLICY "alocacoes_select" ON public.equipamentos_alocacoes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "alocacoes_insert" ON public.equipamentos_alocacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "alocacoes_update" ON public.equipamentos_alocacoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "alocacoes_delete" ON public.equipamentos_alocacoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- Manutencoes policies
CREATE POLICY "manutencoes_select" ON public.equipamentos_manutencoes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "manutencoes_insert" ON public.equipamentos_manutencoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "manutencoes_update" ON public.equipamentos_manutencoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "manutencoes_delete" ON public.equipamentos_manutencoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- Custos policies
CREATE POLICY "custos_select" ON public.equipamentos_custos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "custos_insert" ON public.equipamentos_custos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "custos_update" ON public.equipamentos_custos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "custos_delete" ON public.equipamentos_custos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- 8. Add updated_at triggers
CREATE TRIGGER trg_equipamentos_updated BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_equipamentos_alocacoes_updated BEFORE UPDATE ON public.equipamentos_alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_equipamentos_manutencoes_updated BEFORE UPDATE ON public.equipamentos_manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_equipamentos_custos_updated BEFORE UPDATE ON public.equipamentos_custos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
