import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/funcionario")({
  head: () => ({
    meta: [{ title: "ObrasFlow Funcionário" }],
    links: [{ rel: "manifest", href: "/manifest-funcionario.json" }],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { area: "employee", redirect: "/ponto" } });
  },
});
