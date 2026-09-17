import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { 
  Receipt, Plus, Search, FileText, Download, Eye, AlertCircle, 
  Loader2, CheckCircle2, ShieldCheck, Settings, Landmark, RefreshCw 
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { canAccess } from "@/lib/permissions";
import { uploadR2, getR2Url } from "@/lib/r2";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/fiscal")({
  component: FiscalPage,
});

// Zod Form Schemas
const emissaoFormSchema = z.object({
  obra_id: z.string().uuid("Selecione uma obra"),
  cliente_id: z.string().uuid("Selecione um cliente"),
  tipo: z.enum(["nfe", "nfse"]),
  valor_total: z.coerce.number().min(0.01, "Valor total deve ser maior que zero"),
  descricao: z.string().min(5, "Descrição do serviço/produto é muito curta"),
  cfop: z.string().regex(/^\d{4}$/, "CFOP deve conter exatamente 4 dígitos numéricos").default("5933"),
  cst: z.string().regex(/^\d{2,3}$/, "CST/CSOSN inválido").default("102"),
  iss_percent: z.coerce.number().min(0).max(100).default(5),
  icms_percent: z.coerce.number().min(0).max(100).default(0),
  pis_percent: z.coerce.number().min(0).max(100).default(0.65),
  cofins_percent: z.coerce.number().min(0).max(100).default(3),
});

const certFormSchema = z.object({
  password: z.string().min(1, "A senha do certificado é obrigatória"),
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

const STATUS_LABELS = {
  pendente: "Pendente",
  autorizada: "Autorizada (SEFAZ)",
  cancelada: "Cancelada",
  rejeitada: "Rejeitada",
};

const STATUS_COLORS = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  autorizada: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelada: "bg-slate-50 text-slate-700 border-slate-200",
  rejeitada: "bg-red-50 text-red-700 border-red-200",
};

function FiscalPage() {
  const { perfil, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && perfil && !canAccess(perfil.perfil, "fiscal")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, perfil, navigate]);

  const [activeTab, setActiveTab] = useState("emitidas");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialog triggers
  const [emissaoDialogOpen, setEmissaoDialogOpen] = useState(false);
  const [selectedFaturamento, setSelectedFaturamento] = useState<any | null>(null);
  
  // Tax settings (saved in LocalStorage)
  const [issDefault, setIssDefault] = useState(5);
  const [icmsDefault, setIcmsDefault] = useState(0);
  const [pisDefault, setPisDefault] = useState(0.65);
  const [cofinsDefault, setCofinsDefault] = useState(3);
  
  // Certificate status (saved in LocalStorage)
  const [certActive, setCertActive] = useState(false);
  const [certName, setCertName] = useState("");
  const [certExpDate, setCertExpDate] = useState("");
  const [certDialogOpen, setCertDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIssDefault(Number(localStorage.getItem("fiscal_iss") || "5"));
      setIcmsDefault(Number(localStorage.getItem("fiscal_icms") || "0"));
      setPisDefault(Number(localStorage.getItem("fiscal_pis") || "0.65"));
      setCofinsDefault(Number(localStorage.getItem("fiscal_cofins") || "3"));
      
      setCertActive(localStorage.getItem("fiscal_cert_active") === "true");
      setCertName(localStorage.getItem("fiscal_cert_name") || "");
      setCertExpDate(localStorage.getItem("fiscal_cert_exp") || "");
    }
  }, []);

  // Queries
  const { data: notasFiscais, isLoading: loadingNotas } = useQuery({
    queryKey: ["notas_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais" as any)
        .select("*, obras(nome), clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: obras } = useQuery({
    queryKey: ["obras-faturamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras" as any)
        .select("*, clientes(nome, cpf_cnpj, email)")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: medicoes } = useQuery({
    queryKey: ["medicoes-faturamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicoes" as any)
        .select("*, obras(nome, cliente_id, clientes(nome, cpf_cnpj, email))")
        .eq("status", "aprovada")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Filtered invoices list
  const filteredNotas = useMemo(() => {
    if (!notasFiscais) return [];
    return notasFiscais.filter((n) => {
      const matchStatus = statusFilter === "all" || n.status === statusFilter;
      const matchSearch = 
        !searchQuery ||
        n.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.clientes?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.chave_acesso && n.chave_acesso.includes(searchQuery));
      return matchStatus && matchSearch;
    });
  }, [notasFiscais, searchQuery, statusFilter]);

  // Form setup
  const emissaoForm = useForm<any>({
    resolver: zodResolver(emissaoFormSchema),
    defaultValues: {
      obra_id: "",
      cliente_id: "",
      tipo: "nfse",
      valor_total: 0,
      descricao: "",
      cfop: "5933",
      cst: "102",
      iss_percent: 5,
      icms_percent: 0,
      pis_percent: 0.65,
      cofins_percent: 3,
    },
  });

  const certForm = useForm<any>({
    resolver: zodResolver(certFormSchema),
    defaultValues: {
      password: "",
    },
  });

  const handleOpenEmissao = (fat: any, isMedicao = false) => {
    setSelectedFaturamento({ fat, isMedicao });
    
    const isService = isMedicao || fat.tipo === "servico";
    emissaoForm.reset({
      obra_id: isMedicao ? fat.obra_id : fat.id,
      cliente_id: isMedicao ? fat.obras?.cliente_id : fat.cliente_id,
      tipo: isService ? "nfse" : "nfe",
      valor_total: isMedicao ? Number(fat.valor_total || 0) / 100 : Number(fat.valor_total || 0),
      descricao: isMedicao 
        ? `Faturamento ref. Medição de Obra aprovada para o projeto ${fat.obras?.nome}.`
        : `Faturamento ref. Contrato ${fat.numero} - ${fat.titulo}.`,
      cfop: isService ? "5933" : "5102",
      cst: isService ? "00" : "102",
      iss_percent: issDefault,
      icms_percent: icmsDefault,
      pis_percent: pisDefault,
      cofins_percent: cofinsDefault,
    });
    
    setEmissaoDialogOpen(true);
  };

  // Mutations
  const emissaoMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emissaoFormSchema>) => {
      if (!certActive) {
        throw new Error("Certificado Digital A1 não está ativo. Configure um certificado antes de emitir.");
      }

      const valueCentavos = Math.round(values.valor_total * 100);
      const isErrorCase = values.descricao.toLowerCase().includes("rejeitar");
      
      const invoiceNumber = String(Math.floor(100000 + Math.random() * 900000));
      const invoiceSerie = "001";
      const chaveAcesso = values.tipo === "nfe" 
        ? Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join("")
        : null;

      // 1. Insert nota_fiscal as PENDENTE
      const { data: nota, error: insertError } = await supabase
        .from("notas_fiscais" as any)
        .insert({
          obra_id: values.obra_id,
          cliente_id: values.cliente_id,
          numero: invoiceNumber,
          serie: invoiceSerie,
          tipo: values.tipo,
          chave_acesso: chaveAcesso,
          status: "pendente",
          valor_total: valueCentavos,
          xml_url: null,
          pdf_url: null,
          mensagem_sefaz: "Enviando lote para processamento na SEFAZ/Prefeitura...",
          emitido_em: null,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;

      // Simulate network processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (isErrorCase) {
        // Update to REJEITADA
        const { error: errorUpdate } = await supabase
          .from("notas_fiscais" as any)
          .update({
            status: "rejeitada",
            mensagem_sefaz: "Rejeição: Falha de validação cadastral do destinatário (inscrição estadual inválida).",
          })
          .eq("id", (nota as any).id);
        if (errorUpdate) throw errorUpdate;
        throw new Error("Rejeitado pela SEFAZ: Verifique os dados cadastrais.");
      }

      // Generate dummy XML and PDF files
      const xmlFilename = `${invoiceNumber}.xml`;
      const pdfFilename = `${invoiceNumber}.pdf`;

      const dummyXml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFeId="NFe${chaveAcesso || invoiceNumber}"><ide><cNF>${invoiceNumber}</cNF><mod>${values.tipo === "nfe" ? 55 : 0}</mod><serie>${invoiceSerie}</serie><nNF>${invoiceNumber}</nNF><dhEmi>${new Date().toISOString()}</dhEmi><tpNF>1</tpNF><dest><xNome>Cliente Faturado</xNome></dest><det><prod><xProd>${values.descricao}</xProd><vProd>${values.valor_total}</vProd><CFOP>${values.cfop}</CFOP><CST>${values.cst}</CST></prod></det><total><ICMS><vNF>${values.valor_total}</vNF></ICMS></total></infNFe></NFe></nfeProc>`;
      const dummyPdf = `Simulated Invoice DANFE Document\nNúmero: ${invoiceNumber}\nSérie: ${invoiceSerie}\nCliente: ${values.cliente_id}\nValor: R$ ${values.valor_total}\nDescrição: ${values.descricao}\nCFOP: ${values.cfop} | CST/CSOSN: ${values.cst}`;

      // Upload to R2
      const xmlBlob = new Blob([dummyXml], { type: "text/xml" });
      const pdfBlob = new Blob([dummyPdf], { type: "text/plain" });
      const xmlKey = await uploadR2(new File([xmlBlob], xmlFilename, { type: "text/xml" }), "fiscal/xmls", `fiscal/xmls/${xmlFilename}`);
      const pdfKey = await uploadR2(new File([pdfBlob], pdfFilename, { type: "text/plain" }), "fiscal/pdfs", `fiscal/pdfs/${pdfFilename}`);

      // Get public URLs
      const xmlUrl = getR2Url(xmlKey);
      const pdfUrl = getR2Url(pdfKey);

      // 2. Update status to AUTORIZADA
      const { error: successUpdate } = await supabase
        .from("notas_fiscais" as any)
        .update({
          status: "autorizada",
          xml_url: xmlUrl,
          pdf_url: pdfUrl,
          mensagem_sefaz: `Autorizado o uso da NF-e / NFS-e (CFOP: ${values.cfop}, CST: ${values.cst})`,
          emitido_em: new Date().toISOString(),
        })
        .eq("id", (nota as any).id);

      if (successUpdate) throw successUpdate;

      // 3. Create Contas a Receber record for this billing, marked directly as received (Baixa automática do contas a receber)
      const today = new Date();
      await supabase
        .from("contas_receber" as any)
        .insert({
          obra_id: values.obra_id,
          cliente_id: values.cliente_id,
          descricao: `Faturamento - Nota Fiscal Nº ${invoiceNumber}`,
          valor_total: valueCentavos,
          data_vencimento: today.toISOString().split("T")[0],
          status: "recebida",
          data_recebimento: today.toISOString().split("T")[0],
          valor_recebido: valueCentavos,
        });
    },
    onSuccess: () => {
      toast.success("Nota Fiscal emitida e autorizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["medicoes-faturamento"] });
      setEmissaoDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (nota: any) => {
      // Set to cancelada
      const { error } = await supabase
        .from("notas_fiscais" as any)
        .update({
          status: "cancelada",
          mensagem_sefaz: "NF-e Cancelada com homologação da SEFAZ.",
        })
        .eq("id", nota.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota Fiscal cancelada com sucesso!");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
    onError: (err: any) => toast.error("Falha ao cancelar: " + err.message),
  });

  // Handle cert configuration
  const handleCertSubmit = (values: z.infer<typeof certFormSchema>) => {
    const fakeExp = new Date();
    fakeExp.setFullYear(fakeExp.getFullYear() + 1);

    localStorage.setItem("fiscal_cert_active", "true");
    localStorage.setItem("fiscal_cert_name", "CERTIFICADO DIGITAL DE TESTE ME LTDA");
    localStorage.setItem("fiscal_cert_exp", fakeExp.toLocaleDateString("pt-BR"));
    
    setCertActive(true);
    setCertName("CERTIFICADO DIGITAL DE TESTE ME LTDA");
    setCertExpDate(fakeExp.toLocaleDateString("pt-BR"));

    toast.success("Certificado Digital A1 instalado com sucesso!");
    setCertDialogOpen(false);
  };

  const handleRemoveCert = () => {
    localStorage.removeItem("fiscal_cert_active");
    localStorage.removeItem("fiscal_cert_name");
    localStorage.removeItem("fiscal_cert_exp");
    
    setCertActive(false);
    setCertName("");
    setCertExpDate("");
    
    toast.info("Certificado Digital removido.");
  };

  const handleSaveTaxes = () => {
    localStorage.setItem("fiscal_iss", String(issDefault));
    localStorage.setItem("fiscal_icms", String(icmsDefault));
    localStorage.setItem("fiscal_pis", String(pisDefault));
    localStorage.setItem("fiscal_cofins", String(cofinsDefault));
    toast.success("Alíquotas padrão atualizadas.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Faturamento & Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere notas fiscais eletrônicas de produtos (NF-e) ou serviços (NFS-e) integradas ao financeiro.
          </p>
        </div>
        {!certActive && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1.5 py-1 px-2.5">
            <AlertCircle className="size-3.5" /> Certificado Não Configurado
          </Badge>
        )}
        {certActive && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-2.5">
            <ShieldCheck className="size-3.5" /> Certificado A1 Ativo
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="emitidas" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border">
          <TabsTrigger value="emitidas">Notas Emitidas</TabsTrigger>
          <TabsTrigger value="faturamento">Balanço de Faturamento</TabsTrigger>
          <TabsTrigger value="config">Configuração Fiscal</TabsTrigger>
        </TabsList>

        {/* Tab 1: Notas Emitidas */}
        <TabsContent value="emitidas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por número da nota ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-slate-50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="autorizada">Autorizada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="rejeitada">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              {loadingNotas ? (
                <div className="flex justify-center py-10"><Loader2 className="size-8 animate-spin text-primary" /></div>
              ) : filteredNotas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Nenhuma nota fiscal localizada</p>
                  <p className="text-xs mt-1">Gere notas fiscais a partir da aba de Faturamento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Número / Série</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotas.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-semibold text-slate-700 font-mono">
                            Nº {n.numero} · Série {n.serie}
                          </TableCell>
                          <TableCell className="text-sm">
                            {n.emitido_em ? format(parseISO(n.emitido_em), "dd/MM/yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{n.clientes?.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{n.obras?.nome || "Uso Geral"}</TableCell>
                          <TableCell className="text-xs font-semibold capitalize font-mono">
                            {n.tipo === "nfe" ? "NF-e (Produtos)" : "NFS-e (Serviços)"}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono">{formatCurrency(n.valor_total / 100)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[n.status as keyof typeof STATUS_COLORS]}>
                              {STATUS_LABELS[n.status as keyof typeof STATUS_LABELS] || n.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {n.pdf_url ? (
                                <a href={n.pdf_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="size-8" title="Download DANFE (PDF)">
                                    <Download className="size-3.5" />
                                  </Button>
                                </a>
                              ) : (
                                <Button variant="ghost" size="icon" className="size-8" disabled>
                                  <Download className="size-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {n.xml_url ? (
                                <a href={n.xml_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="size-8" title="Download XML">
                                    <FileText className="size-3.5 text-slate-500" />
                                  </Button>
                                </a>
                              ) : (
                                <Button variant="ghost" size="icon" className="size-8" disabled>
                                  <FileText className="size-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {n.status === "autorizada" && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => cancelMutation.mutate(n)}
                                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Faturamento */}
        <TabsContent value="faturamento" className="space-y-6">
          {/* Section: Medições faturáveis */}
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Medições de Obra Aprovadas (Faturáveis)</CardTitle>
              <CardDescription>Lista de medições de campo que já foram homologadas e aguardam faturamento fiscal.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!medicoes || medicoes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Não há medições aprovadas prontas para faturamento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Cliente Destino</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor Homologado</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicoes.map((med) => (
                        <TableRow key={med.id}>
                          <TableCell className="font-semibold text-slate-700 font-mono text-xs">MED-{med.id.slice(0, 8).toUpperCase()}</TableCell>
                          <TableCell className="font-medium text-slate-700">{med.obras?.nome}</TableCell>
                          <TableCell className="text-sm">{med.obras?.clientes?.nome || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {med.data_inicio ? format(parseISO(med.data_inicio), "dd/MM/yyyy") : ""} 
                            {med.data_fim ? ` a ${format(parseISO(med.data_fim), "dd/MM/yyyy")}` : ""}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono text-emerald-600">{formatCurrency(med.valor_total / 100)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleOpenEmissao(med, true)} className="h-8 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                              Emitir Nota
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Contratos faturáveis */}
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Obras e Contratos Ativos (Faturamento Avulso)</CardTitle>
              <CardDescription>Gere faturamentos gerais e parciais a partir do valor contratado das obras ativas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!obras || obras.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Não há obras ativas no sistema.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Código da Obra</TableHead>
                        <TableHead>Nome do Projeto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor do Contrato</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {obras.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-semibold text-slate-700 font-mono text-xs">{o.numero}</TableCell>
                          <TableCell className="font-medium text-slate-700">{o.nome}</TableCell>
                          <TableCell className="text-sm">{o.clientes?.nome || "—"}</TableCell>
                          <TableCell className="text-right font-semibold font-mono">{formatCurrency(Number(o.valor_contratado || 0))}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleOpenEmissao(o, false)} className="h-8">
                              Faturamento Avulso
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Configuração */}
        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Certificado digital card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800">Certificado Digital A1</CardTitle>
                <CardDescription>Necessário para assinar os lotes de NF-e e NFS-e enviados para a SEFAZ/Prefeitura.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {certActive ? (
                  <div className="border border-emerald-100 bg-emerald-50/50 rounded-lg p-4 flex items-start gap-3">
                    <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-emerald-900">{certName}</div>
                      <div className="text-xs text-emerald-700">Vencimento: {certExpDate}</div>
                      <Button variant="outline" size="sm" onClick={handleRemoveCert} className="mt-2 text-xs border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50">
                        Desinstalar Certificado
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3">
                    <ShieldCheck className="size-8 text-slate-300 mx-auto" />
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Nenhum Certificado Digital Instalado</div>
                      <p className="text-xs text-muted-foreground mt-1">Carregue um arquivo .pfx para ativar as emissões fiscais.</p>
                    </div>
                    <Button size="sm" onClick={() => setCertDialogOpen(true)}>Configurar Certificado</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Impostos padrao card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800">Alíquotas e Tributações Padrão</CardTitle>
                <CardDescription>Determine as alíquotas padrão que serão sugeridas ao preencher novas notas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="iss">ISS (%) - Serviços</Label>
                    <Input id="iss" type="number" step="0.01" value={issDefault} onChange={(e) => setIssDefault(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="icms">ICMS (%) - Vendas</Label>
                    <Input id="icms" type="number" step="0.01" value={icmsDefault} onChange={(e) => setIcmsDefault(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pis">PIS (%)</Label>
                    <Input id="pis" type="number" step="0.001" value={pisDefault} onChange={(e) => setPisDefault(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cofins">COFINS (%)</Label>
                    <Input id="cofins" type="number" step="0.01" value={cofinsDefault} onChange={(e) => setCofinsDefault(Number(e.target.value))} />
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveTaxes} className="mt-2">Salvar Configurações</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: EMISSÃO FISCAL */}
      <Dialog open={emissaoDialogOpen} onOpenChange={setEmissaoDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transmitir Nota Fiscal Eletrônica</DialogTitle>
            <DialogDescription>
              Valide as alíquotas fiscais e confirme o faturamento junto à SEFAZ/Prefeitura.
            </DialogDescription>
          </DialogHeader>
          <Form {...emissaoForm}>
            <form onSubmit={emissaoForm.handleSubmit((v) => emissaoMutation.mutate(v))} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={emissaoForm.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Faturamento *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="nfse">NFS-e (Nota de Serviços)</SelectItem>
                        <SelectItem value="nfe">NF-e (Nota de Produtos/Materiais)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={emissaoForm.control} name="valor_total" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Bruto do Faturamento (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={emissaoForm.control} name="descricao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Faturamento (Dados Adicionais) *</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Escreva 'rejeitar' para testar o fluxo de erro da SEFAZ..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <FormField control={emissaoForm.control} name="cfop" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-slate-700">CFOP *</FormLabel>
                      <FormControl><Input placeholder="5933" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={emissaoForm.control} name="cst" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-slate-700">CST / CSOSN *</FormLabel>
                      <FormControl><Input placeholder="102" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Cálculo de Impostos Estimado</h4>
                <div className="grid grid-cols-4 gap-3">
                  <FormField control={emissaoForm.control} name="iss_percent" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">ISS (%)</FormLabel>
                      <FormControl><Input type="number" step="0.01" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={emissaoForm.control} name="icms_percent" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">ICMS (%)</FormLabel>
                      <FormControl><Input type="number" step="0.01" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={emissaoForm.control} name="pis_percent" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">PIS (%)</FormLabel>
                      <FormControl><Input type="number" step="0.001" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={emissaoForm.control} name="cofins_percent" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">COFINS (%)</FormLabel>
                      <FormControl><Input type="number" step="0.01" className="h-8 text-xs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" type="button" onClick={() => setEmissaoDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={emissaoMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white">
                  {emissaoMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  Transmitir Nota Fiscal
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIGURAR CERTIFICADO */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar Certificado A1 (.pfx)</DialogTitle>
            <DialogDescription>
              Carregue o arquivo de certificado e insira a senha para autenticar o uso.
            </DialogDescription>
          </DialogHeader>
          <Form {...certForm}>
            <form onSubmit={certForm.handleSubmit(handleCertSubmit)} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cert-file">Arquivo do Certificado (.pfx / .p12) *</Label>
                <Input id="cert-file" type="file" accept=".pfx,.p12" required className="cursor-pointer" />
              </div>

              <FormField control={certForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha do Certificado *</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCertDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Instalar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
