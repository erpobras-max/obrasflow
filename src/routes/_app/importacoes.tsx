import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Download, RefreshCw, AlertCircle, CheckCircle2,
  ListRestart, Loader2, Play, Eye, FileText, ArrowRight, Table as TableIcon
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  importarClientes,
  importarProdutos,
  importarPedidosVenda,
  importarContasPagarReceber
} from "@/lib/importacoes.functions";

export const Route = createFileRoute("/_app/importacoes")({
  head: () => ({ meta: [{ title: "Importações — ERP Obras" }] }),
  component: ImportacoesPage,
});

type ImportType = "clientes" | "produtos" | "pedidos_venda" | "contas_pagar" | "contas_receber";

interface ColumnMapping {
  systemField: string;
  label: string;
  required: boolean;
  mappedHeader: string; // The header in the uploaded file it maps to
}

// System schemas to perform client-side Zod validation
const clientValidationSchema = z.object({
  tipo: z.enum(["pf", "pj"], { errorMap: () => ({ message: "Deve ser 'pf' ou 'pj'" }) }),
  nome: z.string().min(1, "Nome é obrigatório"),
  nome_fantasia: z.string().nullable().optional(),
  cpf_cnpj: z.string().min(1, "CPF/CNPJ é obrigatório"),
  rg_ie: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  telefone: z.string().nullable().optional(),
  celular: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  logradouro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const productValidationSchema = z.object({
  sku: z.string().min(1, "SKU é obrigatório"),
  nome: z.string().min(1, "Nome é obrigatório"),
  categoria: z.string().nullable().optional(),
  unidade: z.string().default("UN"),
  preco_custo: z.coerce.number().min(0, "Custo inválido"),
  preco_venda: z.coerce.number().min(0, "Venda inválida"),
  ncm: z.string().nullable().optional(),
  gtin: z.string().nullable().optional(),
  situacao: z.enum(["ativo", "inativo"]).default("ativo"),
  estoque_min: z.coerce.number().default(0),
  estoque_max: z.coerce.number().default(0),
  estoque_inicial: z.coerce.number().default(0),
});

const saleOrderValidationSchema = z.object({
  numero: z.coerce.number().int("Número deve ser inteiro"),
  cliente_cpf_cnpj: z.string().min(1, "CPF/CNPJ do cliente é obrigatório"),
  vendedor_email: z.string().email("E-mail do vendedor inválido").nullable().optional().or(z.literal("")),
  situacao: z.enum(["em_aberto", "atendido", "cancelado"]).default("em_aberto"),
  forma_pagamento: z.string().nullable().optional(),
  valor_frete: z.coerce.number().default(0),
  valor_desconto: z.coerce.number().default(0),
  observacoes: z.string().nullable().optional(),
  itens: z.array(z.object({
    sku: z.string().min(1, "SKU é obrigatório"),
    quantidade: z.coerce.number().min(0.001, "Qtd inválida"),
    valor_unitario: z.coerce.number().min(0, "Preço inválido"),
  })).min(1, "Pedido deve ter itens"),
});

const financialValidationSchema = z.object({
  vencimento: z.string().min(1, "Vencimento é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  categoria: z.string().nullable().optional(),
  documento_doc: z.string().min(1, "Cliente/Fornecedor (doc/nome) é obrigatório"),
  valor: z.coerce.number().min(0.01, "Valor deve ser maior que 0"),
  situacao: z.string().default("aberta"),
  numero_documento: z.string().nullable().optional(),
});

function ImportacoesPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();

  const [importType, setImportType] = useState<ImportType>("clientes");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [fileName, setFileName] = useState("");

  // Validation States
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<{ linha: number; erros: string[] }[]>([]);

  // Progression States
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);

  // Modal logs
  const [selectedLogErrors, setSelectedLogErrors] = useState<any[] | null>(null);

  // Server functions
  const sfnClientes = useServerFn(importarClientes);
  const sfnProdutos = useServerFn(importarProdutos);
  const sfnVendas = useServerFn(importarPedidosVenda);
  const sfnFinanceiro = useServerFn(importarContasPagarReceber);

  // Mappings template config for fields
  const getFieldsForType = (type: ImportType): ColumnMapping[] => {
    switch (type) {
      case "clientes":
        return [
          { systemField: "tipo", label: "Tipo (pf/pj)", required: true, mappedHeader: "" },
          { systemField: "nome", label: "Razão Social / Nome", required: true, mappedHeader: "" },
          { systemField: "nome_fantasia", label: "Nome Fantasia", required: false, mappedHeader: "" },
          { systemField: "cpf_cnpj", label: "CPF/CNPJ", required: true, mappedHeader: "" },
          { systemField: "rg_ie", label: "RG/Inscrição Estadual", required: false, mappedHeader: "" },
          { systemField: "email", label: "E-mail", required: false, mappedHeader: "" },
          { systemField: "telefone", label: "Telefone", required: false, mappedHeader: "" },
          { systemField: "celular", label: "Celular", required: false, mappedHeader: "" },
          { systemField: "cep", label: "CEP", required: false, mappedHeader: "" },
          { systemField: "logradouro", label: "Endereço", required: false, mappedHeader: "" },
          { systemField: "numero", label: "Número", required: false, mappedHeader: "" },
          { systemField: "complemento", label: "Complemento", required: false, mappedHeader: "" },
          { systemField: "bairro", label: "Bairro", required: false, mappedHeader: "" },
          { systemField: "cidade", label: "Cidade", required: false, mappedHeader: "" },
          { systemField: "uf", label: "UF", required: false, mappedHeader: "" },
          { systemField: "observacoes", label: "Observações", required: false, mappedHeader: "" },
        ];
      case "produtos":
        return [
          { systemField: "sku", label: "Código (SKU)", required: true, mappedHeader: "" },
          { systemField: "nome", label: "Descrição do Produto", required: true, mappedHeader: "" },
          { systemField: "categoria", label: "Categoria", required: false, mappedHeader: "" },
          { systemField: "unidade", label: "Unidade de Medida", required: false, mappedHeader: "" },
          { systemField: "preco_custo", label: "Preço de Custo", required: false, mappedHeader: "" },
          { systemField: "preco_venda", label: "Preço de Venda", required: true, mappedHeader: "" },
          { systemField: "ncm", label: "NCM", required: false, mappedHeader: "" },
          { systemField: "gtin", label: "GTIN/EAN", required: false, mappedHeader: "" },
          { systemField: "situacao", label: "Situação (ativo/inativo)", required: false, mappedHeader: "" },
          { systemField: "estoque_min", label: "Estoque Mínimo", required: false, mappedHeader: "" },
          { systemField: "estoque_max", label: "Estoque Máximo", required: false, mappedHeader: "" },
          { systemField: "estoque_inicial", label: "Saldo de Estoque Inicial", required: false, mappedHeader: "" },
        ];
      case "pedidos_venda":
        return [
          { systemField: "numero", label: "Número do Pedido", required: true, mappedHeader: "" },
          { systemField: "cliente_cpf_cnpj", label: "CPF/CNPJ do Cliente", required: true, mappedHeader: "" },
          { systemField: "vendedor_email", label: "E-mail do Vendedor", required: false, mappedHeader: "" },
          { systemField: "situacao", label: "Situação", required: false, mappedHeader: "" },
          { systemField: "forma_pagamento", label: "Forma de Pagamento", required: false, mappedHeader: "" },
          { systemField: "valor_frete", label: "Valor do Frete", required: false, mappedHeader: "" },
          { systemField: "valor_desconto", label: "Valor do Desconto", required: false, mappedHeader: "" },
          { systemField: "observacoes", label: "Observações", required: false, mappedHeader: "" },
          // Items details (Bling lists these details inline per order number)
          { systemField: "item_sku", label: "SKU do Item", required: true, mappedHeader: "" },
          { systemField: "item_quantidade", label: "Quantidade do Item", required: true, mappedHeader: "" },
          { systemField: "item_valor_unitario", label: "Valor Unitário do Item", required: true, mappedHeader: "" },
        ];
      case "contas_pagar":
      case "contas_receber":
        return [
          { systemField: "vencimento", label: "Data de Vencimento", required: true, mappedHeader: "" },
          { systemField: "descricao", label: "Descrição / Histórico", required: true, mappedHeader: "" },
          { systemField: "categoria", label: "Categoria Financeira", required: false, mappedHeader: "" },
          { systemField: "documento_doc", label: "Cliente/Fornecedor (Doc ou Nome)", required: true, mappedHeader: "" },
          { systemField: "valor", label: "Valor", required: true, mappedHeader: "" },
          { systemField: "situacao", label: "Situação (paga/aberta)", required: false, mappedHeader: "" },
          { systemField: "numero_documento", label: "Número do Documento", required: false, mappedHeader: "" },
        ];
    }
  };

  // Bling default export headers auto mapping
  const autoMapHeaders = (type: ImportType, fileHeaders: string[]): ColumnMapping[] => {
    const list = getFieldsForType(type);
    const lowerHeaders = fileHeaders.map(h => h.trim().toLowerCase());

    const blingAliases: Record<string, string[]> = {
      tipo: ["tipo", "tipo pessoa", "pf/pj"],
      nome: ["nome", "razao social", "razão social", "cliente", "fornecedor", "descrição", "descricao"],
      nome_fantasia: ["fantasia", "nome fantasia"],
      cpf_cnpj: ["cpf/cnpj", "cpf_cnpj", "cnpj", "cpf", "documento"],
      rg_ie: ["rg/ie", "ie", "rg", "inscrição estadual", "inscricao estadual"],
      email: ["email", "e-mail"],
      telefone: ["telefone", "fone"],
      celular: ["celular", "cel"],
      cep: ["cep"],
      logradouro: ["endereco", "endereço", "rua", "logradouro"],
      numero: ["numero", "número", "nº"],
      complemento: ["complemento", "comp"],
      bairro: ["bairro"],
      cidade: ["cidade"],
      uf: ["uf", "estado"],
      observacoes: ["observacoes", "observações", "obs"],
      
      sku: ["codigo", "código", "sku", "código (sku)", "codigo (sku)"],
      categoria: ["categoria", "grupo"],
      unidade: ["unidade", "un"],
      preco_custo: ["custo", "preco custo", "preço custo", "preco de custo"],
      preco_venda: ["venda", "preco", "preço", "preco venda", "preço venda", "preco de venda"],
      ncm: ["ncm"],
      gtin: ["gtin", "ean", "gtin/ean"],
      situacao: ["situacao", "situação", "status"],
      estoque_min: ["estoque minimo", "estoque mínimo", "minimo", "mínimo"],
      estoque_max: ["estoque maximo", "estoque máximo", "maximo", "máximo"],
      estoque_inicial: ["estoque", "saldo", "quantidade", "saldo inicial", "estoque inicial"],

      numero_pedido: ["numero", "número", "numero pedido", "número pedido", "pedido"],
      cliente_cpf_cnpj: ["cliente", "cpf/cnpj cliente", "documento cliente", "cnpj cliente"],
      vendedor_email: ["vendedor", "email vendedor", "vendedor email"],
      forma_pagamento: ["forma pagamento", "forma de pagamento", "pagamento"],
      valor_frete: ["frete", "valor frete", "valor do frete"],
      valor_desconto: ["desconto", "valor desconto", "valor do desconto"],
      item_sku: ["item", "sku item", "codigo item", "código item", "sku do item"],
      item_quantidade: ["quantidade", "quantidade item", "qtd"],
      item_valor_unitario: ["preco unitario", "preço unitário", "valor unitario", "valor unitário"],

      vencimento: ["vencimento", "data vencimento", "data de vencimento", "venc"],
      documento_doc: ["cliente/fornecedor", "fornecedor", "cliente", "documento", "cpf/cnpj"],
      valor: ["valor", "total", "valor total", "valor do lancamento"],
      numero_documento: ["documento", "numero documento", "nº documento"],
    };

    return list.map(item => {
      // Find matching alias
      const aliases = blingAliases[item.systemField] || [item.systemField.toLowerCase()];
      let foundHeader = "";
      for (const alias of aliases) {
        const index = lowerHeaders.indexOf(alias);
        if (index !== -1) {
          foundHeader = fileHeaders[index];
          break;
        }
      }
      return { ...item, mappedHeader: foundHeader };
    });
  };

  // Queries: Import logs history
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["importacoes-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacoes_log")
        .select("*, perfis_usuarios(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const templates = {
    clientes: "Tipo (pf/pj),Nome,Nome Fantasia,CPF/CNPJ,RG/IE,Email,Telefone,Celular,CEP,Logradouro,Numero,Complemento,Bairro,Cidade,UF,Observacoes",
    produtos: "SKU,Nome,Categoria,Unidade,Preco Custo,Preco Venda,NCM,GTIN,Situacao (ativo/inativo),Estoque Minimo,Estoque Maximo,Estoque Inicial",
    pedidos_venda: "Numero,Cliente CPF/CNPJ,Situacao (em_aberto/atendido/cancelado),Forma Pagamento,Valor Frete,Valor Desconto,Observacoes,Item SKU,Item Quantidade,Item Preco Unitario",
    contas_pagar: "Vencimento,Descricao,Categoria DRE,Fornecedor CPF/CNPJ,Valor,Situacao (aberta/paga),Numero Documento",
    contas_receber: "Vencimento,Descricao,Categoria DRE,Cliente CPF/CNPJ,Valor,Situacao (aberta/recebida),Numero Documento",
  };

  const handleDownloadTemplate = (type: ImportType) => {
    const csvContent = templates[type];
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `template_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Template para ${type} baixado.`);
  };

  // Parse Excel or CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const fileContent = evt.target?.result;
        let parsedRows: any[] = [];
        let parsedHeaders: string[] = [];

        if (isExcel) {
          const workbook = XLSX.read(fileContent, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          if (json.length > 0) {
            parsedHeaders = Object.keys(json[0] as any);
            parsedRows = json;
          }
        } else {
          // CSV
          const text = new TextDecoder("utf-8").decode(fileContent as ArrayBuffer);
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.meta.fields) {
            parsedHeaders = parsed.meta.fields;
          }
          parsedRows = parsed.data;
        }

        if (parsedRows.length === 0) {
          toast.error("Arquivo vazio ou sem dados válidos.");
          return;
        }

        setFileData(parsedRows);
        setHeaders(parsedHeaders);
        setMappings(autoMapHeaders(importType, parsedHeaders));
        setStep(2);
        toast.success(`Arquivo lido. ${parsedRows.length} linhas encontradas.`);
      } catch (err) {
        toast.error(`Erro ao processar arquivo: ${(err as Error).message}`);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  const handleMappingChange = (systemField: string, mappedHeader: string) => {
    setMappings(prev => prev.map(m => m.systemField === systemField ? { ...m, mappedHeader } : m));
  };

  // Client-side mapping & Zod validation
  const handleValidateData = () => {
    // Map raw rows to system schemas
    const missingRequired = mappings.filter(m => m.required && !m.mappedHeader);
    if (missingRequired.length > 0) {
      toast.error(`Mapeie todas as colunas obrigatórias: ${missingRequired.map(m => m.label).join(", ")}`);
      return;
    }

    const valids: any[] = [];
    const invalids: { linha: number; erros: string[] }[] = [];

    // For Pedidos de Venda, we group by Numero to validate order along with items
    if (importType === "pedidos_venda") {
      const ordersMap: Record<number, any> = {};
      const numberField = mappings.find(m => m.systemField === "numero")?.mappedHeader || "";
      const clientField = mappings.find(m => m.systemField === "cliente_cpf_cnpj")?.mappedHeader || "";
      const sellerField = mappings.find(m => m.systemField === "vendedor_email")?.mappedHeader || "";
      const statusField = mappings.find(m => m.systemField === "situacao")?.mappedHeader || "";
      const paymentField = mappings.find(m => m.systemField === "forma_pagamento")?.mappedHeader || "";
      const freightField = mappings.find(m => m.systemField === "valor_frete")?.mappedHeader || "";
      const discountField = mappings.find(m => m.systemField === "valor_desconto")?.mappedHeader || "";
      const obsField = mappings.find(m => m.systemField === "observacoes")?.mappedHeader || "";

      const itemSkuField = mappings.find(m => m.systemField === "item_sku")?.mappedHeader || "";
      const itemQtyField = mappings.find(m => m.systemField === "item_quantidade")?.mappedHeader || "";
      const itemValField = mappings.find(m => m.systemField === "item_valor_unitario")?.mappedHeader || "";

      fileData.forEach((row, idx) => {
        const linhaNum = idx + 1;
        const num = Number(row[numberField]);
        if (isNaN(num) || num <= 0) {
          invalids.push({ linha: linhaNum, erros: ["Número do pedido inválido."] });
          return;
        }

        if (!ordersMap[num]) {
          ordersMap[num] = {
            numero: num,
            cliente_cpf_cnpj: String(row[clientField] || "").trim(),
            vendedor_email: row[sellerField] ? String(row[sellerField]).trim() : null,
            situacao: row[statusField] === "atendido" || row[statusField] === "cancelado" ? row[statusField] : "em_aberto",
            forma_pagamento: row[paymentField] ? String(row[paymentField]).trim() : null,
            valor_frete: Number(row[freightField]) || 0,
            valor_desconto: Number(row[discountField]) || 0,
            observacoes: row[obsField] ? String(row[obsField]).trim() : null,
            itens: [],
            linhasOrigem: []
          };
        }

        ordersMap[num].itens.push({
          sku: String(row[itemSkuField] || "").trim(),
          quantidade: Number(row[itemQtyField]) || 0,
          valor_unitario: Number(row[itemValField]) || 0,
        });
        ordersMap[num].linhasOrigem.push(linhaNum);
      });

      // Now run schema validation on each grouped order
      Object.values(ordersMap).forEach((order: any) => {
        const res = saleOrderValidationSchema.safeParse(order);
        if (res.success) {
          valids.push(res.data);
        } else {
          invalids.push({
            linha: order.linhasOrigem[0],
            erros: res.error.errors.map(e => `[Pedido #${order.numero}] ${e.path.join(".")}: ${e.message}`)
          });
        }
      });

    } else {
      // General schemas: clientes, produtos, contas
      const schema =
        importType === "clientes" ? clientValidationSchema :
        importType === "produtos" ? productValidationSchema :
        financialValidationSchema;

      fileData.forEach((row, idx) => {
        const linhaNum = idx + 1;
        const mappedRow: any = {};
        
        mappings.forEach(m => {
          if (m.mappedHeader) {
            mappedRow[m.systemField] = row[m.mappedHeader];
          }
        });

        // Special fallback defaults
        if (importType === "produtos") {
          if (!mappedRow.unidade) mappedRow.unidade = "UN";
          if (!mappedRow.situacao) mappedRow.situacao = "ativo";
        }

        const res = schema.safeParse(mappedRow);
        if (res.success) {
          valids.push(res.data);
        } else {
          invalids.push({
            linha: linhaNum,
            erros: res.error.errors.map(e => `${e.path.join(".")}: ${e.message}`)
          });
        }
      });
    }

    setValidatedRows(valids);
    setInvalidRows(invalids);
    setStep(3);
    toast.info(`Validação concluída: ${valids.length} válidas, ${invalids.length} com erro.`);
  };

  // Batching & uploading
  const handleStartImport = async () => {
    if (validatedRows.length === 0) {
      toast.error("Sem dados válidos para importar.");
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      // 1. Create central import log row
      const { data: newLog, error: logErr } = await supabase
        .from("importacoes_log")
        .insert({
          arquivo: fileName,
          tipo: importType,
          total_linhas: validatedRows.length + invalidRows.length,
          sucesso: 0,
          erros: 0,
        })
        .select()
        .single();

      if (logErr) throw logErr;
      const createdLogId = newLog.id;
      setLogId(createdLogId);

      // Save initial validation errors in the DB
      if (invalidRows.length > 0) {
        const errPayloads = invalidRows.flatMap(inv => 
          inv.erros.map(e => ({
            importacao_id: createdLogId,
            linha: inv.linha,
            campo: "Validação Zod",
            mensagem: e
          }))
        );
        // Upload errors in batches of 500
        for (let offset = 0; offset < errPayloads.length; offset += 500) {
          const chunk = errPayloads.slice(offset, offset + 500);
          await supabase.from("importacoes_erros").insert(chunk);
        }
        // Update log with initial errors count
        await supabase.from("importacoes_log").update({ erros: invalidRows.length }).eq("id", createdLogId);
      }

      // 2. Call corresponding server function in batches of 500
      const batchSize = 500;
      let processed = 0;
      const total = validatedRows.length;

      for (let offset = 0; offset < total; offset += batchSize) {
        const batch = validatedRows.slice(offset, offset + batchSize);

        if (importType === "clientes") {
          await sfnClientes({ data: { logId: createdLogId, rows: batch } });
        } else if (importType === "produtos") {
          await sfnProdutos({ data: { logId: createdLogId, rows: batch } });
        } else if (importType === "pedidos_venda") {
          await sfnVendas({ data: { logId: createdLogId, rows: batch } });
        } else {
          await sfnFinanceiro({ data: { 
            logId: createdLogId, 
            tipoFinanceiro: importType === "contas_pagar" ? "pagar" : "receber", 
            rows: batch 
          } });
        }

        processed += batch.length;
        setProgress(Math.round((processed / total) * 100));
      }

      toast.success("Importação em lotes concluída com sucesso!");
      setStep(4);
      qc.invalidateQueries({ queryKey: ["importacoes-logs"] });
    } catch (e: any) {
      toast.error(`Falha durante importação: ${e.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorCsv = () => {
    if (invalidRows.length === 0) return;
    const csvRows = invalidRows.map(inv => ({
      Linha: inv.linha,
      Erros: inv.erros.join(" | ")
    }));
    const ws = XLSX.utils.json_to_sheet(csvRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, `erros_importacao_${importType}.xlsx`);
  };

  const handleReset = () => {
    setFileData([]);
    setHeaders([]);
    setMappings([]);
    setValidatedRows([]);
    setInvalidRows([]);
    setStep(1);
    setFileName("");
    setProgress(0);
    setLogId(null);
  };

  // View detail errors from history
  const handleViewLogErrors = async (id: string) => {
    const { data, error } = await supabase
      .from("importacoes_erros")
      .select("*")
      .eq("importacao_id", id)
      .order("linha");
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedLogErrors(data || []);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Importações</h1>
        <p className="text-sm text-muted-foreground">Importe dados em lote exportados do Bling (CSV/Excel) com mapeamento inteligente e validação.</p>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Nova Importação</CardTitle>
              <CardDescription>Selecione o tipo de registro e faça o upload da sua planilha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">O que você deseja importar?</label>
                <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clientes">Clientes (PF / PJ)</SelectItem>
                    <SelectItem value="produtos">Produtos & Estoque</SelectItem>
                    <SelectItem value="pedidos_venda">Pedidos de Venda & Itens</SelectItem>
                    <SelectItem value="contas_pagar">Contas a Pagar (Compras)</SelectItem>
                    <SelectItem value="contas_receber">Contas a Receber (Vendas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 flex flex-col items-center justify-center gap-4 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer relative">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Clique para fazer upload ou arraste o arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Suporta arquivos CSV (.csv) ou Excel (.xlsx, .xls)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="gap-2" onClick={() => handleDownloadTemplate(importType)}>
                  <Download className="size-4" /> Baixar Modelo CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-md">Deduplicação & Regras</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Clientes</h4>
                <p>Chave: <strong>CPF/CNPJ</strong> normalizado. Se o CPF/CNPJ já existir no sistema, os dados serão atualizados; caso contrário, será cadastrado um novo.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Produtos</h4>
                <p>Chave: <strong>SKU</strong> (Código). Se o SKU já existir, os preços e características são atualizados. Se houver coluna de estoque, o saldo será inicializado.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Pedidos de Venda</h4>
                <p>Chave: <strong>Número do Pedido</strong>. Se o número já existir, o pedido é ignorado para evitar reimportações redundantes.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Financeiro (Contas)</h4>
                <p>Os registros de contas a pagar e receber são inseridos diretamente no sistema vinculando ao cliente/fornecedor por busca de CPF/CNPJ ou nome.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>Combine os campos do sistema com os cabeçalhos encontrados na sua planilha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mappings.map((m) => (
                <div key={m.systemField} className="flex flex-col space-y-2 border p-3 rounded-md bg-muted/5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      {m.label}
                      {m.required && <span className="text-red-500">*</span>}
                    </span>
                    <Badge variant={m.mappedHeader ? "secondary" : "destructive"} className="text-[10px]">
                      {m.mappedHeader ? "Mapeado" : "Não mapeado"}
                    </Badge>
                  </div>
                  <Select
                    value={m.mappedHeader || "none"}
                    onValueChange={(v) => handleMappingChange(m.systemField, v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Ignorar campo --</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 flex justify-between">
              <Button variant="outline" onClick={handleReset}>Voltar</Button>
              <Button className="gap-2" onClick={handleValidateData}>
                Validar Dados <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-green-800 dark:text-green-300">Linhas Válidas</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{validatedRows.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                  <AlertCircle className="size-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-red-800 dark:text-red-300">Linhas Inválidas</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{invalidRows.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col justify-center p-5 gap-2">
              <Button
                className="w-full gap-2"
                onClick={handleStartImport}
                disabled={validatedRows.length === 0 || isImporting}
              >
                {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Importar {validatedRows.length} Registros
              </Button>
              {invalidRows.length > 0 && (
                <Button variant="outline" className="w-full gap-2" onClick={handleDownloadErrorCsv}>
                  <Download className="size-4" /> Baixar Planilha de Erros
                </Button>
              )}
            </Card>
          </div>

          {invalidRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 text-red-700">
                  <AlertCircle className="size-5" /> Erros de Validação Identificados
                </CardTitle>
                <CardDescription>Corrija estes erros na sua planilha original ou ignore-os para importar apenas as linhas válidas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Linha</TableHead>
                        <TableHead>Erros Diagnosticados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.map((inv) => (
                        <TableRow key={inv.linha}>
                          <TableCell className="font-semibold text-red-600">#{inv.linha}</TableCell>
                          <TableCell>
                            <ul className="list-disc pl-4 space-y-1">
                              {inv.erros.map((e, idx) => (
                                <li key={idx} className="text-xs text-red-600/90">{e}</li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} disabled={isImporting}>Voltar para Mapeamento</Button>
            <Button variant="ghost" onClick={handleReset} disabled={isImporting}>Limpar tudo</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <Card className="max-w-md mx-auto text-center p-8 space-y-6">
          <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mx-auto">
            <CheckCircle2 className="size-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Processamento Concluído!</h2>
            <p className="text-sm text-muted-foreground mt-2">Seus dados foram importados com sucesso em lotes e integrados ao banco de dados do sistema.</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-muted-foreground">Importações com Sucesso:</span>
              <span className="font-semibold text-green-600">{validatedRows.length}</span>
            </div>
            {invalidRows.length > 0 && (
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">Registros Ignorados (Erros):</span>
                <span className="font-semibold text-red-600">{invalidRows.length}</span>
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleReset}>Fazer nova importação</Button>
        </Card>
      )}

      {isImporting && (
        <Dialog open={isImporting} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md text-center py-10 space-y-4">
            <Loader2 className="size-10 animate-spin text-primary mx-auto" />
            <div>
              <DialogTitle>Importando dados...</DialogTitle>
              <DialogDescription className="mt-2">
                Enviando registros em lotes de 500 para processamento seguro.
              </DialogDescription>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2 w-full" />
              <div className="text-xs text-muted-foreground font-semibold">{progress}% Concluído</div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Audit Log History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md flex items-center gap-2">
            <ListRestart className="size-5" /> Histórico de Importações
          </CardTitle>
          <CardDescription>Logs e auditoria de arquivos e registros processados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhuma importação realizada até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Total Linhas</TableHead>
                    <TableHead>Sucesso</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{fmtDate(log.created_at)}</TableCell>
                      <TableCell className="font-semibold text-xs">{log.arquivo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {log.tipo.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{log.total_linhas}</TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">{log.sucesso}</TableCell>
                      <TableCell className="text-center text-red-600 font-semibold">{log.erros}</TableCell>
                      <TableCell>
                        {log.erros > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-red-600 hover:text-red-700"
                            onClick={() => handleViewLogErrors(log.id)}
                          >
                            <Eye className="size-3.5" /> Ver Erros
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errors Modal */}
      {selectedLogErrors && (
        <Dialog open={!!selectedLogErrors} onOpenChange={() => setSelectedLogErrors(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-red-700 flex items-center gap-2">
                <AlertCircle className="size-5" /> Erros de Processamento
              </DialogTitle>
              <DialogDescription>Detalhamento dos erros ocorridos durante o processamento do arquivo.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto border rounded-md my-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Linha</TableHead>
                    <TableHead className="w-40">Coluna/Campo</TableHead>
                    <TableHead>Mensagem de Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLogErrors.map((err) => (
                    <TableRow key={err.id}>
                      <TableCell className="font-semibold">#{err.linha}</TableCell>
                      <TableCell className="capitalize text-xs font-semibold text-muted-foreground">{err.campo || "Geral"}</TableCell>
                      <TableCell className="text-xs text-red-600">{err.mensagem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedLogErrors(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
