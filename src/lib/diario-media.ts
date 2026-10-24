export const DIARIO_IMAGE_MAX_MB = 20;
export const DIARIO_VIDEO_MAX_MB = 150;

export const DIARIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DIARIO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export function getDiarioMediaError(file: Pick<File, "size" | "type">): string | null {
  const isImage = DIARIO_IMAGE_TYPES.some((type) => type === file.type);
  const isVideo = DIARIO_VIDEO_TYPES.some((type) => type === file.type);
  if (!isImage && !isVideo) return "Use imagens JPG, PNG ou WebP, ou vídeos MP4, WebM ou MOV.";

  const maxMB = isImage ? DIARIO_IMAGE_MAX_MB : DIARIO_VIDEO_MAX_MB;
  if (file.size > maxMB * 1024 * 1024) {
    return `${isImage ? "A imagem" : "O vídeo"} deve ter no máximo ${maxMB} MB.`;
  }
  return null;
}
