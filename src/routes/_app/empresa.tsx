import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadR2, getR2Url } from "@/lib/r2";
import { Building2, Loader2, Save, Search, ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { buscarCep } from "@/lib/cep";
import { buscarCnpj } from "@/lib/cnpj";
import { formatCep, formatCpfCnpj, formatTelefone, onlyDigits } from "@/lib/validacao-documento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/empresa")({
  component: EmpresaConfigPage,
});

interface EmpresaConfig {
  id: number;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  website: string | null;
  logo_url: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  atividade_principal: string | null;
  clausula_padrao: string | null;
}

const empty = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "", inscricaoMunicipal: "",
  email: "", telefone: "", celular: "", website: "", logoUrl: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  situacaoCadastral: "", dataAbertura: "", atividadePrincipal: "", clausulaPadrao: "",
};

function EmpresaConfigPage() {
  const navigate = useNavigate();
  const { loading, perfil } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!loading && perfil && !["admin", "diretor", "rh"].includes(perfil.perfil)) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, perfil, navigate]);

  const { data: config, isLoading } = useQuery<EmpresaConfig | null>({
    queryKey: ["configuracoes-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaConfig | null;
    },
  });

  useEffect(() => {
    if (!config) return;
    setForm({
      razaoSocial: config.razao_social ?? "",
      nomeFantasia: config.nome_fantasia ?? "",
      cnpj: formatCpfCnpj(config.cnpj ?? ""),
      inscricaoEstadual: config.inscricao_estadual ?? "",
      inscricaoMunicipal: config.inscricao_municipal ?? "",
      email: config.email ?? "",
      telefone: formatTelefone(config.telefone ?? ""),
      celular: formatTelefone(config.celular ?? ""),
      website: config.website ?? "",
      logoUrl: config.logo_url ?? "",
      cep: formatCep(config.cep ?? ""),
      logradouro: config.logradouro ?? "",
      numero: config.numero ?? "",
      complemento: config.complemento ?? "",
      bairro: config.bairro ?? "",
      cidade: config.cidade ?? "",
      uf: config.uf ?? "",
      situacaoCadastral: config.situacao_cadastral ?? "",
      dataAbertura: config.data_abertura ?? "",
      atividadePrincipal: config.atividade_principal ?? "",
      clausulaPadrao: config.clausula_padrao ?? "",
    });
  }, [config]);

  const alterar = (campo: keyof typeof empty, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  const preencherCnpj = async () => {
    const documento = onlyDigits(form.cnpj);
    if (documento.length !== 14) {
      toast.error("Informe um CNPJ completo para consultar.");
      return;
    }
    setBuscandoCnpj(true);
    const empresa = await buscarCnpj(documento);
    setBuscandoCnpj(false);
    if (!empresa) {
      toast.error("CNPJ não encontrado na base pública. Confira o número ou preencha manualmente.");
      return;
    }
    setForm((atual) => ({
      ...atual,
      cnpj: formatCpfCnpj(empresa.cnpj),
      razaoSocial: empresa.razaoSocial || atual.razaoSocial,
      nomeFantasia: empresa.nomeFantasia || atual.nomeFantasia,
      inscricaoEstadual: empresa.inscricaoEstadual || atual.inscricaoEstadual,
      email: empresa.email || atual.email,
      telefone: empresa.telefone ? formatTelefone(empresa.telefone) : atual.telefone,
      cep: empresa.cep ? formatCep(empresa.cep) : atual.cep,
      logradouro: empresa.logradouro || atual.logradouro,
      numero: empresa.numero || atual.numero,
      complemento: empresa.complemento || atual.complemento,
      bairro: empresa.bairro || atual.bairro,
      cidade: empresa.cidade || atual.cidade,
      uf: empresa.uf || atual.uf,
      situacaoCadastral: empresa.situacaoCadastral,
      dataAbertura: empresa.dataAbertura,
      atividadePrincipal: empresa.atividadePrincipal,
    }));
    toast.success("Dados cadastrais preenchidos. Revise antes de salvar.");
  };

  const preencherCep = async () => {
    if (onlyDigits(form.cep).length !== 8) return;
    setBuscandoCep(true);
    const endereco = await buscarCep(form.cep);
    setBuscandoCep(false);
    if (!endereco) {
      toast.error("CEP não encontrado.");
      return;
    }
    setForm((atual) => ({
      ...atual,
      cep: formatCep(endereco.cep),
      logradouro: endereco.logradouro || atual.logradouro,
      bairro: endereco.bairro || atual.bairro,
      cidade: endereco.cidade || atual.cidade,
      uf: endereco.uf || atual.uf,
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const endereco = [
        form.logradouro,
        form.numero,
        form.complemento,
        form.bairro,
        form.cidade && form.uf ? form.cidade + " - " + form.uf : form.cidade,
        form.cep && "CEP " + form.cep,
      ].filter(Boolean).join(", ");

      const payload = {
        id: 1,
        razao_social: form.razaoSocial.trim(),
        nome_fantasia: form.nomeFantasia.trim() || null,
        cnpj: onlyDigits(form.cnpj),
        inscricao_estadual: form.inscricaoEstadual.trim() || null,
        inscricao_municipal: form.inscricaoMunicipal.trim() || null,
        email: form.email.trim() || null,
        telefone: onlyDigits(form.telefone) || null,
        celular: onlyDigits(form.celular) || null,
        website: form.website.trim() || null,
        logo_url: form.logoUrl?.trim() || null,
        cep: onlyDigits(form.cep) || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        endereco,
        situacao_cadastral: form.situacaoCadastral || null,
        data_abertura: form.dataAbertura || null,
        atividade_principal: form.atividadePrincipal || null,
        clausula_padrao: form.clausulaPadrao.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("configuracoes_empresa").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa salvos.");
      qc.invalidateQueries({ queryKey: ["configuracoes-empresa"] });
    },
    onError: (error: Error) => toast.error("Falha ao salvar: " + error.message),
  });

  if (loading || isLoading) {
    return <div className="flex h-[200px] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dados da empresa</h1>
        <p className="text-sm text-muted-foreground">Informações oficiais usadas em propostas, medições, documentos e relatórios.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10"><Building2 className="size-5 text-primary" /></div>
            <div><CardTitle className="text-base">Identificação e situação cadastral</CardTitle><CardDescription>Consulte o CNPJ para preencher os dados públicos disponíveis e revise-os antes de salvar.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Campo label="CNPJ" id="cnpj"><Input id="cnpj" value={form.cnpj} onChange={(e) => alterar("cnpj", formatCpfCnpj(e.target.value))} onBlur={preencherCnpj} placeholder="00.000.000/0001-00" /></Campo>
            <Button type="button" variant="outline" className="self-end" onClick={preencherCnpj} disabled={buscandoCnpj}>{buscandoCnpj ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar CNPJ</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Razão social" id="razao"><Input id="razao" value={form.razaoSocial} onChange={(e) => alterar("razaoSocial", e.target.value)} /></Campo>
            <Campo label="Nome fantasia" id="fantasia"><Input id="fantasia" value={form.nomeFantasia} onChange={(e) => alterar("nomeFantasia", e.target.value)} /></Campo>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Campo label="Inscrição Estadual" id="ie"><Input id="ie" value={form.inscricaoEstadual} onChange={(e) => alterar("inscricaoEstadual", e.target.value)} /></Campo>
            <Campo label="Inscrição Municipal" id="im"><Input id="im" value={form.inscricaoMunicipal} onChange={(e) => alterar("inscricaoMunicipal", e.target.value)} /></Campo>
            <Campo label="Situação cadastral" id="situacao"><Input id="situacao" value={form.situacaoCadastral} onChange={(e) => alterar("situacaoCadastral", e.target.value)} /></Campo>
          </div>
          <Campo label="Atividade principal" id="atividade"><Input id="atividade" value={form.atividadePrincipal} onChange={(e) => alterar("atividadePrincipal", e.target.value)} /></Campo>
          <Campo label="Cláusulas padrão do contrato" id="clausula"><Textarea id="clausula" rows={4} placeholder="Texto fixo usado no contrato..." value={form.clausulaPadrao} onChange={(e) => alterar("clausulaPadrao", e.target.value)} /></Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contato</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo label="E-mail" id="email"><Input id="email" type="email" value={form.email} onChange={(e) => alterar("email", e.target.value)} /></Campo>
          <Campo label="Website" id="site"><Input id="site" placeholder="https://" value={form.website} onChange={(e) => alterar("website", e.target.value)} /></Campo>
          <Campo label="Logo (URL)" id="logo"><Input id="logo" placeholder="https://..." value={form.logoUrl||""} onChange={(e) => alterar("logoUrl", e.target.value)} /></Campo>
          <Campo label="Logo (upload)" id="logo-upload">
            <div className="flex items-center gap-3">
              <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingLogo(true); try { const key = await uploadR2(f, "outros"); const url = getR2Url(key); alterar("logoUrl", url); toast.success("Logo enviado."); } catch (err: any) { toast.error("Falha no upload: " + err.message); } finally { setUploadingLogo(false); e.target.value = ""; } }} />
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("logo-upload")?.click()} disabled={uploadingLogo}>{uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {uploadingLogo ? "Enviando..." : "Enviar logo"}</Button>
              {form.logoUrl && <><img src={form.logoUrl} alt="Logo preview" className="h-10 w-auto rounded shadow-sm object-contain border" /><a href={form.logoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline ml-1">Ver</a></>}
            </div>
          </Campo>
          <Campo label="Telefone" id="telefone"><Input id="telefone" value={form.telefone} onChange={(e) => alterar("telefone", formatTelefone(e.target.value))} /></Campo>
          <Campo label="Celular" id="celular"><Input id="celular" value={form.celular} onChange={(e) => alterar("celular", formatTelefone(e.target.value))} /></Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Endereço</CardTitle><CardDescription>Informe o CEP para completar logradouro, bairro, cidade e UF.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <Campo label={"CEP" + (buscandoCep ? " (consultando)" : "")} id="cep"><Input id="cep" value={form.cep} onChange={(e) => alterar("cep", formatCep(e.target.value))} onBlur={preencherCep} placeholder="00000-000" /></Campo>
            <Campo label="Logradouro" id="logradouro"><Input id="logradouro" value={form.logradouro} onChange={(e) => alterar("logradouro", e.target.value)} /></Campo>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Campo label="Número" id="numero"><Input id="numero" value={form.numero} onChange={(e) => alterar("numero", e.target.value)} /></Campo>
            <Campo label="Complemento" id="complemento"><Input id="complemento" value={form.complemento} onChange={(e) => alterar("complemento", e.target.value)} /></Campo>
            <Campo label="Bairro" id="bairro"><Input id="bairro" value={form.bairro} onChange={(e) => alterar("bairro", e.target.value)} /></Campo>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_100px]">
            <Campo label="Cidade" id="cidade"><Input id="cidade" value={form.cidade} onChange={(e) => alterar("cidade", e.target.value)} /></Campo>
            <Campo label="UF" id="uf"><Input id="uf" maxLength={2} value={form.uf} onChange={(e) => alterar("uf", e.target.value.toUpperCase())} /></Campo>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.razaoSocial || onlyDigits(form.cnpj).length !== 14}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar dados da empresa</Button></div>
    </div>
  );
}

function Campo({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
