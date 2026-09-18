import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Clock, LogOut, Loader2, CheckCircle, RefreshCw, AlertCircle, Play, Coffee, SkipForward, LogOut as LogOutIcon
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client.custom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/ponto")({
  component: PontoPage,
});

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  matricula: string | null;
}

interface RegistroPonto {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_retorno_almoco: string | null;
  hora_saida: string | null;
  horas_trabalhadas: number | null;
  tipo_dia: string;
  observacoes: string | null;
}

function PontoPage() {
  const navigate = useNavigate();
  const { loading, user, perfil, roles } = useAuth();
  const qc = useQueryClient();
  const [time, setTime] = useState(new Date());

  // Relógio dinâmico
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redireciona usuários não autorizados
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    } else if (!loading && perfil?.ativo === false) {
      void supabase.auth.signOut().then(() => navigate({ to: "/auth", replace: true }));
    } else if (
      !loading &&
      !roles.some((role) => ["funcionario", "admin", "rh", "diretor"].includes(role))
    ) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, perfil?.ativo, roles, navigate]);

  // Busca dados do funcionário logado
  const { data: funcionario, isLoading: loadingFunc } = useQuery<Funcionario | null>({
    queryKey: ["ponto-funcionario", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, matricula")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar funcionário:", error.message);
        throw error;
      }
      return data as Funcionario;
    },
    enabled: !!user,
  });

  const hoje = format(new Date(), "yyyy-MM-dd");

  // Busca registro de hoje
  const { data: pontoHoje, isLoading: loadingPontoHoje } = useQuery<RegistroPonto | null>({
    queryKey: ["ponto-hoje", funcionario?.id],
    queryFn: async () => {
      if (!funcionario) return null;
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", funcionario.id)
        .eq("data", hoje)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar ponto de hoje:", error.message);
        throw error;
      }
      return data as RegistroPonto;
    },
    enabled: !!funcionario,
  });

  // Busca histórico de ponto (últimos 30 dias)
  const { data: historico, isLoading: loadingHistorico } = useQuery<RegistroPonto[]>({
    queryKey: ["ponto-historico", funcionario?.id],
    queryFn: async () => {
      if (!funcionario) return [];
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", funcionario.id)
        .order("data", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Erro ao buscar histórico de ponto:", error.message);
        throw error;
      }
      return (data ?? []) as RegistroPonto[];
    },
    enabled: !!funcionario,
  });

  // Registrar / Atualizar Ponto Mutation
  const registerPontoMutation = useMutation({
    mutationFn: async (tipo: "entrada" | "saida_almoco" | "retorno_almoco" | "saida") => {
      if (!funcionario) throw new Error("Funcionário não identificado.");

      const nowTime = format(new Date(), "HH:mm:ss");
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (pontoHoje) {
        // Atualiza registro existente do dia
        const updates: Partial<RegistroPonto> & { [key: string]: any } = {};
        if (tipo === "entrada") updates.hora_entrada = nowTime;
        if (tipo === "saida_almoco") updates.hora_saida_almoco = nowTime;
        if (tipo === "retorno_almoco") updates.hora_retorno_almoco = nowTime;
        if (tipo === "saida") updates.hora_saida = nowTime;

        // Calcular horas trabalhadas se fechar entrada e saída
        const entrada = updates.hora_entrada || pontoHoje.hora_entrada;
        const saidaAlmoco = updates.saida_almoco || pontoHoje.hora_saida_almoco;
        const retornoAlmoco = updates.retorno_almoco || pontoHoje.hora_retorno_almoco;
        const saida = updates.hora_saida || pontoHoje.hora_saida;

        if (entrada && saida) {
          const toMin = (t: string) => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
          };
          const e = toMin(entrada);
          const s = toMin(saida);
          const alm = (saidaAlmoco && retornoAlmoco) 
            ? toMin(retornoAlmoco) - toMin(saidaAlmoco)
            : 60; // 1 hora de almoço padrão
          updates.horas_trabalhadas = Math.max(0, (s - e - alm) / 60);
        }

        const { error } = await supabase
          .from("registros_ponto")
          .update(updates)
          .eq("id", pontoHoje.id);

        if (error) throw error;
      } else {
        // Cria novo registro para hoje
        const payload: Record<string, any> = {
          funcionario_id: funcionario.id,
          data: hoje,
          tipo_dia: "normal",
          fonte: "manual",
          created_by: currentUser?.id
        };

        if (tipo === "entrada") payload.hora_entrada = nowTime;
        if (tipo === "saida_almoco") payload.hora_saida_almoco = nowTime;
        if (tipo === "retorno_almoco") payload.hora_retorno_almoco = nowTime;
        if (tipo === "saida") payload.hora_saida = nowTime;

        const { error } = await supabase
          .from("registros_ponto")
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Ponto registrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["ponto-hoje", funcionario?.id] });
      qc.invalidateQueries({ queryKey: ["ponto-historico", funcionario?.id] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao registrar ponto: ${err.message}`);
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading || loadingFunc || (user && !funcionario && loadingFunc)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-slate-500">Identificando colaborador...</p>
        </div>
      </div>
    );
  }

  if (user && !funcionario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertCircle className="size-12 text-destructive mx-auto mb-3" />
          <CardTitle className="text-lg">Colaborador não vinculado</CardTitle>
          <CardDescription className="mt-2">
            Este usuário não está vinculado a nenhuma ficha de funcionário no RH. Solicite ao administrador a vinculação do seu CPF ou e-mail.
          </CardDescription>
          <Button onClick={handleLogout} className="mt-6 w-full gap-2" variant="outline">
            <LogOut className="size-4" /> Voltar ao Login
          </Button>
        </Card>
      </div>
    );
  }

  const formatHora = (h: string | null) => h ? h.slice(0, 5) : "—";

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm md:text-base leading-none">Portal de Ponto</h1>
              <p className="text-xs text-slate-500 mt-1">{funcionario?.nome} • {funcionario?.cargo}</p>
            </div>
          </div>

          <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100">
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
        
        {/* Relógio e Registro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card do Relógio */}
          <Card className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10 md:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Horário Local</p>
            <h2 className="text-4xl font-extrabold text-slate-800 my-2 tabular-nums">
              {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </h2>
            <p className="text-xs text-slate-500">
              {format(time, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </Card>

          {/* Ações de Registro de Ponto */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Registrar Marcação</CardTitle>
              <CardDescription>Clique no botão correspondente ao ponto que deseja bater neste momento.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                
                {/* 1. Entrada */}
                <Button 
                  onClick={() => registerPontoMutation.mutate("entrada")}
                  disabled={!!pontoHoje?.hora_entrada || registerPontoMutation.isPending}
                  className="h-16 flex flex-col gap-1 items-center justify-center text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition-all"
                  variant="ghost"
                >
                  <Play className="size-5 text-emerald-500" />
                  <span>Entrada</span>
                  {pontoHoje?.hora_entrada && (
                    <span className="text-[10px] text-slate-500">{formatHora(pontoHoje.hora_entrada)}</span>
                  )}
                </Button>

                {/* 2. Saída Almoço */}
                <Button 
                  onClick={() => registerPontoMutation.mutate("saida_almoco")}
                  disabled={!pontoHoje?.hora_entrada || !!pontoHoje?.hora_saida_almoco || registerPontoMutation.isPending}
                  className="h-16 flex flex-col gap-1 items-center justify-center text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition-all"
                  variant="ghost"
                >
                  <Coffee className="size-5 text-orange-500" />
                  <span>Saída Almoço</span>
                  {pontoHoje?.hora_saida_almoco && (
                    <span className="text-[10px] text-slate-500">{formatHora(pontoHoje.hora_saida_almoco)}</span>
                  )}
                </Button>

                {/* 3. Retorno Almoço */}
                <Button 
                  onClick={() => registerPontoMutation.mutate("retorno_almoco")}
                  disabled={!pontoHoje?.hora_saida_almoco || !!pontoHoje?.hora_retorno_almoco || registerPontoMutation.isPending}
                  className="h-16 flex flex-col gap-1 items-center justify-center text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition-all"
                  variant="ghost"
                >
                  <SkipForward className="size-5 text-blue-500" />
                  <span>Retorno Almoço</span>
                  {pontoHoje?.hora_retorno_almoco && (
                    <span className="text-[10px] text-slate-500">{formatHora(pontoHoje.hora_retorno_almoco)}</span>
                  )}
                </Button>

                {/* 4. Saída */}
                <Button 
                  onClick={() => registerPontoMutation.mutate("saida")}
                  disabled={!pontoHoje?.hora_entrada || !!pontoHoje?.hora_saida || registerPontoMutation.isPending}
                  className="h-16 flex flex-col gap-1 items-center justify-center text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition-all"
                  variant="ghost"
                >
                  <LogOut className="size-5 text-rose-500" />
                  <span>Saída</span>
                  {pontoHoje?.hora_saida && (
                    <span className="text-[10px] text-slate-500">{formatHora(pontoHoje.hora_saida)}</span>
                  )}
                </Button>

              </div>
            </CardContent>
          </Card>

        </div>

        {/* Histórico dos Últimos 30 Dias */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Histórico de Ponto</CardTitle>
              <CardDescription>Seus registros de ponto realizados nos últimos 30 dias.</CardDescription>
            </div>
            <Button 
              size="icon" 
              variant="outline" 
              className="size-8"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["ponto-hoje"] });
                qc.invalidateQueries({ queryKey: ["ponto-historico"] });
              }}
            >
              <RefreshCw className="size-4 text-slate-500" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Alm.</TableHead>
                    <TableHead>Retorno Alm.</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-right">Total Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHistorico ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        <Loader2 className="size-5 animate-spin mx-auto mb-2 text-slate-400" />
                        Carregando histórico...
                      </TableCell>
                    </TableRow>
                  ) : historico?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        Nenhum ponto registrado nos últimos 30 dias.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historico?.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-700">
                          {format(parseISO(row.data), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-100 font-mono">
                            {formatHora(row.hora_entrada)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-orange-50/50 text-orange-700 border-orange-100 font-mono">
                            {formatHora(row.hora_saida_almoco)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-100 font-mono">
                            {formatHora(row.hora_retorno_almoco)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-rose-50/50 text-rose-700 border-rose-100 font-mono">
                            {formatHora(row.hora_saida)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-700 font-mono">
                          {row.horas_trabalhadas !== null ? `${row.horas_trabalhadas.toFixed(2)}h` : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
