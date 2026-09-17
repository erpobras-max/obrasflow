/**
 * r2.ts — Cliente centralizado para Cloudflare R2 (S3-compatível)
 *
 * ARQUITETURA:
 *   - uploadR2, deleteR2, deleteManyR2 → roteiam pelo servidor via server functions
 *     (sem CORS, credenciais nunca chegam ao browser)
 *   - leitura de documentos será feita por URL assinada no servidor
 *
 * Uso:
 *   import { uploadR2, getR2Url, deleteR2 } from "@/lib/r2";
 *
 *   // Upload (server-proxied, sem CORS)
 *   const key = await uploadR2(file, "rh/atestados");
 *
 *   // URL pública para visualização
 *   const url = getR2Url(key);
 *
 *   // Deletar
 *   await deleteR2(key);
 *
 * Credenciais privadas no ambiente de execução:
 *   R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */

import { supabase } from "@/integrations/supabase/client.custom";

// ─────────────────────────────────────────────
// URL pública (leitura — sem credenciais)
// ─────────────────────────────────────────────
const R2_PUBLIC = import.meta.env.VITE_R2_PUBLIC_URL as string;

/**
 * Retorna a URL pública de um objeto no R2.
 * O bucket deve estar configurado com acesso público ativado.
 */
export function getR2Url(key: string | null | undefined): string {
  if (!key) return "";
  const cleanKey = key.replace(/^\//, "");
  return `${R2_PUBLIC}/${cleanKey}`;
}

/**
 * Carrega um arquivo privado pelo servidor autenticado e cria uma URL temporária
 * válida apenas nesta aba do navegador.
 */
export async function getSecureR2Url(key: string): Promise<string> {
  const { readR2ServerFn } = await import("./r2.functions");
  const result = await readR2ServerFn({
    headers: await getAuthHeaders(),
    data: { key },
  });

  const binary = atob(result.bodyBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
}

/**
 * Abre a URL pública de um documento em nova aba.
 */
export function openR2File(key: string | null | undefined): void {
  const url = getR2Url(key);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export type R2Folder =
  | "rh/atestados"
  | "rh/documentos"
  | "documentos/obras"
  | "documentos/contratos"
  | "fiscal/xmls"
  | "fiscal/pdfs"
  | "financeiro/comprovantes"
  | "financeiro/notas"
  | "diario/fotos"
  | "outros";

// ─────────────────────────────────────────────
// Autenticação das funções de servidor
// ─────────────────────────────────────────────
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  return { Authorization: `Bearer ${accessToken}` };
}

// ─────────────────────────────────────────────
// Upload via servidor (sem CORS)
// ─────────────────────────────────────────────

/**
 * Converte um File em base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result = "data:<mime>;base64,<data>"
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Faz upload de um arquivo para o R2 via servidor (sem CORS).
 * @param file - O arquivo a enviar.
 * @param folder - Pasta de destino (usar constantes R2Folder).
 * @param customKey - Chave completa opcional (substitui o caminho automático).
 * @returns A chave (path) do objeto no R2.
 */
export async function uploadR2(
  file: File,
  folder: R2Folder | string,
  customKey?: string
): Promise<string> {
  if (customKey) throw new Error("Caminho personalizado não é permitido.");
  if (!validateFileSize(file) || !validateFileType(file)) {
    throw new Error("Arquivo inválido ou maior que 10 MB.");
  }
  const bodyBase64 = await fileToBase64(file);

  const { uploadR2ServerFn } = await import("./r2.functions");
  const result = await uploadR2ServerFn({
    headers: await getAuthHeaders(),
    data: {
      folder: folder as R2Folder,
      bodyBase64,
      contentType: file.type || "application/octet-stream",
      fileName: file.name,
    },
  });

  return result.key;
}

// ─────────────────────────────────────────────
// Delete via servidor (sem CORS)
// ─────────────────────────────────────────────

/**
 * Deleta um único objeto do R2.
 */
export async function deleteR2(key: string): Promise<void> {
  if (!key) return;
  const { deleteR2ServerFn } = await import("./r2.functions");
  await deleteR2ServerFn({ headers: await getAuthHeaders(), data: { key } });
}

/**
 * Deleta múltiplos objetos do R2 em lote.
 */
export async function deleteManyR2(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const { deleteManyR2ServerFn } = await import("./r2.functions");
  await deleteManyR2ServerFn({ headers: await getAuthHeaders(), data: { keys } });
}

// ─────────────────────────────────────────────
// Validação de tipos de arquivo por categoria
// ─────────────────────────────────────────────
export const ALLOWED_TYPES: Record<string, string[]> = {
  documentos: [
    "application/pdf", "image/jpeg", "image/png", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  imagens: ["image/jpeg", "image/png", "image/webp"],
  fiscal: ["text/xml", "application/xml", "application/pdf", "text/plain"],
};

export function validateFileType(
  file: File,
  category: keyof typeof ALLOWED_TYPES = "documentos"
): boolean {
  return ALLOWED_TYPES[category]?.includes(file.type) ?? false;
}

export const MAX_FILE_SIZE_MB = 10;

export function validateFileSize(file: File, maxMB = MAX_FILE_SIZE_MB): boolean {
  return file.size <= maxMB * 1024 * 1024;
}
