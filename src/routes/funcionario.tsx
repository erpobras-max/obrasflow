import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

function FuncionarioEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/auth", search: { area: "employee", redirect: "/ponto" }, replace: true });
  }, [navigate]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Carregando portal do funcionário…</main>;
}

export const Route = createFileRoute("/funcionario")({
  head: () => ({
    meta: [{ title: "ObrasFlow Funcionário" }],
    links: [{ rel: "manifest", href: "/manifest-funcionario.json" }],
  }),
  component: FuncionarioEntry,
});
