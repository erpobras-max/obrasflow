import { EmpresaLogo } from "@/components/empresa-logo";
import { ClausulasDocumento } from "@/components/contratos/clausulas-documento";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client.custom";
import { imprimirElemento } from "@/lib/impressao";
import { formatarDocumento } from "@/lib/documento";
import type { ClausulaContrato } from "@/lib/contrato-clausulas";
import {
  AssinaturasContrato,
  AssinaturasImpressao,
  useAssinaturasContrato,
  type SignatarioContrato,
} from "@/components/contratos/assinaturas-contrato";

type Contrato = {
  id: string;
  numero: string;
  titulo: string;
  objeto: string | null;
  valor_total: number;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  cliente_id: string;
  clausulas?: ClausulaContrato[] | null;
};
type Cliente = {
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};
type Empresa = {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  logo_url: string | null;
  clausula_padrao: string | null;
};

const brl = (valor: number) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) =>
  valor ? new Date(valor + "T00:00").toLocaleDateString("pt-BR") : "A definir";
const endereco = (
  dados:
    | Pick<
        Empresa,
        "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "cep" | "endereco"
      >
    | Cliente
    | null
    | undefined,
) =>
  dados
    ? [
        dados.logradouro,
        dados.numero,
        "complemento" in dados ? dados.complemento : null,
        dados.bairro,
        dados.cidade,
        dados.uf,
        dados.cep,
      ]
        .filter(Boolean)
        .join(", ") ||
      ("endereco" in dados ? dados.endereco : "") ||
      "—"
    : "—";

export function ContratoImpressao({
  contrato,
  open,
  onOpenChange,
}: {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const printRef = useRef<HTMLElement>(null);
  const { data: documento, isLoading } = useQuery({
    queryKey: ["contrato-impressao", contrato?.id],
    enabled: Boolean(contrato && open),
    queryFn: async () => {
      const [cliente, empresa] = await Promise.all([
        supabase
          .from("clientes")
          .select("nome,cpf_cnpj,email,telefone,logradouro,numero,bairro,cidade,uf,cep")
          .eq("id", contrato!.cliente_id)
          .maybeSingle(),
        supabase.from("configuracoes_empresa").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (cliente.error) throw cliente.error;
      if (empresa.error) throw empresa.error;
      return { cliente: cliente.data as Cliente | null, empresa: empresa.data as Empresa | null };
    },
  });
  const { data: assinaturas = [] } = useAssinaturasContrato({
    contratoId: contrato?.id,
    enabled: Boolean(contrato && open),
  });
  const signatarios: SignatarioContrato[] = [
    {
      papel: "contratada",
      label: "CONTRATADA",
      nome: documento?.empresa?.razao_social || documento?.empresa?.nome_fantasia,
      documento: documento?.empresa?.cnpj,
    },
    {
      papel: "contratante",
      label: "CONTRATANTE",
      nome: documento?.cliente?.nome,
      documento: documento?.cliente?.cpf_cnpj,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto print:max-w-none print:border-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Contrato pronto para emissão</DialogTitle>
          <DialogDescription>
            Use a impressão do navegador para salvar uma cópia em PDF ou enviar para assinatura.
          </DialogDescription>
        </DialogHeader>
        <div className="print:hidden flex flex-wrap items-center gap-3">
          <Button
            onClick={() => imprimirElemento(printRef.current, `Contrato ${contrato?.numero || ""}`)}
          >
            <Printer className="size-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
        {contrato && <AssinaturasContrato contratoId={contrato.id} signatarios={signatarios} />}
        {isLoading || !contrato ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <article
            ref={printRef}
            className="print-sheet contract-print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-[12px] text-slate-900 shadow print:max-w-none print:p-10 print:shadow-none"
          >
            <style>{`@media print { @page { size:A4; margin:12mm; } html,body { background:#fff!important; } .contract-print-sheet { position:relative!important; display:block!important; width:100%!important; max-width:none!important; margin:0!important; box-shadow:none!important; } }`}</style>
            <header className="border-b-2 border-slate-800 pb-5">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-3">
                  {documento?.empresa?.logo_url && (
                    <EmpresaLogo
                      value={documento.empresa.logo_url}
                      className="h-12 w-auto object-contain rounded shadow-sm"
                    />
                  )}
                  <div>
                    <h1 className="text-lg font-bold">
                      {documento?.empresa?.nome_fantasia ||
                        documento?.empresa?.razao_social ||
                        "Empresa"}
                    </h1>
                    <p>{documento?.empresa?.razao_social}</p>
                    <p>
                      CNPJ: {documento?.empresa?.cnpj || "Não informado"}
                      {documento?.empresa?.inscricao_estadual
                        ? ` · IE: ${documento.empresa.inscricao_estadual}`
                        : ""}
                    </p>
                    <p>{endereco(documento?.empresa)}</p>
                    <p>
                      {[documento?.empresa?.telefone, documento?.empresa?.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold">CONTRATO</h2>
                  <p>
                    <b>Nº:</b> {contrato.numero}
                  </p>
                  <p>
                    <b>Emissão:</b> {new Date().toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </header>
            <h2 className="mt-6 text-center text-base font-bold uppercase">
              Contrato de prestação de serviços
            </h2>
            <section className="mt-5 space-y-3 leading-6">
              <p>
                <b>CONTRATANTE:</b> {documento?.cliente?.nome || "Cliente"},{" "}
                {formatarDocumento(documento?.cliente?.cpf_cnpj)}, com endereço em{" "}
                {endereco(documento?.cliente)}.
              </p>
              <p>
                <b>CONTRATADA:</b> {documento?.empresa?.razao_social || "Empresa"},{" "}
                {formatarDocumento(documento?.empresa?.cnpj)}, com endereço em{" "}
                {endereco(documento?.empresa)}.
              </p>
              <ClausulasDocumento
                clausulas={contrato.clausulas}
                objeto={contrato.objeto || contrato.titulo}
                inicio={data(contrato.data_inicio)}
                fim={data(contrato.data_fim)}
                valor={brl(contrato.valor_total)}
              />
              {documento?.empresa?.clausula_padrao && (
                <p>
                  <b>CONDIÇÕES ESPECÍFICAS.</b> {documento.empresa.clausula_padrao}
                </p>
              )}
              {contrato.observacoes && (
                <p>
                  <b>OBSERVAÇÕES.</b> {contrato.observacoes}
                </p>
              )}
            </section>
            <AssinaturasImpressao assinaturas={assinaturas} signatarios={signatarios} />
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}

