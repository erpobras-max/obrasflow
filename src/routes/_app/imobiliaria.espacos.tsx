import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Copy,
  DoorOpen,
  Edit3,
  Loader2,
  Plus,
  QrCode,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  EspacoFormDialog,
  type EspacoFormValue,
} from "@/components/imobiliaria/espaco-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client.custom";
import type { Espaco, ReservaEspaco } from "@/lib/espacos";
import { statusReservaLabel } from "@/lib/espacos";
import { deleteR2, uploadR2 } from "@/lib/r2";

export const Route = createFileRoute("/_app/imobiliaria/espacos")({ component: EspacosPage });

const moeda = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function EspacosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<Espaco | null>(null);
  const [shareTarget, setShareTarget] = useState<Espaco | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Espaco | null>(null);

  const spacesQuery = useQuery({
    queryKey: ["imob-espacos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_espacos")
        .select("*, fotos:imob_espaco_fotos(id, object_key, ordem)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Espaco[];
    },
  });

  const reservationsQuery = useQuery({
    queryKey: ["imob-reservas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_reservas")
        .select("*, espaco:imob_espacos(nome, codigo)")
        .order("inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReservaEspaco[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      value,
      files,
      removedKeys,
    }: {
      value: EspacoFormValue;
      files: File[];
      removedKeys: string[];
    }) => {
      const uploaded: string[] = [];
      let photosInserted = false;
      try {
        for (const file of files) uploaded.push(await uploadR2(file, "imobiliaria/espacos"));
        const payload = {
          ...value,
          descricao: value.descricao || null,
          endereco: value.endereco || null,
          regras: value.regras || null,
        };
        let spaceId = target?.id;
        if (spaceId) {
          const { error } = await supabase.from("imob_espacos").update(payload).eq("id", spaceId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("imob_espacos")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          spaceId = data.id;
        }
        if (uploaded.length) {
          const remainingOrders = (target?.fotos ?? [])
            .filter((photo) => !removedKeys.includes(photo.object_key))
            .map((photo) => photo.ordem);
          const firstOrder = Math.max(-1, ...remainingOrders) + 1;
          const rows = uploaded.map((object_key, index) => ({
            espaco_id: spaceId,
            object_key,
            ordem: firstOrder + index,
          }));
          const { error } = await supabase.from("imob_espaco_fotos").insert(rows);
          if (error) throw error;
          photosInserted = true;
        }
        if (removedKeys.length) {
          const { error } = await supabase
            .from("imob_espaco_fotos")
            .delete()
            .eq("espaco_id", spaceId)
            .in("object_key", removedKeys);
          if (error) throw error;
        }
        await Promise.allSettled(removedKeys.map((key) => deleteR2(key)));
      } catch (error) {
        if (!photosInserted) await Promise.allSettled(uploaded.map((key) => deleteR2(key)));
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["imob-espacos"] });
      setFormOpen(false);
      setTarget(null);
      toast.success("Espaço salvo.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar o espaço."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (space: Espaco) => {
      const { error } = await supabase
        .from("imob_espacos")
        .update({ deleted_at: new Date().toISOString(), status: "inativo" })
        .eq("id", space.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["imob-espacos"] });
      setDeleteTarget(null);
      toast.success("Espaço removido do catálogo.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível remover o espaço."),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: Pick<ReservaEspaco, "id" | "status">) => {
      const { error } = await supabase.from("imob_reservas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["imob-reservas"] }),
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível atualizar a reserva."),
  });

  const spaces = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (spacesQuery.data ?? []).filter(
      (space) => !term || `${space.codigo} ${space.nome}`.toLowerCase().includes(term),
    );
  }, [search, spacesQuery.data]);

  const publicUrl =
    shareTarget && typeof window !== "undefined"
      ? `${window.location.origin}/reservar/${shareTarget.token_publico}`
      : "";
  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(publicUrl)}`
    : "";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Salas e reservas</h2>
          <p className="text-sm text-muted-foreground">
            Apresente os espaços e organize a agenda por hora.
          </p>
        </div>
        <Button
          onClick={() => {
            setTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" /> Novo espaço
        </Button>
      </div>

      <Tabs defaultValue="espacos">
        <TabsList>
          <TabsTrigger value="espacos">Espaços</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
        </TabsList>
        <TabsContent value="espacos" className="space-y-4 pt-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código ou nome"
            />
          </div>
          {spacesQuery.isLoading ? (
            <Loading />
          ) : spacesQuery.isError ? (
            <ErrorState />
          ) : spaces.length === 0 ? (
            <EmptySpaces onCreate={() => setFormOpen(true)} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {spaces.map((space) => (
                <Card key={space.id} className="overflow-hidden">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{space.codigo}</p>
                        <CardTitle className="mt-1 text-lg">{space.nome}</CardTitle>
                      </div>
                      <Badge variant={space.status === "publicado" ? "default" : "secondary"}>
                        {space.status}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {space.descricao || "Sem descrição pública."}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Users className="size-4" /> {space.capacidade} pessoas
                      </span>
                      <strong className="text-right text-emerald-700">
                        {moeda(Number(space.valor_hora))}/h
                      </strong>
                      <span className="col-span-2 flex items-center gap-2 text-muted-foreground">
                        <CalendarClock className="size-4" /> {space.horario_abertura.slice(0, 5)}–
                        {space.horario_fechamento.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTarget(space);
                          setFormOpen(true);
                        }}
                      >
                        <Edit3 className="mr-2 size-4" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={space.status !== "publicado"}
                        onClick={() => setShareTarget(space)}
                      >
                        <QrCode className="mr-2 size-4" /> QR e link
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto text-destructive"
                        aria-label={`Remover ${space.nome}`}
                        onClick={() => setDeleteTarget(space)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="reservas" className="pt-3">
          <ReservationsTable
            reservations={reservationsQuery.data ?? []}
            loading={reservationsQuery.isLoading}
            error={reservationsQuery.isError}
            onStatus={(id, status) => statusMutation.mutate({ id, status })}
          />
        </TabsContent>
      </Tabs>

      <EspacoFormDialog
        open={formOpen}
        target={target}
        pending={saveMutation.isPending}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setTarget(null);
        }}
        onSave={(value, files, removedKeys) => saveMutation.mutate({ value, files, removedKeys })}
      />

      <Dialog open={shareTarget !== null} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code da sala</DialogTitle>
            <DialogDescription>
              Imprima este QR e fixe na porta. O endereço permanece o mesmo enquanto a sala existir.
            </DialogDescription>
          </DialogHeader>
          {shareTarget && (
            <div className="space-y-4 text-center">
              <img
                src={qrUrl}
                alt={`QR Code para reservar ${shareTarget.nome}`}
                className="mx-auto size-60 rounded-lg border"
              />
              <p className="break-all rounded-md bg-muted p-3 text-left text-xs">{publicUrl}</p>
              <Button
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="mr-2 size-4" /> Copiar link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este espaço?</AlertDialogTitle>
            <AlertDialogDescription>
              O anúncio será ocultado. As reservas existentes serão preservadas para histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReservationsTable({
  reservations,
  loading,
  error,
  onStatus,
}: {
  reservations: ReservaEspaco[];
  loading: boolean;
  error: boolean;
  onStatus: (id: string, status: ReservaEspaco["status"]) => void;
}) {
  if (loading) return <Loading />;
  if (error) return <ErrorState />;
  if (!reservations.length)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhuma reserva recebida.
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="p-3">Sala</th>
            <th className="p-3">Cliente</th>
            <th className="p-3">Horário</th>
            <th className="p-3">Valor</th>
            <th className="p-3">Pagamento</th>
            <th className="p-3">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td className="p-3">
                <strong>{reservation.espaco?.nome ?? "Sala"}</strong>
                <br />
                <span className="text-xs text-muted-foreground">{reservation.espaco?.codigo}</span>
              </td>
              <td className="p-3">
                {reservation.cliente_nome}
                <br />
                <span className="text-xs text-muted-foreground">{reservation.cliente_email}</span>
              </td>
              <td className="p-3">
                {dataHora(reservation.inicio)}
                <br />
                <span className="text-xs text-muted-foreground">
                  até {dataHora(reservation.fim)}
                </span>
              </td>
              <td className="p-3 font-medium">{moeda(Number(reservation.valor_total))}</td>
              <td className="p-3">
                <Badge variant="outline">{reservation.pagamento_status}</Badge>
              </td>
              <td className="p-3">
                <Select
                  value={reservation.status}
                  onValueChange={(status: ReservaEspaco["status"]) =>
                    onStatus(reservation.id, status)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["solicitada", "confirmada", "cancelada", "finalizada"] as const).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {statusReservaLabel[value]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Carregando…
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
      Não foi possível carregar os dados. Tente novamente.
    </div>
  );
}

function EmptySpaces({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <DoorOpen className="mx-auto size-10 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">Nenhum espaço cadastrado</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre a primeira sala para gerar sua página e QR Code.
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="mr-2 size-4" /> Novo espaço
      </Button>
    </div>
  );
}
