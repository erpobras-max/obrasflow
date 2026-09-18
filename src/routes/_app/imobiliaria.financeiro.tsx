import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canAccessAny } from "@/lib/permissions";
import { FinanceiroPage } from "./financeiro";

export const Route = createFileRoute("/_app/imobiliaria/financeiro")({
  component: FinanceiroImobiliarioPage,
});

function FinanceiroImobiliarioPage() {
  const { loading, roles } = useAuth();
  const navigate = useNavigate();
  const allowed = canAccessAny(roles, "financeiro_imobiliaria");

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/imobiliaria/dashboard", replace: true });
  }, [allowed, loading, navigate]);

  if (loading || !allowed) return null;
  return <FinanceiroPage forcedOrigin="imobiliaria" />;
}
