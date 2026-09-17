import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client.custom";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

interface Perfil {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  perfil: AppRole;
  avatar_url: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  roles: AppRole[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    perfil: null,
    roles: [],
  });

  useEffect(() => {
    let active = true;

    const loadPerfil = async (user: User | null) => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("perfis_usuarios")
        .select("id, user_id, nome, email, perfil, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return null;
      return (data as Perfil | null) ?? null;
    };

    const loadRoles = async (user: User | null) => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) return [];
      return (data?.map(r => r.role as AppRole)) ?? [];
    };

    const applySession = async (session: Session | null) => {
      const perfil = await loadPerfil(session?.user ?? null);
      const loadedRoles = await loadRoles(session?.user ?? null);
      const roles = Array.from(new Set([
        ...loadedRoles,
        ...(perfil?.perfil ? [perfil.perfil] : []),
      ]));

      if (!active) return;
      setState({
        loading: false,
        session,
        user: session?.user ?? null,
        perfil,
        roles,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
