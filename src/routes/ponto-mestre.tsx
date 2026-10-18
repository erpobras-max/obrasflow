import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  MapPin,
  Play,
  Coffee,
  SkipForward,
  Users,
  Building,
  UserPlus,
  FileClock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client.custom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/ponto-mestre")({ component: PontoMestrePage });

type Marcacao = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";
type Localizacao = { latitude: number; longitude: number; precisao?: number | null };

interface Obra {
  id: string;
  nome: string;
  endereco: string | null;
}

interface FuncionarioMestre {
  id: string;
  nome: string;
  cargo: string;
  cpf: string;
  matricula: string | null;
  obra_id: string | null;
}

interface FuncionarioParaRegistro {
  id: string;
  nome: string;
  cargo: string;
  matricula: string | null;
  obra_id: string;
  obra_nome: string;
}

interface RegistroPonto {
  id: string;
  funcionario_id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_retorno_almoco: string | null;
  hora_saida: string | null;
  horas_trabalhadas: number | null;
  tipo_dia: string;
  observacoes: string | null;
  obra_id: string | null;
}

function PontoMestrePage() {
  const navigate = useNavigate();
  const { loading, user, roles } = useAuth();
  const qc = useQueryClient();
  const [agora] = useState(new Date());
  const [obraSelecionada, setObraSelecionada] = useState<string | null>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(null);
  const [tipoMarcacao, setTipoMarcacao] = useState<Marcacao>("entrada");
  const [justificativa, setJustificativa] = useState("");
  const [dialogoRegistro, setDialogoRegistro] = useState(false);

  // Verificar se o usuário é mestre de obras
  useEffect(() => {
    if (!loading && (!user || !roles.includes("mestre_obras"))) {
      navigate({ to: "/ponto", replace: true });
    }
  }, [loading, user, roles, navigate]);

  // Obter obras vinculadas ao mestre
  const { data: obras = [], isLoading: loadingObras } = useQuery<Obra[]>({
    queryKey: ["obras-mestre", user?.id],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_mestres")
        .select("obra_id, obras!inner(nome, endereco)")
        .eq("funcionario_id", user!.id)
        .eq("ativo", true);

      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.obra_id,
        nome: item.obras.nome,
        endereco: item.obras.endereco,
      }));
    },
  });

  // Obter funcionários da obra selecionada
  const { data: funcionariosObra = [], isLoading: loadingFuncionarios } = useQuery<FuncionarioParaRegistro[]>({
    queryKey: ["funcionarios-obra", obraSelecionada],
    enabled: !!obraSelecionada,
    queryFn: async () => {
      if (!obraSelecionada) return [];

      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, matricula, obra_id, obras!inner(nome)")
        .eq("obra_id", obraSelecionada)
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        nome: f.nome,
        cargo: f.cargo,
        matricula: f.matricula,
        obra_id: f.obra_id,
        obra_nome: f.obras.nome,
      }));
    },
  });

  // Obter informações do mestre (funcionário)
  const { data: mestreInfo, isLoading: loadingMestreInfo } = useQuery<FuncionarioMestre | null>({
    queryKey: ["mestre-info", user?.id],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, cpf, matricula, obra_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Obter registros de ponto recentes dos funcionários da obra
  const { data: registrosRecentes = [], isLoading: loadingRegistros } = useQuery<RegistroPonto[]>({
    queryKey: ["registros-mestre", obraSelecionada],
    enabled: !!obraSelecionada,
    queryFn: async () => {
      if (!obraSelecionada) return [];

      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .in("funcionario_id", funcionariosObra.map(f => f.id))
        .gte("data", format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Mutação para registrar ponto via RPC
  const registrarPonto = useMutation({
    mutationFn: async () => {
      if (!funcionarioSelecionado || !obraSelecionada || !tipoMarcacao) {
        throw new Error("Selecione o funcionário e o tipo de marcação");
      }

      // Validar justificativa para saída antecipada
      if (tipoMarcacao === "saida" && justificativa.trim().length < 5) {
        throw new Error("Para saída antecipada, informe uma justificativa com pelo menos 5 caracteres");
      }

      const local = await obterLocalizacao();

      const { error } = await supabase.rpc("registrar_ponto_por_mestre", {
        p_funcionario_id: funcionarioSelecionado,
        p_obra_id: obraSelecionada,
        p_tipo: tipoMarcacao,
        p_justificativa_saida_antecipada: tipoMarcacao === "saida" && justificativa.trim() ? justificativa.trim() : null,
        p_latitude: local?.latitude ?? null,
        p_longitude: local?.longitude ?? null,
        p_precisao: local?.precisao ?? null,
        p_dispositivo: {
          navegador: navigator.userAgent,
          plataforma: navigator.platform,
          idioma: navigator.language,
          mestre_id: mestreInfo?.id,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto registrado com sucesso");
      setDialogoRegistro(false);
      setJustificativa("");
      setFuncionarioSelecionado(null);
      void qc.invalidateQueries({ queryKey: ["registros-mestre"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  // Função para obter localização
  async function obterLocalizacao(): Promise<Localizacao | null> {
    if (!navigator.geolocation) return null;

    try {
      return await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          (p) =>
            resolve({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              precisao: p.coords.accuracy,
            }),
          reject,
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
        ),
      );
    } catch {
      toast.info("Marcação realizada sem localização. Libere o GPS nas permissões do navegador para registrá-la.");
      return null;
    }
  }

  // Função para registrar seu próprio ponto
  const registrarMeuPonto = useMutation({
    mutationFn: async (tipo: Marcacao) => {
      if (!mestreInfo) throw new Error("Informações do mestre não encontradas");

      const local = await obterLocalizacao();

      const { error } = await supabase.rpc("registrar_ponto_funcionario", {
        p_tipo: tipo,
        p_latitude: local?.latitude ?? null,
        p_longitude: local?.longitude ?? null,
        p_precisao: local?.precisao ?? null,
        p_dispositivo: {
          navegador: navigator.userAgent,
          plataforma: navigator.platform,
          idioma: navigator.language,
          mestre_id: mestreInfo.id,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seu ponto registrado com sucesso");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  if (loading || loadingMestreInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!mestreInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-12 text-destructive" />
          <CardTitle>Mestre de Obras não vinculado</CardTitle>
          <CardDescription className="mt-2">
            Este usuário não está vinculado a uma ficha ativa no RH como mestre de obras.
          </CardDescription>
          <Button onClick={() => navigate({ to: "/ponto" })} variant="outline" className="mt-6 w-full">
            Voltar ao ponto comum
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-950">
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-600 text-white">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold md:text-base">Portal do Mestre de Obras</h1>
              <p className="text-xs text-slate-500">
                {mestreInfo.nome} · {mestreInfo.cargo}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate({ to: "/ponto" })} variant="ghost" size="sm" className="gap-2">
            <Clock className="size-4" /> Meu Ponto
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Tabs defaultValue="registrar" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4 bg-white p-1 shadow-sm md:w-[500px]">
            <TabsTrigger value="registrar" className="min-h-10">
              Registrar Ponto
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="min-h-10">
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="historico" className="min-h-10">
              Histórico
            </TabsTrigger>
            <TabsTrigger value="meuponto" className="min-h-10">
              Meu Ponto
            </TabsTrigger>
          </TabsList>

          {/* Aba: Registrar Ponto */}
          <TabsContent value="registrar" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Registrar Ponto para Funcionários</CardTitle>
                <CardDescription>
                  Selecione a obra, o funcionário e o tipo de marcação. Para saída antecipada, informe a justificativa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Obra</Label>
                    <Select value={obraSelecionada || ""} onValueChange={setObraSelecionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a obra" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingObras ? (
                          <SelectItem value="loading" disabled>
                            <Loader2 className="mr-2 inline size-4 animate-spin" /> Carregando...
                          </SelectItem>
                        ) : obras.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhuma obra vinculada
                          </SelectItem>
                        ) : (
                          obras.map((obra) => (
                            <SelectItem key={obra.id} value={obra.id}>
                              <div className="flex items-center gap-2">
                                <Building className="size-4" />
                                {obra.nome}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Funcionário</Label>
                    <Select
                      value={funcionarioSelecionado || ""}
                      onValueChange={setFuncionarioSelecionado}
                      disabled={!obraSelecionada || loadingFuncionarios}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!obraSelecionada ? "Selecione a obra primeiro" : "Selecione o funcionário"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingFuncionarios ? (
                          <SelectItem value="loading" disabled>
                            <Loader2 className="mr-2 inline size-4 animate-spin" /> Carregando...
                          </SelectItem>
                        ) : funcionariosObra.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhum funcionário nesta obra
                          </SelectItem>
                        ) : (
                          funcionariosObra.map((funcionario) => (
                            <SelectItem key={funcionario.id} value={funcionario.id}>
                              <div className="flex items-center gap-2">
                                <UserPlus className="size-4" />
                                {funcionario.nome} ({funcionario.cargo})
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {obraSelecionada && funcionarioSelecionado && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo de Marcação</Label>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(
                          [
                            ["entrada", "Entrada", Play],
                            ["saida_almoco", "Saída almoço", Coffee],
                            ["retorno_almoco", "Retorno", SkipForward],
                            ["saida", "Saída", LogOut],
                          ] as const
                        ).map(([tipo, label, Icon]) => (
                          <Button
                            key={tipo}
                            onClick={() => {
                              setTipoMarcacao(tipo);
                              if (tipo === "saida") {
                                setDialogoRegistro(true);
                              } else {
                                registrarPonto.mutate();
                              }
                            }}
                            disabled={registrarPonto.isPending}
                            variant={tipoMarcacao === tipo ? "default" : "outline"}
                            className="h-24 flex-col gap-2"
                          >
                            <Icon className="size-5" />
                            <span>{label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {tipoMarcacao === "saida" && (
                      <div className="space-y-2">
                        <Label>Justificativa para Saída Antecipada (opcional)</Label>
                        <Textarea
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Informe o motivo da saída antecipada (ex: tarefa concluída, problema na obra, atendimento médico)..."
                          rows={3}
                        />
                        <p className="text-xs text-slate-500">
                          A justificativa será registrada para análise do RH e pode ser aplicada no holerite.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Funcionários */}
          <TabsContent value="funcionarios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Funcionários das Obras</CardTitle>
                <CardDescription>
                  Funcionários ativos nas obras sob sua supervisão
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFuncionarios && !obraSelecionada ? (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto size-8 animate-spin" />
                    <p className="mt-2 text-sm text-slate-500">Carregando funcionários...</p>
                  </div>
                ) : !obraSelecionada ? (
                  <div className="py-8 text-center">
                    <Users className="mx-auto size-12 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">Selecione uma obra para visualizar os funcionários</p>
                  </div>
                ) : funcionariosObra.length === 0 ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="mx-auto size-12 text-amber-300" />
                    <p className="mt-2 text-sm text-slate-500">Nenhum funcionário ativo nesta obra</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funcionariosObra.map((funcionario) => (
                          <TableRow key={funcionario.id}>
                            <TableCell className="font-medium">{funcionario.nome}</TableCell>
                            <TableCell>{funcionario.cargo}</TableCell>
                            <TableCell>{funcionario.matricula || "—"}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFuncionarioSelecionado(funcionario.id);
                                  setTipoMarcacao("entrada");
                                  setDialogoRegistro(true);
                                }}
                              >
                                Registrar Ponto
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

          {/* Aba: Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Histórico de Registros</CardTitle>
                    <CardDescription>
                      Últimos registros de ponto dos funcionários das suas obras
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void qc.invalidateQueries({ queryKey: ["registros-mestre"] })}
                    disabled={loadingRegistros}
                  >
                    <RefreshCw className={`mr-2 size-4 ${loadingRegistros ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRegistros ? (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto size-8 animate-spin" />
                  </div>
                ) : registrosRecentes.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileClock className="mx-auto size-12 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">
                      {obraSelecionada ? "Nenhum registro recente" : "Selecione uma obra para visualizar os registros"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Funcionário</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Saída Almoço</TableHead>
                          <TableHead>Retorno</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Obra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrosRecentes.map((registro) => {
                          const funcionario = funcionariosObra.find(f => f.id === registro.funcionario_id);
                          return (
                            <TableRow key={registro.id}>
                              <TableCell className="font-medium">
                                {funcionario?.nome || "Desconhecido"}
                              </TableCell>
                              <TableCell>
                                {format(parseISO(registro.data), "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell>{registro.hora_entrada?.slice(0, 5) || "—"}</TableCell>
                              <TableCell>{registro.hora_saida_almoco?.slice(0, 5) || "—"}</TableCell>
                              <TableCell>{registro.hora_retorno_almoco?.slice(0, 5) || "—"}</TableCell>
                              <TableCell>{registro.hora_saida?.slice(0, 5) || "—"}</TableCell>
                              <TableCell>{funcionario?.obra_nome || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Meu Ponto */}
          <TabsContent value="meuponto" className="space-y-5">
            <Card>
              <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">
                  Horário local
                </p>
                <h2 className="my-2 text-5xl font-bold tabular-nums tracking-tight">
                  {agora.toLocaleTimeString("pt-BR")}
                </h2>
                <p className="text-sm capitalize text-slate-500">
                  {format(agora, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <Badge variant="outline" className="mt-4">
                  Marcação usa horário do servidor
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registrar meu ponto</CardTitle>
                <CardDescription>
                  Como mestre de obras, você também precisa registrar seu próprio ponto
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["entrada", "Entrada", Play],
                    ["saida_almoco", "Saída almoço", Coffee],
                    ["retorno_almoco", "Retorno", SkipForward],
                    ["saida", "Saída", LogOut],
                  ] as const
                ).map(([tipo, label, Icon]) => (
                  <Button
                    key={tipo}
                    onClick={() => registrarMeuPonto.mutate(tipo)}
                    disabled={registrarMeuPonto.isPending}
                    variant="outline"
                    className="h-24 flex-col gap-2"
                  >
                    <Icon className="size-5" />
                    <span>{label}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Diálogo de confirmação para saída antecipada */}
      <Dialog open={dialogoRegistro} onOpenChange={setDialogoRegistro}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar saída antecipada</DialogTitle>
            <DialogDescription>
              {justificativa.trim()
                ? "A justificativa será registrada para análise do RH."
                : "Esta saída não terá justificativa."}
            </DialogDescription>
          </DialogHeader>
          {justificativa.trim() && (
            <div className="rounded bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">Justificativa:</p>
              <p className="text-sm text-amber-700 mt-1">{justificativa}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoRegistro(false)}>
              Cancelar
            </Button>
            <Button onClick={() => registrarPonto.mutate()} disabled={registrarPonto.isPending}>
              {registrarPonto.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar Saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}