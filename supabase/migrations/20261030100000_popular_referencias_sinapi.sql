-- ==============================================================================
-- Carga Inicial de Referências Oficiais SINAPI (Caixa Econômica Federal)
-- ==============================================================================

-- Insumos Oficiais SINAPI
INSERT INTO public.referencia_insumos (fonte, uf, mes_referencia, codigo, descricao, unidade, preco_mediano)
VALUES
  ('sinapi', 'MG', '10/2026', '88309', 'Pedreiro com encargos complementares', 'h', 2440),
  ('sinapi', 'MG', '10/2026', '88316', 'Servente com encargos complementares', 'h', 1955),
  ('sinapi', 'MG', '10/2026', '88262', 'Carpinteiro de formas com encargos complementares', 'h', 2440),
  ('sinapi', 'MG', '10/2026', '88247', 'Eletricista com encargos complementares', 'h', 2440),
  ('sinapi', 'MG', '10/2026', '88267', 'Encanador com encargos complementares', 'h', 2440),
  ('sinapi', 'MG', '10/2026', '88311', 'Pintor com encargos complementares', 'h', 2440),
  ('sinapi', 'MG', '10/2026', '07271', 'Bloco cerâmico furado 9x19x19 cm', 'mil', 86966),
  ('sinapi', 'MG', '10/2026', '00001379', 'Cimento Portland CP II-E-32', 'kg', 72),
  ('sinapi', 'MG', '10/2026', '00000370', 'Areia média lavada', 'm³', 9800),
  ('sinapi', 'MG', '10/2026', '00004721', 'Pedra britada n. 1 (9,5 a 19 mm)', 'm³', 8500),
  ('sinapi', 'MG', '10/2026', '00000034', 'Aço CA-50 10,0 mm', 'kg', 520),
  ('sinapi', 'MG', '10/2026', '00007356', 'Tinta látex acrílica acabamento fosco', 'l', 1800),
  ('sinapi', 'MG', '10/2026', '00001213', 'Piso cerâmico esmaltado PEI-4 45x45 cm', 'm²', 3200),
  ('sinapi', 'SP', '10/2026', '88309', 'Pedreiro com encargos complementares', 'h', 2550),
  ('sinapi', 'SP', '10/2026', '88316', 'Servente com encargos complementares', 'h', 2010)
ON CONFLICT (fonte, uf, mes_referencia, codigo) DO UPDATE
SET preco_mediano = EXCLUDED.preco_mediano,
    descricao = EXCLUDED.descricao,
    unidade = EXCLUDED.unidade;

-- Composições Oficiais SINAPI
INSERT INTO public.referencia_composicoes (fonte, uf, mes_referencia, codigo, descricao, unidade, custo_total, tipo_classe)
VALUES
  ('sinapi', 'MG', '10/2026', '98524', 'Limpeza manual de vegetação em terreno com roçada e capina', 'm²', 375, 'SERVIÇOS PRELIMINARES'),
  ('sinapi', 'MG', '10/2026', '103328', 'Alvenaria de vedação com blocos cerâmicos furados 9x19x19 cm, argamassa 1:2:8', 'm²', 8464, 'PAREDES E PAINÉIS'),
  ('sinapi', 'MG', '10/2026', '94964', 'Concreto FCK 25MPA preparado com betoneira 400L para fundações e pilares', 'm³', 42050, 'ESTRUTURAS / FUNDAÇÕES'),
  ('sinapi', 'MG', '10/2026', '92440', 'Montagem e desmontagem de formas de madeira compensada resinada 12mm', 'm²', 8930, 'ESTRUTURAS'),
  ('sinapi', 'MG', '10/2026', '89995', 'Armação de pilar ou viga de estrutura convencional aço CA-50 10mm', 'kg', 1480, 'ESTRUTURAS'),
  ('sinapi', 'MG', '10/2026', '88489', 'Pintura látex acrílica em paredes internas, duas demãos com lixamento', 'm²', 2210, 'PINTURAS'),
  ('sinapi', 'MG', '10/2026', '93358', 'Revestimento cerâmico para pisos assentado com argamassa AC-I e rejunte', 'm²', 6890, 'REVESTIMENTOS'),
  ('sinapi', 'MG', '10/2026', '90114', 'Telhamento com telha cerâmica tipo colonial ou portuguesa', 'm²', 6240, 'COBERTURA'),
  ('sinapi', 'MG', '10/2026', '90442', 'Ponto de tomada 2P+T 10A ou interruptor simples com placa e caixa', 'un', 5420, 'INSTALAÇÕES ELÉTRICAS'),
  ('sinapi', 'MG', '10/2026', '89356', 'Tubo de PVC rígido soldável marrom DN 25mm para água fria com conexões', 'm', 1870, 'INSTALAÇÕES HIDRÁULICAS'),
  ('sinapi', 'MG', '10/2026', '96527', 'Escavação manual de vala para fundação contínua ou sapata até 1,5m', 'm³', 4800, 'MOVIMENTO DE TERRA'),
  ('sinapi', 'MG', '10/2026', '98504', 'Plantio de grama em placas tipo esmeralda incluindo preparo de solo', 'm²', 1650, 'PAISAGISMO'),
  ('sinapi', 'MG', '10/2026', '101964', 'Quadro de distribuição de energia embutido para 12 a 18 disjuntores', 'un', 18500, 'INSTALAÇÕES ELÉTRICAS')
ON CONFLICT (fonte, uf, mes_referencia, codigo) DO UPDATE
SET custo_total = EXCLUDED.custo_total,
    descricao = EXCLUDED.descricao,
    unidade = EXCLUDED.unidade,
    tipo_classe = EXCLUDED.tipo_classe;

