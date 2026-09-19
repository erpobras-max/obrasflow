import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileSignature,
  Loader2,
  PenLine,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { SignatureCanvas } from "@/components/contratos/assinaturas-contrato";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client.custom";

export const Route = createFileRoute("/portal/contratos")({ component: PortalContratos });

type Pessoa = {
  nome?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
};

type ContratoPortal = {
  tipo: "civil" | "locacao";
  id: string;
  numero: string;
  titulo: string;
  objeto?: string | null;
  status: string;
  valor: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  observacoes?: string | null;
  dia_vencimento?: number | null;
  garantia_tipo?: string | null;
  garantia_valor?: number | null;
  cliente: Pessoa;
  locador?: Pessoa | null;
  imovel?: Pessoa & { titulo?: string | null; codigo?: string | null };
  empresa?: Pessoa & {
    razao_social?: string | null;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    endereco?: string | null;
  };
  assinado: boolean;
  assinado_em?: string | null;
};

const moeda = (valor: number) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const data = (valor?: string | null) =>
  valor ? new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR") : "A definir";

const endereco = (pessoa?: Pessoa | null) =>
  pessoa
    ? [
        pessoa.logradouro,
        pessoa.numero,
        pessoa.complemento,
        pessoa.bairro,
        pessoa.cidade,
        pessoa.uf,
        pessoa.cep,
      ]
        .filter(Boolean)
        .join(", ") || "—"
    : "—";

function PortalContratos() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ContratoPortal | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const {
    data: contratos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["portal-contratos"],
    queryFn: async () => {
      const { data: result, error: queryError } = await supabase.rpc(
        "listar_contratos_portal" as never,
      );
      if (queryError) throw queryError;
      return (result ?? []) as ContratoPortal[];
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !signature) throw new Error("Desenhe sua assinatura para continuar.");
      const { error: signError } = await supabase.rpc(
        "assinar_contrato_portal" as never,
        {
          _tipo: selected.tipo,
          _documento_id: selected.id,
          _assinatura_data_url: signature,
        } as never,
      );
      if (signError) throw signError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portal-contratos"] });
      setSignatureOpen(false);
      setSelected(null);
      toast.success("Contrato assinado com sucesso.");
    },
    onError: (mutationError: Error) =>
      toast.error(mutationError.message || "Não foi possível registrar a assinatura."),
  });

  const openSignature = () => {
    setSignature(null);
    setResetKey((value) => value + 1);
    setSignatureOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Não foi possível carregar seus contratos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus contratos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte os documentos vinculados ao seu cadastro e assine os pendentes.
        </p>
      </div>

      {contratos.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileSignature className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-3 font-semibold">Nenhum contrato encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando um contrato for vinculado ao seu cadastro, ele aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contratos.map((contrato) => (
            <Card key={`${contrato.tipo}-${contrato.id}`} className="overflow-hidden">
              <CardHeader className="border-b bg-slate-50/70 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{contrato.numero}</p>
                    <CardTitle className="mt-1 text-base">{contrato.titulo}</CardTitle>
                  </div>
                  <Badge
                    className={
                      contrato.assinado
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                    }
                  >
                    {contrato.assinado ? "Assinado" : "Pendente"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-semibold">{moeda(contrato.valor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="font-semibold">{data(contrato.data_inicio)}</p>
                  </div>
                </div>
                {contrato.assinado_em && (
                  <p className="flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle2 className="size-4" /> Assinado em{" "}
                    {new Date(contrato.assinado_em).toLocaleString("pt-BR")}
                  </p>
                )}
                <Button variant="outline" className="w-full" onClick={() => setSelected(contrato)}>
                  <Eye className="size-4" /> Visualizar contrato
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selected) && !signatureOpen}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{selected?.titulo}</DialogTitle>
            <DialogDescription>Revise todo o documento antes de assinar.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir / Salvar PDF
            </Button>
            {selected && !selected.assinado && (
              <Button onClick={openSignature}>
                <PenLine className="size-4" /> Assinar contrato
              </Button>
            )}
          </div>
          {selected && <ContractDocument contract={selected} />}
        </DialogContent>
      </Dialog>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assinar contrato</DialogTitle>
            <DialogDescription>
              Desenhe sua assinatura. Seu nome e documento serão vinculados automaticamente pelo
              cadastro autenticado.
            </DialogDescription>
          </DialogHeader>
          <SignatureCanvas onChange={setSignature} resetKey={resetKey} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!signature || signMutation.isPending}
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar
              assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractDocument({ contract }: { contract: ContratoPortal }) {
  const companyName =
    contract.empresa?.nome_fantasia || contract.empresa?.razao_social || "Empresa contratada";
  return (
    <article className="portal-contract-print mx-auto w-full max-w-[794px] bg-white p-5 text-[12px] leading-6 text-slate-900 shadow-sm sm:p-8 print:max-w-none print:p-8 print:shadow-none">
      <style>{`@media print { body * { visibility:hidden!important } .portal-contract-print,.portal-contract-print * { visibility:visible!important } .portal-contract-print { position:absolute; inset:0; width:100% } @page { size:A4; margin:12mm } }`}</style>
      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-5">
        <div>
          <h1 className="text-lg font-bold">{companyName}</h1>
          <p>CNPJ: {contract.empresa?.cnpj || "—"}</p>
          <p>{contract.empresa?.endereco || endereco(contract.empresa)}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">CONTRATO</h2>
          <p>Nº {contract.numero}</p>
        </div>
      </header>
      <h2 className="mt-6 text-center text-base font-bold uppercase">
        {contract.tipo === "locacao"
          ? "Instrumento particular de contrato de locação"
          : "Contrato de prestação de serviços"}
      </h2>
      <section className="mt-5 space-y-3 text-justify">
        {contract.tipo === "civil" ? (
          <>
            <p>
              <b>CONTRATANTE:</b> {contract.cliente.nome}, documento{" "}
              {contract.cliente.documento || "—"}, com endereço em {endereco(contract.cliente)}.
            </p>
            <p>
              <b>CONTRATADA:</b> {companyName}, CNPJ {contract.empresa?.cnpj || "—"}.
            </p>
            <p>
              <b>CLÁUSULA 1ª — OBJETO.</b> {contract.objeto || contract.titulo}.
            </p>
            <p>
              <b>CLÁUSULA 2ª — VALOR.</b> O valor total contratado é de{" "}
              <b>{moeda(contract.valor)}</b>.
            </p>
            <p>
              <b>CLÁUSULA 3ª — VIGÊNCIA.</b> De {data(contract.data_inicio)} até{" "}
              {data(contract.data_fim)}.
            </p>
          </>
        ) : (
          <>
            <p>
              <b>LOCADOR:</b> {contract.locador?.nome || "—"}, documento{" "}
              {contract.locador?.documento || "—"}.
            </p>
            <p>
              <b>LOCATÁRIO:</b> {contract.cliente.nome}, documento{" "}
              {contract.cliente.documento || "—"}.
            </p>
            <p>
              <b>IMÓVEL LOCADO:</b> {endereco(contract.imovel)}.
            </p>
            <p>
              <b>VALOR E VENCIMENTO.</b> Aluguel mensal de <b>{moeda(contract.valor)}</b>, com
              vencimento no dia {contract.dia_vencimento || "—"}.
            </p>
            <p>
              <b>VIGÊNCIA.</b> De {data(contract.data_inicio)} até {data(contract.data_fim)}.
            </p>
            <p>
              <b>GARANTIA.</b> Modalidade{" "}
              {contract.garantia_tipo?.replaceAll("_", " ") || "sem garantia"}
              {contract.garantia_valor ? `, no valor de ${moeda(contract.garantia_valor)}` : ""}.
            </p>
          </>
        )}
        <p>
          <b>CONDIÇÕES GERAIS.</b> As partes declaram conhecer e aceitar as condições, valores,
          prazos e responsabilidades descritos neste instrumento.
        </p>
        {contract.observacoes && (
          <p>
            <b>OBSERVAÇÕES.</b> {contract.observacoes}
          </p>
        )}
      </section>
      <footer className="mt-14 grid grid-cols-2 gap-10 text-center">
        <div className="border-t border-slate-700 pt-2">
          <b>{contract.tipo === "locacao" ? "LOCADOR" : "CONTRATADA"}</b>
        </div>
        <div className="border-t border-slate-700 pt-2">
          <b>{contract.tipo === "locacao" ? "LOCATÁRIO" : "CONTRATANTE"}</b>
          {contract.assinado && (
            <p className="mt-1 text-[10px] text-emerald-700">
              Assinado eletronicamente em {new Date(contract.assinado_em!).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      </footer>
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[10px] text-slate-500">
        <CalendarDays className="size-3" /> Documento emitido pelo portal ObrasFlow em{" "}
        {new Date().toLocaleDateString("pt-BR")}
      </p>
    </article>
  );
}
