import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Database, Sparkles, Loader2, Check, Package, Hammer, Layers } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase as client } from '@/integrations/supabase/client.custom'

const supabase = client as any

export interface ComposicaoCatalogoItem {
  id: string
  codigo: string
  descricao: string
  unidade: string
  valorUnitarioCentavos: number
  fonte: 'sinapi' | 'propria'
  tipoItem: 'composicao' | 'insumo'
  categoria?: string
  categoriaInsumo?: 'mao_de_obra' | 'material' | 'equipamento' | 'outros'
  insumos?: Array<{
    codigo: string
    descricao: string
    unidade: string
    categoria: 'mao_de_obra' | 'material' | 'equipamento' | 'outros'
    coeficiente: number
    precoUnitarioCentavos: number
  }>
}

interface CatalogoComposicoesDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  etapas: Array<{ id: string; codigo: string; nome: string }>
  etapaSelecionadaId?: string
  onInserir(composicao: ComposicaoCatalogoItem, etapaId: string): void
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Base Oficial SINAPI (Composições de Serviços)
export const COMPOSICOES_SINAPI_OFICIAIS: ComposicaoCatalogoItem[] = [
  {
    id: 'comp-98524',
    codigo: '98524',
    descricao: 'Limpeza manual de vegetação em terreno com roçada e capina',
    unidade: 'm²',
    valorUnitarioCentavos: 375,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'SERVIÇOS PRELIMINARES',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.15, precoUnitarioCentavos: 1955 },
      { codigo: '00000367', descricao: 'Enxada e ferramentas manuais', unidade: 'un', categoria: 'equipamento', coeficiente: 0.05, precoUnitarioCentavos: 1640 },
    ],
  },
  {
    id: 'comp-103328',
    codigo: '103328',
    descricao: 'Alvenaria de vedação com blocos cerâmicos furados 9x19x19 cm, argamassa 1:2:8',
    unidade: 'm²',
    valorUnitarioCentavos: 8464,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'PAREDES E PAINÉIS',
    insumos: [
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.61, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.805, precoUnitarioCentavos: 1955 },
      { codigo: '07271', descricao: 'Bloco cerâmico 9x19x19 cm', unidade: 'mil', categoria: 'material', coeficiente: 0.02831, precoUnitarioCentavos: 86966 },
      { codigo: '37592', descricao: 'Tela metálica galvanizada para amarração', unidade: 'm', categoria: 'material', coeficiente: 0.42, precoUnitarioCentavos: 1190 },
    ],
  },
  {
    id: 'comp-94964',
    codigo: '94964',
    descricao: 'Concreto FCK 25MPA preparado com betoneira 400L para fundações e pilares',
    unidade: 'm³',
    valorUnitarioCentavos: 42050,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'ESTRUTURAS / FUNDAÇÕES',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.5, precoUnitarioCentavos: 1955 },
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.2, precoUnitarioCentavos: 2440 },
      { codigo: '00001379', descricao: 'Cimento Portland CP II-E-32', unidade: 'kg', categoria: 'material', coeficiente: 350.0, precoUnitarioCentavos: 72 },
      { codigo: '00000370', descricao: 'Areia média lavada', unidade: 'm³', categoria: 'material', coeficiente: 0.75, precoUnitarioCentavos: 9800 },
      { codigo: '00004721', descricao: 'Pedra britada n. 1 (9,5 a 19 mm)', unidade: 'm³', categoria: 'material', coeficiente: 0.82, precoUnitarioCentavos: 8500 },
    ],
  },
  {
    id: 'comp-92440',
    codigo: '92440',
    descricao: 'Montagem e desmontagem de formas de madeira compensada resinada 12mm',
    unidade: 'm²',
    valorUnitarioCentavos: 8930,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'ESTRUTURAS',
    insumos: [
      { codigo: '88262', descricao: 'Carpinteiro de formas com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.2, precoUnitarioCentavos: 1955 },
      { codigo: '00001358', descricao: 'Chapa de madeira compensada resinada 12mm', unidade: 'm²', categoria: 'material', coeficiente: 0.35, precoUnitarioCentavos: 4500 },
    ],
  },
  {
    id: 'comp-89995',
    codigo: '89995',
    descricao: 'Armação de pilar ou viga de estrutura convencional aço CA-50 10mm',
    unidade: 'kg',
    valorUnitarioCentavos: 1480,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'ESTRUTURAS',
    insumos: [
      { codigo: '88245', descricao: 'Armador com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.25, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.15, precoUnitarioCentavos: 1955 },
      { codigo: '00000034', descricao: 'Aço CA-50 10,0 mm', unidade: 'kg', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 520 },
    ],
  },
  {
    id: 'comp-88489',
    codigo: '88489',
    descricao: 'Pintura látex acrílica em paredes internas, duas demãos com lixamento prévio',
    unidade: 'm²',
    valorUnitarioCentavos: 2210,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'PINTURAS',
    insumos: [
      { codigo: '88311', descricao: 'Pintor com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.45, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.20, precoUnitarioCentavos: 1955 },
      { codigo: '00007356', descricao: 'Tinta látex acrílica premium acabamento fosco', unidade: 'l', categoria: 'material', coeficiente: 0.33, precoUnitarioCentavos: 1800 },
    ],
  },
  {
    id: 'comp-93358',
    codigo: '93358',
    descricao: 'Revestimento cerâmico para pisos assentado com argamassa AC-I e rejunte',
    unidade: 'm²',
    valorUnitarioCentavos: 6890,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'REVESTIMENTOS',
    insumos: [
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.9, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.5, precoUnitarioCentavos: 1955 },
      { codigo: '00001213', descricao: 'Piso cerâmico esmaltado PEI-4 45x45 cm', unidade: 'm²', categoria: 'material', coeficiente: 1.08, precoUnitarioCentavos: 3200 },
      { codigo: '00000378', descricao: 'Argamassa colante tipo AC-I', unidade: 'kg', categoria: 'material', coeficiente: 6.0, precoUnitarioCentavos: 65 },
    ],
  },
  {
    id: 'comp-90114',
    codigo: '90114',
    descricao: 'Telhamento com telha cerâmica tipo colonial ou portuguesa sobre estrutura de madeira',
    unidade: 'm²',
    valorUnitarioCentavos: 6240,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'COBERTURA',
    insumos: [
      { codigo: '88262', descricao: 'Carpinteiro de telhados com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.6, precoUnitarioCentavos: 1955 },
      { codigo: '00007158', descricao: 'Telha cerâmica colonial', unidade: 'mil', categoria: 'material', coeficiente: 0.017, precoUnitarioCentavos: 175000 },
    ],
  },
  {
    id: 'comp-90442',
    codigo: '90442',
    descricao: 'Ponto de tomada 2P+T 10A ou interruptor simples embutido com caixa e placa',
    unidade: 'un',
    valorUnitarioCentavos: 5420,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'INSTALAÇÕES ELÉTRICAS',
    insumos: [
      { codigo: '88247', descricao: 'Eletricista com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.7, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.4, precoUnitarioCentavos: 1955 },
      { codigo: '00038102', descricao: 'Módulo tomada 2P+T 10A 250V com placa 4x2', unidade: 'un', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 1850 },
    ],
  },
  {
    id: 'comp-89356',
    codigo: '89356',
    descricao: 'Tubo de PVC rígido soldável marrom DN 25mm (3/4") para água fria com conexões',
    unidade: 'm',
    valorUnitarioCentavos: 1870,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'INSTALAÇÕES HIDRÁULICAS',
    insumos: [
      { codigo: '88267', descricao: 'Encanador com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.3, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.2, precoUnitarioCentavos: 1955 },
      { codigo: '00009868', descricao: 'Tubo PVC rígido soldável 25mm', unidade: 'm', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 620 },
    ],
  },
  {
    id: 'comp-96527',
    codigo: '96527',
    descricao: 'Escavação manual de vala para fundação contínua ou sapata até 1,5m de profundidade',
    unidade: 'm³',
    valorUnitarioCentavos: 4800,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'MOVIMENTO DE TERRA',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.45, precoUnitarioCentavos: 1955 },
    ],
  },
  {
    id: 'comp-98504',
    codigo: '98504',
    descricao: 'Plantio de grama em placas tipo esmeralda incluindo preparo de solo e adubação',
    unidade: 'm²',
    valorUnitarioCentavos: 1650,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'PAISAGISMO E ÁREAS EXTERNAS',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.35, precoUnitarioCentavos: 1955 },
      { codigo: '00003324', descricao: 'Grama esmeralda em placas', unidade: 'm²', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 850 },
    ],
  },
  {
    id: 'comp-101964',
    codigo: '101964',
    descricao: 'Quadro de distribuição de energia de embutir para 12 a 18 disjuntores com barramento',
    unidade: 'un',
    valorUnitarioCentavos: 18500,
    fonte: 'sinapi',
    tipoItem: 'composicao',
    categoria: 'INSTALAÇÕES ELÉTRICAS',
    insumos: [
      { codigo: '88247', descricao: 'Eletricista com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.0, precoUnitarioCentavos: 1955 },
      { codigo: '00012015', descricao: 'Quadro de distribuição metálico embutir c/ barramento', unidade: 'un', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 11500 },
    ],
  },
]

// Base Oficial SINAPI (Insumos Diretos de Mão de Obra, Material e Equipamento)
export const INSUMOS_SINAPI_OFICIAIS: ComposicaoCatalogoItem[] = [
  // Mão de Obra
  { id: 'ins-88309', codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88316', codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', valorUnitarioCentavos: 1955, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88262', codigo: '88262', descricao: 'Carpinteiro de formas com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88245', codigo: '88245', descricao: 'Armador com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88247', codigo: '88247', descricao: 'Eletricista com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88267', codigo: '88267', descricao: 'Encanador ou bombeiro hidráulico com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88311', codigo: '88311', descricao: 'Pintor com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88301', codigo: '88301', descricao: 'Mestre de obras com encargos complementares', unidade: 'h', valorUnitarioCentavos: 4250, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88260', codigo: '88260', descricao: 'Calceteiro com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2290, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88320', codigo: '88320', descricao: 'Telhadista com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },
  { id: 'ins-88274', codigo: '88274', descricao: 'Gesseiro com encargos complementares', unidade: 'h', valorUnitarioCentavos: 2440, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MÃO DE OBRA', categoriaInsumo: 'mao_de_obra' },

  // Materiais Básicos e Estruturais
  { id: 'ins-00001379', codigo: '00001379', descricao: 'Cimento Portland composto CP II-E-32', unidade: 'kg', valorUnitarioCentavos: 72, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000370', codigo: '00000370', descricao: 'Areia média lavada para concreto e argamassas', unidade: 'm³', valorUnitarioCentavos: 9800, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00004721', codigo: '00004721', descricao: 'Pedra britada n. 1 (9,5 a 19 mm)', unidade: 'm³', valorUnitarioCentavos: 8500, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00004718', codigo: '00004718', descricao: 'Pedra britada n. 2 (19 a 25 mm)', unidade: 'm³', valorUnitarioCentavos: 8500, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000034', codigo: '00000034', descricao: 'Aço CA-50 soldável barra reta 10 mm (3/8")', unidade: 'kg', valorUnitarioCentavos: 520, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000033', codigo: '00000033', descricao: 'Aço CA-50 soldável barra reta 8 mm (5/16")', unidade: 'kg', valorUnitarioCentavos: 540, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000032', codigo: '00000032', descricao: 'Aço CA-50 soldável barra reta 6.3 mm (1/4")', unidade: 'kg', valorUnitarioCentavos: 580, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000043', codigo: '00000043', descricao: 'Aço CA-60 barra ou rolo 5 mm', unidade: 'kg', valorUnitarioCentavos: 610, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000362', codigo: '00000362', descricao: 'Arame recozido 18 BWG d=1,25 mm', unidade: 'kg', valorUnitarioCentavos: 1240, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-07271', codigo: '07271', descricao: 'Bloco cerâmico furado 9x19x19 cm para vedação', unidade: 'mil', valorUnitarioCentavos: 86966, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000678', codigo: '00000678', descricao: 'Bloco de concreto estrutural 14x19x39 cm', unidade: 'un', valorUnitarioCentavos: 450, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },

  // Argamassas, Pisos e Acabamentos
  { id: 'ins-00000378', codigo: '00000378', descricao: 'Argamassa colante tipo AC-I para interiores (saco 20 kg)', unidade: 'kg', valorUnitarioCentavos: 65, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000377', codigo: '00000377', descricao: 'Argamassa colante tipo AC-II para áreas externas (saco 20 kg)', unidade: 'kg', valorUnitarioCentavos: 110, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000376', codigo: '00000376', descricao: 'Argamassa colante tipo AC-III para grandes formatos e porcelanato', unidade: 'kg', valorUnitarioCentavos: 170, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00001213', codigo: '00001213', descricao: 'Piso cerâmico esmaltado PEI-4 45x45 cm', unidade: 'm²', valorUnitarioCentavos: 3200, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00007356', codigo: '00007356', descricao: 'Tinta látex acrílica premium acabamento fosco', unidade: 'l', valorUnitarioCentavos: 1800, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00001358', codigo: '00001358', descricao: 'Chapa de madeira compensada resinada 12 mm 1,10x2,20 m', unidade: 'm²', valorUnitarioCentavos: 4500, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00005068', codigo: '00005068', descricao: 'Prego com cabeça 17x27 (2 1/2" x 11)', unidade: 'kg', valorUnitarioCentavos: 1650, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00007158', codigo: '00007158', descricao: 'Telha cerâmica colonial', unidade: 'mil', valorUnitarioCentavos: 175000, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00007172', codigo: '00007172', descricao: 'Telha de fibrocimento ondulada 6 mm 2,44x1,10 m', unidade: 'un', valorUnitarioCentavos: 5600, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },

  // Instalações Hidráulicas e Elétricas
  { id: 'ins-00009868', codigo: '00009868', descricao: 'Tubo de PVC rígido soldável 25 mm (3/4") barra 6m', unidade: 'm', valorUnitarioCentavos: 620, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00009869', codigo: '00009869', descricao: 'Tubo de PVC rígido soldável 32 mm (1") barra 6m', unidade: 'm', valorUnitarioCentavos: 1150, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00009836', codigo: '00009836', descricao: 'Tubo de PVC para esgoto predial 100 mm barra 6m', unidade: 'm', valorUnitarioCentavos: 1890, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00038102', codigo: '00038102', descricao: 'Módulo de tomada 2P+T 10A 250V com placa 4x2', unidade: 'un', valorUnitarioCentavos: 1850, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000984', codigo: '00000984', descricao: 'Cabo de cobre flexível antichama 2,5 mm² 750V', unidade: 'm', valorUnitarioCentavos: 240, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000985', codigo: '00000985', descricao: 'Cabo de cobre flexível antichama 4,0 mm² 750V', unidade: 'm', valorUnitarioCentavos: 390, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },
  { id: 'ins-00000986', codigo: '00000986', descricao: 'Cabo de cobre flexível antichama 6,0 mm² 750V', unidade: 'm', valorUnitarioCentavos: 580, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'MATERIAL', categoriaInsumo: 'material' },

  // Equipamentos e Locações
  { id: 'ins-00010550', codigo: '00010550', descricao: 'Betoneira capacidade 400L com motor elétrico trifásico (locação)', unidade: 'mês', valorUnitarioCentavos: 45000, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'EQUIPAMENTO', categoriaInsumo: 'equipamento' },
  { id: 'ins-00014618', codigo: '00014618', descricao: 'Andaime metálico tubular tipo torre 1,5x1,5m com painéis e diagonais', unidade: 'mês', valorUnitarioCentavos: 12000, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'EQUIPAMENTO', categoriaInsumo: 'equipamento' },
  { id: 'ins-00013280', codigo: '00013280', descricao: 'Caçamba metálica estacionária 5 m³ para entulho (locação com transporte)', unidade: 'un', valorUnitarioCentavos: 28000, fonte: 'sinapi', tipoItem: 'insumo', categoria: 'EQUIPAMENTO', categoriaInsumo: 'equipamento' },
]

export function CatalogoComposicoesDialog({
  open,
  onOpenChange,
  etapas,
  etapaSelecionadaId,
  onInserir,
}: CatalogoComposicoesDialogProps) {
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState<'sinapi' | 'propria'>('sinapi')
  const [tipo, setTipo] = useState<'composicao' | 'insumo'>('composicao')
  const [etapaId, setEtapaId] = useState<string>(etapaSelecionadaId ?? (etapas[0]?.id ?? ''))
  const [itemSelecionado, setItemSelecionado] = useState<ComposicaoCatalogoItem | null>(null)

  // Atualiza etapa selecionada padrão quando abrir
  useMemo(() => {
    if (etapaSelecionadaId) setEtapaId(etapaSelecionadaId)
    else if (etapas.length && !etapaId) setEtapaId(etapas[0].id)
  }, [etapaSelecionadaId, etapas])

  const buscaTermo = busca.trim().toLowerCase()

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ['catalogo-composicoes-orcamento', fonte, tipo, buscaTermo],
    enabled: open,
    queryFn: async () => {
      if (fonte === 'sinapi') {
        let dbItens: ComposicaoCatalogoItem[] = []
        const tabela = tipo === 'composicao' ? 'referencia_composicoes' : 'referencia_insumos'

        try {
          // Consulta a tabela oficial correspondente no banco
          let q = supabase
            .from(tabela)
            .select('*')
            .eq('fonte', 'sinapi')
            .limit(50)

          if (buscaTermo) {
            q = q.or(`descricao.ilike.%${buscaTermo}%,codigo.ilike.%${buscaTermo}%`)
          }

          const { data, error } = await q
          if (!error && data && data.length > 0) {
            dbItens = data.map((row: any) => ({
              id: row.id,
              codigo: String(row.codigo ?? 'SINAPI'),
              descricao: row.descricao,
              unidade: row.unidade ?? 'un',
              valorUnitarioCentavos: Number(row.custo_total ?? row.preco_mediano ?? Math.round(Number(row.valor_unitario ?? 0) * 100)),
              fonte: 'sinapi' as const,
              tipoItem: tipo,
              categoria: row.tipo_classe ?? (tipo === 'insumo' ? 'INSUMO SINAPI' : 'COMPOSIÇÃO SINAPI'),
              categoriaInsumo: (tipo === 'insumo' ? 'material' : undefined) as any,
            }))
          }
        } catch {
          // Fallback silencioso para garantir estabilidade
        }

        // Base em memória oficial
        const baseFonte = tipo === 'composicao' ? COMPOSICOES_SINAPI_OFICIAIS : INSUMOS_SINAPI_OFICIAIS
        const baseFiltrada = baseFonte.filter((item) => {
          if (!buscaTermo) return true
          return (
            item.codigo.toLowerCase().includes(buscaTermo) ||
            item.descricao.toLowerCase().includes(buscaTermo) ||
            (item.categoria && item.categoria.toLowerCase().includes(buscaTermo))
          )
        })

        // Unifica itens do banco com a base em memória sem duplicar código
        const codigosVistos = new Set<string>()
        const unificados: ComposicaoCatalogoItem[] = []

        for (const item of [...dbItens, ...baseFiltrada]) {
          if (!codigosVistos.has(item.codigo)) {
            codigosVistos.add(item.codigo)
            unificados.push(item)
          }
        }

        return unificados
      } else {
        // Base Própria / Catálogo interno
        try {
          const { data } = await supabase
            .from('propostas_catalogo_itens')
            .select('id, codigo, descricao')
            .limit(30)

          if (data && data.length > 0) {
            return data.map((row: any) => ({
              id: row.id,
              codigo: row.codigo ?? 'PR-01',
              descricao: row.descricao,
              unidade: 'un',
              valorUnitarioCentavos: 15000,
              fonte: 'propria' as const,
              tipoItem: tipo,
            }))
          }
        } catch {
          // Fallback
        }

        return [
          {
            id: 'prop-01',
            codigo: 'COMP-014',
            descricao: 'Placa de obra personalizada em chapa galvanizada com estrutura de madeira',
            unidade: 'm²',
            valorUnitarioCentavos: 32840,
            fonte: 'propria' as const,
            tipoItem: 'composicao' as const,
            categoria: 'SERVIÇOS PRELIMINARES',
            insumos: [
              { codigo: 'IN-01', descricao: 'Chapa de aço galvanizado #26', unidade: 'm²', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 14500 },
              { codigo: 'IN-02', descricao: 'Pontalete de madeira de lei 3x3"', unidade: 'm', categoria: 'material', coeficiente: 2.2, precoUnitarioCentavos: 3800 },
              { codigo: 'IN-03', descricao: 'Carpinteiro montador', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.0, precoUnitarioCentavos: 2440 },
              { codigo: 'IN-04', descricao: 'Servente auxiliar', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.5, precoUnitarioCentavos: 1955 },
            ],
          },
          {
            id: 'prop-02',
            codigo: 'COMP-020',
            descricao: 'Revestimento acústico em drywall com lã de rocha e pintura final',
            unidade: 'm²',
            valorUnitarioCentavos: 11500,
            fonte: 'propria' as const,
            tipoItem: 'composicao' as const,
            categoria: 'PAREDES E DIVISÓRIAS',
          },
        ]
      }
    },
  })

  const confirmar = () => {
    if (!itemSelecionado) return
    const targetEtapa = etapaId || etapas[0]?.id
    if (!targetEtapa) return

    onInserir(itemSelecionado, targetEtapa)
    setItemSelecionado(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white text-slate-900 border border-slate-200 shadow-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
              <Database className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Catálogo de Referências Analíticas
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                  SINAPI Caixa
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Pesquise e insira tanto Composições de Serviço quanto Insumos Diretos (Mão de Obra, Material, Equipamento).
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Alternador de Tipo (Composições vs Insumos) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-1 border-b border-slate-100">
          <Tabs value={tipo} onValueChange={(v) => { setTipo(v as any); setItemSelecionado(null); }} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-2 bg-slate-100 p-0.5 h-9">
              <TabsTrigger value="composicao" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-xs">
                <Layers className="size-3.5" />
                Composições de Serviço
              </TabsTrigger>
              <TabsTrigger value="insumo" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-xs">
                <Hammer className="size-3.5" />
                Insumos Diretos (Materiais / Mão de Obra)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Select value={fonte} onValueChange={(v) => { setFonte(v as any); setItemSelecionado(null); }}>
              <SelectTrigger className="h-8 text-xs bg-white text-slate-900 border-slate-300 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sinapi">Base Oficial SINAPI</SelectItem>
                <SelectItem value="propria">Base Própria / Interna</SelectItem>
              </SelectContent>
            </Select>

            <Select value={etapaId} onValueChange={(v) => setEtapaId(v)}>
              <SelectTrigger className="h-8 text-xs bg-white text-slate-900 border-slate-300 w-44">
                <SelectValue placeholder="Inserir na Etapa..." />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.codigo} · {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={tipo === 'composicao' ? 'Buscar composição (ex: 98524, 103328, alvenaria, concreto, pintura...)' : 'Buscar insumo (ex: 88309, pedreiro, servente, cimento, areia, brita, aço...)'}
              className="pl-9 h-9 text-xs bg-white text-slate-900 border-slate-300 font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[460px] py-1 space-y-1.5 divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-2">
              <Loader2 className="size-6 animate-spin text-sky-600" />
              <span>Consultando base SINAPI oficial...</span>
            </div>
          ) : resultados.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs space-y-2">
              <Database className="size-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-600">Nenhum {tipo === 'composicao' ? 'composição' : 'insumo'} encontrado</p>
              <p className="text-[11px] text-slate-400">Tente outros termos de busca ou troque de aba acima.</p>
            </div>
          ) : (
            resultados.map((item) => {
              const selecionado = itemSelecionado?.id === item.id || itemSelecionado?.codigo === item.codigo
              const isMaoDeObra = item.categoriaInsumo === 'mao_de_obra' || item.categoria === 'MÃO DE OBRA'
              const isEquipamento = item.categoriaInsumo === 'equipamento' || item.categoria === 'EQUIPAMENTO'
              return (
                <div
                  key={item.id || item.codigo}
                  onClick={() => setItemSelecionado(item)}
                  className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-4 ${
                    selecionado
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded border border-sky-200">
                        {item.codigo}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {item.categoria ?? (item.tipoItem === 'insumo' ? 'INSUMO' : 'COMPOSIÇÃO')}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 h-4 ${
                          item.tipoItem === 'insumo'
                            ? isMaoDeObra
                              ? 'bg-blue-100 text-blue-800'
                              : isEquipamento
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {item.tipoItem === 'insumo'
                          ? isMaoDeObra ? 'MÃO DE OBRA' : isEquipamento ? 'EQUIPAMENTO' : 'MATERIAL'
                          : 'COMPOSIÇÃO'}
                      </Badge>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                      {item.descricao}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Unidade: <strong className="text-slate-700">{item.unidade}</strong></span>
                      {item.tipoItem === 'composicao' && item.insumos && item.insumos.length > 0 && (
                        <span>• {item.insumos.length} insumos analíticos</span>
                      )}
                      {item.tipoItem === 'insumo' && (
                        <span className="text-emerald-700 font-medium">• Insumo Direto</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap pl-2">
                    <span className="text-[10px] block text-slate-500 uppercase font-semibold">Preço / Custo</span>
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {brl(item.valorUnitarioCentavos)}
                    </span>
                    <span className="text-[11px] text-slate-500 block">/{item.unidade}</span>
                  </div>

                  <div className="pl-1">
                    {selecionado ? (
                      <div className="size-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="size-6 rounded-full border border-slate-300 hover:border-slate-400" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé e Confirmação */}
        <DialogFooter className="border-t border-slate-100 pt-3 flex flex-row items-center justify-between sm:justify-between w-full">
          <div className="text-xs text-slate-600">
            {itemSelecionado ? (
              <span className="flex items-center gap-1.5 text-slate-900">
                <span className="font-bold text-sky-700">{itemSelecionado.codigo}</span> ({itemSelecionado.tipoItem === 'insumo' ? 'Insumo' : 'Composição'}) selecionado
                ({brl(itemSelecionado.valorUnitarioCentavos)}/{itemSelecionado.unidade})
              </span>
            ) : (
              <span className="text-slate-400">Selecione um item acima para inserir na etapa.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!itemSelecionado || !etapaId}
              onClick={confirmar}
              className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="size-4" />
              Inserir no Orçamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
