import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  SunMedium,
  Send,
  AlertTriangle,
  Clock,
  TrendingUp,
  HardHat,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obterResumoDiarioCliente, dispararResumoMatinalManual } from "@/lib/resumo-diario.functions";

export function ResumoDiarioCard() {
  const [expandido, setExpandido] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emailTeste, setEmailTeste] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: resumo, isLoading, refetch } = useQuery({
    queryKey: ["resumo-executivo-diario"],
    queryFn: obterResumoDiarioCliente,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const handleEnviarEmail = async () => {
    setEnviando(true);
    try {
      const res = await dispararResumoMatinalManual(emailTeste.trim() || undefined);
      if (res.sucesso) {
        toast.success(res.mensagem || "Boletim matinal enviado com sucesso!");
        setDialogAberto(false);
        setEmailTeste("");
      } else {
        toast.error(res.mensagem || "Erro ao enviar e-mail de resumo.");
      }
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm animate-pulse">
        <CardContent className="p-4">
          <div className="h-6 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!resumo) return null;

  const osStats = resumo.os_stats || { vencendo_hoje: 0, atrasadas: 0, em_andamento: 0, criticas: [] };
  const finStats = resumo.financeiro_stats || {
    pagar_hoje_total: 0,
    pagar_hoje_qtd: 0,
    receber_hoje_total: 0,
    receber_hoje_qtd: 0,
    saldo_projetado_dia: 0,
    contas_criticas: [],
  };
  const opStats = resumo.operacional_stats || { obras_ativas_qtd: 0, pontos_registrados_hoje: 0 };

  const formatMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const temAlertasCriticos = osStats.atrasadas > 0 || osStats.vencendo_hoje > 0;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-sky-500/5 via-card to-amber-500/5 shadow-sm transition-all">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SunMedium className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold tracking-tight">
                    Resumo do Dia • {resumo.data_formatada}
                  </CardTitle>
                  {temAlertasCriticos ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                      {osStats.atrasadas + osStats.vencendo_hoje} OSs com atenção
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Operação em dia
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Boletim executivo matinal consolidado para gestão e diretoria
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => setDialogAberto(true)}
              >
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Disparar</span> E-mail Resumo
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setExpandido(!expandido)}
                aria-label={expandido ? "Recolher resumo" : "Expandir resumo"}
              >
                {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expandido && (
          <CardContent className="p-4 pt-2 space-y-4">
            {/* Grid de KPIs rápidos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* OSs Vencendo */}
              <Link
                to="/ordens-servico"
                className="flex flex-col justify-between p-3 rounded-lg border bg-card/80 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium">OSs Hoje</span>
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold">{osStats.vencendo_hoje}</span>
                  {osStats.atrasadas > 0 && (
                    <span className="text-xs font-semibold text-rose-500">
                      ({osStats.atrasadas} atrasadas)
                    </span>
                  )}
                </div>
              </Link>

              {/* Saldo Projetado */}
              <Link
                to="/financeiro"
                className="flex flex-col justify-between p-3 rounded-lg border bg-card/80 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium">Saldo Projetado Hoje</span>
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-lg font-bold ${
                      finStats.saldo_projetado_dia >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoeda(finStats.saldo_projetado_dia)}
                  </span>
                </div>
              </Link>

              {/* Canteiros de Obras */}
              <Link
                to="/obras"
                className="flex flex-col justify-between p-3 rounded-lg border bg-card/80 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium">Obras em Andamento</span>
                  <HardHat className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold">{opStats.obras_ativas_qtd}</span>
                  <span className="text-xs text-muted-foreground">canteiros ativos</span>
                </div>
              </Link>

              {/* Presença Ponto Hoje */}
              <Link
                to="/rh"
                className="flex flex-col justify-between p-3 rounded-lg border bg-card/80 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-medium">Pontos Registrados</span>
                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold">{opStats.pontos_registrados_hoje}</span>
                  <span className="text-xs text-muted-foreground">colaboradores</span>
                </div>
              </Link>
            </div>

            {/* Lista resumida de OSs críticas se houver */}
            {osStats.criticas && osStats.criticas.length > 0 && (
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    OSs Prioritárias para o Dia
                  </span>
                  <Link
                    to="/ordens-servico"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Ver todas →
                  </Link>
                </div>
                <div className="divide-y divide-border/60">
                  {osStats.criticas.slice(0, 3).map((os) => (
                    <div
                      key={os.numero}
                      className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground shrink-0">{os.numero}</span>
                        <span className="truncate text-muted-foreground">{os.titulo}</span>
                        {os.obra_nome && (
                          <span className="hidden sm:inline text-[11px] text-muted-foreground/80">
                            • {os.obra_nome}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant={os.status_prazo === "atrasada" ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-bold ml-2"
                      >
                        {os.status_prazo === "atrasada" ? "Atrasada" : "Hoje"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Diálogo de Disparo de E-mail */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Disparar Resumo do Dia
            </DialogTitle>
            <DialogDescription>
              Envie o boletim matinal com as métricas consolidadas de hoje via Resend.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
              <div className="font-semibold text-foreground">Destinatários automáticos:</div>
              {resumo.destinatarios && resumo.destinatarios.length > 0 ? (
                resumo.destinatarios.map((d) => (
                  <div key={d.email} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>{d.nome} ({d.email})</span>
                  </div>
                ))
              ) : (
                <div>Administradores e diretores cadastrados.</div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-teste" className="text-xs">
                Enviar para e-mail de teste (opcional)
              </Label>
              <Input
                id="email-teste"
                placeholder="seu-email@dominio.com"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para enviar a todos os gestores cadastrados.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogAberto(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleEnviarEmail}
              disabled={enviando}
              className="gap-1.5"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Disparando...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Enviar Boletim Agora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
