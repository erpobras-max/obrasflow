import { Badge } from "@/components/ui/badge";

export function ContratoStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ativo":
      return (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 font-medium">
          Ativo
        </Badge>
      );
    case "em_aprovacao":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 font-medium">
          Em Aprovação
        </Badge>
      );
    case "concluido":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50 font-medium">
          Concluído
        </Badge>
      );
    case "cancelado":
      return (
        <Badge variant="outline" className="border-rose-500 text-rose-700 bg-rose-50 font-medium">
          Cancelado
        </Badge>
      );
    case "rascunho":
    default:
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50 font-medium">
          Rascunho
        </Badge>
      );
  }
}

export function MedicaoStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "aprovada":
      return (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 font-medium">
          Aprovada
        </Badge>
      );
    case "paga":
      return (
        <Badge variant="outline" className="border-indigo-500 text-indigo-700 bg-indigo-50 font-medium">
          Paga
        </Badge>
      );
    case "em_aprovacao":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 font-medium">
          Em Aprovação
        </Badge>
      );
    case "reprovada":
      return (
        <Badge variant="outline" className="border-rose-500 text-rose-700 bg-rose-50 font-medium">
          Reprovada
        </Badge>
      );
    case "cancelada":
      return (
        <Badge variant="outline" className="border-zinc-400 text-zinc-600 bg-zinc-100 font-medium">
          Cancelada
        </Badge>
      );
    case "rascunho":
    default:
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50 font-medium">
          Rascunho
        </Badge>
      );
  }
}

