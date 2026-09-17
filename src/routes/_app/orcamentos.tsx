import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  Calculator, Plus, Search, FileSpreadsheet, Database, Upload, Trash2,
  AlertCircle, Check, Loader2, ArrowUpDown, ChevronDown, RefreshCw, HelpCircle
} from "lucide-react";

import { supabase as supabaseOriginal } from "@/integrations/supabase/client.custom";
const supabase = supabaseOriginal as any;
import { useAuth } from "@/hooks/use-auth";
import {
  orcamentoItemSchema,
  type OrcamentoItemFormValues,
  type ReferenciaInsumoRow,
  type ReferenciaComposicaoRow,
  type OrcamentoRow,
  type OrcamentoItemRow
} from "@/lib/orcamentos.schema";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/orcamentos")({
  component: OrcamentosPage,
});

const fmtBRL = (v: number | null | undefined) =>
  ((v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtQty = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const parseCurrencyToCentavos = (val: any): number => {
  if (typeof val === 'number') return Math.round(val * 100);
  if (!val) return 0;
  const cleaned = String(val)
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
};

const parseQuantity = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\./g, "").replace(/,/g, ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

function OrcamentosPage() {
  const { perfil, user } = useAuth();
  const qc = useQueryClient();

  const podeEditar =
    perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "engenharia";

  const [activeTab, setActiveTab] = useState("obras");

  // Selected Obra
  const [selectedObraId, setSelectedObraId] = useState<string>("");

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [importBudgetOpen, setImportBudgetOpen] = useState(false);
  const [importCatalogOpen, setImportCatalogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrcamentoItemRow | null>(null);

  // Search filter for reference list
  const [refSearch, setRefSearch] = useState("");
  const [refSource, setRefSource] = useState<"sinapi" | "sicro">("sinapi");
  const [refType, setRefType] = useState<"insumos" | "composicoes">("insumos");
  const [refUF, setRefUF] = useState("SP");
  const [refMes, setRefMes] = useState("05/2026");

  // Dynamic list of reference months from 2024 to 2026
  const availableMonths = useMemo(() => {
    const list = [];
    for (let year = 2024; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        const mStr = String(month).padStart(2, "0");
        list.push(`${mStr}/${year}`);
      }
    }
    return list.reverse(); // Newest months first
  }, []);

  // Excel files parsing states
  const [parsedRows, setParsedRows] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeaders, setHasHeaders] = useState(true);

  // Mapping states for budget importer
  const [mapping, setMapping] = useState({
    codigo: -1,
    descricao: -1,
    unidade: -1,
    quantidade: -1,
    valor_unitario: -1,
    etapa: -1,
  });
  const [defaultEtapa, setDefaultEtapa] = useState("Geral");

  // Importer progress states
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Queries
  const { data: obras } = useQuery({
    queryKey: ["obras-select-orc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id,numero,nome,orcamento,valor_executado")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Seleciona a obra indicada pela tela de Obras; se ausente, usa a primeira disponível.
  useEffect(() => {
    if (!obras?.length || selectedObraId) return;
    const obraParam = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("obra")
      : null;
    const obraInicial = obras.find((obra: any) => obra.id === obraParam) ?? obras[0];
    setSelectedObraId(obraInicial.id);
  }, [obras, selectedObraId]);

  // Selected Obra detail
  const currentObra = useMemo(() => {
    return obras?.find((o: any) => o.id === selectedObraId);
  }, [obras, selectedObraId]);

  // Orcamento table check/upsert
  const { data: orcamento } = useQuery({
    queryKey: ["orcamento-for-obra", selectedObraId],
    enabled: !!selectedObraId,
    queryFn: async () => {
      let { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("obra_id", selectedObraId)
        .maybeSingle();

      if (error) throw error;

      if (!data && podeEditar) {
        // Auto-create budget entry if it doesn't exist
        const { data: newOrc, error: insertErr } = await supabase
          .from("orcamentos")
          .insert({ obra_id: selectedObraId, total_estimado: 0 })
          .select("*")
          .single();
        if (insertErr) throw insertErr;
        data = newOrc;
      }
      return data as OrcamentoRow;
    },
  });

  // Orcamento itens
  const { data: orcamentoItens, isLoading: loadingItens } = useQuery({
    queryKey: ["orcamento-itens", orcamento?.id],
    enabled: !!orcamento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", orcamento!.id)
        .order("etapa", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrcamentoItemRow[];
    },
  });

  // Public reference catalog query
  const { data: refCatalog, isLoading: loadingRefCatalog } = useQuery({
    queryKey: ["reference-catalog", refSource, refType, refUF, refMes, refSearch],
    queryFn: async () => {
      const isCompo = refType === "composicoes";
      const table = isCompo ? "referencia_composicoes" : "referencia_insumos";

      let query = supabase
        .from(table)
        .select("*")
        .eq("fonte", refSource)
        .eq("uf", refUF)
        .eq("mes_referencia", refMes)
        .order("codigo", { ascending: true })
        .limit(100);

      if (refSearch) {
        query = query.or(`codigo.ilike.%${refSearch}%,descricao.ilike.%${refSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Grouped budget items by etapa
  const itemsByEtapa = useMemo(() => {
    const map: Record<string, { items: OrcamentoItemRow[]; subtotal: number }> = {};
    if (!orcamentoItens) return map;

    orcamentoItens.forEach((item) => {
      const et = item.etapa || "Geral";
      if (!map[et]) {
        map[et] = { items: [], subtotal: 0 };
      }
      map[et].items.push(item);
      map[et].subtotal += Number(item.valor_total);
    });
    return map;
  }, [orcamentoItens]);

  // Total computed from items
  const totalCalculado = useMemo(() => {
    if (!orcamentoItens) return 0;
    return orcamentoItens.reduce((acc, curr) => acc + Number(curr.valor_total), 0);
  }, [orcamentoItens]);

  // Sync budget totals in database
  const syncTotalsMutation = useMutation({
    mutationFn: async (totalCents: number) => {
      if (!orcamento) return;
      // Update budget total
      await supabase
        .from("orcamentos")
        .update({ total_estimado: totalCents })
        .eq("id", orcamento.id);

      // Update obra total
      await supabase
        .from("obras")
        .update({ orcamento: Number(totalCents) / 100 })
        .eq("id", selectedObraId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras-select-orc"] });
      qc.invalidateQueries({ queryKey: ["orcamento-for-obra"] });
    }
  });

  // Sync total when items change
  useEffect(() => {
    if (orcamento && totalCalculado !== Number(orcamento.total_estimado)) {
      syncTotalsMutation.mutate(totalCalculado);
    }
  }, [totalCalculado, orcamento]);

  // Mutations for budget items
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("orcamento_itens")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido do orçamento");
      qc.invalidateQueries({ queryKey: ["orcamento-itens", orcamento?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearCatalogMutation = useMutation({
    mutationFn: async () => {
      const isCompo = refType === "composicoes";
      const table = isCompo ? "referencia_composicoes" : "referencia_insumos";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("fonte", refSource)
        .eq("uf", refUF)
        .eq("mes_referencia", refMes);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Base de referência limpa com sucesso!");
      qc.invalidateQueries({ queryKey: ["reference-catalog", refSource, refType, refUF, refMes] });
    },
    onError: (err: any) => {
      toast.error("Erro ao limpar base: " + err.message);
    }
  });

  const saveItemMutation = useMutation({
    mutationFn: async (values: OrcamentoItemFormValues) => {
      if (!orcamento) throw new Error("Orçamento não inicializado");

      const qty = Number(values.quantidade);
      const unitValCents = Math.round(Number(values.valor_unitario) * 100);
      const totalValCents = Math.round(qty * unitValCents);

      const payload = {
        orcamento_id: orcamento.id,
        codigo: values.codigo || null,
        descricao: values.descricao,
        unidade: values.unidade,
        quantidade: qty,
        valor_unitario: unitValCents,
        valor_total: totalValCents,
        fonte_referencia: values.fonte_referencia,
        referencia_id: values.referencia_id || null,
        tipo_referencia: values.tipo_referencia || null,
        referencia_uf: values.referencia_uf || null,
        referencia_mes: values.referencia_mes || null,
        etapa: values.etapa || "Geral",
      };

      if (editingItem) {
        const { error } = await supabase
          .from("orcamento_itens")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("orcamento_itens")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? "Item atualizado" : "Item adicionado");
      qc.invalidateQueries({ queryKey: ["orcamento-itens", orcamento?.id] });
      setItemModalOpen(false);
      setEditingItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addReferenceToBudgetMutation = useMutation({
    mutationFn: async (row: any) => {
      if (!orcamento) throw new Error("Selecione uma obra antes de adicionar a referência");
      const valorUnitario = Number(refType === "composicoes" ? row.custo_total : row.preco_mediano);
      const { error } = await supabase.from("orcamento_itens").insert({
        orcamento_id: orcamento.id,
        codigo: row.codigo,
        descricao: row.descricao,
        unidade: row.unidade,
        quantidade: 1,
        valor_unitario: valorUnitario,
        valor_total: valorUnitario,
        fonte_referencia: refSource,
        referencia_id: row.id,
        tipo_referencia: refType === "composicoes" ? "composicao" : "insumo",
        referencia_uf: row.uf,
        referencia_mes: row.mes_referencia,
        etapa: row.tipo_classe || "Geral",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referência adicionada ao orçamento da obra");
      qc.invalidateQueries({ queryKey: ["orcamento-itens", orcamento?.id] });
      setActiveTab("obras");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Handle excel parse for budget import
  const handleBudgetFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (json.length === 0) {
        toast.error("Planilha vazia");
        return;
      }

      setParsedRows(json);

      // Guess headers
      const firstRow = json[0] || [];
      const headerLabels = firstRow.map((cell, idx) => {
        return cell ? String(cell).trim() : `Coluna ${idx + 1}`;
      });
      setHeaders(headerLabels);

      // Try smart mapping
      const newMapping = {
        codigo: -1,
        descricao: -1,
        unidade: -1,
        quantidade: -1,
        valor_unitario: -1,
        etapa: -1,
      };

      headerLabels.forEach((label, idx) => {
        const norm = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (norm.includes("codigo") || norm.includes("cod")) newMapping.codigo = idx;
        if (norm.includes("descricao") || norm.includes("item") || norm.includes("servico") || norm.includes("insumo")) newMapping.descricao = idx;
        if (norm.includes("unidade") || norm.includes("un")) newMapping.unidade = idx;
        if (norm.includes("quantidade") || norm.includes("qtd") || norm.includes("quant")) newMapping.quantidade = idx;
        if (norm.includes("valor unitario") || norm.includes("preco unitario") || norm.includes("preco") || norm.includes("valor_unit") || norm.includes("valor unit")) newMapping.valor_unitario = idx;
        if (norm.includes("etapa") || norm.includes("fase") || norm.includes("grupo")) newMapping.etapa = idx;
      });

      setMapping(newMapping);
    };
    reader.readAsArrayBuffer(file);
  };

  // Run budget file import insertion
  const runBudgetImport = async () => {
    if (!orcamento) {
      toast.error("Selecione uma obra válida");
      return;
    }
    if (mapping.descricao === -1 || mapping.unidade === -1 || mapping.quantidade === -1 || mapping.valor_unitario === -1) {
      toast.error("Mapeie pelo menos Descrição, Unidade, Quantidade e Preço Unitário");
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus("Processando planilha...");

      const startRowIdx = hasHeaders ? 1 : 0;
      const rowsToImport = parsedRows.slice(startRowIdx).filter(row => row && row[mapping.descricao]);

      const itemsPayload = rowsToImport.map((row) => {
        const codeVal = mapping.codigo !== -1 ? String(row[mapping.codigo] || "").trim() : null;
        const descVal = String(row[mapping.descricao] || "").trim();
        const unitVal = String(row[mapping.unidade] || "").trim() || "un";
        const qtyVal = parseQuantity(row[mapping.quantidade]);
        const unitPriceCents = parseCurrencyToCentavos(row[mapping.valor_unitario]);
        const stageVal = mapping.etapa !== -1 && row[mapping.etapa] ? String(row[mapping.etapa]).trim() : defaultEtapa;

        return {
          orcamento_id: orcamento.id,
          codigo: codeVal,
          descricao: descVal,
          unidade: unitVal,
          quantidade: qtyVal,
          valor_unitario: unitPriceCents,
          valor_total: Math.round(qtyVal * unitPriceCents),
          fonte_referencia: "proprio",
          etapa: stageVal,
        };
      });

      setImportStatus(`Inserindo ${itemsPayload.length} itens no banco...`);
      
      // Batch in chunks of 100 to update progress UI
      const chunkSize = 100;
      const total = itemsPayload.length;
      let insertedCount = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = itemsPayload.slice(i, i + chunkSize);
        const { error } = await supabase.from("orcamento_itens").insert(chunk);
        if (error) throw error;
        insertedCount += chunk.length;
        setImportProgress(Math.round((insertedCount / total) * 100));
        setImportStatus(`Importado ${insertedCount} de ${total} itens...`);
      }

      toast.success("Orçamento importado com sucesso!");
      qc.invalidateQueries({ queryKey: ["orcamento-itens", orcamento.id] });
      setImportBudgetOpen(false);
      setParsedRows([]);
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Attempt to parse state (UF) and reference month/year from file name
  const parseMetadataFromFileName = (fileName: string) => {
    const cleanName = fileName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 1. Detect UF
    const ufs = [
      "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
      "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
      "SP", "SE", "TO"
    ];
    
    let detectedUF = "";
    for (const uf of ufs) {
      const regex = new RegExp(`(^|[\\W_])${uf}([\\W_]|$)`);
      if (regex.test(cleanName)) {
        detectedUF = uf;
        break;
      }
    }
    
    // 2. Detect Date (Month/Year)
    let detectedMes = "";
    const mmyyyyMatch = cleanName.match(/(\d{2})_?(\d{4})/);
    if (mmyyyyMatch) {
      const month = mmyyyyMatch[1];
      const year = mmyyyyMatch[2];
      const mNum = parseInt(month, 10);
      if (mNum >= 1 && mNum <= 12) {
        detectedMes = `${month}/${year}`;
      }
    }

    if (!detectedMes) {
      const yyyymmMatch = cleanName.match(/(\d{4})_?(\d{2})/);
      if (yyyymmMatch) {
        const year = yyyymmMatch[1];
        const month = yyyymmMatch[2];
        const mNum = parseInt(month, 10);
        if (mNum >= 1 && mNum <= 12) {
          detectedMes = `${month}/${year}`;
        }
      }
    }

    // 3. Detect refType: only set if it contains ONE of them, not both
    let detectedType: "insumos" | "composicoes" | null = null;
    const hasInsumo = cleanName.includes("INSUMO");
    const hasComposi = cleanName.includes("COMPOSI");
    if (hasInsumo && !hasComposi) {
      detectedType = "insumos";
    } else if (hasComposi && !hasInsumo) {
      detectedType = "composicoes";
    }

    return { detectedUF, detectedMes, detectedType };
  };

  // Handle SINAPI/SICRO catalog file parsing and batched uploading
  const handleCatalogFileChange = async (file: File) => {
    try {
      const { detectedUF, detectedMes, detectedType } = parseMetadataFromFileName(file.name);
      
      let typeToUse = refType;
      if (detectedType) {
        setRefType(detectedType);
        typeToUse = detectedType;
        toast.info(`Tipo detectado: ${detectedType === "insumos" ? "Insumos" : "Composições"}`);
      }
      if (detectedUF) {
        setRefUF(detectedUF);
        toast.info(`UF detectada: ${detectedUF}`);
      }
      if (detectedMes) {
        setRefMes(detectedMes);
        toast.info(`Referência detectada: ${detectedMes}`);
      }

      let arrayBuffer: ArrayBuffer;
      let fileName = file.name;

      if (file.name.toLowerCase().endsWith(".zip")) {
        toast.info("Processando arquivo ZIP do SINAPI...");
        const zip = await JSZip.loadAsync(file);
        
        // Try to find actual price/synthetic spreadsheets first (exclude representativeness/coefficients/analytics)
        let excelFiles = Object.keys(zip.files).filter((name) => {
          const lower = name.toLowerCase();
          const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
          const isMac = lower.includes("__macosx");
          const isExcludeKeyword = lower.includes("representat") || 
                                   lower.includes("coef") || 
                                   lower.includes("analitico") ||
                                   lower.includes("grupo") ||
                                   lower.includes("classe");
          return isExcel && !isMac && !isExcludeKeyword;
        });

        // Fall back to any excel file if no price-specific files found
        if (excelFiles.length === 0) {
          excelFiles = Object.keys(zip.files).filter(
            (name) => (name.toLowerCase().endsWith(".xlsx") || name.toLowerCase().endsWith(".xls")) && !name.includes("__MACOSX")
          );
        }

        if (excelFiles.length === 0) {
          toast.error("Nenhuma planilha Excel encontrada dentro do arquivo ZIP.");
          return;
        }

        // Try to find the file that matches the typeToUse (insumos vs composicoes)
        let targetFile = excelFiles[0];
        const isCompo = typeToUse === "composicoes";
        const keyword = isCompo ? "composi" : "insumo";

        const matchingFile = excelFiles.find((name) =>
          name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(keyword)
        );

        if (matchingFile) {
          targetFile = matchingFile;
        }

        toast.info(`Extraindo planilha: ${targetFile.split("/").pop()}`);
        arrayBuffer = await zip.files[targetFile].async("arraybuffer");
        fileName = targetFile;
      } else {
        arrayBuffer = await file.arrayBuffer();
      }

      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (json.length === 0) {
        toast.error("Planilha vazia");
        return;
      }
      setParsedRows(json);

      // Scan the first 20 rows to find the real header row
      // SINAPI files usually have several metadata rows before the actual column headers
      const HEADER_KEYWORDS = ["descri", "codigo", "insumo", "composic", "unidade", "preco", "custo", "mediano"];
      let headerRowIdx = 0;
      let bestScore = 0;

      for (let rowIdx = 0; rowIdx < Math.min(20, json.length); rowIdx++) {
        const row = json[rowIdx];
        if (!row || row.length === 0) continue;
        let score = 0;
        for (const cell of row) {
          if (!cell) continue;
          const norm = String(cell).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          for (const kw of HEADER_KEYWORDS) {
            if (norm.includes(kw)) { score++; break; }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          headerRowIdx = rowIdx;
        }
      }

      const headerRow = json[headerRowIdx] || [];
      const headerLabels = headerRow.map((cell, idx) =>
        cell ? String(cell).trim() : `Coluna ${idx + 1}`
      );

      // Store the actual data start row (after the header row we found)
      // We store this in parsedRows with a sentinel so runCatalogImport knows where to start
      // Strategy: re-slice parsedRows so index 0 = header, index 1+ = data
      const resliced = json.slice(headerRowIdx);
      setParsedRows(resliced);
      setHeaders(headerLabels);

      // Guess smart mapping based on catalog type
      const newMapping = {
        codigo: -1,
        descricao: -1,
        unidade: -1,
        quantidade: -1,
        valor_unitario: -1,
        etapa: -1,
      };

      headerLabels.forEach((label, idx) => {
        const norm = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Código: matches "codigo" / "cod" prefixes but NOT description or name columns
        if (
          (norm === "codigo" || norm.startsWith("cod") || norm.startsWith("codigo")) &&
          !norm.includes("descr") && !norm.includes("nome") && !norm.includes("agrup")
        ) {
          if (newMapping.codigo === -1) newMapping.codigo = idx; // take first match only
        }

        // Descrição: matches "descricao" or "descricao da composicao" / "descricao do insumo"
        // but NOT "classe" or "tipo" descriptions
        if (
          (norm.includes("descr") && !norm.includes("classe") && !norm.includes("tipo") && !norm.includes("agrup")) ||
          norm.includes("nome")
        ) {
          if (newMapping.descricao === -1) newMapping.descricao = idx; // take first match only
        }

        if (norm.includes("unidade") || norm.includes("unid") || norm === "um") {
          if (newMapping.unidade === -1) newMapping.unidade = idx;
        }

        if (
          (norm.includes("preco") || norm.includes("mediano") ||
           (norm.includes("custo") && norm.includes("total")) ||
           norm.includes("valor")) &&
          !norm.includes("cod") && !norm.includes("mao") && !norm.includes("material") &&
          !norm.includes("equip") && !norm.includes("servico") && !norm.includes("outro")
        ) {
          if (newMapping.valor_unitario === -1) newMapping.valor_unitario = idx;
        }

        if (
          (norm.includes("descr") && (norm.includes("classe") || norm.includes("tipo"))) ||
          (norm.startsWith("descricao") && norm.includes("classe"))
        ) {
          if (newMapping.etapa === -1) newMapping.etapa = idx;
        }
      });

      setMapping(newMapping);
      toast.success(`Planilha "${fileName.split("/").pop()}" carregada! Cabeçalhos encontrados na linha ${headerRowIdx + 1}.`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    }
  };

  const runCatalogImport = async () => {
    if (mapping.codigo === -1 || mapping.descricao === -1 || mapping.unidade === -1 || mapping.valor_unitario === -1) {
      toast.error("Mapeie Código, Descrição, Unidade e Preço/Custo");
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus("Processando planilha do catálogo...");

      const startRowIdx = hasHeaders ? 1 : 0;
      const rawRows = parsedRows.slice(startRowIdx).filter(row => row && row[mapping.codigo]);

      // Deduplicate rows by the "codigo" column value to handle Analítico files (which repeat composition codes for each sub-item)
      const seenCodes = new Set<string>();
      const rowsToImport: any[][] = [];
      
      for (const row of rawRows) {
        const code = String(row[mapping.codigo] || "").trim();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          rowsToImport.push(row);
        }
      }

      const isCompo = refType === "composicoes";
      const table = isCompo ? "referencia_composicoes" : "referencia_insumos";

      const catalogPayload = rowsToImport.map((row) => {
        const base = {
          fonte: refSource,
          uf: refUF,
          mes_referencia: refMes,
          codigo: String(row[mapping.codigo] || "").trim(),
          descricao: String(row[mapping.descricao] || "").trim(),
          unidade: String(row[mapping.unidade] || "").trim() || "un",
        };

        if (isCompo) {
          const classVal = mapping.etapa !== -1 && row[mapping.etapa] ? String(row[mapping.etapa]).trim() : null;
          return {
            ...base,
            custo_total: parseCurrencyToCentavos(row[mapping.valor_unitario]),
            tipo_classe: classVal,
          };
        } else {
          return {
            ...base,
            preco_mediano: parseCurrencyToCentavos(row[mapping.valor_unitario]),
          };
        }
      });

      setImportStatus(`Inserindo ${catalogPayload.length} registros em lotes de 500...`);

      const chunkSize = 500;
      const total = catalogPayload.length;
      let insertedCount = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = catalogPayload.slice(i, i + chunkSize);
        
        // Upsert on conflict to prevent primary key errors
        const { error } = await supabase
          .from(table)
          .upsert(chunk, { onConflict: "fonte,uf,mes_referencia,codigo" });

        if (error) throw error;
        
        insertedCount += chunk.length;
        setImportProgress(Math.round((insertedCount / total) * 100));
        setImportStatus(`Enviado lote ${Math.ceil(insertedCount / chunkSize)}: ${insertedCount} de ${total} registros...`);
      }

      toast.success("Catálogo público importado e atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["reference-catalog"] });
      setImportCatalogOpen(false);
      setParsedRows([]);
    } catch (e) {
      toast.error(`Falha na importação do catálogo: ${(e as Error).message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="space-y-6 p-1 md:p-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground tracking-tight">
            <Calculator className="size-6 text-primary" />
            Módulo de Orçamentos e Custos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planejamento orçamentário de projetos, custos estimativos por etapa e base de preços públicos.
          </p>
        </div>
        
        {activeTab === "obras" && (
          <div className="flex items-center gap-2">
            <Select value={selectedObraId} onValueChange={setSelectedObraId}>
              <SelectTrigger className="w-64" id="select-obra-dropdown">
                <SelectValue placeholder="Selecione a Obra" />
              </SelectTrigger>
              <SelectContent>
                {obras?.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.numero} — {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-[480px] grid-cols-2">
          <TabsTrigger value="obras" id="tab-orcamento-obras">Orçamento de Obras</TabsTrigger>
          <TabsTrigger value="referencias" id="tab-sinapi-sicro">Base de Referência (SINAPI/SICRO)</TabsTrigger>
        </TabsList>

        {/* Tab 1: Orçamento de Obras */}
        <TabsContent value="obras" className="space-y-6">
          {selectedObraId ? (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-card to-accent/20 border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                      Total Orçado (Planejado)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight text-foreground" id="lbl-total-orcado">
                      {fmtBRL(totalCalculado)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Definido pelo detalhamento de etapas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-accent/20 border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                      Total Executado (Medido)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight text-foreground" id="lbl-total-executado">
                      {fmtBRL((currentObra?.valor_executado ?? 0) * 100)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Medições financeiras aprovadas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-accent/20 border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                      Desvio / Progresso Financeiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-lg font-bold">
                        {totalCalculado > 0
                          ? `${(( (currentObra?.valor_executado ?? 0) * 100 / totalCalculado) * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Medido vs Orçado
                      </span>
                    </div>
                    <Progress
                      value={
                        totalCalculado > 0
                          ? Math.min(((currentObra?.valor_executado ?? 0) * 100 / totalCalculado) * 100, 100)
                          : 0
                      }
                      className="h-2"
                      id="progress-orcamento"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  Planilha de Itens por Obra
                  <Badge variant="outline" className="font-mono text-xs">
                    {orcamentoItens?.length ?? 0} itens
                  </Badge>
                </h2>
                
                {podeEditar && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2 text-sm"
                      onClick={() => {
                        setParsedRows([]);
                        setImportBudgetOpen(true);
                      }}
                      id="btn-import-orcamento-excel"
                    >
                      <Upload className="size-4" />
                      Importar Planilha (.xlsx)
                    </Button>
                    
                    <Button
                      className="gap-2 text-sm"
                      onClick={() => {
                        setEditingItem(null);
                        setItemModalOpen(true);
                      }}
                      id="btn-adicionar-item-manual"
                    >
                      <Plus className="size-4" />
                      Adicionar Item
                    </Button>
                  </div>
                )}
              </div>

              {/* Items List grouped by Etapa */}
              {loadingItens ? (
                <div className="space-y-3">
                  <Loader2 className="size-8 animate-spin text-primary mx-auto" />
                  <p className="text-center text-sm text-muted-foreground">Carregando itens orçamentários...</p>
                </div>
              ) : Object.keys(itemsByEtapa).length === 0 ? (
                <Card className="border border-dashed py-12 flex flex-col items-center justify-center text-center">
                  <FileSpreadsheet className="size-12 text-muted-foreground/40 mb-3" />
                  <h3 className="font-medium text-foreground">Orçamento vazio</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                    Não há itens cadastrados no orçamento desta obra. Comece importando uma planilha ou adicionando itens manualmente.
                  </p>
                  {podeEditar && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setImportBudgetOpen(true)}>
                        Importar Excel
                      </Button>
                      <Button size="sm" onClick={() => setItemModalOpen(true)}>
                        Adicionar Item
                      </Button>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="space-y-6">
                  {Object.entries(itemsByEtapa).map(([etapa, group]) => (
                    <Card key={etapa} className="border shadow-none overflow-hidden">
                      <CardHeader className="bg-accent/30 py-3 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="px-2 py-0.5 font-semibold text-xs tracking-wider uppercase">
                            Etapa
                          </Badge>
                          <span className="font-bold text-foreground text-sm">{etapa}</span>
                        </div>
                        <div className="text-sm font-bold text-foreground">
                          Subtotal: <span className="font-mono">{fmtBRL(group.subtotal)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24 pl-4">Código</TableHead>
                              <TableHead>Descrição do Serviço/Insumo</TableHead>
                              <TableHead className="w-16 text-center">Und</TableHead>
                              <TableHead className="w-24 text-right">Qtd</TableHead>
                              <TableHead className="w-32 text-right">Preço Unitário</TableHead>
                              <TableHead className="w-32 text-right">Preço Total</TableHead>
                              <TableHead className="w-20 text-center">Fonte</TableHead>
                              {podeEditar && <TableHead className="w-20 text-right pr-4" />}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((item) => (
                              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-mono text-xs pl-4">{item.codigo ?? "—"}</TableCell>
                                <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                                <TableCell className="text-center text-xs">{item.unidade}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{fmtQty(Number(item.quantidade))}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{fmtBRL(item.valor_unitario)}</TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold">{fmtBRL(item.valor_total)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] px-1.5 py-0 capitalize",
                                    item.fonte_referencia === "sinapi" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
                                    item.fonte_referencia === "sicro" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800",
                                    item.fonte_referencia === "proprio" && "bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800"
                                  )}>
                                    {item.fonte_referencia}
                                  </Badge>
                                </TableCell>
                                {podeEditar && (
                                  <TableCell className="text-right pr-4">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8"
                                        onClick={() => {
                                          setEditingItem(item);
                                          setItemModalOpen(true);
                                        }}
                                        title="Editar"
                                      >
                                        <ChevronDown className="size-3.5 rotate-90" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                          if (confirm(`Excluir o item "${item.descricao}"?`)) {
                                            deleteItemMutation.mutate(item.id);
                                          }
                                        }}
                                        title="Excluir"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card className="border p-8 text-center text-muted-foreground">
              Selecione ou cadastre uma Obra para visualizar o orçamento.
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Base de Referência */}
        <TabsContent value="referencias" className="space-y-6">
          {/* Filtering Panel */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-md font-bold text-foreground">
                    Catálogos de Referência Pública
                  </CardTitle>
                  <CardDescription>
                    Pesquise bases públicas SINAPI e SICRO de insumos ou composições de serviços.
                  </CardDescription>
                </div>
                {podeEditar && (
                  <div className="flex flex-wrap gap-2 self-start md:self-auto">
                    <Button
                      variant="destructive"
                      className="gap-2 text-sm"
                      onClick={() => {
                        if (confirm(`Aviso: Isso excluirá TODOS os registros de ${refType === "insumos" ? "Insumos" : "Composições"} da fonte ${refSource.toUpperCase()} para o estado ${refUF} na referência ${refMes}. Deseja continuar?`)) {
                          clearCatalogMutation.mutate();
                        }
                      }}
                      disabled={clearCatalogMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                      {clearCatalogMutation.isPending ? "Limpando..." : "Limpar Base"}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-sm"
                      onClick={() => {
                        setParsedRows([]);
                        setImportCatalogOpen(true);
                      }}
                      id="btn-import-catalogo-publico"
                    >
                      <Upload className="size-4" />
                      Carregar Catálogo Público
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Fonte */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Fonte</label>
                  <Select value={refSource} onValueChange={(v: any) => setRefSource(v)}>
                    <SelectTrigger id="ref-filter-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sinapi">SINAPI (Caixa)</SelectItem>
                      <SelectItem value="sicro">SICRO (DNIT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Tabela */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Tipo de Base</label>
                  <Select value={refType} onValueChange={(v: any) => setRefType(v)}>
                    <SelectTrigger id="ref-filter-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumos">Insumos (Materiais/Mão de Obra)</SelectItem>
                      <SelectItem value="composicoes">Composições de Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* UF */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">UF (Estado)</label>
                  <Select value={refUF} onValueChange={(v: string) => setRefUF(v)}>
                    <SelectTrigger id="ref-filter-uf" className="font-mono text-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mês Referência */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Referência (Mês/Ano)</label>
                  <Select value={refMes} onValueChange={(v: string) => setRefMes(v)}>
                    <SelectTrigger id="ref-filter-mes" className="text-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Term */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Buscar Código / Descrição</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      className="pl-9"
                      value={refSearch}
                      onChange={(e) => setRefSearch(e.target.value)}
                      id="ref-filter-search"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Catalog Listing */}
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32 pl-4">Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24 text-center">Unidade</TableHead>
                  <TableHead className="w-32 text-right">
                    {refType === "composicoes" ? "Custo Total" : "Preço Mediano"}
                  </TableHead>
                  {refType === "composicoes" && <TableHead className="w-48 pl-4">Classe/Tipo</TableHead>}
                  {podeEditar && selectedObraId && <TableHead className="w-28" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRefCatalog ? (
                  <TableRow>
                    <TableCell colSpan={(refType === "composicoes" ? 5 : 4) + (podeEditar && selectedObraId ? 1 : 0)} className="text-center py-12">
                      <Loader2 className="size-6 animate-spin text-primary mx-auto mb-2" />
                      <span className="text-sm text-muted-foreground">Carregando catálogo de referência...</span>
                    </TableCell>
                  </TableRow>
                ) : refCatalog?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(refType === "composicoes" ? 5 : 4) + (podeEditar && selectedObraId ? 1 : 0)} className="text-center py-12 text-muted-foreground">
                      <Database className="size-8 mx-auto mb-2 opacity-50" />
                      Nenhum registro encontrado para esta pesquisa ou base vazia.
                    </TableCell>
                  </TableRow>
                ) : (
                  refCatalog?.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-bold pl-4">{row.codigo}</TableCell>
                      <TableCell className="text-sm">{row.descricao}</TableCell>
                      <TableCell className="text-center text-xs">{row.unidade}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtBRL(refType === "composicoes" ? row.custo_total : row.preco_mediano)}
                      </TableCell>
                      {refType === "composicoes" && (
                        <TableCell className="text-xs pl-4 truncate max-w-[200px]" title={row.tipo_classe}>
                          {row.tipo_classe ?? "—"}
                        </TableCell>
                      )}
                      {podeEditar && selectedObraId && (
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={addReferenceToBudgetMutation.isPending}
                            onClick={() => addReferenceToBudgetMutation.mutate(row)}
                          >
                            Adicionar
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manual Item Dialog Form */}
      <ManualItemFormDialog
        open={itemModalOpen}
        onOpenChange={(o) => {
          setItemModalOpen(o);
          if (!o) setEditingItem(null);
        }}
        editingItem={editingItem}
        onSave={(vals) => saveItemMutation.mutate(vals)}
        isSubmitting={saveItemMutation.isPending}
      />

      {/* Spreadsheet Budget Importer Dialog */}
      <Dialog open={importBudgetOpen} onOpenChange={setImportBudgetOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Planilha de Orçamento (.xlsx)</DialogTitle>
            <DialogDescription>
              Selecione a planilha de orçamento do seu projeto e associe as colunas correspondentes para carregar no sistema.
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <p className="font-medium">{importStatus}</p>
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} className="h-2" />
                <span className="text-xs text-muted-foreground mt-1 block">{importProgress}% Concluído</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Input */}
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/10 transition-colors">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBudgetFileChange(file);
                  }}
                  className="hidden"
                  id="budget-file-input"
                />
                <label htmlFor="budget-file-input" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="size-10 text-muted-foreground mx-auto" />
                  <div className="text-sm font-medium text-foreground">
                    Clique para selecionar ou arraste o arquivo aqui
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Suporta arquivos Excel (.xlsx, .xls) ou planilhas CSV
                  </div>
                </label>
              </div>

              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  {/* File config & mapping inputs */}
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="chk-has-headers-budget"
                        checked={hasHeaders}
                        onChange={(e) => setHasHeaders(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="chk-has-headers-budget" className="text-xs font-semibold text-foreground">
                        A primeira linha da planilha contém os cabeçalhos das colunas
                      </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Descricao (req) */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Descrição *</label>
                        <Select
                          value={String(mapping.descricao)}
                          onValueChange={(val) => setMapping({ ...mapping, descricao: Number(val) })}
                        >
                          <SelectTrigger id="import-map-desc">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Unidade (req) */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Unidade *</label>
                        <Select
                          value={String(mapping.unidade)}
                          onValueChange={(val) => setMapping({ ...mapping, unidade: Number(val) })}
                        >
                          <SelectTrigger id="import-map-und">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantidade (req) */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Quantidade *</label>
                        <Select
                          value={String(mapping.quantidade)}
                          onValueChange={(val) => setMapping({ ...mapping, quantidade: Number(val) })}
                        >
                          <SelectTrigger id="import-map-qty">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preco Unitario (req) */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Preço Unitário *</label>
                        <Select
                          value={String(mapping.valor_unitario)}
                          onValueChange={(val) => setMapping({ ...mapping, valor_unitario: Number(val) })}
                        >
                          <SelectTrigger id="import-map-price">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Código */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Código (Opcional)</label>
                        <Select
                          value={String(mapping.codigo)}
                          onValueChange={(val) => setMapping({ ...mapping, codigo: Number(val) })}
                        >
                          <SelectTrigger id="import-map-code">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">— Nenhum —</SelectItem>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Etapa */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Etapa/Fase (Opcional)</label>
                        <Select
                          value={String(mapping.etapa)}
                          onValueChange={(val) => setMapping({ ...mapping, etapa: Number(val) })}
                        >
                          <SelectTrigger id="import-map-stage">
                            <SelectValue placeholder="Padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">— Usar Etapa Padrão —</SelectItem>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {mapping.etapa === -1 && (
                      <div className="space-y-1 pt-2">
                        <label className="text-xs font-medium text-foreground">Etapa Padrão</label>
                        <Input
                          value={defaultEtapa}
                          onChange={(e) => setDefaultEtapa(e.target.value)}
                          placeholder="Etapa Padrão"
                          id="import-default-etapa"
                        />
                      </div>
                    )}
                  </div>

                  {/* Preview Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Pré-visualização dos Dados Mapeados</h4>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead className="w-24 pl-4">Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-16 text-center">Unidade</TableHead>
                            <TableHead className="w-24 text-right">Qtd</TableHead>
                            <TableHead className="w-32 text-right">Valor Unitário</TableHead>
                            <TableHead className="w-24">Etapa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedRows.slice(hasHeaders ? 1 : 0, hasHeaders ? 6 : 5).map((row, idx) => {
                            const descVal = mapping.descricao !== -1 ? String(row[mapping.descricao] || "") : "";
                            const unitVal = mapping.unidade !== -1 ? String(row[mapping.unidade] || "") : "";
                            const qtyVal = mapping.quantidade !== -1 ? parseQuantity(row[mapping.quantidade]) : 0;
                            const priceVal = mapping.valor_unitario !== -1 ? parseCurrencyToCentavos(row[mapping.valor_unitario]) : 0;
                            const codeVal = mapping.codigo !== -1 ? String(row[mapping.codigo] || "") : "";
                            const stageVal = mapping.etapa !== -1 && row[mapping.etapa] ? String(row[mapping.etapa]) : defaultEtapa;

                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs pl-4">{codeVal || "—"}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">{descVal || "—"}</TableCell>
                                <TableCell className="text-center text-xs">{unitVal || "—"}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{fmtQty(qtyVal)}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{fmtBRL(priceVal)}</TableCell>
                                <TableCell className="text-xs truncate max-w-[100px]">{stageVal}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setParsedRows([]);
                setImportBudgetOpen(false);
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            {parsedRows.length > 0 && (
              <Button
                onClick={runBudgetImport}
                disabled={isImporting}
                id="btn-confirm-import-orcamento"
              >
                {isImporting ? "Importando..." : "Importar Orçamento"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Catalog Importer Dialog */}
      <Dialog open={importCatalogOpen} onOpenChange={setImportCatalogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Catálogo Público (SINAPI/SICRO)</DialogTitle>
            <DialogDescription>
              Insira arquivos oficiais de insumos ou composições. Os itens serão processados em lotes progressivos para atualização do banco.
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <p className="font-medium">{importStatus}</p>
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} className="h-2" />
                <span className="text-xs text-muted-foreground mt-1 block">{importProgress}% Concluído</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Context Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Fonte do Catálogo</label>
                  <Select value={refSource} onValueChange={(v: any) => setRefSource(v)}>
                    <SelectTrigger id="catalog-import-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sinapi">SINAPI (Caixa)</SelectItem>
                      <SelectItem value="sicro">SICRO (DNIT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Tipo de Catálogo</label>
                  <Select value={refType} onValueChange={(v: any) => setRefType(v)}>
                    <SelectTrigger id="catalog-import-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumos">Insumos</SelectItem>
                      <SelectItem value="composicoes">Composições</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">UF</label>
                  <Select value={refUF} onValueChange={(v: string) => setRefUF(v)}>
                    <SelectTrigger id="catalog-import-uf" className="font-mono text-center bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Mês/Ano Referência</label>
                  <Select value={refMes} onValueChange={(v: string) => setRefMes(v)}>
                    <SelectTrigger id="catalog-import-mes" className="text-center bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* File input */}
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/10 transition-colors">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCatalogFileChange(file);
                  }}
                  className="hidden"
                  id="catalog-file-input"
                />
                <label htmlFor="catalog-file-input" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="size-10 text-muted-foreground mx-auto" />
                  <div className="text-sm font-medium text-foreground">
                    Clique para selecionar planilha ou arquivo ZIP do SINAPI
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Suporta planilhas Excel (.xlsx, .xls), CSV ou pacotes compactados ZIP do SINAPI
                  </div>
                </label>
              </div>

              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  {/* Mapping options */}
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="chk-has-headers-catalog"
                        checked={hasHeaders}
                        onChange={(e) => setHasHeaders(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="chk-has-headers-catalog" className="text-xs font-semibold text-foreground">
                        A primeira linha da planilha contém os cabeçalhos das colunas
                      </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Código */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Código *</label>
                        <Select
                          value={String(mapping.codigo)}
                          onValueChange={(val) => setMapping({ ...mapping, codigo: Number(val) })}
                        >
                          <SelectTrigger id="catalog-map-code">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Descricao */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Descrição *</label>
                        <Select
                          value={String(mapping.descricao)}
                          onValueChange={(val) => setMapping({ ...mapping, descricao: Number(val) })}
                        >
                          <SelectTrigger id="catalog-map-desc">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Unidade */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Unidade *</label>
                        <Select
                          value={String(mapping.unidade)}
                          onValueChange={(val) => setMapping({ ...mapping, unidade: Number(val) })}
                        >
                          <SelectTrigger id="catalog-map-und">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preço Mediano ou Custo Total */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          {refType === "composicoes" ? "Custo Total *" : "Preço Mediano *"}
                        </label>
                        <Select
                          value={String(mapping.valor_unitario)}
                          onValueChange={(val) => setMapping({ ...mapping, valor_unitario: Number(val) })}
                        >
                          <SelectTrigger id="catalog-map-price">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((h, idx) => (
                              <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Tipo/Classe (composições apenas) */}
                      {refType === "composicoes" && (
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-medium text-foreground">Classe/Grupo (Opcional)</label>
                          <Select
                            value={String(mapping.etapa)}
                            onValueChange={(val) => setMapping({ ...mapping, etapa: Number(val) })}
                          >
                            <SelectTrigger id="catalog-map-stage">
                              <SelectValue placeholder="Nenhum" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-1">— Nenhum —</SelectItem>
                              {headers.map((h, idx) => (
                                <SelectItem key={idx} value={String(idx)}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setParsedRows([]);
                setImportCatalogOpen(false);
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            {parsedRows.length > 0 && (
              <Button
                onClick={runCatalogImport}
                disabled={isImporting}
                id="btn-confirm-import-catalogo"
              >
                {isImporting ? "Processando..." : "Importar Catálogo"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Manual Item dialog inner Component
interface ManualItemDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingItem: OrcamentoItemRow | null;
  onSave: (vals: OrcamentoItemFormValues) => void;
  isSubmitting: boolean;
}

function ManualItemFormDialog({
  open,
  onOpenChange,
  editingItem,
  onSave,
  isSubmitting,
}: ManualItemDialogProps) {
  const form = useForm<any>({
    resolver: zodResolver(orcamentoItemSchema) as any,
    defaultValues: {
      codigo: "",
      descricao: "",
      unidade: "un",
      quantidade: 1,
      valor_unitario: 0,
      fonte_referencia: "proprio",
      etapa: "Geral",
    },
  });

  // Sync edits
  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          codigo: editingItem.codigo ?? "",
          descricao: editingItem.descricao,
          unidade: editingItem.unidade,
          quantidade: Number(editingItem.quantidade),
          valor_unitario: editingItem.valor_unitario / 100,
          fonte_referencia: (editingItem.fonte_referencia as any) || "proprio",
          referencia_id: editingItem.referencia_id ?? null,
          tipo_referencia: editingItem.tipo_referencia ?? null,
          referencia_uf: editingItem.referencia_uf ?? null,
          referencia_mes: editingItem.referencia_mes ?? null,
          etapa: editingItem.etapa || "Geral",
        });
      } else {
        form.reset({
          codigo: "",
          descricao: "",
          unidade: "un",
          quantidade: 1,
          valor_unitario: 0,
          fonte_referencia: "proprio",
          referencia_id: null,
          tipo_referencia: null,
          referencia_uf: null,
          referencia_mes: null,
          etapa: "Geral",
        });
      }
    }
  }, [open, editingItem, form]);

  const sourceVal = form.watch("fonte_referencia");
  const codeVal = form.watch("codigo");

  // Autofill button triggered by source + code lookup
  const handleAutofillLookup = async () => {
    if (!codeVal) {
      toast.error("Insira o código de referência");
      return;
    }
    if (sourceVal === "proprio") {
      toast.error("Para buscar preço, selecione SINAPI ou SICRO");
      return;
    }

    try {
      toast.loading("Buscando dados no catálogo...", { id: "lookup" });
      const table = sourceVal === "sinapi" ? "referencia_insumos" : "referencia_insumos"; // fallback or check composicoes too
      
      // Check in insumos
      let { data, error } = await supabase
        .from("referencia_insumos")
        .select("*")
        .eq("fonte", sourceVal)
        .eq("codigo", codeVal.trim())
        .limit(1)
        .maybeSingle();

      // If not found in insumos, check composicoes
      if (!data && !error) {
        const { data: compData, error: compErr } = await supabase
          .from("referencia_composicoes")
          .select("*")
          .eq("fonte", sourceVal)
          .eq("codigo", codeVal.trim())
          .limit(1)
          .maybeSingle();
        
        error = compErr;
        if (compData) {
          data = {
            id: compData.id,
            descricao: compData.descricao,
            unidade: compData.unidade,
            preco_mediano: compData.custo_total
          } as any;
        }
      }

      if (error) throw error;

      if (data) {
        form.setValue("descricao", data.descricao);
        form.setValue("unidade", data.unidade);
        form.setValue("valor_unitario", Number(data.preco_mediano) / 100);
        toast.success("Preço preenchido do catálogo público!", { id: "lookup" });
      } else {
        toast.error("Código não encontrado neste catálogo público", { id: "lookup" });
      }
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`, { id: "lookup" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Item de Custo" : "Adicionar Item de Custo"}</DialogTitle>
          <DialogDescription>
            Insira os dados do insumo ou serviço próprio, ou preencha usando um código SINAPI/SICRO.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Fonte Referencia */}
              <FormField
                control={form.control}
                name="fonte_referencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonte de Referência</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="manual-item-source">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="proprio">Próprio (Customizado)</SelectItem>
                        <SelectItem value="sinapi">SINAPI (Caixa)</SelectItem>
                        <SelectItem value="sicro">SICRO (DNIT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Código */}
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex justify-between items-center">
                      Código
                      {sourceVal !== "proprio" && (
                        <button
                          type="button"
                          onClick={handleAutofillLookup}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
                          id="btn-autofill-lookup"
                        >
                          <RefreshCw className="size-2.5" />
                          Buscar Preço
                        </button>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 88243" {...field} id="manual-item-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descricao */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Insumo/Serviço *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: AJUDANTE DE CARPINTEIRO COM ENCARGOS COMPLEMENTARES" {...field} id="manual-item-desc" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              {/* Unidade */}
              <FormField
                control={form.control}
                name="unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: H, m3, un" {...field} id="manual-item-und" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantidade */}
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" min={0.0001} {...field} id="manual-item-qty" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preço Unitário */}
              <FormField
                control={form.control}
                name="valor_unitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Unitário (R$) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min={0} {...field} id="manual-item-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Etapa */}
            <FormField
              control={form.control}
              name="etapa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa / Fase da Obra *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Fundação, Alvenaria, Acabamento" {...field} id="manual-item-stage" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} id="btn-save-manual-item">
                {isSubmitting ? "Salvando..." : "Salvar Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
