import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2, LayoutDashboard, Image, Folder, DollarSign, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client.custom";
import { PortalContext } from "@/hooks/use-portal-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { loading, user, perfil } = useAuth();
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    } else if (!loading && user && perfil?.perfil !== "cliente") {
      // Usuários não-clientes (admin, diretor, etc.) e perfis nulos não pertencem ao portal
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, perfil, navigate]);

  // Fetch client obras
  const { data: obras, isLoading: loadingObras } = useQuery({
    queryKey: ["portal-obras", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("obras")
        .select("id, numero, nome")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as { id: string; numero: string; nome: string }[];
    },
    enabled: !!user,
  });

  // Automatically select the first obra
  useEffect(() => {
    if (obras && obras.length > 0 && !selectedObraId) {
      const saved = localStorage.getItem("portal_active_obra_id");
      const matched = obras.find((o) => o.id === saved);
      setSelectedObraId(matched ? matched.id : obras[0].id);
    }
  }, [obras, selectedObraId]);

  const handleObraChange = (id: string) => {
    setSelectedObraId(id);
    localStorage.setItem("portal_active_obra_id", id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading || !user || (loadingObras && !selectedObraId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeObra = obras?.find((o) => o.id === selectedObraId);
  const nomeUsuario = perfil?.nome ?? user.email?.split("@")[0] ?? "Cliente";

  const menuItems = [
    { label: "Resumo", icon: LayoutDashboard, to: "/portal" },
    { label: "Fotos", icon: Image, to: "/portal/fotos" },
    { label: "Documentos", icon: Folder, to: "/portal/documentos" },
    { label: "Financeiro", icon: DollarSign, to: "/portal/financeiro" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm md:text-base hidden sm:inline-block">ERP Obras</span>
            
            {obras && obras.length > 0 && (
              <div className="max-w-[200px] sm:max-w-[300px]">
                <Select value={selectedObraId || ""} onValueChange={handleObraChange}>
                  <SelectTrigger className="h-9 py-1 text-xs md:text-sm border-none bg-slate-100 focus:ring-0">
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs md:text-sm">
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {nomeUsuario.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium hidden md:inline-block text-slate-700">{nomeUsuario}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground size-8">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation (Tabs style) */}
      <div className="hidden md:block bg-background border-b py-2 sticky top-16 z-30">
        <div className="container px-4">
          <nav className="flex gap-1">
            {menuItems.map((item) => {
              const active = item.to === "/portal" ? path === "/portal" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 container py-6 px-4 max-w-4xl mx-auto">
        {selectedObraId ? (
          <PortalContext.Provider value={{ obraId: selectedObraId }}>
            <Outlet />
          </PortalContext.Provider>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="size-12 text-slate-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700">Nenhuma obra vinculada</h2>
            <p className="text-sm text-slate-500 max-w-xs mt-1">
              Não encontramos nenhuma obra associada à sua conta de cliente.
            </p>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex h-16 items-center justify-around px-2 pb-safe">
        {menuItems.map((item) => {
          const active = item.to === "/portal" ? path === "/portal" : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="size-5 mb-1" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
