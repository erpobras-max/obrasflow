import {
  Accessibility,
  Bath,
  Car,
  Coffee,
  CookingPot,
  GlassWater,
  Monitor,
  MoreHorizontal,
  Presentation,
  Projector,
  Snowflake,
  Video,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export const COMODIDADES_PADRAO = [
  "Wi-Fi",
  "TV",
  "Ar-condicionado",
  "Projetor",
  "Quadro branco",
  "Videoconferência",
  "Café",
  "Água",
  "Estacionamento",
  "Acessibilidade",
  "Banheiro",
  "Cozinha",
] as const;

const icons: Record<string, LucideIcon> = {
  "wi-fi": Wifi,
  tv: Monitor,
  "ar-condicionado": Snowflake,
  projetor: Projector,
  "quadro branco": Presentation,
  videoconferência: Video,
  cafe: Coffee,
  café: Coffee,
  agua: GlassWater,
  água: GlassWater,
  estacionamento: Car,
  acessibilidade: Accessibility,
  banheiro: Bath,
  cozinha: CookingPot,
};

export function AmenityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name.trim().toLocaleLowerCase("pt-BR")] ?? MoreHorizontal;
  return <Icon className={className} aria-hidden="true" />;
}
