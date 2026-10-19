import { createFileRoute } from "@tanstack/react-router";
import { EstudioProjeto3D } from "@/components/projeto3d/EstudioProjeto3D";

export const Route = createFileRoute("/_app/obras/$id/projeto")({
  component: ObraProjeto3DPage,
});

function ObraProjeto3DPage() {
  const { id } = Route.useParams();
  return <EstudioProjeto3D obraId={id} />;
}
