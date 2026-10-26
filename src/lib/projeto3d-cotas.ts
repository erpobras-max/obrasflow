import type { CotaLinear, Ponto2D, ReferenciaPontoCota } from "@/types/projeto3d";

type ProjetoComParedes = { paredes: Array<{ id: string; p1: Ponto2D; p2: Ponto2D }> };

export function resolverPontoCota(dados: ProjetoComParedes, referencia: ReferenciaPontoCota): Ponto2D {
  if (referencia.tipo === "livre") return referencia.ponto;
  return dados.paredes.find((parede) => parede.id === referencia.paredeId)?.[referencia.ponto] ?? referencia.fallback;
}

export function calcularCotaLinear(dados: ProjetoComParedes, cota: CotaLinear) {
  const inicio = resolverPontoCota(dados, cota.inicio);
  const fim = resolverPontoCota(dados, cota.fim);
  return { inicio, fim, distancia: Math.hypot(fim.x - inicio.x, fim.y - inicio.y) };
}

function distanciaAoSegmento(ponto: Ponto2D, inicio: Ponto2D, fim: Ponto2D) {
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const comprimentoQuadrado = dx * dx + dy * dy;
  if (comprimentoQuadrado === 0) return Math.hypot(ponto.x - inicio.x, ponto.y - inicio.y);
  const t = Math.max(0, Math.min(1, ((ponto.x - inicio.x) * dx + (ponto.y - inicio.y) * dy) / comprimentoQuadrado));
  return Math.hypot(ponto.x - (inicio.x + t * dx), ponto.y - (inicio.y + t * dy));
}

export function encontrarCotaLinearProxima(
  dados: ProjetoComParedes,
  cotas: CotaLinear[],
  ponto: Ponto2D,
  tolerancia: number
) {
  return cotas.find((cota) => {
    const calculada = calcularCotaLinear(dados, cota);
    return distanciaAoSegmento(ponto, calculada.inicio, calculada.fim) <= tolerancia;
  }) ?? null;
}
