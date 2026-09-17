import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canAccess } from "@/lib/permissions";

export const Route = createFileRoute("/_app/imobiliaria")({
  component: ImobiliariaLayout,
});

function ImobiliariaLayout() {
  const { loading, perfil } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && perfil && !canAccess(perfil.perfil, "imobiliaria")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, perfil, navigate]);

  useEffect(() => {
    if (path === "/imobiliaria") {
      navigate({ to: "/imobiliaria/imoveis", replace: true });
    }
  }, [path, navigate]);

  return <Outlet />;
}
