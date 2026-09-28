export function formatarDocumento(valor?: string | null) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length === 11) return `CPF: ${digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  if (digitos.length === 14) return `CNPJ: ${digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;
  return digitos ? `Documento: ${valor}` : "Documento: não informado";
}
