import { createFileRoute } from "@tanstack/react-router";
import { HardHat } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { EmpreiteirosCadastroPanel } from "@/components/prestadores/empreiteiros-cadastro-panel";

export const Route = createFileRoute("/_app/prestadores")({
  component: PrestadoresPage,
});

function PrestadoresPage() {
  const { roles } = useAuth();
  const podeGerenciar = roles.some((role) => ["admin", "compras"].includes(role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HardHat className="size-6 text-primary" /> Cadastro de empreiteiros
        </h1>
        <p className="text-sm text-muted-foreground">
          Centralize pessoas físicas e empresas disponíveis para contratos de empreitada.
        </p>
      </div>
      <EmpreiteirosCadastroPanel podeGerenciar={podeGerenciar} />
    </div>
  );
}
