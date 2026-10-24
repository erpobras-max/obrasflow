import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Loader2,
  MapPin,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { PublicPropertyGallery } from "@/components/imobiliaria/public-property-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client.custom";
import { calcularValorReserva, type Espaco } from "@/lib/espacos";
import { formatCpfCnpj, formatTelefone, onlyDigits, validarCPF } from "@/lib/validacao-documento";

export const Route = createFileRoute("/reservar/$token")({ component: ReservarEspacoPage });

type EspacoPublico = Omit<Espaco, "token_publico" | "status">;
type ReservaCriada = {
  id: string;
  status: string;
  valor_total: number;
  inicio: string;
  fim: string;
};

const moeda = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brasiliaDate = (value: string) => new Date(`${value}:00-03:00`);

function minBrasiliaDateTime() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return parts.replace(" ", "T");
}

function ReservarEspacoPage() {
  const { token } = Route.useParams();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [available, setAvailable] = useState(false);
  const [reservation, setReservation] = useState<ReservaCriada | null>(null);
  const [customer, setCustomer] = useState({ nome: "", cpf: "", email: "", telefone: "" });

  const spaceQuery = useQuery({
    queryKey: ["espaco-publico", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "obter_espaco_publico" as never,
        { _token: token } as never,
      );
      if (error) throw error;
      return (data || null) as EspacoPublico | null;
    },
    retry: false,
  });

  const availabilityMutation = useMutation({
    mutationFn: async () => {
      if (!inicio || !fim || brasiliaDate(fim) <= brasiliaDate(inicio))
        throw new Error("Informe um período válido.");
      const { data, error } = await supabase.rpc(
        "consultar_disponibilidade_espaco" as never,
        {
          _token: token,
          _inicio: brasiliaDate(inicio).toISOString(),
          _fim: brasiliaDate(fim).toISOString(),
        } as never,
      );
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: (result) => {
      setAvailable(result);
      if (!result)
        toast.error("Esse horário não está disponível ou está fora do período de atendimento.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reservationMutation = useMutation({
    mutationFn: async () => {
      if (!validarCPF(customer.cpf)) throw new Error("Informe um CPF válido.");
      if (onlyDigits(customer.telefone).length < 10) throw new Error("Informe um telefone válido.");
      const { data, error } = await supabase.rpc(
        "criar_reserva_espaco" as never,
        {
          _token: token,
          _cliente_nome: customer.nome,
          _cliente_cpf: onlyDigits(customer.cpf),
          _cliente_email: customer.email,
          _cliente_telefone: onlyDigits(customer.telefone),
          _inicio: brasiliaDate(inicio).toISOString(),
          _fim: brasiliaDate(fim).toISOString(),
        } as never,
      );
      if (error) throw error;
      return data as ReservaCriada;
    },
    onSuccess: setReservation,
    onError: (error: Error) => {
      setAvailable(false);
      toast.error(error.message || "Não foi possível registrar a reserva.");
    },
  });

  if (spaceQuery.isLoading) return <PageMessage loading text="Carregando sala…" />;
  if (spaceQuery.isError || !spaceQuery.data)
    return <PageMessage text="Esta sala não está disponível para reservas." />;

  const space = spaceQuery.data;
  const price =
    inicio && fim
      ? calcularValorReserva(Number(space.valor_hora), brasiliaDate(inicio), brasiliaDate(fim))
      : 0;
  const resetAvailability = () => setAvailable(false);

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-semibold tracking-tight">ObrasFlow</span>
          <Badge variant="outline">{space.codigo}</Badge>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            Locação por hora
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{space.nome}</h1>
          {space.endereco && (
            <p className="mt-3 flex items-center gap-2 text-stone-600">
              <MapPin className="size-4" /> {space.endereco}
            </p>
          )}
        </section>

        <PublicPropertyGallery
          token={token}
          title={space.nome}
          photos={[...(space.fotos ?? [])].sort((a, b) => a.ordem - b.ordem)}
          resource="espaco"
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardContent className="grid gap-5 p-6 sm:grid-cols-3">
                <Info icon={Users} label="Capacidade" value={`${space.capacidade} pessoas`} />
                <Info
                  icon={Clock3}
                  label="Atendimento"
                  value={`${space.horario_abertura.slice(0, 5)}–${space.horario_fechamento.slice(0, 5)}`}
                />
                <Info
                  icon={CalendarCheck}
                  label="Reserva mínima"
                  value={`${space.duracao_minima_minutos} min`}
                />
              </CardContent>
            </Card>
            {space.descricao && (
              <Card>
                <CardHeader>
                  <CardTitle>Sobre o espaço</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap leading-7 text-stone-600">{space.descricao}</p>
                </CardContent>
              </Card>
            )}
            {space.comodidades.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Comodidades</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {space.comodidades.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1.5 px-3 py-1.5">
                      <Wifi className="size-3.5" /> {item}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {space.regras && (
              <Card>
                <CardHeader>
                  <CardTitle>Regras de uso</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-stone-600">
                    {space.regras}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <p className="text-sm text-stone-500">A partir de</p>
              <CardTitle className="text-3xl text-emerald-700">
                {moeda(Number(space.valor_hora))}
                <span className="text-base font-normal text-stone-500"> / hora</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reservation ? (
                <ReservationSuccess reservation={reservation} />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <Field label="Início — horário de Brasília">
                      <Input
                        type="datetime-local"
                        min={minBrasiliaDateTime()}
                        value={inicio}
                        onChange={(event) => {
                          setInicio(event.target.value);
                          resetAvailability();
                        }}
                      />
                    </Field>
                    <Field label="Término — horário de Brasília">
                      <Input
                        type="datetime-local"
                        min={inicio || minBrasiliaDateTime()}
                        value={fim}
                        onChange={(event) => {
                          setFim(event.target.value);
                          resetAvailability();
                        }}
                      />
                    </Field>
                  </div>
                  {price > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-stone-100 p-3 text-sm">
                      <span>Valor estimado</span>
                      <strong>{moeda(price)}</strong>
                    </div>
                  )}
                  {!available ? (
                    <Button
                      className="w-full"
                      disabled={!inicio || !fim || availabilityMutation.isPending}
                      onClick={() => availabilityMutation.mutate()}
                    >
                      {availabilityMutation.isPending && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}{" "}
                      Verificar disponibilidade
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Horário disponível.
                        Informe seus dados para solicitar a reserva.
                      </div>
                      <form
                        className="space-y-4"
                        onSubmit={(event: FormEvent) => {
                          event.preventDefault();
                          reservationMutation.mutate();
                        }}
                      >
                        <Field label="Nome completo">
                          <Input
                            required
                            minLength={3}
                            maxLength={120}
                            value={customer.nome}
                            onChange={(event) =>
                              setCustomer({ ...customer, nome: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="CPF">
                          <Input
                            required
                            inputMode="numeric"
                            value={customer.cpf}
                            onChange={(event) =>
                              setCustomer({ ...customer, cpf: formatCpfCnpj(event.target.value) })
                            }
                            placeholder="000.000.000-00"
                          />
                        </Field>
                        <Field label="E-mail">
                          <Input
                            required
                            type="email"
                            maxLength={254}
                            value={customer.email}
                            onChange={(event) =>
                              setCustomer({ ...customer, email: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Telefone">
                          <Input
                            required
                            inputMode="tel"
                            value={customer.telefone}
                            onChange={(event) =>
                              setCustomer({
                                ...customer,
                                telefone: formatTelefone(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Button
                          className="w-full"
                          type="submit"
                          disabled={reservationMutation.isPending}
                        >
                          {reservationMutation.isPending && (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          )}{" "}
                          Solicitar reserva
                        </Button>
                      </form>
                    </>
                  )}
                  <p className="flex items-start gap-2 text-xs leading-5 text-stone-500">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" /> A equipe confirmará a
                    solicitação e enviará as instruções de pagamento e acesso.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function ReservationSuccess({ reservation }: { reservation: ReservaCriada }) {
  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
      <div>
        <h2 className="text-xl font-semibold">Solicitação recebida</h2>
        <p className="mt-2 text-sm text-stone-600">
          Seu horário foi reservado provisoriamente. A equipe entrará em contato para confirmar
          pagamento e acesso.
        </p>
      </div>
      <div className="rounded-lg bg-stone-100 p-4 text-sm">
        <p>
          Valor: <strong>{moeda(Number(reservation.valor_total))}</strong>
        </p>
        <p className="mt-1 break-all text-xs text-stone-500">Reserva {reservation.id}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-emerald-700" />
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function PageMessage({ text, loading = false }: { text: string; loading?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <Card className="max-w-md">
        <CardContent className="p-8 text-center">
          {loading ? (
            <Loader2 className="mx-auto size-9 animate-spin text-emerald-700" />
          ) : (
            <DoorOpen className="mx-auto size-10 text-stone-400" />
          )}
          <p className="mt-4 text-stone-600">{text}</p>
        </CardContent>
      </Card>
    </main>
  );
}
