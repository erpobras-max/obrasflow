import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hammer, FileCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  PrestadoresServicosPanel,
  type ObraOption,
  type PrestadorOption,
} from "@/components/prestadores/prestadores-servicos-panel";

export const Route = createFileRoute("/_app/prestadores")({
  component: PrestadoresPage,
});

function PrestadoresPage() {
  const { roles } = useAuth();
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-prestadores"],
    queryFn: async () => {
      // A tabela de obras está presente no banco, mas fora dos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("obras")
        .select("id,numero,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ObraOption[];
    },
  });
  const { data: prestadores = [] } = useQuery({
    queryKey: ["prestadores-servicos"],
    queryFn: async () => {
      // A classificação de terceirizado ainda não consta nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("fornecedores")
        .select("id,razao_social,especialidade")
        .eq("classificacao", "terceirizado")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as PrestadorOption[];
    },
  });
  const podeAprovar = roles.some((role) =>
    ["admin", "diretor", "compras", "engenharia", "financeiro", "financeiro_civil"].includes(role),
  );
  const isAdmin = roles.includes("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Hammer className="size-6 text-primary" /> Prestadores de serviços
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastre serviços terceirizados, registre medições executadas e acompanhe os pagamentos
          por obra.
        </p>
      </div>
      <PrestadoresServicosPanel
        obras={obras}
        fornecedores={prestadores}
        podeAprovar={podeAprovar}
        isAdmin={isAdmin}
      />
    </div>
  );
}

