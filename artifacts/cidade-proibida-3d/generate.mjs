import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(ROOT, "stl");
const CLEARANCE = 0.25;
const PEG = 4;
const SOCKET = PEG + CLEARANCE * 2;
const EPSILON = 1e-7;

mkdirSync(OUTPUT, { recursive: true });

class Mesh {
  constructor(name) {
    this.name = name;
    this.triangles = [];
  }

  triangle(a, b, c) {
    this.triangles.push([a, b, c]);
  }

  merge(other, offset = [0, 0, 0]) {
    for (const triangle of other.triangles) {
      this.triangle(...triangle.map((point) => point.map((value, axis) => value + offset[axis])));
    }
    return this;
  }
}

function addBox(mesh, x, y, z, width, depth, height) {
  const x1 = x + width;
  const y1 = y + depth;
  const z1 = z + height;
  const p = [
    [x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z],
    [x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1],
  ];
  const faces = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  for (const [a, b, c] of faces) mesh.triangle(p[a], p[b], p[c]);
}

function addCylinder(mesh, cx, cy, z, radius, height, sides = 16) {
  const bottom = [];
  const top = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (Math.PI * 2 * i) / sides;
    bottom.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, z]);
    top.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, z + height]);
  }
  const cb = [cx, cy, z];
  const ct = [cx, cy, z + height];
  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides;
    mesh.triangle(cb, bottom[next], bottom[i]);
    mesh.triangle(ct, top[i], top[next]);
    mesh.triangle(bottom[i], bottom[next], top[next]);
    mesh.triangle(bottom[i], top[next], top[i]);
  }
}

function addHipRoof(mesh, cx, cy, z, width, depth, rise, eave = 2) {
  addBox(mesh, cx - width / 2, cy - depth / 2, z, width, depth, eave);
  const baseZ = z + eave;
  const topZ = baseZ + rise;
  const ridge = Math.max(width - depth, width * 0.35) / 2;
  const a = [cx - width / 2, cy - depth / 2, baseZ];
  const b = [cx + width / 2, cy - depth / 2, baseZ];
  const c = [cx + width / 2, cy + depth / 2, baseZ];
  const d = [cx - width / 2, cy + depth / 2, baseZ];
  const r1 = [cx - ridge, cy, topZ];
  const r2 = [cx + ridge, cy, topZ];
  mesh.triangle(a, b, r2);
  mesh.triangle(a, r2, r1);
  mesh.triangle(d, r1, r2);
  mesh.triangle(d, r2, c);
  mesh.triangle(a, r1, d);
  mesh.triangle(b, c, r2);
  mesh.triangle(a, d, c);
  mesh.triangle(a, c, b);
}

function addPeg(mesh, cx, cy, z, size = PEG, height = 3) {
  addBox(mesh, cx - size / 2, cy - size / 2, z, size, size, height);
}

function addPlateWithBlindSockets(mesh, width, depth, height, sockets = [], socketDepth = 3) {
  if (!sockets.length) {
    addBox(mesh, -width / 2, -depth / 2, 0, width, depth, height);
    return;
  }

  const xCuts = [-width / 2, width / 2];
  const yCuts = [-depth / 2, depth / 2];
  for (const [x, y, size = SOCKET] of sockets) {
    xCuts.push(x - size / 2, x + size / 2);
    yCuts.push(y - size / 2, y + size / 2);
  }
  xCuts.sort((a, b) => a - b);
  yCuts.sort((a, b) => a - b);

  for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
    for (let yi = 0; yi < yCuts.length - 1; yi += 1) {
      const x0 = xCuts[xi];
      const x1 = xCuts[xi + 1];
      const y0 = yCuts[yi];
      const y1 = yCuts[yi + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const insideSocket = sockets.some(([x, y, size = SOCKET]) =>
        Math.abs(mx - x) < size / 2 - EPSILON && Math.abs(my - y) < size / 2 - EPSILON,
      );
      if (!insideSocket && x1 - x0 > EPSILON && y1 - y0 > EPSILON) {
        addBox(mesh, x0, y0, 0, x1 - x0, y1 - y0, socketDepth);
      }
    }
  }
  addBox(mesh, -width / 2, -depth / 2, socketDepth, width, depth, height - socketDepth);
}

function addThreeStairs(mesh, platformDepth, platformHeight, run = 18) {
  const stairWidths = [22, 34, 22];
  const centers = [-52, 0, 52];
  const steps = 6;
  for (let group = 0; group < centers.length; group += 1) {
    for (let step = 0; step < steps; step += 1) {
      const depth = run / steps;
      const height = (platformHeight * (step + 1)) / steps;
      addBox(
        mesh,
        centers[group] - stairWidths[group] / 2,
        -platformDepth / 2 - run + step * depth,
        0,
        stairWidths[group],
        depth + 0.05,
        height,
      );
    }
  }
}

function terrace(name, width, depth, height, lowerSockets, upperPegs, stairRun) {
  const mesh = new Mesh(name);
  addPlateWithBlindSockets(mesh, width, depth, height, lowerSockets);
  addThreeStairs(mesh, depth, height, stairRun);
  for (const [x, y] of upperPegs) addPeg(mesh, x, y, height);
  return mesh;
}

function buildParts() {
  const basePegs = [[-72, -102], [72, -102], [-72, 102], [72, 102]];
  const lowerPegs = [[-64, -82], [64, -82], [-64, 82], [64, 82]];
  const middlePegs = [[-58, -65], [58, -65], [-58, 65], [58, 65]];
  const hallPegs = [[-48, -24], [48, -24], [-48, 24], [48, 24]];
  const roofPegs = [[-46, -22], [46, -22], [-46, 22], [46, 22]];

  const fit = new Mesh("00_teste_encaixe");
  addBox(fit, -38, -10, 0, 16, 20, 4);
  addPeg(fit, -30, 0, 4);
  for (const [index, clearance] of [0.15, 0.25, 0.35].entries()) {
    const block = new Mesh(`socket-${clearance}`);
    addPlateWithBlindSockets(block, 16, 20, 4, [[0, 0, PEG + clearance * 2]], 3);
    fit.merge(block, [-10 + index * 22, 0, 0]);
  }

  const base = new Mesh("01_base");
  addBox(base, -100, -140, 0, 200, 280, 4);
  addBox(base, -98, -138, 4, 196, 276, 1.2);
  for (const [x, y] of basePegs) addPeg(base, x, y, 5.2);

  const lower = terrace("02_terraco_inferior", 190, 238, 6, basePegs, lowerPegs, 18);
  const middle = terrace("03_terraco_intermediario", 178, 202, 6, lowerPegs, middlePegs, 18);
  const upper = terrace("04_terraco_superior", 166, 170, 8, middlePegs, hallPegs, 20);

  const hall = new Mesh("05_salao_11x5_vaos");
  addPlateWithBlindSockets(hall, 150, 82, 4, hallPegs);
  addBox(hall, -63, -28, 4, 126, 56, 14);
  const frontY = [-32, 32];
  for (let column = 0; column < 11; column += 1) {
    const x = -62.5 + column * 12.5;
    for (const y of frontY) addCylinder(hall, x, y, 4, 1.7, 16, 12);
  }
  for (let column = 1; column < 4; column += 1) {
    const y = -32 + column * 16;
    addCylinder(hall, -62.5, y, 4, 1.7, 16, 12);
    addCylinder(hall, 62.5, y, 4, 1.7, 16, 12);
  }
  addBox(hall, -67, -35, 18, 134, 70, 3);
  for (const [x, y] of roofPegs) addPeg(hall, x, y, 21);

  const lowerRoof = new Mesh("06_beiral_inferior");
  addPlateWithBlindSockets(lowerRoof, 164, 100, 4, roofPegs);
  addHipRoof(lowerRoof, 0, 0, 4, 164, 100, 6, 2);
  addBox(lowerRoof, -70, -38, 12, 140, 76, 3);
  const upperRoofPegs = [[-42, -20], [42, -20], [-42, 20], [42, 20]];
  for (const [x, y] of upperRoofPegs) addPeg(lowerRoof, x, y, 15);

  const upperRoof = new Mesh("07_cobertura_imperial");
  addPlateWithBlindSockets(upperRoof, 172, 106, 4, upperRoofPegs);
  addHipRoof(upperRoof, 0, 0, 4, 172, 106, 15, 2.5);
  addCylinder(upperRoof, 0, 0, 21.5, 1.8, 3, 12);
  addBox(upperRoof, -34, -1.4, 23.5, 68, 2.8, 2.5);
  addCylinder(upperRoof, -36, 0, 22.5, 2.2, 4, 12);
  addCylinder(upperRoof, 36, 0, 22.5, 2.2, 4, 12);

  return { fit, base, lower, middle, upper, hall, lowerRoof, upperRoof };
}

function normal([a, b, c]) {
  const u = b.map((value, axis) => value - a[axis]);
  const v = c.map((value, axis) => value - a[axis]);
  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...cross);
  return { vector: length ? cross.map((value) => value / length) : [0, 0, 0], area: length / 2 };
}

function bounds(mesh) {
  const points = mesh.triangles.flat();
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])));
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function validate(mesh, printable = true) {
  if (!mesh.triangles.length) throw new Error(`${mesh.name}: malha vazia`);
  for (const triangle of mesh.triangles) {
    if (normal(triangle).area < EPSILON) throw new Error(`${mesh.name}: triângulo degenerado`);
    if (triangle.flat().some((value) => !Number.isFinite(value))) throw new Error(`${mesh.name}: coordenada inválida`);
  }
  const box = bounds(mesh);
  if (printable && (box.size[0] > 200 + EPSILON || box.size[1] > 280 + EPSILON)) {
    throw new Error(`${mesh.name}: excede 200 x 280 mm (${box.size[0]} x ${box.size[1]})`);
  }
  if (box.min[2] < -EPSILON) throw new Error(`${mesh.name}: geometria abaixo da mesa`);
  return box;
}

function binaryStl(mesh) {
  const buffer = Buffer.alloc(84 + mesh.triangles.length * 50);
  buffer.write(`ObrasFlow - ${mesh.name}`.slice(0, 80), 0, "ascii");
  buffer.writeUInt32LE(mesh.triangles.length, 80);
  let offset = 84;
  for (const triangle of mesh.triangles) {
    const { vector } = normal(triangle);
    for (const value of vector) {
      buffer.writeFloatLE(value, offset);
      offset += 4;
    }
    for (const point of triangle) {
      for (const value of point) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
    }
    buffer.writeUInt16LE(0, offset);
    offset += 2;
  }
  return buffer;
}

function format(value) {
  return Math.round(value * 10) / 10;
}

function renderPreview(layers) {
  const angle = (-35 * Math.PI) / 180;
  const tilt = (58 * Math.PI) / 180;
  const projected = [];
  for (const { mesh, offset, color } of layers) {
    for (const triangle of mesh.triangles) {
      const points = triangle.map((point) => {
        const x = point[0] + offset[0];
        const y = point[1] + offset[1];
        const z = point[2] + offset[2];
        const rx = x * Math.cos(angle) - y * Math.sin(angle);
        const ry = x * Math.sin(angle) + y * Math.cos(angle);
        return {
          x: rx,
          y: ry * Math.cos(tilt) - z * Math.sin(tilt),
          depth: ry * Math.sin(tilt) + z * Math.cos(tilt),
        };
      });
      projected.push({ points, depth: points.reduce((sum, point) => sum + point.depth, 0) / 3, color });
    }
  }
  projected.sort((a, b) => a.depth - b.depth);
  const xs = projected.flatMap(({ points }) => points.map(({ x }) => x));
  const ys = projected.flatMap(({ points }) => points.map(({ y }) => y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = 1000;
  const height = 760;
  const padding = 55;
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const polygons = projected.map(({ points, color }) => {
    const value = points.map(({ x, y }) =>
      `${format((x - minX) * scale + padding)},${format((maxY - y) * scale + padding)}`,
    ).join(" ");
    return `<polygon points="${value}" fill="${color}" stroke="#4c3b2a" stroke-width="0.45"/>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Prévia isométrica da maquete do Salão da Suprema Harmonia</title>
  <desc id="desc">Plataforma branca em três níveis, salão vermelho com colunas e cobertura imperial dourada de beiral duplo.</desc>
  <rect width="100%" height="100%" fill="#f4efe5"/>
  <ellipse cx="500" cy="690" rx="390" ry="38" fill="#3a2f2530"/>
  <g stroke-linejoin="round">${polygons}</g>
  <text x="40" y="48" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#3a2f25">Salão da Suprema Harmonia · prévia de montagem</text>
  <text x="40" y="76" font-family="Arial, sans-serif" font-size="16" fill="#6b5b4c">Escala aproximada 1:400 · base 200 × 280 mm · altura 87,7 mm</text>
</svg>\n`;
}

const parts = buildParts();
const manifest = {
  projeto: "Salão da Suprema Harmonia — Cidade Proibida",
  unidade: "mm",
  escala_aproximada: "1:400",
  mesa_maxima: [200, 280],
  folga_por_lado: CLEARANCE,
  arquivos: [],
};

for (const mesh of Object.values(parts)) {
  const box = validate(mesh);
  const filename = `${mesh.name}.stl`;
  writeFileSync(join(OUTPUT, filename), binaryStl(mesh));
  manifest.arquivos.push({
    arquivo: filename,
    dimensoes: box.size.map(format),
    triangulos: mesh.triangles.length,
  });
}

const assembled = new Mesh("cidade_proibida_montada_REFERENCIA");
let z = 0;
const previewLayers = [];
const previewColors = {
  base: "#d8d3ca",
  lower: "#eee9df",
  middle: "#e5dfd3",
  upper: "#f5f0e7",
  hall: "#9f2d28",
  lowerRoof: "#c9951a",
  upperRoof: "#e3b12d",
};
for (const name of ["base", "lower", "middle", "upper", "hall", "lowerRoof", "upperRoof"]) {
  const mesh = parts[name];
  assembled.merge(mesh, [0, 0, z]);
  previewLayers.push({ mesh, offset: [0, 0, z], color: previewColors[name] });
  z += bounds(mesh).size[2] - (name === "base" ? 3 : 3);
}
const assembledBox = validate(assembled, false);
writeFileSync(join(OUTPUT, `${assembled.name}.stl`), binaryStl(assembled));
writeFileSync(join(ROOT, "preview.svg"), renderPreview(previewLayers));
manifest.referencia_montada = {
  arquivo: `${assembled.name}.stl`,
  dimensoes: assembledBox.size.map(format),
  triangulos: assembled.triangles.length,
};

writeFileSync(join(ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Gerados ${manifest.arquivos.length} STLs imprimíveis em ${OUTPUT}`);
for (const item of manifest.arquivos) {
  console.log(`${item.arquivo.padEnd(32)} ${item.dimensoes.join(" x ")} mm | ${item.triangulos} triângulos`);
}
console.log(`Referência montada: ${manifest.referencia_montada.dimensoes.join(" x ")} mm`);
