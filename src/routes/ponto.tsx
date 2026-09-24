/* As tabelas e RPCs desta migration ainda não fazem parte do arquivo de tipos gerado. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileClock,
  Loader2,
  LogOut,
  MapPin,
  Play,
  Printer,
  RefreshCw,
  Send,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { eachDayOfInterval, endOfMonth, format, isWeekend, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client.custom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/ponto")({ component: PontoPage });
type Marcacao = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";
type Localizacao = { latitude: number; longitude: number; precisao?: number | null };
interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  matricula: string | null;
  obra_id: string | null;
  carga_horaria_semanal: number;
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
  entrada_localizacao?: Localizacao | null;
  saida_almoco_localizacao?: Localizacao | null;
  retorno_almoco_localizacao?: Localizacao | null;
  saida_localizacao?: Localizacao | null;
}
interface SolicitacaoAjuste {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida_almoco: string | null;
  hora_retorno_almoco: string | null;
  hora_saida: string | null;
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  resposta: string | null;
  created_at: string;
}
const vazio = {
  data: format(new Date(), "yyyy-MM-dd"),
  hora_entrada: "",
  hora_saida_almoco: "",
  hora_retorno_almoco: "",
  hora_saida: "",
  motivo: "",
};
const ajusteMeta = {
  pendente: ["Em análise", "border-amber-200 bg-amber-50 text-amber-800"],
  aprovado: ["Aprovado", "border-emerald-200 bg-emerald-50 text-emerald-800"],
  rejeitado: ["Rejeitado", "border-red-200 bg-red-50 text-red-700"],
} as const;
const hora = (v?: string | null) => (v ? v.slice(0, 5) : "—");
const numero = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function PontoPage() {
  const navigate = useNavigate();
  const { loading, user, perfil, roles } = useAuth();
  const qc = useQueryClient();
  const [agora, setAgora] = useState(new Date());
  const [mes, setMes] = useState(() => format(new Date(), "yyyy-MM"));
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajuste, setAjuste] = useState(vazio);
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
    else if (!loading && perfil?.ativo === false)
      void supabase.auth.signOut().then(() => navigate({ to: "/auth", replace: true }));
    else if (!loading && !roles.some((r) => ["funcionario", "admin", "rh", "diretor"].includes(r)))
      navigate({ to: "/dashboard", replace: true });
  }, [loading, user, perfil?.ativo, roles, navigate]);

  const { data: funcionario, isLoading: loadingFunc } = useQuery<Funcionario | null>({
    queryKey: ["ponto-funcionario", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("funcionarios")
        .select("id,nome,cargo,matricula,obra_id,carga_horaria_semanal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Funcionario | null;
    },
  });
  const hoje = format(new Date(), "yyyy-MM-dd");
  const inicio = `${mes}-01`,
    fim = format(endOfMonth(parseISO(inicio)), "yyyy-MM-dd");
  const { data: registros = [], isLoading: loadingRegistros } = useQuery<RegistroPonto[]>({
    queryKey: ["ponto-registros", funcionario?.id, mes],
    enabled: !!funcionario,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", funcionario!.id)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegistroPonto[];
    },
  });
  const { data: ajustes = [] } = useQuery<SolicitacaoAjuste[]>({
    queryKey: ["ponto-ajustes", funcionario?.id],
    enabled: !!funcionario,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solicitacoes_ajuste_ponto")
        .select("*")
        .eq("funcionario_id", funcionario!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolicitacaoAjuste[];
    },
  });
  const pontoHoje = registros.find((r) => r.data === hoje) ?? null;
  const resumo = useMemo(() => {
    if (!funcionario) return { dias: 0, horas: 0, previstas: 0, extras: 0, saldo: 0 };
    const limite =
      mes === format(new Date(), "yyyy-MM") ? new Date() : endOfMonth(parseISO(inicio));
    const uteis = eachDayOfInterval({
      start: startOfMonth(parseISO(inicio)),
      end: endOfMonth(parseISO(inicio)),
    }).filter((d) => !isWeekend(d) && d <= limite).length;
    const horas = registros.reduce((s, r) => s + numero(r.horas_trabalhadas), 0),
      previstas = (uteis * funcionario.carga_horaria_semanal) / 5,
      saldo = horas - previstas;
    return {
      dias: registros.filter((r) => numero(r.horas_trabalhadas) > 0).length,
      horas,
      previstas,
      extras: Math.max(0, saldo),
      saldo,
    };
  }, [funcionario, inicio, mes, registros]);

  async function gps(): Promise<Localizacao | null> {
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
      toast.info(
        "Marcação realizada sem localização. Libere o GPS nas permissões do navegador para registrá-la.",
      );
      return null;
    }
  }
  const registrar = useMutation({
    mutationFn: async (tipo: Marcacao) => {
      const local = await gps();
      const { error } = await (supabase as any).rpc("registrar_ponto_funcionario", {
        p_tipo: tipo,
        p_latitude: local?.latitude ?? null,
        p_longitude: local?.longitude ?? null,
        p_precisao: local?.precisao ?? null,
        p_dispositivo: {
          navegador: navigator.userAgent,
          plataforma: navigator.platform,
          idioma: navigator.language,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcação registrada com o horário oficial do servidor.");
      void qc.invalidateQueries({ queryKey: ["ponto-registros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const solicitar = useMutation({
    mutationFn: async () => {
      if (!funcionario || ajuste.motivo.trim().length < 5)
        throw new Error("Explique o motivo do ajuste.");
      const atual = registros.find((r) => r.data === ajuste.data);
      const { error } = await (supabase as any).from("solicitacoes_ajuste_ponto").insert({
        funcionario_id: funcionario.id,
        registro_ponto_id: atual?.id ?? null,
        data: ajuste.data,
        hora_entrada: ajuste.hora_entrada || null,
        hora_saida_almoco: ajuste.hora_saida_almoco || null,
        hora_retorno_almoco: ajuste.hora_retorno_almoco || null,
        hora_saida: ajuste.hora_saida || null,
        motivo: ajuste.motivo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada ao RH.");
      setAjusteOpen(false);
      setAjuste(vazio);
      void qc.invalidateQueries({ queryKey: ["ponto-ajustes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function abrirAjuste(r?: RegistroPonto) {
    setAjuste({
      data: r?.data ?? hoje,
      hora_entrada: hora(r?.hora_entrada).replace("—", ""),
      hora_saida_almoco: hora(r?.hora_saida_almoco).replace("—", ""),
      hora_retorno_almoco: hora(r?.hora_retorno_almoco).replace("—", ""),
      hora_saida: hora(r?.hora_saida).replace("—", ""),
      motivo: "",
    });
    setAjusteOpen(true);
  }
  function mudarMes(delta: number) {
    const d = parseISO(`${mes}-01`);
    d.setMonth(d.getMonth() + delta);
    setMes(format(d, "yyyy-MM"));
  }
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (loading || loadingFunc)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  if (user && !funcionario)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-12 text-destructive" />
          <CardTitle>Colaborador não vinculado</CardTitle>
          <CardDescription className="mt-2">
            Este usuário não está vinculado a uma ficha ativa no RH.
          </CardDescription>
          <Button onClick={sair} variant="outline" className="mt-6 w-full">
            Voltar ao login
          </Button>
        </Card>
      </div>
    );
  const local =
    pontoHoje?.saida_localizacao ||
    pontoHoje?.retorno_almoco_localizacao ||
    pontoHoje?.saida_almoco_localizacao ||
    pontoHoje?.entrada_localizacao;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-950 print:bg-white">
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm print:static print:shadow-none">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Clock className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold md:text-base">Portal do Funcionário</h1>
              <p className="text-xs text-slate-500">
                {funcionario?.nome} · {funcionario?.cargo}
              </p>
            </div>
          </div>
          <Button onClick={sair} variant="ghost" size="sm" className="gap-2 print:hidden">
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Tabs defaultValue="hoje" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-3 bg-white p-1 shadow-sm md:w-[460px] print:hidden">
            <TabsTrigger value="hoje" className="min-h-10">
              Hoje
            </TabsTrigger>
            <TabsTrigger value="espelho" className="min-h-10">
              Espelho mensal
            </TabsTrigger>
            <TabsTrigger value="ajustes" className="min-h-10">
              Ajustes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hoje" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
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
                  <CardTitle className="text-lg">Registrar marcação</CardTitle>
                  <CardDescription>
                    A sequência é validada automaticamente. O GPS é solicitado no momento da
                    marcação.
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
                  ).map(([tipo, label, Icon]) => {
                    const valor =
                      tipo === "entrada"
                        ? pontoHoje?.hora_entrada
                        : tipo === "saida_almoco"
                          ? pontoHoje?.hora_saida_almoco
                          : tipo === "retorno_almoco"
                            ? pontoHoje?.hora_retorno_almoco
                            : pontoHoje?.hora_saida;
                    const habilitado =
                      tipo === "entrada"
                        ? !pontoHoje?.hora_entrada
                        : tipo === "saida_almoco"
                          ? !!pontoHoje?.hora_entrada &&
                            !pontoHoje?.hora_saida_almoco &&
                            !pontoHoje?.hora_saida
                          : tipo === "retorno_almoco"
                            ? !!pontoHoje?.hora_saida_almoco && !pontoHoje?.hora_retorno_almoco
                            : !!pontoHoje?.hora_entrada &&
                              !pontoHoje?.hora_saida &&
                              (!pontoHoje?.hora_saida_almoco || !!pontoHoje?.hora_retorno_almoco);
                    return (
                      <Button
                        key={tipo}
                        onClick={() => registrar.mutate(tipo)}
                        disabled={!habilitado || registrar.isPending}
                        variant="outline"
                        className="h-24 flex-col gap-2 bg-white"
                      >
                        {valor ? (
                          <CheckCircle2 className="size-5 text-emerald-600" />
                        ) : (
                          <Icon className="size-5" />
                        )}
                        <span>{label}</span>
                        <span className="text-xs font-normal text-slate-500">{hora(valor)}</span>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase text-slate-500">Situação de hoje</p>
                  <p className="mt-2 text-lg font-bold">
                    {pontoHoje?.hora_saida
                      ? "Jornada concluída"
                      : pontoHoje?.hora_entrada
                        ? "Jornada em andamento"
                        : "Entrada pendente"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase text-slate-500">Horas computadas</p>
                  <p className="mt-2 text-lg font-bold">
                    {pontoHoje?.horas_trabalhadas != null
                      ? `${numero(pontoHoje.horas_trabalhadas).toFixed(2)}h`
                      : "Aguardando saída"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase text-slate-500">Localização</p>
                  {local ? (
                    <a
                      className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:underline"
                      href={`https://www.openstreetmap.org/?mlat=${local.latitude}&mlon=${local.longitude}#map=18/${local.latitude}/${local.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="size-4" /> Ver última marcação
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Ainda não capturada</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="espelho" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => mudarMes(-1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-40 text-center font-semibold capitalize">
                  {format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                <Button size="icon" variant="outline" onClick={() => mudarMes(1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void qc.invalidateQueries({ queryKey: ["ponto-registros"] })}
                >
                  <RefreshCw className="mr-2 size-4" /> Atualizar
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 size-4" /> Imprimir
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Dias trabalhados", resumo.dias],
                ["Horas realizadas", `${resumo.horas.toFixed(2)}h`],
                ["Horas previstas", `${resumo.previstas.toFixed(2)}h`],
                ["Horas extras", `${resumo.extras.toFixed(2)}h`],
                ["Saldo", `${resumo.saldo >= 0 ? "+" : ""}${resumo.saldo.toFixed(2)}h`],
              ].map(([l, v]) => (
                <Card key={l}>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{l}</p>
                    <p className="mt-1 text-xl font-bold">{v}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Saída almoço</TableHead>
                        <TableHead>Retorno</TableHead>
                        <TableHead>Saída</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="print:hidden" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRegistros ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center">
                            <Loader2 className="mx-auto size-5 animate-spin" />
                          </TableCell>
                        </TableRow>
                      ) : registros.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                            Nenhum registro neste mês.
                          </TableCell>
                        </TableRow>
                      ) : (
                        registros.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {format(parseISO(r.data), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{hora(r.hora_entrada)}</TableCell>
                            <TableCell>{hora(r.hora_saida_almoco)}</TableCell>
                            <TableCell>{hora(r.hora_retorno_almoco)}</TableCell>
                            <TableCell>{hora(r.hora_saida)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {r.horas_trabalhadas == null
                                ? "—"
                                : `${numero(r.horas_trabalhadas).toFixed(2)}h`}
                            </TableCell>
                            <TableCell className="text-right print:hidden">
                              <Button size="sm" variant="ghost" onClick={() => abrirAjuste(r)}>
                                Solicitar ajuste
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ajustes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Solicitações ao RH</h2>
                <p className="text-sm text-slate-500">Correções dependem de aprovação.</p>
              </div>
              <Button onClick={() => abrirAjuste()}>
                <Send className="mr-2 size-4" /> Novo ajuste
              </Button>
            </div>
            <div className="space-y-3">
              {ajustes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-slate-500">
                    <FileClock className="mx-auto mb-3 size-9 opacity-50" />
                    Nenhuma solicitação enviada.
                  </CardContent>
                </Card>
              ) : (
                ajustes.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong>{format(parseISO(a.data), "dd/MM/yyyy")}</strong>
                          <Badge variant="outline" className={ajusteMeta[a.status][1]}>
                            {ajusteMeta[a.status][0]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm">{a.motivo}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {hora(a.hora_entrada)} · {hora(a.hora_saida_almoco)} ·{" "}
                          {hora(a.hora_retorno_almoco)} · {hora(a.hora_saida)}
                        </p>
                        {a.resposta && (
                          <p className="mt-2 rounded bg-slate-50 p-2 text-sm">
                            <b>RH:</b> {a.resposta}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(parseISO(a.created_at), "dd/MM HH:mm")}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar ajuste de ponto</DialogTitle>
            <DialogDescription>
              Informe os horários corretos e o motivo. O RH analisará antes de alterar o espelho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={ajuste.data}
                onChange={(e) => setAjuste((a) => ({ ...a, data: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["hora_entrada", "Entrada"],
                  ["hora_saida_almoco", "Saída almoço"],
                  ["hora_retorno_almoco", "Retorno"],
                  ["hora_saida", "Saída"],
                ] as const
              ).map(([campo, label]) => (
                <div className="space-y-2" key={campo}>
                  <Label>{label}</Label>
                  <Input
                    type="time"
                    value={ajuste[campo]}
                    onChange={(e) => setAjuste((a) => ({ ...a, [campo]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={ajuste.motivo}
                onChange={(e) => setAjuste((a) => ({ ...a, motivo: e.target.value }))}
                placeholder="Explique por que o ajuste é necessário."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => solicitar.mutate()} disabled={solicitar.isPending}>
              {solicitar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enviar ao RH
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
