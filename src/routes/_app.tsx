import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { loading, user, perfil, roles } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
    else if (!loading && perfil?.ativo === false) {
      void supabase.auth.signOut().then(() => navigate({ to: "/auth", replace: true }));
    }
    else if (!loading && roles.length > 0 && roles.every((role) => role === "cliente")) {
      navigate({ to: "/portal", replace: true });
    } else if (!loading && roles.length > 0 && roles.every((role) => role === "funcionario")) {
      navigate({ to: "/ponto" as any, replace: true });
    }
  }, [loading, user, perfil?.ativo, roles, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar
        roles={roles}
        nome={perfil?.nome ?? user.email ?? "Usuário"}
        email={user.email ?? ""}
        className="hidden lg:flex"
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
