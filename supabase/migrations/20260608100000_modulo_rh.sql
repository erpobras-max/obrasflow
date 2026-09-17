-- ============================================
-- MÓDULO DE RH — RECURSOS HUMANOS
-- Integração futura com app mobile via fonte='mobile' + device_id + GPS
-- Folha com cálculo automático INSS/IRRF
-- ============================================

-- -----------------------------------------------
-- 1. FUNCIONÁRIOS
-- -----------------------------------------------
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados pessoais
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  rg TEXT,
  data_nascimento DATE,
  sexo TEXT CHECK (sexo IN ('masculino','feminino','outro')),
  estado_civil TEXT CHECK (estado_civil IN ('solteiro','casado','divorciado','viuvo','uniao_estavel')),
  nacionalidade TEXT DEFAULT 'Brasileira',
  -- Contato
  email TEXT,
  telefone TEXT,
  celular TEXT,
  -- Endereço
  cep TEXT,
  logradouro TEXT,
  numero_end TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  -- Dados contratuais
  matricula TEXT UNIQUE,
  cargo TEXT NOT NULL,
  departamento TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  data_admissao DATE NOT NULL,
  data_demissao DATE,
  motivo_demissao TEXT,
  tipo_contrato TEXT NOT NULL DEFAULT 'clt'
    CHECK (tipo_contrato IN ('clt','pj','estagiario','temporario','autonomo')),
  carga_horaria_semanal INTEGER NOT NULL DEFAULT 44,
  salario_base BIGINT NOT NULL DEFAULT 0, -- em centavos
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','afastado','demitido','ferias')),
  -- Dados bancários
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT CHECK (tipo_conta IN ('corrente','poupanca','salario')),
  pix TEXT,
  -- Documentos complementares
  pis TEXT,
  ctps_numero TEXT,
  ctps_serie TEXT,
  titulo_eleitor TEXT,
  cnh TEXT,
  -- Extras
  foto_url TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_funcionarios_status ON public.funcionarios(status);
CREATE INDEX idx_funcionarios_departamento ON public.funcionarios(departamento);
CREATE INDEX idx_funcionarios_obra ON public.funcionarios(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO authenticated;
GRANT ALL ON public.funcionarios TO service_role;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_func_select" ON public.funcionarios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_func_insert" ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_func_update" ON public.funcionarios FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_func_delete" ON public.funcionarios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------
-- 2. REGISTROS DE PONTO
-- Preparado para integração futura com app mobile (fonte, device_id, GPS)
-- -----------------------------------------------
CREATE TABLE public.registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_entrada TIME,
  hora_saida_almoco TIME,
  hora_retorno_almoco TIME,
  hora_saida TIME,
  horas_trabalhadas NUMERIC(5,2), -- calculado no save
  tipo_dia TEXT NOT NULL DEFAULT 'normal'
    CHECK (tipo_dia IN ('normal','folga','feriado','falta','meio_periodo','afastamento')),
  observacoes TEXT,
  -- Campos para futura integração mobile
  fonte TEXT NOT NULL DEFAULT 'manual'
    CHECK (fonte IN ('manual','mobile','importacao')),
  device_id TEXT,          -- ID do dispositivo móvel
  latitude NUMERIC(10,8),  -- GPS entrada
  longitude NUMERIC(11,8), -- GPS entrada
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

CREATE INDEX idx_ponto_func_data ON public.registros_ponto(funcionario_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_ponto TO authenticated;
GRANT ALL ON public.registros_ponto TO service_role;
ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ponto_select" ON public.registros_ponto FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_ponto_all" ON public.registros_ponto FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));

-- -----------------------------------------------
-- 3. FÉRIAS
-- -----------------------------------------------
CREATE TABLE public.ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio DATE NOT NULL,
  periodo_aquisitivo_fim DATE NOT NULL,
  dias_direito INTEGER NOT NULL DEFAULT 30,
  dias_gozados INTEGER NOT NULL DEFAULT 0,
  data_inicio_gozo DATE,
  data_fim_gozo DATE,
  data_retorno DATE,
  abono_pecuniario INTEGER NOT NULL DEFAULT 0, -- dias vendidos (máx 10)
  status TEXT NOT NULL DEFAULT 'aquisitivo'
    CHECK (status IN ('aquisitivo','programado','gozando','concluido','vencido')),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ferias_func ON public.ferias(funcionario_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias TO authenticated;
GRANT ALL ON public.ferias TO service_role;
ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ferias_all" ON public.ferias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));

CREATE TRIGGER trg_ferias_updated BEFORE UPDATE ON public.ferias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------
-- 4. AFASTAMENTOS & ATESTADOS MÉDICOS
-- -----------------------------------------------
CREATE TABLE public.afastamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('atestado_medico','licenca_maternidade','licenca_paternidade',
                    'inss','acidente_trabalho','licenca_nao_remunerada','outros')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dias INTEGER,
  cid TEXT,     -- CID-10
  medico TEXT,
  crm TEXT,
  arquivo_url TEXT,  -- path no bucket documentos-rh
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','reprovado')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_afastamentos_func ON public.afastamentos(funcionario_id, data_inicio DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afastamentos TO authenticated;
GRANT ALL ON public.afastamentos TO service_role;
ALTER TABLE public.afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_afastamentos_all" ON public.afastamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));

-- -----------------------------------------------
-- 5. DOCUMENTOS DO FUNCIONÁRIO
-- -----------------------------------------------
CREATE TABLE public.documentos_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'contrato', 'ctps', 'rg', 'cpf', 'admissao', 'demissao', 'declaracao', 'outros'
  descricao TEXT,
  arquivo_url TEXT NOT NULL, -- path no bucket documentos-rh
  data_documento DATE,
  validade DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_rh_func ON public.documentos_rh(funcionario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_rh TO authenticated;
GRANT ALL ON public.documentos_rh TO service_role;
ALTER TABLE public.documentos_rh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_docs_all" ON public.documentos_rh FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));

-- -----------------------------------------------
-- 6. EVENTOS DE FOLHA DE PAGAMENTO
-- Suporta proventos e descontos manuais; INSS/IRRF calculados no frontend
-- -----------------------------------------------
CREATE TABLE public.eventos_folha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- formato YYYY-MM
  tipo TEXT NOT NULL
    CHECK (tipo IN (
      'hora_extra_50','hora_extra_100','adicional_noturno',
      'adicional_insalubridade','adicional_periculosidade',
      'vale_transporte','vale_refeicao','desconto_falta',
      'desconto_atraso','adiantamento','outros_proventos','outros_descontos'
    )),
  descricao TEXT,
  quantidade NUMERIC(10,2) DEFAULT 1,
  valor_unitario BIGINT NOT NULL DEFAULT 0, -- centavos
  valor_total BIGINT NOT NULL DEFAULT 0,    -- centavos
  natureza TEXT NOT NULL DEFAULT 'provento'
    CHECK (natureza IN ('provento','desconto')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_folha_func ON public.eventos_folha(funcionario_id, competencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_folha TO authenticated;
GRANT ALL ON public.eventos_folha TO service_role;
ALTER TABLE public.eventos_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_eventos_all" ON public.eventos_folha FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'rh'));

-- -----------------------------------------------
-- 7. STORAGE BUCKET: documentos-rh
-- Armazena atestados médicos e documentos de funcionários
-- -----------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-rh',
  'documentos-rh',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rh_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-rh' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'rh')
  ));
CREATE POLICY "rh_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-rh' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'rh')
  ));
CREATE POLICY "rh_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-rh' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  ));
