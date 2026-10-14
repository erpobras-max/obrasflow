import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ClipboardList,
  HardHat,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  valor_unitario: number;
  valor_total: number;
  data_inicio: string;
  data_fim: string | null;
  status: string;
};

type MedicaoRow = {
  id: string;
  servico_id: string;
  quantidade_executada: number;
  valor_unitario: number;
  valor_total: number;
  data_medicao: string;
  data_vencimento: string;
  observacoes: string | null;
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
const hoje = () => new Date().toISOString().slice(0, 10);
const parseMoeda = (value: string) => {
  const texto = value.trim().replace(/\s/g, "");
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  return Math.round(Number(normalizado.replace(/[^\d.-]/g, "")) * 100);
};
const formatarMoedaInput = (centavos: number) =>
  (Number(centavos || 0) / 100).toFixed(2).replace(".", ",");

export function PrestadoresServicosPanel({ obras, fornecedores, podeAprovar, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const [servicoAberto, setServicoAberto] = useState(false);
  const [servicoEditando, setServicoEditando] = useState<ServicoRow | null>(null);
  const [medicaoEditando, setMedicaoEditando] = useState<MedicaoRow | null>(null);
  const [medicaoServicoId, setMedicaoServicoId] = useState("");
  const [servicoForm, setServicoForm] = useState({
    obra_id: "",
    fornecedor_id: "",
    tipo_servico: "",
    descricao: "",
    quantidade: "1",
    valor_unitario: "",
    data_inicio: hoje(),
    data_fim: "",
  });
  const [medicaoForm, setMedicaoForm] = useState({
    quantidade_executada: "",
    valor_unitario: "",
    data_medicao: hoje(),
    data_vencimento: "",
    observacoes: "",
  });
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

  const salvarServico = useMutation({
    mutationFn: async () => {
      const quantidade = Number(servicoForm.quantidade);
      const valorUnitario = parseMoeda(servicoForm.valor_unitario);
      if (
        !servicoForm.obra_id ||
        !servicoForm.fornecedor_id ||
        !servicoForm.tipo_servico.trim() ||
        quantidade <= 0 ||
        valorUnitario <= 0 ||
        !servicoForm.data_inicio
      ) {
        throw new Error("Preencha obra, prestador, serviço, quantidade, valor e data de início.");
      }
      const payload = {
        obra_id: servicoForm.obra_id,
        fornecedor_id: servicoForm.fornecedor_id,
        tipo_servico: servicoForm.tipo_servico.trim(),
        descricao: servicoForm.descricao.trim() || null,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total: Math.round(quantidade * valorUnitario),
        data_inicio: servicoForm.data_inicio,
        data_fim: servicoForm.data_fim || null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let request = (supabase as any).from("servicos_terceirizados");
      if (servicoEditando) {
        const quantidadeJaMedida = medicoes
          .filter(
            (medicao) =>
              medicao.servico_id === servicoEditando.id && medicao.status === "financeiro_gerado",
          )
          .reduce((total, medicao) => total + Number(medicao.quantidade_executada), 0);
        if (quantidade < quantidadeJaMedida) {
          throw new Error(
            `A quantidade não pode ficar abaixo das ${quantidadeJaMedida} unidades já aprovadas em medições.`,
          );
        }
        request = request.update(payload).eq("id", servicoEditando.id);
        if (!isAdmin) request = request.eq("status", "rascunho");
      } else {
        request = request.insert({
          ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        });
      }
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error("O serviço foi alterado por outra pessoa ou seu perfil não pode editá-lo.");
    },
    onSuccess: () => {
      toast.success(
        servicoEditando ? "Serviço contratado atualizado." : "Serviço contratado cadastrado.",
      );
      setServicoAberto(false);
      setServicoEditando(null);
      setServicoForm({
        obra_id: "",
        fornecedor_id: "",
        tipo_servico: "",
        descricao: "",
        quantidade: "1",
        valor_unitario: "",
        data_inicio: hoje(),
        data_fim: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["servicos-terceirizados"] });
      void queryClient.invalidateQueries({ queryKey: ["medicoes-terceirizados"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const excluirServico = useMutation({
    mutationFn: async (servico: ServicoRow) => {
      if (
        !window.confirm(
          `Excluir o serviço contratado “${servico.tipo_servico}”? As medições vinculadas serão removidas; lançamentos financeiros já gerados permanecem no financeiro.`,
        )
      )
        return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let request = (supabase as any).from("servicos_terceirizados").delete().eq("id", servico.id);
      if (!isAdmin) request = request.eq("status", "rascunho");
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "O serviço não pôde ser excluído. Atualize a tela e confira as permissões.",
        );
      return true;
    },
    onSuccess: (excluido) => {
      if (!excluido) return;
      toast.success("Serviço contratado excluído.");
      void queryClient.invalidateQueries({ queryKey: ["servicos-terceirizados"] });
      void queryClient.invalidateQueries({ queryKey: ["medicoes-terceirizados"] });
      void queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const salvarMedicao = useMutation({
    mutationFn: async () => {
      const quantidade = Number(medicaoForm.quantidade_executada);
      const valorUnitario = parseMoeda(medicaoForm.valor_unitario);
      if (
        !medicaoServicoId ||
        quantidade <= 0 ||
        valorUnitario <= 0 ||
        !medicaoForm.data_medicao ||
        !medicaoForm.data_vencimento
      ) {
        throw new Error("Informe serviço, quantidade executada, valor unitário e datas.");
      }
      const payload = {
        servico_id: medicaoServicoId,
        quantidade_executada: quantidade,
        valor_unitario: valorUnitario,
        valor_total: Math.round(quantidade * valorUnitario),
        data_medicao: medicaoForm.data_medicao,
        data_vencimento: medicaoForm.data_vencimento,
        observacoes: medicaoForm.observacoes.trim() || null,
      };
      const request = medicaoEditando
        ? (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .from("medicoes_terceirizados")
            .update(payload)
            .eq("id", medicaoEditando.id)
            .eq("status", "rascunho")
        : (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .from("medicoes_terceirizados")
            .insert({
              ...payload,
              created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
            });
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (medicaoEditando && !data)
        throw new Error("A medição não está mais em rascunho. Atualize a tela e tente novamente.");
    },
    onSuccess: () => {
      toast.success(medicaoEditando ? "Medição atualizada." : "Medição cadastrada como rascunho.");
      setMedicaoEditando(null);
      setMedicaoServicoId("");
      setMedicaoForm({
        quantidade_executada: "",
        valor_unitario: "",
        data_medicao: hoje(),
        data_vencimento: "",
        observacoes: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["medicoes-terceirizados"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aprovarServico = useMutation({
    mutationFn: async (servicoId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("servicos_terceirizados")
        .update({ status: "aprovado" })
        .eq("id", servicoId)
        .eq("status", "rascunho");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço aprovado; já é possível lançar medições.");
      void queryClient.invalidateQueries({ queryKey: ["servicos-terceirizados"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aprovarMedicao = useMutation({
    mutationFn: async (medicaoId: string) => {
      // A função ainda não consta nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("aprovar_medicao_terceirizado", {
        p_medicao_id: medicaoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medição aprovada e enviada ao Financeiro.");
      void queryClient.invalidateQueries({ queryKey: ["medicoes-terceirizados"] });
      void queryClient.invalidateQueries({ queryKey: ["servicos-terceirizados"] });
      void queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const abrirNovaMedicao = (servico: ServicoRow) => {
    setMedicaoEditando(null);
    setMedicaoServicoId(servico.id);
    setMedicaoForm({
      quantidade_executada: "",
      valor_unitario: formatarMoedaInput(servico.valor_unitario),
      data_medicao: hoje(),
      data_vencimento: "",
      observacoes: "",
    });
  };
  const abrirEdicaoServico = (servico: ServicoRow) => {
    setServicoEditando(servico);
    setServicoForm({
      obra_id: servico.obra_id,
      fornecedor_id: servico.fornecedor_id,
      tipo_servico: servico.tipo_servico,
      descricao: servico.descricao || "",
      quantidade: String(servico.quantidade),
      valor_unitario: formatarMoedaInput(servico.valor_unitario),
      data_inicio: servico.data_inicio,
      data_fim: servico.data_fim || "",
    });
    setServicoAberto(true);
  };
  const abrirEdicaoMedicao = (medicao: MedicaoRow) => {
    setMedicaoEditando(medicao);
    setMedicaoServicoId(medicao.servico_id);
    setMedicaoForm({
      quantidade_executada: String(medicao.quantidade_executada),
      valor_unitario: formatarMoedaInput(medicao.valor_unitario),
      data_medicao: medicao.data_medicao,
      data_vencimento: medicao.data_vencimento,
      observacoes: medicao.observacoes || "",
    });
  };

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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <HardHat className="size-5" /> Serviços contratados
          </CardTitle>
          {podeAprovar && (
            <Button onClick={() => setServicoAberto(true)}>
              <Plus className="mr-2 size-4" />
              Novo serviço
            </Button>
          )}
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
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {(isAdmin || (podeAprovar && servico.status === "rascunho")) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEdicaoServico(servico)}
                          >
                            <Pencil className="mr-1 size-4" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={excluirServico.isPending}
                            onClick={() => excluirServico.mutate(servico)}
                          >
                            <Trash2 className="mr-1 size-4" /> Excluir
                          </Button>
                        </>
                      )}
                      {podeAprovar && servico.status === "rascunho" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={aprovarServico.isPending}
                          onClick={() => aprovarServico.mutate(servico.id)}
                        >
                          <Check className="mr-1 size-4" />
                          Aprovar
                        </Button>
                      )}
                      {podeAprovar && servico.status === "aprovado" && (
                        <Button size="sm" onClick={() => abrirNovaMedicao(servico)}>
                          <Plus className="mr-1 size-4" />
                          Nova medição
                        </Button>
                      )}
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
                    <div className="flex items-center gap-2">
                      {podeAprovar && medicao.status === "rascunho" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEdicaoMedicao(medicao)}
                          >
                            <Pencil className="mr-1 size-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            disabled={aprovarMedicao.isPending}
                            onClick={() => aprovarMedicao.mutate(medicao.id)}
                          >
                            <Check className="mr-1 size-4" />
                            Aprovar e enviar ao financeiro
                          </Button>
                        </>
                      )}
                      <div className="text-right">
                        <p className="font-semibold">{moeda(medicao.valor_total)}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {medicao.status.replaceAll("_", " ")}
                        </p>
                      </div>
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

      <Dialog open={servicoAberto} onOpenChange={setServicoAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {servicoEditando ? "Editar serviço contratado" : "Novo serviço contratado"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select
                value={servicoForm.obra_id}
                onValueChange={(value) => setServicoForm({ ...servicoForm, obra_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.numero} — {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prestador *</Label>
              <Select
                value={servicoForm.fornecedor_id}
                onValueChange={(value) => setServicoForm({ ...servicoForm, fornecedor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o prestador" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de serviço *</Label>
              <Input
                value={servicoForm.tipo_servico}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, tipo_servico: event.target.value })
                }
                placeholder="Ex.: Gesso, elétrica"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade contratada *</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                value={servicoForm.quantidade}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, quantidade: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valor unitário (R$) *</Label>
              <Input
                inputMode="decimal"
                value={servicoForm.valor_unitario}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, valor_unitario: event.target.value })
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de início *</Label>
              <Input
                type="date"
                value={servicoForm.data_inicio}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, data_inicio: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data de término</Label>
              <Input
                type="date"
                value={servicoForm.data_fim}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, data_fim: event.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={servicoForm.descricao}
                onChange={(event) =>
                  setServicoForm({ ...servicoForm, descricao: event.target.value })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Total contratado:{" "}
              {moeda(
                Math.round(
                  Number(servicoForm.quantidade || 0) *
                    Math.max(0, parseMoeda(servicoForm.valor_unitario || "0")),
                ),
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setServicoAberto(false);
                setServicoEditando(null);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={salvarServico.isPending} onClick={() => salvarServico.mutate()}>
              {salvarServico.isPending
                ? "Salvando…"
                : servicoEditando
                  ? "Salvar alterações"
                  : "Salvar serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(medicaoServicoId)}
        onOpenChange={(open) => {
          if (!open) {
            setMedicaoServicoId("");
            setMedicaoEditando(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{medicaoEditando ? "Editar medição" : "Nova medição"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Registre somente a quantidade efetivamente executada. A medição será criada como
            rascunho para conferência.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Serviço</Label>
              <Input
                readOnly
                value={
                  servicos.find((servico) => servico.id === medicaoServicoId)?.tipo_servico || ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade executada *</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                value={medicaoForm.quantidade_executada}
                onChange={(event) =>
                  setMedicaoForm({ ...medicaoForm, quantidade_executada: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valor unitário (R$) *</Label>
              <Input
                inputMode="decimal"
                value={medicaoForm.valor_unitario}
                onChange={(event) =>
                  setMedicaoForm({ ...medicaoForm, valor_unitario: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data da medição *</Label>
              <Input
                type="date"
                value={medicaoForm.data_medicao}
                onChange={(event) =>
                  setMedicaoForm({ ...medicaoForm, data_medicao: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={medicaoForm.data_vencimento}
                onChange={(event) =>
                  setMedicaoForm({ ...medicaoForm, data_vencimento: event.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={medicaoForm.observacoes}
                onChange={(event) =>
                  setMedicaoForm({ ...medicaoForm, observacoes: event.target.value })
                }
              />
            </div>
            <p className="text-sm font-medium sm:col-span-2">
              Total da medição:{" "}
              {moeda(
                Math.round(
                  Number(medicaoForm.quantidade_executada || 0) *
                    Math.max(0, parseMoeda(medicaoForm.valor_unitario || "0")),
                ),
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMedicaoServicoId("");
                setMedicaoEditando(null);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={salvarMedicao.isPending} onClick={() => salvarMedicao.mutate()}>
              {salvarMedicao.isPending ? "Salvando…" : "Salvar medição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

