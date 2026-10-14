import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardList, HardHat, LoaderCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client.custom";

export type ObraOption = { id: string; numero: string; nome: string };
export type PrestadorOption = { id: string; razao_social: string; especialidade: string | null };

type ServicoRow = {
  id: string;
  obra_id: string;
  fornecedor_id: string;
  tipo_servico: string;
  descricao: string | null;
  quantidade: number;
  valor_total: number;
  data_inicio: string;
  data_fim: string | null;
  status: string;
};

type MedicaoRow = {
  id: string;
  servico_id: string;
  quantidade_executada: number;
  valor_total: number;
  data_medicao: string;
  data_vencimento: string;
  status: string;
};

type Props = {
  obras: ObraOption[];
  fornecedores: PrestadorOption[];
  podeAprovar: boolean;
  isAdmin: boolean;
};

const moeda = (centavos: number) =>
  (Number(centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";

export function PrestadoresServicosPanel({ obras, fornecedores, podeAprovar, isAdmin }: Props) {
  const servicosQuery = useQuery({
    queryKey: ["servicos-terceirizados"],
    queryFn: async () => {
      // Estas tabelas ainda não constam nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("servicos_terceirizados")
        .select("*")
        .order("ordem")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServicoRow[];
    },
  });
  const medicoesQuery = useQuery({
    queryKey: ["medicoes-terceirizados"],
    queryFn: async () => {
      // Estas tabelas ainda não constam nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("medicoes_terceirizados")
        .select("*")
        .order("data_medicao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MedicaoRow[];
    },
  });

  const servicos = servicosQuery.data ?? [];
  const medicoes = medicoesQuery.data ?? [];
  const obrasMap = new Map(obras.map((obra) => [obra.id, `${obra.numero} — ${obra.nome}`]));
  const prestadoresMap = new Map(fornecedores.map((item) => [item.id, item.razao_social]));

  if (servicosQuery.isLoading || medicoesQuery.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" /> Carregando serviços e medições…
      </div>
    );
  }

  const queryError = servicosQuery.error ?? medicoesQuery.error;
  if (queryError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>
          Não foi possível carregar os serviços de prestadores. {(queryError as Error).message}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Serviços contratados</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{servicos.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Medições</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{medicoes.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {medicoes.filter((item) => item.status === "rascunho").length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="size-5" /> Serviços contratados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {servicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum serviço contratado cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {servicos.map((servico) => (
                <article key={servico.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{servico.tipo_servico}</h3>
                      <p className="text-sm text-muted-foreground">
                        {prestadoresMap.get(servico.fornecedor_id) ?? "Prestador não encontrado"} ·{" "}
                        {obrasMap.get(servico.obra_id) ?? "Obra não encontrada"}
                      </p>
                      {servico.descricao && <p className="mt-1 text-sm">{servico.descricao}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{moeda(servico.valor_total)}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {servico.status.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Quantidade: {Number(servico.quantidade).toLocaleString("pt-BR")} · Período:{" "}
                    {dataBR(servico.data_inicio)} a {dataBR(servico.data_fim)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" /> Medições
          </CardTitle>
        </CardHeader>
        <CardContent>
          {medicoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma medição cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {medicoes.map((medicao) => {
                const servico = servicos.find((item) => item.id === medicao.servico_id);
                return (
                  <article
                    key={medicao.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{servico?.tipo_servico ?? "Serviço removido"}</p>
                      <p className="text-sm text-muted-foreground">
                        {servico ? (prestadoresMap.get(servico.fornecedor_id) ?? "Prestador") : ""}{" "}
                        · Medição em {dataBR(medicao.data_medicao)} · Vencimento{" "}
                        {dataBR(medicao.data_vencimento)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quantidade executada:{" "}
                        {Number(medicao.quantidade_executada).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{moeda(medicao.valor_total)}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {medicao.status.replaceAll("_", " ")}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {podeAprovar ? "Seu perfil pode aprovar medições." : "Perfil somente para consulta."}
        {isAdmin ? " Administração habilitada." : ""}
      </p>
    </div>
  );
}

