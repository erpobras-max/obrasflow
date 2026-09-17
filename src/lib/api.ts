import { supabase } from "@/integrations/supabase/client.custom";

export const apiClient = {
  obras: () => supabase.from("obras"),
  clientes: () => supabase.from("clientes"),
  contas: () => supabase.from("contas_receber"),
};
