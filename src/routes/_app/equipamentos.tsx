import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { 
  Wrench, Plus, Search, Pencil, Trash2, Calendar, DollarSign, 
  MapPin, Settings, Fuel, AlertCircle, Loader2, Link as LinkIcon 
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/equipamentos")({
  component: EquipamentosPage,
});

// Zod validation schemas
const equipamentoFormSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  tipo: z.string().min(2, "Selecione ou digite um tipo"),
  marca: z.string().min(2, "Marca é obrigatória"),
  modelo: z.string().min(2, "Modelo é obrigatório"),
  numero_serie: z.string().optional(),
  placa: z.string().optional(),
  data_aquisicao: z.string().min(1, "Data de aquisição é obrigatória"),
  valor_aquisicao: z.coerce.number().min(0).optional(),
  custo_hora: z.coerce.number().min(0, "Custo hora deve ser maior ou igual a zero"),
  status: z.enum(["disponivel", "alocado", "manutencao", "inativo"]),
});

const alocacaoFormSchema = z.object({
  equipamento_id: z.string().uuid("Selecione um equipamento"),
  obra_id: z.string().uuid("Selecione uma obra"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().optional(),
  custo_hora_efetivo: z.coerce.number().min(0, "Custo/hora deve ser positivo"),
  observacoes: z.string().optional(),
});

const manutencaoFormSchema = z.object({
  equipamento_id: z.string().uuid("Selecione um equipamento"),
  tipo: z.enum(["preventiva", "corretiva"]),
  descricao: z.string().min(3, "Descrição muito curta"),
  data: z.string().min(1, "Data é obrigatória"),
  custo: z.coerce.number().min(0, "Custo deve ser maior ou igual a zero"),
  realizado_por: z.string().optional(),
});

const custoFormSchema = z.object({
  equipamento_id: z.string().uuid("Selecione um equipamento"),
  obra_id: z.string().uuid().optional().or(z.literal("")),
  data: z.string().min(1, "Data é obrigatória"),
  tipo_custo: z.enum(["combustivel", "seguro", "pecas", "outros"]),
  descricao: z.string().optional(),
  quantidade: z.coerce.number().min(0).optional(),
  valor_total: z.coerce.number().min(0.01, "Valor total deve ser maior que zero"),
});

// Format numbers
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

const formatDecimal = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(val);
};

const STATUS_LABELS = {
  disponivel: "Disponível",
  alocado: "Alocado",
  manutencao: "Em Manutenção",
  inativo: "Inativo",
};

const STATUS_COLORS = {
  disponivel: "bg-emerald-50 text-emerald-700 border-emerald-200",
  alocado: "bg-blue-50 text-blue-700 border-blue-200",
  manutencao: "bg-amber-50 text-amber-700 border-amber-200",
  inativo: "bg-slate-50 text-slate-700 border-slate-200",
};

function EquipamentosPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEscrever = 
    perfil?.perfil === "admin" || 
    perfil?.perfil === "engenharia" || 
    perfil?.perfil === "almoxarifado";

  const [activeTab, setActiveTab] = useState("inventario");

  // State dialog triggers
  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [eqEditTarget, setEqEditTarget] = useState<any | null>(null);
  const [eqDeleteTarget, setEqDeleteTarget] = useState<any | null>(null);

  const [alocDialogOpen, setAlocDialogOpen] = useState(false);
  const [manutDialogOpen, setManutDialogOpen] = useState(false);
  const [custoDialogOpen, setCustoDialogOpen] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const { data: equipamentos, isLoading: loadingEq } = useQuery({
    queryKey: ["equipamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: obras } = useQuery({
    queryKey: ["obras-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras" as any)
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: alocacoes, isLoading: loadingAloc } = useQuery({
    queryKey: ["equipamentos_alocacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_alocacoes" as any)
        .select("*, equipamentos(nome, marca, modelo), obras(nome)")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: manutencoes, isLoading: loadingManut } = useQuery({
    queryKey: ["equipamentos_manutencoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_manutencoes" as any)
        .select("*, equipamentos(nome, marca, modelo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: custos, isLoading: loadingCustos } = useQuery({
    queryKey: ["equipamentos_custos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_custos" as any)
        .select("*, equipamentos(nome, marca, modelo), obras(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Filtered equipments list
  const filteredEquipamentos = useMemo(() => {
    if (!equipamentos) return [];
    return queryFilter(equipamentos, searchQuery);
  }, [equipamentos, searchQuery]);

  function queryFilter(items: any[], q: string) {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((item) => 
      item.nome.toLowerCase().includes(s) || 
      item.marca.toLowerCase().includes(s) || 
      item.modelo.toLowerCase().includes(s) || 
      (item.placa && item.placa.toLowerCase().includes(s))
    );
  }

  // Forms
  const eqForm = useForm<z.infer<typeof equipamentoFormSchema>>({
    resolver: zodResolver(equipamentoFormSchema),
    defaultValues: {
      nome: "",
      tipo: "Máquina",
      marca: "",
      modelo: "",
      numero_serie: "",
      placa: "",
      data_aquisicao: new Date().toISOString().split("T")[0],
      valor_aquisicao: 0,
      custo_hora: 0,
      status: "disponivel",
    },
  });

  const alocForm = useForm<z.infer<typeof alocacaoFormSchema>>({
    resolver: zodResolver(alocacaoFormSchema),
    defaultValues: {
      equipamento_id: "",
      obra_id: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: "",
      custo_hora_efetivo: 0,
      observacoes: "",
    },
  });

  const manutForm = useForm<z.infer<typeof manutencaoFormSchema>>({
    resolver: zodResolver(manutencaoFormSchema),
    defaultValues: {
      equipamento_id: "",
      tipo: "preventiva",
      descricao: "",
      data: new Date().toISOString().split("T")[0],
      custo: 0,
      realizado_por: "",
    },
  });

  const custoForm = useForm<z.infer<typeof custoFormSchema>>({
    resolver: zodResolver(custoFormSchema),
    defaultValues: {
      equipamento_id: "",
      obra_id: "",
      data: new Date().toISOString().split("T")[0],
      tipo_custo: "combustivel",
      descricao: "",
      quantidade: 0,
      valor_total: 0,
    },
  });

  // Watch for equipment selection to autofill values
  const watchedEqId = alocForm.watch("equipamento_id");
  useEffect(() => {
    if (watchedEqId && equipamentos) {
      const selected = equipamentos.find((e: any) => e.id === watchedEqId);
      if (selected) {
        alocForm.setValue("custo_hora_efetivo", selected.custo_hora);
      }
    }
  }, [watchedEqId, equipamentos, alocForm]);

  // Open Edit Dialog
  const handleEdit = (eq: any) => {
    setEqEditTarget(eq);
    eqForm.reset({
      nome: eq.nome,
      tipo: eq.tipo,
      marca: eq.marca,
      modelo: eq.modelo,
      numero_serie: eq.numero_serie || "",
      placa: eq.placa || "",
      data_aquisicao: eq.data_aquisicao,
      valor_aquisicao: eq.valor_aquisicao || 0,
      custo_hora: eq.custo_hora || 0,
      status: eq.status,
    });
    setEqDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEqEditTarget(null);
    eqForm.reset({
      nome: "",
      tipo: "Máquina",
      marca: "",
      modelo: "",
      numero_serie: "",
      placa: "",
      data_aquisicao: new Date().toISOString().split("T")[0],
      valor_aquisicao: 0,
      custo_hora: 0,
      status: "disponivel",
    });
    setEqDialogOpen(true);
  };

  // Mutations
  const eqMutation = useMutation({
    mutationFn: async (values: z.infer<typeof equipamentoFormSchema>) => {
      const payload = {
        ...values,
        numero_serie: values.numero_serie || null,
        placa: values.placa || null,
        valor_aquisicao: values.valor_aquisicao || null,
      };

      if (eqEditTarget) {
        const { error } = await supabase
          .from("equipamentos" as any)
          .update(payload)
          .eq("id", eqEditTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("equipamentos" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(eqEditTarget ? "Equipamento atualizado" : "Equipamento cadastrado");
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      setEqDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("equipamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipamento excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      setEqDeleteTarget(null);
    },
    onError: (err: any) => toast.error("Falha ao excluir: " + err.message),
  });

  const alocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof alocacaoFormSchema>) => {
      const { error: insertError } = await supabase
        .from("equipamentos_alocacoes" as any)
        .insert({
          ...values,
          data_fim: values.data_fim || null,
          observacoes: values.observacoes || null,
        });
      if (insertError) throw insertError;

      // Update equipment status to alocado
      const { error: updateError } = await supabase
        .from("equipamentos" as any)
        .update({ status: "alocado" })
        .eq("id", values.equipamento_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Alocação realizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["equipamentos_alocacoes"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      setAlocDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const finalizaAlocMutation = useMutation({
    mutationFn: async (aloc: any) => {
      const today = new Date().toISOString().split("T")[0];
      
      const { error: updateAlocError } = await supabase
        .from("equipamentos_alocacoes" as any)
        .update({ data_fim: today })
        .eq("id", aloc.id);
      if (updateAlocError) throw updateAlocError;

      const { error: updateEqError } = await supabase
        .from("equipamentos" as any)
        .update({ status: "disponivel" })
        .eq("id", aloc.equipamento_id);
      if (updateEqError) throw updateEqError;
    },
    onSuccess: () => {
      toast.success("Alocação finalizada!");
      qc.invalidateQueries({ queryKey: ["equipamentos_alocacoes"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const manutMutation = useMutation({
    mutationFn: async (values: z.infer<typeof manutencaoFormSchema>) => {
      const { error: insertError } = await supabase
        .from("equipamentos_manutencoes" as any)
        .insert({
          ...values,
          realizado_por: values.realizado_por || null,
        });
      if (insertError) throw insertError;

      // Update status to manutencao
      const { error: updateError } = await supabase
        .from("equipamentos" as any)
        .update({ status: "manutencao" })
        .eq("id", values.equipamento_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Manutenção agendada com sucesso!");
      qc.invalidateQueries({ queryKey: ["equipamentos_manutencoes"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      setManutDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const finalizaManutMutation = useMutation({
    mutationFn: async (eqId: string) => {
      const { error } = await supabase
        .from("equipamentos" as any)
        .update({ status: "disponivel" })
        .eq("id", eqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manutenção concluída, equipamento disponível!");
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const custoMutation = useMutation({
    mutationFn: async (values: z.infer<typeof custoFormSchema>) => {
      const { error } = await supabase
        .from("equipamentos_custos" as any)
        .insert({
          ...values,
          obra_id: values.obra_id || null,
          descricao: values.descricao || null,
          quantidade: values.quantidade || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custo operacional lançado!");
      qc.invalidateQueries({ queryKey: ["equipamentos_custos"] });
      setCustoDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Calculate metrics
  const totalEquipamentos = filteredEquipamentos.length;
  const emUso = filteredEquipamentos.filter(e => e.status === "alocado").length;
  const emManutencao = filteredEquipamentos.filter(e => e.status === "manutencao").length;
  const totalCustoManutencao = useMemo(() => {
    if (!manutencoes) return 0;
    return manutencoes.reduce((acc, m) => acc + (m.custo || 0), 0);
  }, [manutencoes]);

  const totalOutrosCustos = useMemo(() => {
    if (!custos) return 0;
    return custos.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  }, [custos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Controle de Equipamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o inventário de máquinas, veículos, ferramentas, alocações e custos associados.
          </p>
        </div>
        {podeEscrever && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreateNew} className="h-9">
              <Plus className="size-4 mr-2" /> Novo Equipamento
            </Button>
            <Button variant="outline" onClick={() => setAlocDialogOpen(true)} className="h-9">
              <LinkIcon className="size-4 mr-2" /> Alocar em Obra
            </Button>
            <Button variant="outline" onClick={() => setManutDialogOpen(true)} className="h-9">
              <Settings className="size-4 mr-2" /> Registrar Manutenção
            </Button>
            <Button variant="outline" onClick={() => setCustoDialogOpen(true)} className="h-9">
              <Fuel className="size-4 mr-2" /> Lançar Custo/Abastecimento
            </Button>
          </div>
        )}
      </div>

      {/* Metrics Card Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Equipamentos</CardTitle>
            <Wrench className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold">{totalEquipamentos}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Alocados em Obra</CardTitle>
            <MapPin className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-blue-600">{emUso}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Manutenção</CardTitle>
            <Settings className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-amber-600">{emManutencao}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Custos Acumulados</CardTitle>
            <DollarSign className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalCustoManutencao + totalOutrosCustos)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventario" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border">
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="alocacoes">Alocações</TabsTrigger>
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          <TabsTrigger value="custos">Custos & Abastecimentos</TabsTrigger>
        </TabsList>

        {/* Tab 1: Inventario */}
        <TabsContent value="inventario" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Frota e Ferramentas</CardTitle>
                <CardDescription>Lista completa de todos os equipamentos cadastrados no sistema.</CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome, placa, marca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs sm:text-sm bg-slate-50"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingEq ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : filteredEquipamentos.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Nenhum equipamento localizado</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie um novo equipamento ou altere a busca.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Marca/Modelo</TableHead>
                        <TableHead>Identificação</TableHead>
                        <TableHead className="text-right">Custo/Hora</TableHead>
                        <TableHead>Status</TableHead>
                        {podeEscrever && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEquipamentos.map((eq) => (
                        <TableRow key={eq.id}>
                          <TableCell className="font-semibold text-slate-700">{eq.nome}</TableCell>
                          <TableCell>{eq.tipo}</TableCell>
                          <TableCell>{eq.marca} · {eq.modelo}</TableCell>
                          <TableCell className="text-xs">
                            {eq.placa && <span className="block font-mono bg-slate-100 rounded px-1.5 py-0.5 border w-fit">Placa: {eq.placa}</span>}
                            {eq.numero_serie && <span className="block text-muted-foreground mt-0.5">S/N: {eq.numero_serie}</span>}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono">{formatCurrency(eq.custo_hora)}/h</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[eq.status as keyof typeof STATUS_COLORS]}>
                              {STATUS_LABELS[eq.status as keyof typeof STATUS_LABELS] || eq.status}
                            </Badge>
                          </TableCell>
                          {podeEscrever && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {eq.status === "manutencao" && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => finalizaManutMutation.mutate(eq.id)} 
                                    className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
                                  >
                                    Liberar
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(eq)} className="size-8">
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setEqDeleteTarget(eq)} className="size-8 text-destructive hover:bg-red-50">
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Alocacoes */}
        <TabsContent value="alocacoes" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Alocação de Equipamentos</CardTitle>
              <CardDescription>Rastreabilidade de qual maquinário está ou esteve alocado em cada projeto.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAloc ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : !alocacoes || alocacoes.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Nenhuma alocação registrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Obra Alocada</TableHead>
                        <TableHead>Data Início</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead className="text-right">Custo/Hora Efetivo</TableHead>
                        <TableHead>Observações</TableHead>
                        {podeEscrever && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alocacoes.map((aloc) => (
                        <TableRow key={aloc.id}>
                          <TableCell className="font-semibold text-slate-700">
                            {aloc.equipamentos?.nome}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {aloc.equipamentos?.marca} · {aloc.equipamentos?.modelo}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-blue-600">{aloc.obras?.nome}</TableCell>
                          <TableCell>{format(parseISO(aloc.data_inicio), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            {aloc.data_fim ? (
                              format(parseISO(aloc.data_fim), "dd/MM/yyyy")
                            ) : (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-semibold border-none">Ativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(aloc.custo_hora_efetivo)}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{aloc.observacoes || "—"}</TableCell>
                          {podeEscrever && (
                            <TableCell className="text-right">
                              {!aloc.data_fim && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => finalizaAlocMutation.mutate(aloc)} 
                                  className="h-8 text-xs"
                                >
                                  Retornar / Finalizar
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Manutencoes */}
        <TabsContent value="manutencoes" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Registros de Manutenção</CardTitle>
              <CardDescription>Controle de consertos, revisões preventivas e custos de manutenção.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingManut ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : !manutencoes || manutencoes.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Nenhum histórico de manutenção</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição / Escopo</TableHead>
                        <TableHead>Realizado Por</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manutencoes.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-semibold text-slate-700">
                            {m.equipamentos?.nome}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {m.equipamentos?.marca} · {m.equipamentos?.modelo}
                            </span>
                          </TableCell>
                          <TableCell>{format(parseISO(m.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={m.tipo === "preventiva" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                              {m.tipo === "preventiva" ? "Preventiva" : "Corretiva"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-xs">{m.descricao}</TableCell>
                          <TableCell className="text-sm">{m.realizado_por || "—"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-red-600">{formatCurrency(m.custo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Custos */}
        <TabsContent value="custos" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Despesas e Abastecimentos</CardTitle>
              <CardDescription>Acompanhamento de combustível (litros e custos), seguros e outras despesas associadas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCustos ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : !custos || custos.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Nenhum custo operacional lançado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo Custo</TableHead>
                        <TableHead>Destino / Obra</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd (Litros/etc)</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {custos.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold text-slate-700">
                            {c.equipamentos?.nome}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {c.equipamentos?.marca} · {c.equipamentos?.modelo}
                            </span>
                          </TableCell>
                          <TableCell>{format(parseISO(c.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {c.tipo_custo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-600">{c.obras?.nome || "Uso Geral / Administrativo"}</TableCell>
                          <TableCell className="text-xs max-w-xs">{c.descricao || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{c.quantidade ? formatDecimal(c.quantidade) : "—"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-red-600">{formatCurrency(c.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: Novo/Editar Equipamento */}
      <Dialog open={eqDialogOpen} onOpenChange={setEqDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{eqEditTarget ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para cadastrar no inventário.</DialogDescription>
          </DialogHeader>
          <Form {...eqForm}>
            <form onSubmit={eqForm.handleSubmit((v) => eqMutation.mutate(v))} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={eqForm.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Equipamento *</FormLabel>
                    <FormControl><Input placeholder="Ex: Mini Escavadeira CAT 302.7" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={eqForm.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Máquina">Máquina</SelectItem>
                        <SelectItem value="Veículo">Veículo</SelectItem>
                        <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={eqForm.control} name="marca" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl><Input placeholder="Ex: Caterpillar" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={eqForm.control} name="modelo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl><Input placeholder="Ex: 302.7 CR" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={eqForm.control} name="numero_serie" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Série / Chassi</FormLabel>
                    <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={eqForm.control} name="placa" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa (se houver)</FormLabel>
                    <FormControl><Input placeholder="ABC-1234" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={eqForm.control} name="data_aquisicao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Aquisição *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={eqForm.control} name="valor_aquisicao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de Compra (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={eqForm.control} name="custo_hora" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo de Alocação por Hora (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={eqForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status inicial *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="alocado">Alocado</SelectItem>
                        <SelectItem value="manutencao">Em Manutenção</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" type="button" onClick={() => setEqDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={eqMutation.isPending}>
                  {eqMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Alocar Equipamento */}
      <Dialog open={alocDialogOpen} onOpenChange={setAlocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alocar Equipamento em Obra</DialogTitle>
            <DialogDescription>Selecione a máquina e o projeto de destino para registrar o envio.</DialogDescription>
          </DialogHeader>
          <Form {...alocForm}>
            <form onSubmit={alocForm.handleSubmit((v) => alocMutation.mutate(v))} className="space-y-4 pt-2">
              <FormField control={alocForm.control} name="equipamento_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipamento Disponível *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione um equipamento" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {equipamentos?.filter(e => e.status === "disponivel").map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome} ({e.marca} · {e.modelo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={alocForm.control} name="obra_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra de Destino *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {obras?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={alocForm.control} name="data_inicio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={alocForm.control} name="custo_hora_efetivo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo/Hora de Alocação (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={alocForm.control} name="observacoes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações de Envio</FormLabel>
                  <FormControl><Textarea placeholder="Ex: Entregue com tanque cheio." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setAlocDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={alocMutation.isPending}>
                  {alocMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  Alocar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Registrar Manutenção */}
      <Dialog open={manutDialogOpen} onOpenChange={setManutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Manutenção</DialogTitle>
            <DialogDescription>Lança no histórico e muda o status do equipamento para "Em Manutenção".</DialogDescription>
          </DialogHeader>
          <Form {...manutForm}>
            <form onSubmit={manutForm.handleSubmit((v) => manutMutation.mutate(v))} className="space-y-4 pt-2">
              <FormField control={manutForm.control} name="equipamento_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipamento *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {equipamentos?.filter(e => e.status !== "inativo").map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome} ({STATUS_LABELS[e.status as keyof typeof STATUS_LABELS]})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={manutForm.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Manutenção *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={manutForm.control} name="data" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={manutForm.control} name="descricao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Conserto / Revisão *</FormLabel>
                  <FormControl><Textarea placeholder="Ex: Troca de óleo do motor e filtros hidráulicos." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={manutForm.control} name="custo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo da Manutenção (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={manutForm.control} name="realizado_por" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mecânica / Oficina</FormLabel>
                    <FormControl><Input placeholder="Ex: Oficina Trevo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setManutDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={manutMutation.isPending}>
                  {manutMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  Registrar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Lançar Custo / Abastecimento */}
      <Dialog open={custoDialogOpen} onOpenChange={setCustoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar Custos Operacionais</DialogTitle>
            <DialogDescription>Lançar despesas com combustíveis, seguros ou reposição de peças.</DialogDescription>
          </DialogHeader>
          <Form {...custoForm}>
            <form onSubmit={custoForm.handleSubmit((v) => custoMutation.mutate(v))} className="space-y-4 pt-2">
              <FormField control={custoForm.control} name="equipamento_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipamento *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {equipamentos?.filter(e => e.status !== "inativo").map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome} (Placa: {e.placa || "—"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={custoForm.control} name="obra_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Apropriar Despesa na Obra (opcional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a obra de destino" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">Uso Geral / Administrativo</SelectItem>
                      {obras?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={custoForm.control} name="tipo_custo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Custo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="combustivel">Combustível</SelectItem>
                        <SelectItem value="seguro">Seguro</SelectItem>
                        <SelectItem value="pecas">Peças</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={custoForm.control} name="data" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={custoForm.control} name="descricao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição / Notas</FormLabel>
                  <FormControl><Input placeholder="Ex: Abastecimento Diesel S10" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={custoForm.control} name="quantidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qtd (Litros/etc - opcional)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={custoForm.control} name="valor_total" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCustoDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={custoMutation.isPending}>
                  {custoMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                  Lançar Custo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Confirmação de Exclusão */}
      <AlertDialog open={eqDeleteTarget !== null} onOpenChange={(open) => !open && setEqDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente excluir este equipamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e apagará o equipamento "{eqDeleteTarget?.nome}" e todo o histórico associado a ele no inventário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate(eqDeleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
