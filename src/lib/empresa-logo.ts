/** Recognizes uploaded logos, including the broken URL saved by older builds. */
export function companyLogoKey(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim()
    .replace(/^r2:\/\//, "")
    .replace(/^(?:https?:\/\/[^/]+\/)?\/?undefined\//, "");
  return /^outros\/[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i.test(normalized) ? normalized : null;
}

export function normalizeCompanyLogo(value: string): string {
  const key = companyLogoKey(value);
  return key ? `r2://${key}` : value.trim();
}
