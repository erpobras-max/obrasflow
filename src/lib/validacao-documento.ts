// Validação de CPF e CNPJ — espelha a função SQL validar_cpf_cnpj
export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function formatCpfCnpj(v: string): string {
  const d = onlyDigits(v);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

export function formatCep(v: string): string {
  return onlyDigits(v).replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}

export function formatTelefone(v: string): string {
  const d = onlyDigits(v);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 14);
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}

export function validarCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10) r = 0;
  if (r !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(d[10]);
}

export function validarCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(d[i]) * p1[i];
  let r = soma % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (d1 !== Number(d[12])) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) soma += Number(d[i]) * p2[i];
  r = soma % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return d2 === Number(d[13]);
}

export function validarCpfCnpj(v: string | null | undefined): boolean {
  const d = onlyDigits(v ?? "");
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}
