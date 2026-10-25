import type { Parede, Ponto2D } from "@/types/projeto3d";

interface DxfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
}

interface DxfVertex extends Ponto2D {
  bulge: number;
}

export interface ResumoImportacaoDxf {
  unidade: "milimetros" | "centimetros" | "metros" | "polegadas" | "pes" | "nao_declarada";
  fatorEscala: number;
  entidadesLidas: number;
  entidadesConvertidas: number;
  entidadesIgnoradas: number;
  segmentosGerados: number;
  layers: string[];
}

export interface ResultadoImportacaoDxf {
  paredes: Parede[];
  resumo: ResumoImportacaoDxf;
}

const UNIDADES_DXF: Record<number, { unidade: ResumoImportacaoDxf["unidade"]; fator: number }> = {
  1: { unidade: "polegadas", fator: 0.0254 },
  2: { unidade: "pes", fator: 0.3048 },
  4: { unidade: "milimetros", fator: 0.001 },
  5: { unidade: "centimetros", fator: 0.01 },
  6: { unidade: "metros", fator: 1 },
};

function segmentosDeArco(
  centro: Ponto2D,
  raio: number,
  anguloInicial: number,
  varredura: number,
  layer: string
): DxfLine[] {
  if (!Number.isFinite(raio) || raio <= 0 || !Number.isFinite(varredura) || varredura === 0) return [];

  const quantidade = Math.max(2, Math.ceil(Math.abs(varredura) / (Math.PI / 18)));
  const segmentos: DxfLine[] = [];
  for (let indice = 0; indice < quantidade; indice++) {
    const a1 = anguloInicial + (varredura * indice) / quantidade;
    const a2 = anguloInicial + (varredura * (indice + 1)) / quantidade;
    segmentos.push({
      x1: centro.x + Math.cos(a1) * raio,
      y1: centro.y + Math.sin(a1) * raio,
      x2: centro.x + Math.cos(a2) * raio,
      y2: centro.y + Math.sin(a2) * raio,
      layer,
    });
  }
  return segmentos;
}

function segmentosEntreVertices(inicio: DxfVertex, fim: DxfVertex, layer: string): DxfLine[] {
  if (!inicio.bulge) {
    return [{ x1: inicio.x, y1: inicio.y, x2: fim.x, y2: fim.y, layer }];
  }

  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const corda = Math.hypot(dx, dy);
  if (corda === 0) return [];

  const varredura = 4 * Math.atan(inicio.bulge);
  const distanciaCentro = (corda * (1 - inicio.bulge ** 2)) / (4 * inicio.bulge);
  const centro = {
    x: (inicio.x + fim.x) / 2 + (-dy / corda) * distanciaCentro,
    y: (inicio.y + fim.y) / 2 + (dx / corda) * distanciaCentro,
  };
  const raio = Math.hypot(inicio.x - centro.x, inicio.y - centro.y);
  const anguloInicial = Math.atan2(inicio.y - centro.y, inicio.x - centro.x);
  return segmentosDeArco(centro, raio, anguloInicial, varredura, layer);
}

function lerUnidadeDeclarada(linhas: string[]) {
  for (let i = 0; i < linhas.length - 3; i += 2) {
    if (linhas[i]?.trim() !== "9" || linhas[i + 1]?.trim() !== "$INSUNITS") continue;
    for (let j = i + 2; j < Math.min(i + 12, linhas.length - 1); j += 2) {
      if (linhas[j]?.trim() === "70") return UNIDADES_DXF[Number(linhas[j + 1]?.trim())] ?? null;
      if (linhas[j]?.trim() === "9" || linhas[j]?.trim() === "0") break;
    }
  }
  return null;
}

/**
 * Parser leve e nativo de arquivos DXF ASCII do AutoCAD
 * Extrai entidades LINE e LWPOLYLINE e converte para paredes BIM
 */
export function importarDxf(
  conteudoDxf: string,
  espessuraPadrao = 0.15,
  peDireito = 2.80
): ResultadoImportacaoDxf {
  const linhas = conteudoDxf.split(/\r?\n/);
  const segmentos: DxfLine[] = [];
  const layers = new Set<string>();
  let entidadesLidas = 0;
  let entidadesConvertidas = 0;
  let entidadesIgnoradas = 0;

  let i = 0;
  let emEntidades = false;
  while (i < linhas.length) {
    const code = linhas[i]?.trim();
    const val = linhas[i + 1]?.trim();

    if (
      code === "0" &&
      val === "SECTION" &&
      linhas[i + 2]?.trim() === "2" &&
      linhas[i + 3]?.trim() === "ENTITIES"
    ) {
      emEntidades = true;
      i += 4;
      continue;
    }

    if (emEntidades && code === "0" && val === "ENDSEC") break;

    if (!emEntidades) {
      i += 2;
      continue;
    }

    if (code === "0" && val && val !== "ENDSEC") entidadesLidas++;

    if (code === "0" && val === "LINE") {
      i += 2;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0, layer = "";

      while (i < linhas.length && linhas[i]?.trim() !== "0") {
        const c = linhas[i]?.trim();
        const v = linhas[i + 1]?.trim();

        if (c === "8") layer = v;
        if (c === "10") x1 = parseFloat(v) || 0;
        if (c === "20") y1 = parseFloat(v) || 0;
        if (c === "11") x2 = parseFloat(v) || 0;
        if (c === "21") y2 = parseFloat(v) || 0;
        i += 2;
      }

      if (x1 !== x2 || y1 !== y2) {
        segmentos.push({ x1, y1, x2, y2, layer });
        layers.add(layer || "0");
        entidadesConvertidas++;
      } else {
        entidadesIgnoradas++;
      }
      continue;
    }

    if (code === "0" && val === "LWPOLYLINE") {
      i += 2;
      const vertices: DxfVertex[] = [];
      let layer = "";
      let isClosed = false;
      const quantidadeAntes = segmentos.length;

      while (i < linhas.length && linhas[i]?.trim() !== "0") {
        const c = linhas[i]?.trim();
        const v = linhas[i + 1]?.trim();

        if (c === "8") layer = v;
        if (c === "70") isClosed = (parseInt(v, 10) & 1) === 1;
        if (c === "10") {
          const vx = parseFloat(v) || 0;
          let vy = 0;
          if (linhas[i + 2]?.trim() === "20") {
            vy = parseFloat(linhas[i + 3]?.trim()) || 0;
            i += 2;
          }
          vertices.push({ x: vx, y: vy, bulge: 0 });
        }
        if (c === "42" && vertices.length > 0) vertices[vertices.length - 1].bulge = parseFloat(v) || 0;
        i += 2;
      }

      for (let j = 0; j < vertices.length - 1; j++) {
        segmentos.push(...segmentosEntreVertices(vertices[j], vertices[j + 1], layer));
      }
      if (isClosed && vertices.length > 2) {
        segmentos.push(...segmentosEntreVertices(vertices[vertices.length - 1], vertices[0], layer));
      }
      if (segmentos.length > quantidadeAntes && vertices.length > 1) {
        layers.add(layer || "0");
        entidadesConvertidas++;
      } else {
        entidadesIgnoradas++;
      }
      continue;
    }

    if (code === "0" && val === "ARC") {
      i += 2;
      let x = 0, y = 0, raio = 0, inicio = 0, fim = 0, layer = "";
      while (i < linhas.length && linhas[i]?.trim() !== "0") {
        const c = linhas[i]?.trim();
        const v = linhas[i + 1]?.trim();
        if (c === "8") layer = v;
        if (c === "10") x = parseFloat(v) || 0;
        if (c === "20") y = parseFloat(v) || 0;
        if (c === "40") raio = parseFloat(v) || 0;
        if (c === "50") inicio = parseFloat(v) || 0;
        if (c === "51") fim = parseFloat(v) || 0;
        i += 2;
      }
      const inicioRad = (inicio * Math.PI) / 180;
      let varredura = ((fim - inicio) * Math.PI) / 180;
      if (varredura <= 0) varredura += Math.PI * 2;
      const novosSegmentos = segmentosDeArco({ x, y }, raio, inicioRad, varredura, layer);
      segmentos.push(...novosSegmentos);
      if (novosSegmentos.length > 0) {
        layers.add(layer || "0");
        entidadesConvertidas++;
      } else {
        entidadesIgnoradas++;
      }
      continue;
    }

    if (code === "0" && val && val !== "ENDSEC") entidadesIgnoradas++;
    i += 2;
  }

  const unidadeDeclarada = lerUnidadeDeclarada(linhas);
  if (segmentos.length === 0) {
    return {
      paredes: [],
      resumo: {
        unidade: unidadeDeclarada?.unidade ?? "nao_declarada",
        fatorEscala: unidadeDeclarada?.fator ?? 1,
        entidadesLidas,
        entidadesConvertidas,
        entidadesIgnoradas,
        segmentosGerados: 0,
        layers: [...layers].sort(),
      },
    };
  }

  // 1. Detectar escala pelo tamanho do desenho, sem depender da distância até a origem do AutoCAD
  let minCoordX = Infinity;
  let minCoordY = Infinity;
  let maxCoordX = -Infinity;
  let maxCoordY = -Infinity;
  segmentos.forEach((s) => {
    minCoordX = Math.min(minCoordX, s.x1, s.x2);
    minCoordY = Math.min(minCoordY, s.y1, s.y2);
    maxCoordX = Math.max(maxCoordX, s.x1, s.x2);
    maxCoordY = Math.max(maxCoordY, s.y1, s.y2);
  });
  const maiorDimensao = Math.max(maxCoordX - minCoordX, maxCoordY - minCoordY);

  let fatorEscala = unidadeDeclarada?.fator ?? 1.0;
  if (!unidadeDeclarada && maiorDimensao > 2000) fatorEscala = 0.001;
  else if (!unidadeDeclarada && maiorDimensao > 200) fatorEscala = 0.01;

  // 2. Encontrar o ponto mínimo para transladar para a origem (0,0)
  let minX = Infinity;
  let minY = Infinity;
  segmentos.forEach((s) => {
    minX = Math.min(minX, s.x1 * fatorEscala, s.x2 * fatorEscala);
    minY = Math.min(minY, s.y1 * fatorEscala, s.y2 * fatorEscala);
  });

  // 3. Gerar Paredes no formato do ObrasFlow
  const instanteImportacao = Date.now();
  const paredes: Parede[] = segmentos.flatMap((s, idx) => {
    const p1: Ponto2D = {
      x: Number((s.x1 * fatorEscala - minX).toFixed(2)),
      y: Number((s.y1 * fatorEscala - minY).toFixed(2)),
    };
    const p2: Ponto2D = {
      x: Number((s.x2 * fatorEscala - minX).toFixed(2)),
      y: Number((s.y2 * fatorEscala - minY).toFixed(2)),
    };

    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 0.01) return [];

    return [{
      id: `dxf_parede_${idx}_${instanteImportacao}`,
      p1,
      p2,
      espessura: espessuraPadrao,
      altura: peDireito,
      tipo: "alvenaria_vedacao",
      layer: s.layer || "0",
    }];
  });

  return {
    paredes,
    resumo: {
      unidade: unidadeDeclarada?.unidade ?? "nao_declarada",
      fatorEscala,
      entidadesLidas,
      entidadesConvertidas,
      entidadesIgnoradas,
      segmentosGerados: paredes.length,
      layers: [...layers].sort(),
    },
  };
}

export function extrairParedesDoDxf(
  conteudoDxf: string,
  espessuraPadrao = 0.15,
  peDireito = 2.80
): Parede[] {
  return importarDxf(conteudoDxf, espessuraPadrao, peDireito).paredes;
}

/**
 * Exporta as paredes e esquadrias do ObrasFlow para um arquivo DXF ASCII (AutoCAD R12)
 * Compatível com AutoCAD, DraftSight, LibreCAD, SketchUp e Revit
 */
export function exportarParaDxf(dados: {
  paredes: Parede[];
  nomeObra?: string;
}): string {
  const lines: string[] = [];

  // Cabeçalho DXF
  lines.push("0", "SECTION");
  lines.push("2", "HEADER");
  lines.push("9", "$ACADVER");
  lines.push("1", "AC1009"); // AutoCAD R12
  lines.push("9", "$INSUNITS");
  lines.push("70", "6"); // Metros
  lines.push("0", "ENDSEC");

  // Tabelas de Camadas (Layers)
  lines.push("0", "SECTION");
  lines.push("2", "TABLES");
  lines.push("0", "TABLE");
  lines.push("2", "LAYER");
  const layers = [...new Set(["PAREDES", ...dados.paredes.map((p) => p.layer).filter(Boolean)])];
  lines.push("70", String(layers.length));

  layers.forEach((layer) => {
    lines.push("0", "LAYER");
    lines.push("2", String(layer).replace(/[\r\n]/g, " "));
    lines.push("70", "0");
    lines.push("62", "7");
    lines.push("6", "CONTINUOUS");
  });

  lines.push("0", "ENDTAB");
  lines.push("0", "ENDSEC");

  // Seção de Entidades (Linhas das paredes em metros)
  lines.push("0", "SECTION");
  lines.push("2", "ENTITIES");

  dados.paredes.forEach((p) => {
    lines.push("0", "LINE");
    lines.push("8", String(p.layer || "PAREDES").replace(/[\r\n]/g, " "));
    lines.push("10", p.p1.x.toFixed(4));
    lines.push("20", p.p1.y.toFixed(4));
    lines.push("30", "0.0");
    lines.push("11", p.p2.x.toFixed(4));
    lines.push("21", p.p2.y.toFixed(4));
    lines.push("31", "0.0");
  });

  lines.push("0", "ENDSEC");
  lines.push("0", "EOF");

  return lines.join("\n");
}


