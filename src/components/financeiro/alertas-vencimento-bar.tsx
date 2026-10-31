import { useMemo } from "react";
import { AlertTriangle, Clock, CalendarDays, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AlertasVencimentoBarProps {
  contasReceber: any[];
  contasPagar: any[];
  onFiltrarHoje?: () => void;
  onFiltrarAtrasadas?: () => void;
}

export function AlertasVencimentoBar({
  contasReceber,
  contasPagar,
  onFiltrarHoje,
  onFiltrarAtrasadas,
}: AlertasVencimentoBarProps) {
  const stats = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const em7Dias = new Date();
    em7Dias.setDate(em7Dias.getDate() + 7);
    const em7DiasStr = em7Dias.toISOString().slice(0, 10);

    let hojeReceberQtd = 0;
    let hojeReceberValor = 0;
    let hojePagarQtd = 0;
    let hojePagarValor = 0;

    let prox7ReceberValor = 0;
    let prox7PagarValor = 0;

    let atrasadasReceberQtd = 0;
    let atrasadasReceberValor = 0;
    let atrasadasPagarQtd = 0;
    let atrasadasPagarValor = 0;

    (contasReceber || []).forEach((cr) => {
      if (cr.status === "cancelada" || cr.status === "recebida") return;
      const v = cr.valor_total + (cr.valor_aditivo || 0);

      if (cr.data_vencimento === hojeStr) {
        hojeReceberQtd++;
        hojeReceberValor += v;
      } else if (cr.data_vencimento > hojeStr && cr.data_vencimento <= em7DiasStr) {
        prox7ReceberValor += v;
      } else if (cr.data_vencimento < hojeStr || cr.status === "atrasada") {
        atrasadasReceberQtd++;
        atrasadasReceberValor += v;
      }
    });

    (contasPagar || []).forEach((cp) => {
      if (cp.status === "cancelada" || cp.status === "paga") return;
      const v = cp.valor_total;

      if (cp.data_vencimento === hojeStr) {
        hojePagarQtd++;
        hojePagarValor += v;
      } else if (cp.data_vencimento > hojeStr && cp.data_vencimento <= em7DiasStr) {
        prox7PagarValor += v;
      } else if (cp.data_vencimento < hojeStr || cp.status === "atrasada") {
        atrasadasPagarQtd++;
        atrasadasPagarValor += v;
      }
    });

    return {
      hojeReceberQtd,
      hojeReceberValor,
      hojePagarQtd,
      hojePagarValor,
      prox7ReceberValor,
      prox7PagarValor,
      atrasadasReceberQtd,
      atrasadasReceberValor,
      atrasadasPagarQtd,
      atrasadasPagarValor,
      totalAtrasadasQtd: atrasadasReceberQtd + atrasadasPagarQtd,
      totalHojeQtd: hojeReceberQtd + hojePagarQtd,
    };
  }, [contasReceber, contasPagar]);

  const fmtBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (stats.totalHojeQtd === 0 && stats.totalAtrasadasQtd === 0 && stats.prox7PagarValor === 0 && stats.prox7ReceberValor === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Vence Hoje */}
      <div
        onClick={onFiltrarHoje}
        className={cn(
          "rounded-lg border p-3 flex items-center justify-between cursor-pointer transition-all hover:shadow-sm",
          stats.totalHojeQtd > 0 ? "bg-blue-50/50 border-blue-200" : "bg-card"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-blue-100 text-blue-700">
            <Clock className="size-4" />
          </div>
          <div>
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <span>Vencimentos de Hoje</span>
              {stats.totalHojeQtd > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-200 text-blue-900">
                  {stats.totalHojeQtd}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Pagar: <span className="font-mono font-medium text-red-600">{fmtBRL(stats.hojePagarValor)}</span> • Receber: <span className="font-mono font-medium text-green-600">{fmtBRL(stats.hojeReceberValor)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Próximos 7 dias */}
      <div className="rounded-lg border p-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-slate-100 text-slate-700">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <div className="text-xs font-semibold">Próximos 7 Dias</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Pagar: <span className="font-mono font-medium text-red-600">{fmtBRL(stats.prox7PagarValor)}</span> • Receber: <span className="font-mono font-medium text-green-600">{fmtBRL(stats.prox7ReceberValor)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Em Atraso */}
      <div
        onClick={onFiltrarAtrasadas}
        className={cn(
          "rounded-lg border p-3 flex items-center justify-between cursor-pointer transition-all hover:shadow-sm",
          stats.totalAtrasadasQtd > 0 ? "bg-red-50/50 border-red-200" : "bg-card"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-red-100 text-red-700">
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <span>Títulos em Atraso</span>
              {stats.totalAtrasadasQtd > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {stats.totalAtrasadasQtd}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              A Pagar: <span className="font-mono font-medium text-red-600">{fmtBRL(stats.atrasadasPagarValor)}</span> • A Receber: <span className="font-mono font-medium text-amber-700">{fmtBRL(stats.atrasadasReceberValor)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

