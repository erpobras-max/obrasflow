/**
 * Utilitários para gestão de catálogos SINAPI e bases de referência de custos públicos.
 */

export const UFS_BRASIL = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type UF = (typeof UFS_BRASIL)[number];

/**
 * Ordena competências no formato MM/AAAA (mais recentes primeiro).
 */
export function competenciaSort(a: string, b: string): number {
  if (!a || !b) return 0;
  const [ma, aa] = a.split("/").map(Number);
  const [mb, ab] = b.split("/").map(Number);
  if (isNaN(ma) || isNaN(aa) || isNaN(mb) || isNaN(ab)) return a.localeCompare(b);
  return ab * 100 + mb - (aa * 100 + ma);
}

/**
 * Sanitiza o termo de busca para PostgREST (remove caracteres especiais que quebram o filtro .or()).
 */
export function sanitizeSearchTerm(term: string): string {
  if (!term) return "";
  return term
    .replace(/[,()%_*]/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * Detecta metadados (UF, Mês/Ano e Tipo) a partir do nome de arquivo da Caixa/SINAPI.
 */
export function parseMetadataFromFileName(fileName: string): {
  detectedUF: string;
  detectedMes: string;
  detectedType: "insumos" | "composicoes" | null;
} {
  const cleanName = fileName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Detect UF
  let detectedUF = "";
  for (const uf of UFS_BRASIL) {
    const regex = new RegExp(`(^|[\\W_])${uf}([\\W_]|$)`);
    if (regex.test(cleanName)) {
      detectedUF = uf;
      break;
    }
  }

  // 2. Detect reference month/year
  let detectedMes = "";
  // Check for MM_YYYY or MMYYYY
  const mmyyyyMatch = cleanName.match(/(\d{2})_?(\d{4})/);
  if (mmyyyyMatch) {
    const month = mmyyyyMatch[1];
    const year = mmyyyyMatch[2];
    const mNum = parseInt(month, 10);
    const yNum = parseInt(year, 10);
    if (mNum >= 1 && mNum <= 12 && yNum >= 2000 && yNum <= 2099) {
      detectedMes = `${month}/${year}`;
    }
  }

  if (!detectedMes) {
    // Check for YYYY_MM or YYYYMM
    const yyyymmMatch = cleanName.match(/(\d{4})_?(\d{2})/);
    if (yyyymmMatch) {
      const year = yyyymmMatch[1];
      const month = yyyymmMatch[2];
      const mNum = parseInt(month, 10);
      const yNum = parseInt(year, 10);
      if (mNum >= 1 && mNum <= 12 && yNum >= 2000 && yNum <= 2099) {
        detectedMes = `${month}/${year}`;
      }
    }
  }

  // 3. Detect refType
  let detectedType: "insumos" | "composicoes" | null = null;
  const hasInsumo = cleanName.includes("INSUMO");
  const hasComposi = cleanName.includes("COMPOSI");
  if (hasInsumo && !hasComposi) {
    detectedType = "insumos";
  } else if (hasComposi && !hasInsumo) {
    detectedType = "composicoes";
  }

  return { detectedUF, detectedMes, detectedType };
}
