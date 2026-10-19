# Especificação Técnica & Roadmap: Módulo de Projeto 3D, CAD Paramétrico & Dossiê Técnico

> **ObrasFlow ERP** — Módulo Integrado de Modelagem BIM/CAD, Visualização 3D, Quantitativos, BDI e Dossiê Comercial para Obras Particulares.

---

## 1. Visão Geral do Produto

O objetivo deste módulo é transformar cada obra cadastrada no **ObrasFlow** em um ambiente interativo de engenharia e apresentação de alto padrão.

Ao contrário de sistemas voltados exclusivamente a licitações públicas, o foco deste módulo no ObrasFlow são **obras particulares** (residenciais, comerciais e reformas), onde o cliente final busca clareza visual, segurança de escopo e transparência.

### Principais Benefícios:
1. **Modelagem 2D Paramétrica**: Desenho rápido de paredes, portas, janelas e ambientes no navegador, ou importação de planta `.dxf` do AutoCAD.
2. **Geração 3D Automática (Three.js)**: Extrusão volumétrica instantânea com controle de camadas (ligar/desligar telhado, paredes, esquadrias e modo corte de maquete).
3. **Memória de Cálculo de Quantitativos**: Cálculo automático de áreas de alvenaria ($m^2$), pisos ($m^2$), pintura ($m^2$), rodapés ($m$) e coberturas ($m^2$), com regras transparentes de desconto de vãos.
4. **BDI Privado Customizável**: Margem de lucro da construtora, impostos e custos indiretos sobre composições próprias ou SINAPI.
5. **Dossiê Técnico & Comercial**: Memorial descritivo em PDF diagramado com fotos 3D da obra na capa e especificações de acabamento por ambiente.
6. **Portal do Cliente (Modo View-Only)**: Visualização da maquete 3D interativa no celular do cliente final, com controle de visualização do telhado.

---

## 2. Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────┐
│                       ObrasFlow ERP                         │
│  Rotas: /_app/obras -> /_app/obras/$id/projeto             │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│      Canvas 2D (Editor)      │ │   Three.js 3D (Visualizador)│
│ - Paredes (espessura real)   │ │ - Extrusão paramétrica auto │
│ - Portas, Janelas, Vãos      │ │ - Filtro de Camadas (Layers)│
│ - Cômodos / Ambientes        │ │ - Corte Horizontal (Planta) │
│ - Importador DXF             │ │ - Snapshot 3D para Capa     │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Motor de Engenharia & Custos                 │
│ - Memória de cálculo de áreas e quantitativos               │
│ - Vinculação: SINAPI e/ou Tabela Própria da Construtora     │
│ - BDI da Obra (Lucro, Impostos, Administração Local)        │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Entregáveis & Saídas                     │
│ 1. Dossiê Técnico / Memorial Comercial (PDF de Alto Padrão) │
│ 2. Portal do Cliente (/portal): Maquete 3D Interativa       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Dados (Supabase / Postgres)

Tabela dedicada para armazenar o projeto em formato JSON estruturado, vinculado à obra e à empresa:

```sql
-- Migration: 20261019120000_create_obra_projetos_cad.sql

CREATE TABLE IF NOT EXISTS public.obra_projetos_cad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  
  -- Metadados do Projeto
  versao INTEGER NOT NULL DEFAULT 1,
  titulo VARCHAR(255) NOT NULL DEFAULT 'Projeto Arquitetônico 3D',
  descricao TEXT,
  
  -- Estado completo do CAD / BIM (Paredes, Aberturas, Ambientes, Cobertura, Camadas)
  dados_projeto JSONB NOT NULL DEFAULT '{
    "config": {
      "peDireito": 2.80,
      "espessuraParedePadrao": 0.15,
      "unidade": "m"
    },
    "paredes": [],
    "aberturas": [],
    "ambientes": [],
    "cobertura": {
      "tipo": "embutida",
      "inclinacao": 10,
      "beiral": 0.50
    },
    "layers": {
      "telhado": true,
      "paredes": true,
      "esquadrias": true,
      "piso": true,
      "estrutura": true
    }
  }'::jsonb,

  -- Snapshot da imagem 3D capturada para a capa do dossiê
  foto_capa_3d TEXT,
  fotos_adicionais JSONB DEFAULT '[]'::jsonb,

  -- Memória de cálculo e quantitativos gerados
  quantitativos_calculados JSONB DEFAULT '{}'::jsonb,
  
  -- Parâmetros de BDI e Configurações Comerciais
  config_bdi JSONB DEFAULT '{
    "lucroLiquido": 12.0,
    "impostos": 8.0,
    "administracaoLocal": 5.0,
    "contingencia": 3.0,
    "taxaBdiTotal": 31.5
  }'::jsonb,

  -- Configuração de visualização no Portal do Cliente
  visivel_no_portal BOOLEAN NOT NULL DEFAULT true,
  permitir_download_dossie_portal BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_obra_projetos_cad_obra UNIQUE (obra_id)
);

-- Índices para alta performance
CREATE INDEX IF NOT EXISTS idx_obra_projetos_cad_obra_id ON public.obra_projetos_cad(obra_id);

-- Conceder privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_projetos_cad TO authenticated;
GRANT ALL ON public.obra_projetos_cad TO service_role;

-- Habilitar RLS
ALTER TABLE public.obra_projetos_cad ENABLE ROW LEVEL SECURITY;

-- Política para equipe da construtora
CREATE POLICY "obra_projetos_cad_equipe_all" ON public.obra_projetos_cad
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'compras')
    OR NOT public.has_role(auth.uid(), 'cliente')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
    OR NOT public.has_role(auth.uid(), 'cliente')
  );

-- Política para clientes visualizarem no Portal
CREATE POLICY "obra_projetos_cad_portal_cliente_select" ON public.obra_projetos_cad
  FOR SELECT TO authenticated
  USING (
    visivel_no_portal = true AND EXISTS (
      SELECT 1 FROM public.obras o
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE o.id = obra_projetos_cad.obra_id
        AND c.auth_user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );
```

---

## 4. Estrutura do JSON do Projeto (`dados_projeto`)

```json
{
  "config": {
    "peDireito": 2.80,
    "espessuraParedePadrao": 0.15,
    "unidade": "m"
  },
  "paredes": [
    {
      "id": "wall_1",
      "p1": { "x": 0, "y": 0 },
      "p2": { "x": 8.5, "y": 0 },
      "espessura": 0.15,
      "altura": 2.80,
      "tipo": "alvenaria_bloco_14"
    }
  ],
  "aberturas": [
    {
      "id": "door_1",
      "paredeId": "wall_1",
      "tipo": "porta",
      "largura": 0.80,
      "altura": 2.10,
      "peitoril": 0.0,
      "distanciaP1": 1.20,
      "nome": "P1 - Entrada Principal"
    },
    {
      "id": "win_1",
      "paredeId": "wall_1",
      "tipo": "janela",
      "largura": 1.50,
      "altura": 1.20,
      "peitoril": 1.00,
      "distanciaP1": 4.00,
      "nome": "J1 - Janela Sala"
    }
  ],
  "ambientes": [
    {
      "id": "amb_1",
      "nome": "Sala de Estar / Jantar",
      "area": 25.50,
      "perimetro": 20.40,
      "pisoAcabamento": "Porcelanato 84x84 Polido",
      "tetoAcabamento": "Forro de Gesso com Junta Dilatação",
      "paredeAcabamento": "Pintura Acrílica Fosca Lavável"
    }
  ],
  "cobertura": {
    "tipo": "colonial_duas_aguas",
    "inclinacao": 30,
    "beiral": 0.60
  }
}
```

---

## 5. Roadmap de Implementação em Fases

### 🚀 Fase 1: Motor Visual 2D & 3D (MVP de Modelagem) — [CONCLUÍDO]
* [x] Migration da tabela `obra_projetos_cad` no Supabase (`20261019120000_create_obra_projetos_cad.sql`).
* [x] Rota `/projeto3d/$id` com layout imersivo ("Estúdio ObrasFlow").
* [x] Botão direto de acesso "Projeto 3D" na listagem de Obras (`/obras`).
* [x] Canvas 2D interativo com ferramentas:
  - Desenhar Paredes com espessura e snap ortogonal / grid.
  - Inserir Portas e Janelas arrastáveis sobre as paredes.
  - Reconhecimento automático de cômodos (cálculo de área em $m^2$).
* [x] Viewport 3D com Three.js:
  - Extrusão volumétrica automática das paredes e vãos.
  - Controles de câmera (Órbita, Pan, Zoom).
  - Menu de Camadas (ligar/desligar Telhado, Paredes, Esquadrias).
  - Botão de Corte Horizontal ($1,20\text{ m}$) para Planta Humanizada 3D.
  - Botão **"📸 Capturar para Capa"** com render em tempo real.
* [x] Salvamento e carregamento no Supabase vinculado à Obra.
* [x] **Projeto em Branco por Padrão**: Obras sem modelagem abrem 100% limpas (`paredes: []`), sem projetar nenhum modelo aleatório.

### 📊 Fase 2: Motor de Engenharia de Custos, Quantitativos & BDI — [CONCLUÍDO]
* [x] Algoritmo de cálculo de quantitativos com desconto de vãos:
  - Alvenaria líquida ($m^2$), chapisco/emboço ($m^2$), pintura ($m^2$), contrapiso/porcelanato ($m^2$), rodapé ($m$) e concreto de vigas ($m^3$).
* [x] Vinculação oficial com códigos e itens de referência do SINAPI.
* [x] Painel de BDI Privado (Lucro desejado, Encargos, Impostos federais/municipais, Custo Indireto e Contingência).
* [x] Memória de cálculo auditável na tela (fórmulas abertas e transparentes).

### 📄 Fase 3: Dossiê Técnico Executivo & Portal do Cliente — [CONCLUÍDO]
* [x] Gerador do Dossiê Técnico & Memorial Descritivo em padrão de impressão A4:
  - Capa de luxo com a foto 3D capturada pelo engenheiro.
  - Metadados completos da obra (cliente, logradouro, cidade, responsável).
  - Quadro de acabamentos por ambiente e resumo executivo de materiais.
  - Planilha de BDI detalhada para apresentação ao cliente.
* [x] Módulo no Portal do Cliente (`/portal/projeto`):
  - Visualizador 3D somente leitura com rotação, zoom e toggle de telhado.
  - Aba com visualização e download do Dossiê Técnico em PDF.
  - Estado vazio informativo caso a obra ainda não tenha maquete publicada.

### 🛠️ Fase 4: Recursos CAD Avançados & Blindagem de Dados — [CONCLUÍDO]
* [x] **Importador DXF**: Leitura nativa de linhas e polilinhas do AutoCAD em ASCII.
* [x] **Exportador DXF Nativo**: Geração de arquivos `.dxf` (AutoCAD R12) com camadas separadas (`PAREDES`, `ESQUADRIAS`) para download direto.
* [x] **Gerador Paramétrico de Cômodo (`+ Novo Cômodo`)**: Criação de cômodos retangulares em 1 clique (largura x comprimento com geração das 4 paredes e piso 3D).
* [x] **Modo Ortogonal (Ortho Lock 90°)**: Trava o cursor em ângulos retos para desenho de alta precisão.
* [x] **Seletores de Dimensões Ativas**:
  - Paredes: 10cm, 15cm, 20cm ou customizada.
  - Portas: 0.60m, 0.70m, 0.80m, 0.90m, 1.00m.
  - Janelas: 0.60m, 1.00m, 1.20m, 1.50m, 2.00m.
* [x] **Painel de Edição Paramétrica**: Permite alterar medidas de paredes e aberturas já desenhadas na planta em tempo real.
* [x] **Proteção contra Perda de Dados**:
  - `refetchOnWindowFocus: false`: impede recarregamento involuntário da tela ao alternar entre abas do navegador.
  - **Auto-Save / Backup Local (`localStorage`)**: rascunho salvo continuamente no navegador com restauração automática em caso de fechamento acidental.
  - **Aviso `beforeunload`**: alerta nativo se o usuário tentar sair da tela com alterações não salvas.
  - **Badge de Pendência**: indicador visual `● Alterações não salvas`.

### 💰 Fase 5: Integração BIM 3D com Medições & Financeiro — [CONCLUÍDO]
* [x] **Exportação Seletiva de Serviços / Reformas**:
  - Engenheiro seleciona na aba **Quantitativos & BDI** exatamente quais serviços farão parte da medição (ex: só piso, só gesso ou só pintura).
  - Suporte a reformas onde a planta está completa mas a intervenção é pontual.
* [x] **Lançamento Direto em Medições**:
  - Botão **"Gerar Medição / Financeiro"** no Projeto 3D cria automaticamente a medição com datas de início e fim.
  - Valores unitários já incorporam a taxa de BDI calculada no projeto.
* [x] **Importação Inversa no Módulo de Medições**:
  - Botão **"Do Projeto 3D"** na tela de Medições (`/medicoes`) importa instantaneamente os quantitativos calculados no 3D para a planilha de medição da obra.
* [x] **Conexão com o Financeiro**:
  - Ao aprovar ou faturar a medição gerada a partir do 3D, a trigger do Supabase gera automaticamente os títulos em **Contas a Receber** e provisiona os pagamentos.

### 🚀 Fase 6: Visão 4D de Evolução, Novos Móveis & Galeria Visual do Canteiro — [CONCLUÍDO]
* [x] **Visão 4D no 3D (Status de Medição em Tempo Real)**:
  - Botão flutuante **"Visão 4D"** que colore as paredes de acordo com o avanço físico real das medições.
  - 🟢 **Verde Esmeralda**: Paredes já medidas e faturadas.
  - 🟡 **Âmbar**: Paredes em execução no período atual.
  - ⚪ **Cinza Translúcido**: Etapas futuras a executar.
  - **Legenda Flutuante 4D**: Exibe o percentual consolidado executado da obra e atalho para a última medição.
* [x] **Novos Móveis Paramétricos na Biblioteca 2D e 3D**:
  - `guarda_roupa`: Guarda-roupa 3 portas em madeira nobre com puxadores em inox.
  - `tv_rack`: Painel amadeirado de parede com TV de tela plana em granito preto e nicho inferior.
  - `box_chuveiro`: Vidro temperado translúcido com acabamento de perfis em inox e ducha superior.
* [x] **Galeria do Diário de Obras Integrada no 3D**:
  - Botão **"Fotos Canteiro"** exibido automaticamente no 3D com contador de mídias registradas.
  - Modal com galeria de fotos reais tiradas em campo pelo celular no Diário de Obra, com data, hora e clima.
  - Habilitado tanto no Estúdio interno de Engenharia quanto no **Portal do Cliente**.


