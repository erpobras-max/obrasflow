import type { Parede, Ponto2D } from "@/types/projeto3d";

interface DxfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
}

/**
 * Parser leve e nativo de arquivos DXF ASCII do AutoCAD
 * Extrai entidades LINE e LWPOLYLINE e converte para paredes BIM
 */
export function extrairParedesDoDxf(
  conteudoDxf: string,
  espessuraPadrao = 0.15,
  peDireito = 2.80
): Parede[] {
  const linhas = conteudoDxf.split(/\r?\n/);
  const segmentos: DxfLine[] = [];

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
      }
      continue;
    }

    if (code === "0" && val === "LWPOLYLINE") {
      i += 2;
      const vertices: Ponto2D[] = [];
      let layer = "";
      let isClosed = false;

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
          vertices.push({ x: vx, y: vy });
        }
        i += 2;
      }

      for (let j = 0; j < vertices.length - 1; j++) {
        segmentos.push({
          x1: vertices[j].x,
          y1: vertices[j].y,
          x2: vertices[j + 1].x,
          y2: vertices[j + 1].y,
          layer,
        });
      }
      if (isClosed && vertices.length > 2) {
        segmentos.push({
          x1: vertices[vertices.length - 1].x,
          y1: vertices[vertices.length - 1].y,
          x2: vertices[0].x,
          y2: vertices[0].y,
          layer,
        });
      }
      continue;
    }

    i += 2;
  }

  if (segmentos.length === 0) return [];

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

  let fatorEscala = 1.0;
  if (maiorDimensao > 2000) {
    fatorEscala = 0.001; // Milímetros -> Metros
  } else if (maiorDimensao > 200) {
    fatorEscala = 0.01; // Centímetros -> Metros
  }

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
    }];
  });

  return paredes;
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
  lines.push("0", "ENDSEC");

  // Tabelas de Camadas (Layers)
  lines.push("0", "SECTION");
  lines.push("2", "TABLES");
  lines.push("0", "TABLE");
  lines.push("2", "LAYER");
  lines.push("70", "2");

  // Layer PAREDES
  lines.push("0", "LAYER");
  lines.push("2", "PAREDES");
  lines.push("70", "0");
  lines.push("62", "7"); // Branco / Preto
  lines.push("6", "CONTINUOUS");

  // Layer ESQUADRIAS
  lines.push("0", "LAYER");
  lines.push("2", "ESQUADRIAS");
  lines.push("70", "0");
  lines.push("62", "5"); // Azul
  lines.push("6", "CONTINUOUS");

  lines.push("0", "ENDTAB");
  lines.push("0", "ENDSEC");

  // Seção de Entidades (Linhas das paredes em metros)
  lines.push("0", "SECTION");
  lines.push("2", "ENTITIES");

  dados.paredes.forEach((p) => {
    lines.push("0", "LINE");
    lines.push("8", "PAREDES");
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

