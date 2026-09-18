import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canAccessAny } from "@/lib/permissions";

export const Route = createFileRoute("/_app/imobiliaria")({
  component: ImobiliariaLayout,
});

function ImobiliariaLayout() {
  const { loading, roles } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !canAccessAny(roles, "imobiliaria")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, roles, navigate]);

  useEffect(() => {
    if (path === "/imobiliaria") {
      navigate({ to: "/imobiliaria/imoveis", replace: true });
    }
  }, [path, navigate]);

  return <Outlet />;
}
