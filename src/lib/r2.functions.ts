import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

const folders = [
  "rh/atestados", "rh/documentos", "documentos/obras", "documentos/contratos",
  "fiscal/xmls", "fiscal/pdfs", "financeiro/comprovantes", "financeiro/notas",
  "diario/fotos", "imobiliaria/imoveis", "imobiliaria/vistorias", "outros",
] as const;
const allowedMimeTypes = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/xml", "text/xml", "text/plain",
] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8;
const writableRoles = [
  "admin", "diretor", "financeiro", "financeiro_civil", "financeiro_imobiliaria",
  "imobiliaria", "compras", "engenharia", "almoxarifado", "rh",
];

async function requireActiveProfile(context: any) {
  const { data: profile } = await context.supabase
    .from("perfis_usuarios")
    .select("ativo")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (!profile?.ativo) {
    throw new Error("Seu usuário não tem permissão para acessar arquivos.");
  }
}

async function requireR2WriteAccess(context: any) {
  const { data: profile } = await context.supabase
    .from("perfis_usuarios")
    .select("perfil,ativo")
    .eq("user_id", context.userId)
    .maybeSingle();

  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = new Set<string>([
    profile?.perfil,
    ...(roleRows ?? []).map((row: { role: string }) => row.role),
  ].filter(Boolean));

  if (!profile?.ativo || !writableRoles.some((role) => roles.has(role))) {
    throw new Error("Você não tem permissão para alterar arquivos.");
  }
}

function extensionFor(contentType: string) {
  const extensions: Record<string, string> = {
    "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
    "image/webp": "webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/xml": "xml", "text/xml": "xml", "text/plain": "txt",
  };
  return extensions[contentType];
}

const uploadInputSchema = z.object({
  folder: z.enum(folders),
  bodyBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
  contentType: z.enum(allowedMimeTypes),
  fileName: z.string().trim().min(1).max(180),
});

export const uploadR2ServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uploadInputSchema)
  .handler(async ({ data, context }) => {
    await requireR2WriteAccess(context);
    const binary = atob(data.bodyBase64);
    if (binary.length > MAX_FILE_BYTES) throw new Error("Arquivo excede o limite permitido.");

    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const extension = extensionFor(data.contentType);
    if (!extension) throw new Error("Tipo de arquivo não permitido.");

    const key = `${data.folder}/${crypto.randomUUID()}.${extension}`;
    const { uploadToR2Server } = await import("./r2.server");
    return { key: await uploadToR2Server(key, bytes, data.contentType, data.fileName) };
  });

const keySchema = z.string().regex(
  /^(rh\/(atestados|documentos)|documentos\/(obras|contratos)|fiscal\/(xmls|pdfs)|financeiro\/(comprovantes|notas)|diario\/fotos|imobiliaria\/(imoveis|vistorias)|outros)\/[a-f0-9-]+\.[a-z0-9]+$/,
  "Caminho de arquivo inválido.",
);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export const readR2ServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ key: keySchema }))
  .handler(async ({ data, context }) => {
    await requireActiveProfile(context);
    const { readFromR2Server } = await import("./r2.server");
    const object = await readFromR2Server(data.key);

    return {
      bodyBase64: bytesToBase64(object.bytes),
      contentType: object.contentType,
    };
  });

export const deleteR2ServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ key: keySchema }))
  .handler(async ({ data, context }) => {
    await requireR2WriteAccess(context);
    const { deleteFromR2Server } = await import("./r2.server");
    await deleteFromR2Server(data.key);
    return { ok: true };
  });

export const deleteManyR2ServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ keys: z.array(keySchema).min(1).max(50) }))
  .handler(async ({ data, context }) => {
    await requireR2WriteAccess(context);
    const { deleteManyFromR2Server } = await import("./r2.server");
    await deleteManyFromR2Server(data.keys);
    return { ok: true };
  });
