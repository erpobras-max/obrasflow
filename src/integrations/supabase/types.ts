export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categorias_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          codigo_externo: string | null
          complemento: string | null
          cpf_cnpj: string
          created_at: string
          created_by: string | null
          data_fundacao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          id: string
          inscricao_municipal: string | null
          logradouro: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          rg_ie: string | null
          status: Database["public"]["Enums"]["status_cliente"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao_cliente"]
          uf: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          cpf_cnpj: string
          created_at?: string
          created_by?: string | null
          data_fundacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          rg_ie?: string | null
          status?: Database["public"]["Enums"]["status_cliente"]
          telefone?: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_cliente"]
          uf?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          cpf_cnpj?: string
          created_at?: string
          created_by?: string | null
          data_fundacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          rg_ie?: string | null
          status?: Database["public"]["Enums"]["status_cliente"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_cliente"]
          uf?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      clientes_audit_log: {
        Row: {
          acao: string
          cliente_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          cliente_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          cliente_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          created_at: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          categoria_id: string | null
          codigo_externo: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          imob_cliente_id: string | null
          imob_locacao_id: string | null
          numero_documento: string | null
          obra_id: string | null
          observacoes: string | null
          origem: string | null
          pedido_compra_id: string | null
          status: Database["public"]["Enums"]["status_conta_pagar"]
          updated_at: string
          valor_pago: number | null
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          codigo_externo?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          imob_cliente_id?: string | null
          imob_locacao_id?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["status_conta_pagar"]
          updated_at?: string
          valor_pago?: number | null
          valor_total: number
        }
        Update: {
          categoria_id?: string | null
          codigo_externo?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          imob_cliente_id?: string | null
          imob_locacao_id?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          pedido_compra_id?: string | null
          status?: Database["public"]["Enums"]["status_conta_pagar"]
          updated_at?: string
          valor_pago?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_imob_cliente_id_fkey"
            columns: ["imob_cliente_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_imob_locacao_id_fkey"
            columns: ["imob_locacao_id"]
            isOneToOne: false
            referencedRelation: "locacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          categoria_id: string | null
          cliente_id: string | null
          codigo_externo: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          imob_cliente_id: string | null
          imob_locacao_id: string | null
          numero_documento: string | null
          obra_id: string | null
          observacoes: string | null
          origem: string | null
          pedido_venda_id: string | null
          status: Database["public"]["Enums"]["status_conta_receber"]
          updated_at: string
          valor_recebido: number | null
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_externo?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          imob_cliente_id?: string | null
          imob_locacao_id?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          pedido_venda_id?: string | null
          status?: Database["public"]["Enums"]["status_conta_receber"]
          updated_at?: string
          valor_recebido?: number | null
          valor_total: number
        }
        Update: {
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_externo?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          imob_cliente_id?: string | null
          imob_locacao_id?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string | null
          pedido_venda_id?: string | null
          status?: Database["public"]["Enums"]["status_conta_receber"]
          updated_at?: string
          valor_recebido?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_imob_cliente_id_fkey"
            columns: ["imob_cliente_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_imob_locacao_id_fkey"
            columns: ["imob_locacao_id"]
            isOneToOne: false
            referencedRelation: "locacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_pedido_venda_id_fkey"
            columns: ["pedido_venda_id"]
            isOneToOne: false
            referencedRelation: "pedidos_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          numero: string
          objeto: string | null
          observacoes: string | null
          proposta_id: string | null
          status: Database["public"]["Enums"]["status_contrato"]
          titulo: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          numero: string
          objeto?: string | null
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          titulo: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          numero?: string
          objeto?: string | null
          observacoes?: string | null
          proposta_id?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          titulo?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      depositos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          obra_id: string | null
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          obra_id?: string | null
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          obra_id?: string | null
          padrao?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "depositos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      diarios_obra: {
        Row: {
          atividades: string | null
          clima: string | null
          created_at: string
          created_by: string | null
          data: string
          efetivo: Json
          id: string
          obra_id: string
          observacoes: string | null
          ocorrencias: string | null
          temperatura: number | null
          updated_at: string
        }
        Insert: {
          atividades?: string | null
          clima?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          efetivo?: Json
          id?: string
          obra_id: string
          observacoes?: string | null
          ocorrencias?: string | null
          temperatura?: number | null
          updated_at?: string
        }
        Update: {
          atividades?: string | null
          clima?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          efetivo?: Json
          id?: string
          obra_id?: string
          observacoes?: string | null
          ocorrencias?: string | null
          temperatura?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      diarios_obra_fotos: {
        Row: {
          created_at: string
          descricao: string | null
          diario_id: string
          id: string
          url: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          diario_id: string
          id?: string
          url: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          diario_id?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "diarios_obra_fotos_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diarios_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_externo: string | null
          complemento: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imob_vistorias: {
        Row: {
          created_at: string
          created_by: string | null
          data_vistoria: string
          fotos: Json
          id: string
          imovel_id: string
          locacao_id: string | null
          parecer_geral: string | null
          responsavel: string
          status: Database["public"]["Enums"]["status_vistoria"]
          tipo: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_vistoria: string
          fotos?: Json
          id?: string
          imovel_id: string
          locacao_id?: string | null
          parecer_geral?: string | null
          responsavel: string
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_vistoria?: string
          fotos?: Json
          id?: string
          imovel_id?: string
          locacao_id?: string | null
          parecer_geral?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imob_vistorias_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imob_vistorias_locacao_id_fkey"
            columns: ["locacao_id"]
            isOneToOne: false
            referencedRelation: "locacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      imob_vistorias_itens: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item_categoria: string
          item_nome: string
          observacao: string | null
          ordem: number
          status: string
          updated_at: string
          vistoria_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_categoria: string
          item_nome: string
          observacao?: string | null
          ordem?: number
          status?: string
          updated_at?: string
          vistoria_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_categoria?: string
          item_nome?: string
          observacao?: string | null
          ordem?: number
          status?: string
          updated_at?: string
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imob_vistorias_itens_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "imob_vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      imobiliaria_clientes: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          logradouro: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          rg_ie: string | null
          status: Database["public"]["Enums"]["imob_status_cliente"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["imob_tipo_cliente"]
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          rg_ie?: string | null
          status?: Database["public"]["Enums"]["imob_status_cliente"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["imob_tipo_cliente"]
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          rg_ie?: string | null
          status?: Database["public"]["Enums"]["imob_status_cliente"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["imob_tipo_cliente"]
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imoveis: {
        Row: {
          area_privativa: number | null
          area_total: number | null
          bairro: string | null
          banheiros: number
          cep: string | null
          cidade: string | null
          codigo: string
          complemento: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          id: string
          logradouro: string | null
          numero: string | null
          proprietario_id: string
          quartos: number
          status: Database["public"]["Enums"]["imob_status_imovel"]
          suites: number
          tipo: Database["public"]["Enums"]["imob_tipo_imovel"]
          titulo: string
          uf: string | null
          updated_at: string
          vagas: number
          valor_condominio: number | null
          valor_iptu: number | null
          valor_locacao: number | null
          valor_venda: number | null
          foto_url: string | null
        }
        Insert: {
          area_privativa?: number | null
          area_total?: number | null
          bairro?: string | null
          banheiros?: number
          cep?: string | null
          cidade?: string | null
          codigo: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          proprietario_id: string
          quartos?: number
          status?: Database["public"]["Enums"]["imob_status_imovel"]
          suites?: number
          tipo: Database["public"]["Enums"]["imob_tipo_imovel"]
          titulo: string
          uf?: string | null
          updated_at?: string
          vagas?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_locacao?: number | null
          valor_venda?: number | null
          foto_url?: string | null
        }
        Update: {
          area_privativa?: number | null
          area_total?: number | null
          bairro?: string | null
          banheiros?: number
          cep?: string | null
          cidade?: string | null
          codigo?: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          proprietario_id?: string
          quartos?: number
          status?: Database["public"]["Enums"]["imob_status_imovel"]
          suites?: number
          tipo?: Database["public"]["Enums"]["imob_tipo_imovel"]
          titulo?: string
          uf?: string | null
          updated_at?: string
          vagas?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_locacao?: number | null
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imobiliaria_imoveis_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes_erros: {
        Row: {
          campo: string | null
          created_at: string
          dados: Json | null
          id: string
          importacao_id: string
          linha: number
          mensagem: string
        }
        Insert: {
          campo?: string | null
          created_at?: string
          dados?: Json | null
          id?: string
          importacao_id: string
          linha: number
          mensagem: string
        }
        Update: {
          campo?: string | null
          created_at?: string
          dados?: Json | null
          id?: string
          importacao_id?: string
          linha?: number
          mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_erros_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes_log"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes_log: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          created_by: string | null
          detalhes: Json | null
          finished_at: string | null
          id: string
          linhas_erro: number
          linhas_sucesso: number
          origem: string
          status: Database["public"]["Enums"]["status_importacao"]
          tipo: Database["public"]["Enums"]["tipo_importacao"]
          total_linhas: number
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          detalhes?: Json | null
          finished_at?: string | null
          id?: string
          linhas_erro?: number
          linhas_sucesso?: number
          origem?: string
          status?: Database["public"]["Enums"]["status_importacao"]
          tipo: Database["public"]["Enums"]["tipo_importacao"]
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          detalhes?: Json | null
          finished_at?: string | null
          id?: string
          linhas_erro?: number
          linhas_sucesso?: number
          origem?: string
          status?: Database["public"]["Enums"]["status_importacao"]
          tipo?: Database["public"]["Enums"]["tipo_importacao"]
          total_linhas?: number
        }
        Relationships: []
      }
      lancamentos_financeiros: {
        Row: {
          categoria: string
          categoria_id: string | null
          cliente_id: string | null
          codigo_externo: string | null
          competencia: string | null
          conciliado: boolean
          conta_bancaria_id: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          numero_documento: string | null
          obra_id: string | null
          observacoes: string | null
          pedido_compra_id: string | null
          pedido_venda_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_externo?: string | null
          competencia?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          pedido_venda_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_externo?: string | null
          competencia?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          numero_documento?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          pedido_venda_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_pedido_venda_id_fkey"
            columns: ["pedido_venda_id"]
            isOneToOne: false
            referencedRelation: "pedidos_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      locacoes: {
        Row: {
          contrato_numero: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          deleted_at: string | null
          dia_vencimento: number
          garantia_tipo: Database["public"]["Enums"]["imob_garantia"]
          garantia_valor: number | null
          id: string
          imovel_id: string
          locatario_id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["imob_status_locacao"]
          taxa_administracao_percentual: number
          updated_at: string
          valor_aluguel: number
          fiador_id: string | null
          tipo_contrato: string
          indice_reajuste: string
        }
        Insert: {
          contrato_numero: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          deleted_at?: string | null
          dia_vencimento: number
          garantia_tipo: Database["public"]["Enums"]["imob_garantia"]
          garantia_valor?: number | null
          fiador_id?: string | null
          tipo_contrato?: string
          indice_reajuste?: string
          id?: string
          imovel_id: string
          locatario_id: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["imob_status_locacao"]
          taxa_administracao_percentual?: number
          updated_at?: string
          valor_aluguel: number
        }
        Update: {
          contrato_numero?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          dia_vencimento?: number
          garantia_tipo?: Database["public"]["Enums"]["imob_garantia"]
          garantia_valor?: number | null
          fiador_id?: string | null
          tipo_contrato?: string
          indice_reajuste?: string
          id?: string
          imovel_id?: string
          locatario_id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["imob_status_locacao"]
          taxa_administracao_percentual?: number
          updated_at?: string
          valor_aluguel?: number
        }
        Relationships: [
          {
            foreignKeyName: "imobiliaria_locacoes_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imobiliaria_locacoes_locatario_id_fkey"
            columns: ["locatario_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      imob_fiadores: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          documento_vida: string | null
          id: string
          observacoes: string | null
          renda_mensal: number | null
          updated_at: string
          vinculo_tipo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          documento_vida?: string | null
          id?: string
          observacoes?: string | null
          renda_mensal?: number | null
          updated_at?: string
          vinculo_tipo?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          documento_vida?: string | null
          id?: string
          observacoes?: string | null
          renda_mensal?: number | null
          updated_at?: string
          vinculo_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "imob_fiadores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      imob_indices_reajuste: {
        Row: {
          acumulado_12m: number | null
          criado_em: string
          criado_por: string | null
          fonte: string
          id: string
          indice_tipo: string
          periodo_ano: number
          periodo_mes: number
          valor_indice: number
          variacao_percentual: number | null
        }
        Insert: {
          acumulado_12m?: number | null
          criado_em?: string
          criado_por?: string | null
          fonte?: string
          id?: string
          indice_tipo: string
          periodo_ano: number
          periodo_mes?: number
          valor_indice: number
          variacao_percentual?: number | null
        }
        Update: {
          acumulado_12m?: number | null
          criado_em?: string
          criado_por?: string | null
          fonte?: string
          id?: string
          indice_tipo?: string
          periodo_ano?: number
          periodo_mes?: number
          valor_indice?: number
          variacao_percentual?: number | null
        }
        Relationships: []
      }
      medicoes: {
        Row: {
          contrato_id: string | null
          created_at: string
          created_by: string | null
          id: string
          numero: string | null
          obra_id: string
          observacoes: string | null
          percentual_total: number
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero?: string | null
          obra_id: string
          observacoes?: string | null
          percentual_total?: number
          periodo_fim: string
          periodo_inicio: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero?: string | null
          obra_id?: string
          observacoes?: string | null
          percentual_total?: number
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          medicao_id: string
          qtd_contratada: number
          qtd_executada: number
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          medicao_id: string
          qtd_contratada?: number
          qtd_executada?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          medicao_id?: string
          qtd_contratada?: number
          qtd_executada?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_itens_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          created_by: string | null
          custo_unitario: number
          data_movimento: string
          deposito_destino_id: string | null
          deposito_id: string
          documento: string | null
          id: string
          observacoes: string | null
          produto_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custo_unitario?: number
          data_movimento?: string
          deposito_destino_id?: string | null
          deposito_id: string
          documento?: string | null
          id?: string
          observacoes?: string | null
          produto_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custo_unitario?: number
          data_movimento?: string
          deposito_destino_id?: string | null
          deposito_id?: string
          documento?: string | null
          id?: string
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_mov_estoque"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_deposito_destino_id_fkey"
            columns: ["deposito_destino_id"]
            isOneToOne: false
            referencedRelation: "depositos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_deposito_id_fkey"
            columns: ["deposito_id"]
            isOneToOne: false
            referencedRelation: "depositos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          descricao: string | null
          id: string
          logradouro: string | null
          nome: string
          numero: string
          numero_endereco: string | null
          observacoes: string | null
          orcamento: number
          progresso: number
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_obra"]
          uf: string | null
          updated_at: string
          valor_executado: number
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          numero: string
          numero_endereco?: string | null
          observacoes?: string | null
          orcamento?: number
          progresso?: number
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          uf?: string | null
          updated_at?: string
          valor_executado?: number
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string
          numero_endereco?: string | null
          observacoes?: string | null
          orcamento?: number
          progresso?: number
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          uf?: string | null
          updated_at?: string
          valor_executado?: number
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      obras_equipe: {
        Row: {
          created_at: string
          funcao: string
          id: string
          obra_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          funcao: string
          id?: string
          obra_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          funcao?: string
          id?: string
          obra_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_equipe_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          id: string
          probabilidade: number
          status: Database["public"]["Enums"]["status_oportunidade"]
          titulo: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          probabilidade?: number
          status?: Database["public"]["Enums"]["status_oportunidade"]
          titulo: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          probabilidade?: number
          status?: Database["public"]["Enums"]["status_oportunidade"]
          titulo?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          codigo_externo: string | null
          created_at: string
          created_by: string | null
          data_pedido: string
          data_prevista: string | null
          desconto: number
          forma_pagamento: string | null
          fornecedor_id: string
          frete: number
          id: string
          numero: string
          observacoes: string | null
          situacao: Database["public"]["Enums"]["situacao_pedido_compra"]
          updated_at: string
          valor_produtos: number
          valor_total: number
        }
        Insert: {
          codigo_externo?: string | null
          created_at?: string
          created_by?: string | null
          data_pedido?: string
          data_prevista?: string | null
          desconto?: number
          forma_pagamento?: string | null
          fornecedor_id: string
          frete?: number
          id?: string
          numero: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pedido_compra"]
          updated_at?: string
          valor_produtos?: number
          valor_total?: number
        }
        Update: {
          codigo_externo?: string | null
          created_at?: string
          created_by?: string | null
          data_pedido?: string
          data_prevista?: string | null
          desconto?: number
          forma_pagamento?: string | null
          fornecedor_id?: string
          frete?: number
          id?: string
          numero?: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pedido_compra"]
          updated_at?: string
          valor_produtos?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          desconto: number
          descricao: string
          id: string
          ordem: number
          pedido_id: string
          produto_id: string | null
          quantidade: number
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          desconto?: number
          descricao: string
          id?: string
          ordem?: number
          pedido_id: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          desconto?: number
          descricao?: string
          id?: string
          ordem?: number
          pedido_id?: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_venda: {
        Row: {
          cliente_id: string
          codigo_externo: string | null
          created_at: string
          created_by: string | null
          data_pedido: string
          data_prevista: string | null
          desconto: number
          forma_pagamento: string | null
          frete: number
          id: string
          numero: string
          observacoes: string | null
          situacao: Database["public"]["Enums"]["situacao_pedido_venda"]
          updated_at: string
          valor_produtos: number
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          codigo_externo?: string | null
          created_at?: string
          created_by?: string | null
          data_pedido?: string
          data_prevista?: string | null
          desconto?: number
          forma_pagamento?: string | null
          frete?: number
          id?: string
          numero: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pedido_venda"]
          updated_at?: string
          valor_produtos?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          codigo_externo?: string | null
          created_at?: string
          created_by?: string | null
          data_pedido?: string
          data_prevista?: string | null
          desconto?: number
          forma_pagamento?: string | null
          frete?: number
          id?: string
          numero?: string
          observacoes?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pedido_venda"]
          updated_at?: string
          valor_produtos?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_venda_itens: {
        Row: {
          desconto: number
          descricao: string
          id: string
          ordem: number
          pedido_id: string
          produto_id: string | null
          quantidade: number
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          desconto?: number
          descricao: string
          id?: string
          ordem?: number
          pedido_id: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          desconto?: number
          descricao?: string
          id?: string
          ordem?: number
          pedido_id?: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_usuarios: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          perfil?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      produto_estoque: {
        Row: {
          custo_medio: number
          deposito_id: string
          id: string
          produto_id: string
          saldo: number
          updated_at: string
        }
        Insert: {
          custo_medio?: number
          deposito_id: string
          id?: string
          produto_id: string
          saldo?: number
          updated_at?: string
        }
        Update: {
          custo_medio?: number
          deposito_id?: string
          id?: string
          produto_id?: string
          saldo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_estoque_deposito_id_fkey"
            columns: ["deposito_id"]
            isOneToOne: false
            referencedRelation: "depositos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          estoque_maximo: number
          estoque_minimo: number
          gtin: string | null
          id: string
          imagem_url: string | null
          ncm: string | null
          nome: string
          observacoes: string | null
          peso_kg: number | null
          preco_custo: number
          preco_venda: number
          situacao: Database["public"]["Enums"]["situacao_produto"]
          sku: string
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estoque_maximo?: number
          estoque_minimo?: number
          gtin?: string | null
          id?: string
          imagem_url?: string | null
          ncm?: string | null
          nome: string
          observacoes?: string | null
          peso_kg?: number | null
          preco_custo?: number
          preco_venda?: number
          situacao?: Database["public"]["Enums"]["situacao_produto"]
          sku: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estoque_maximo?: number
          estoque_minimo?: number
          gtin?: string | null
          id?: string
          imagem_url?: string | null
          ncm?: string | null
          nome?: string
          observacoes?: string | null
          peso_kg?: number | null
          preco_custo?: number
          preco_venda?: number
          situacao?: Database["public"]["Enums"]["situacao_produto"]
          sku?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      propostas: {
        Row: {
          cliente_id: string
          condicoes_pagamento: string | null
          created_at: string
          created_by: string | null
          data_envio: string | null
          descricao: string | null
          id: string
          numero: string
          observacoes: string | null
          oportunidade_id: string | null
          status: Database["public"]["Enums"]["status_proposta"]
          titulo: string
          updated_at: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          cliente_id: string
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          descricao?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          oportunidade_id?: string | null
          status?: Database["public"]["Enums"]["status_proposta"]
          titulo: string
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          descricao?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          oportunidade_id?: string | null
          status?: Database["public"]["Enums"]["status_proposta"]
          titulo?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem: number
          proposta_id: string
          quantidade: number
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          proposta_id: string
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          proposta_id?: string
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_itens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validar_cpf_cnpj: { Args: { doc: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "diretor"
        | "financeiro"
        | "compras"
        | "engenharia"
        | "almoxarifado"
        | "rh"
        | "cliente"
      imob_garantia: "caucao" | "fiador" | "seguro_fianca" | "sem_garantia"
      imob_status_cliente: "ativo" | "inativo"
      imob_status_imovel: "disponivel" | "alugado" | "vendido" | "inativo"
      imob_status_locacao: "ativo" | "finalizado" | "rescindido"
      imob_tipo_cliente: "pf" | "pj"
      imob_tipo_imovel: "apartamento" | "casa" | "comercial" | "terreno"
      situacao_pedido_compra:
        | "em_aberto"
        | "aprovado"
        | "recebido"
        | "cancelado"
      situacao_pedido_venda: "em_aberto" | "aprovado" | "atendido" | "cancelado"
      situacao_produto: "ativo" | "inativo"
      status_cliente: "ativo" | "inativo" | "prospect"
      status_conta_pagar: "aberta" | "paga" | "atrasada" | "cancelada"
      status_conta_receber: "aberta" | "recebida" | "atrasada" | "cancelada"
      status_contrato: "ativo" | "concluido" | "cancelado" | "suspenso"
      status_importacao: "processando" | "concluida" | "erro" | "parcial"
      status_obra:
        | "planejamento"
        | "em_andamento"
        | "pausada"
        | "concluida"
        | "cancelada"
      status_oportunidade:
        | "novo"
        | "qualificacao"
        | "proposta"
        | "negociacao"
        | "ganho"
        | "perdido"
      status_proposta:
        | "rascunho"
        | "enviada"
        | "aceita"
        | "rejeitada"
        | "expirada"
      status_vistoria: "agendada" | "realizada" | "cancelada"
      tipo_cliente: "pf" | "pj"
      tipo_importacao:
        | "clientes"
        | "produtos"
        | "pedidos_venda"
        | "contas_pagar"
        | "contas_receber"
      tipo_mov_estoque: "entrada" | "saida" | "ajuste" | "transferencia"
      tipo_relacao_cliente: "cliente" | "fornecedor" | "ambos"
      tipo_vistoria: "entrada" | "saida" | "periodica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "diretor",
        "financeiro",
        "compras",
        "engenharia",
        "almoxarifado",
        "rh",
        "cliente",
      ],
      imob_garantia: ["caucao", "fiador", "seguro_fianca", "sem_garantia"],
      imob_status_cliente: ["ativo", "inativo"],
      imob_status_imovel: ["disponivel", "alugado", "vendido", "inativo"],
      imob_status_locacao: ["ativo", "finalizado", "rescindido"],
      imob_tipo_cliente: ["pf", "pj"],
      imob_tipo_imovel: ["apartamento", "casa", "comercial", "terreno"],
      imob_fiador_vinculo: ["parente", "amigo", "companheiro", "outro"],
      imob_indice_tipo: ["ipca", "igp_m", "inpc"],
      situacao_pedido_compra: [
        "em_aberto",
        "aprovado",
        "recebido",
        "cancelado",
      ],
      situacao_pedido_venda: ["em_aberto", "aprovado", "atendido", "cancelado"],
      situacao_produto: ["ativo", "inativo"],
      status_cliente: ["ativo", "inativo", "prospect"],
      status_conta_pagar: ["aberta", "paga", "atrasada", "cancelada"],
      status_conta_receber: ["aberta", "recebida", "atrasada", "cancelada"],
      status_contrato: ["ativo", "concluido", "cancelado", "suspenso"],
      status_importacao: ["processando", "concluida", "erro", "parcial"],
      status_obra: [
        "planejamento",
        "em_andamento",
        "pausada",
        "concluida",
        "cancelada",
      ],
      status_oportunidade: [
        "novo",
        "qualificacao",
        "proposta",
        "negociacao",
        "ganho",
        "perdido",
      ],
      status_proposta: [
        "rascunho",
        "enviada",
        "aceita",
        "rejeitada",
        "expirada",
      ],
      status_vistoria: ["agendada", "realizada", "cancelada"],
      tipo_cliente: ["pf", "pj"],
      tipo_importacao: [
        "clientes",
        "produtos",
        "pedidos_venda",
        "contas_pagar",
        "contas_receber",
      ],
      tipo_mov_estoque: ["entrada", "saida", "ajuste", "transferencia"],
      tipo_relacao_cliente: ["cliente", "fornecedor", "ambos"],
      tipo_vistoria: ["entrada", "saida", "periodica"],
    },
  },
} as const
