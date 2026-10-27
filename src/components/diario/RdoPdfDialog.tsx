import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  FileText,
  Building,
  MapPin,
  Calendar,
  CloudSun,
  HardHat,
  Users,
  Camera,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import { getDiarioMediaUrl, getSecureR2Url } from "@/lib/r2";
import { companyLogoKey } from "@/lib/empresa-logo";
import { formatCpfCnpj } from "@/lib/validacao-documento";
import {
  formatarDataRdo,
  gerarCodigoRdo,
  calcularTotalEfetivo,
  formatarEnderecoObra,
  obterClimaDetalhado,
  type EfetivoItem,
} from "@/lib/rdo-pdf.utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface DiarioRdoTarget {
  id: string;
  obra_id: string;
  data: string;
  clima: string | null;
  temperatura: number | null;
  efetivo: EfetivoItem[];
  atividades: string | null;
  ocorrencias: string | null;
  observacoes: string | null;
}

interface FotoRdo {
  id: string;
  url: string;
  descricao: string | null;
  signedUrl?: string;
}

interface ObraDetalhes {
  id: string;
  numero: string;
  nome: string;
  cliente_id: string | null;
  responsavel_id: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

interface RdoPdfDialogProps {
  target: DiarioRdoTarget | null;
  onClose: () => void;
}

export function RdoPdfDialog({ target, onClose }: RdoPdfDialogProps) {
  const open = Boolean(target);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [imprimindo, setImprimindo] = useState(false);
  const [fotosComUrls, setFotosComUrls] = useState<FotoRdo[]>([]);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [logoResolvida, setLogoResolvida] = useState<string | null>(null);

  // 1. Dados da Obra
  const { data: obra } = useQuery({
    queryKey: ["obra-detalhes-rdo", target?.obra_id],
    queryFn: async () => {
      if (!target?.obra_id) return null;
      const { data, error } = await supabase
        .from("obras")
        .select("id,numero,nome,cliente_id,responsavel_id,logradouro,numero_endereco,complemento,bairro,cidade,uf")
        .eq("id", target.obra_id)
        .maybeSingle();
      if (error) throw error;
      return data as ObraDetalhes | null;
    },
    enabled: Boolean(target?.obra_id),
  });

  // 2. Dados da Empresa (Configurações Gerais)
  const { data: empresa } = useQuery({
    queryKey: ["empresa-rdo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("razao_social,nome_fantasia,cnpj,logo_url")
        .eq("id", 1)
        .maybeSingle();
      if (error) return null;
      return data as { razao_social?: string; nome_fantasia?: string; cnpj?: string; logo_url?: string } | null;
    },
    enabled: open,
  });

  // Carregar e resolver logo da empresa via R2 ou URL externa
  useEffect(() => {
    let cancelado = false;
    const rawLogo = empresa?.logo_url;
    if (!rawLogo) {
      setLogoResolvida(null);
      return;
    }

    const key = companyLogoKey(rawLogo);
    if (key) {
      getSecureR2Url(key)
        .then((url) => {
          if (!cancelado) setLogoResolvida(url);
        })
        .catch((err) => {
          console.warn("[RdoPdfDialog] Falha ao carregar logo do R2:", err);
          if (!cancelado) setLogoResolvida(null);
        });
    } else if (/^https?:\/\//i.test(rawLogo) || rawLogo.startsWith("data:")) {
      setLogoResolvida(rawLogo);
    } else {
      setLogoResolvida(null);
    }

    return () => {
      cancelado = true;
    };
  }, [empresa?.logo_url]);

  // 3. Cliente da Obra
  const { data: cliente } = useQuery({
    queryKey: ["cliente-rdo", obra?.cliente_id],
    queryFn: async () => {
      if (!obra?.cliente_id) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("nome,cpf_cnpj")
        .eq("id", obra.cliente_id)
        .maybeSingle();
      if (error) return null;
      return data as { nome: string; cpf_cnpj: string | null } | null;
    },
    enabled: Boolean(obra?.cliente_id),
  });

  // 4. Responsável Técnico
  const { data: responsavelTecnico } = useQuery({
    queryKey: ["responsavel-tecnico-rdo", obra?.responsavel_id],
    queryFn: async () => {
      if (!obra?.responsavel_id) return null;
      const { data: responsaveis, error } = await supabase.rpc("listar_responsaveis_tecnicos" as never);
      if (error || !responsaveis) {
        // Fallback para perfil direto
        const { data: p } = await supabase
          .from("perfis")
          .select("nome,crea_cau")
          .eq("user_id", obra.responsavel_id)
          .maybeSingle();
        return p as { nome: string; crea_cau?: string | null } | null;
      }
      const resp = (responsaveis as Array<{ user_id: string; nome: string; crea_cau?: string }>).find(
        (r) => r.user_id === obra.responsavel_id
      );
      return resp ? { nome: resp.nome, crea_cau: resp.crea_cau } : null;
    },
    enabled: Boolean(obra?.responsavel_id),
  });

  // 5. Fotos anexadas ao diário com signed URLs para renderização no PDF
  useEffect(() => {
    let cancelado = false;
    if (!target?.id) {
      setFotosComUrls([]);
      return;
    }

    async function carregarMidias() {
      setCarregandoFotos(true);
      try {
        const { data, error } = await supabase
          .from("diarios_obra_fotos")
          .select("id,url,descricao")
          .eq("diario_id", target!.id)
          .order("created_at", { ascending: true });

        if (error || !data) {
          if (!cancelado) setFotosComUrls([]);
          return;
        }

        // Filtra imagens (ignora vídeos para o relatório impresso)
        const apenasImagens = data.filter((f) => !/\.(mp4|webm|ogg|mov|mkv)$/i.test(f.url));

        const resolvidas = await Promise.all(
          apenasImagens.map(async (foto) => {
            try {
              const signed = await getDiarioMediaUrl(foto.url);
              return { ...foto, signedUrl: signed };
            } catch {
              return foto;
            }
          })
        );

        if (!cancelado) {
          setFotosComUrls(resolvidas);
        }
      } catch (e) {
        console.error("Erro ao carregar fotos do RDO:", e);
      } finally {
        if (!cancelado) setCarregandoFotos(false);
      }
    }

    void carregarMidias();

    return () => {
      cancelado = true;
    };
  }, [target?.id]);

  if (!target) return null;

  const dataInfo = formatarDataRdo(target.data);
  const codigoRdo = gerarCodigoRdo(obra?.numero, target.data);
  const totalEfetivo = calcularTotalEfetivo(target.efetivo);
  const climaInfo = obterClimaDetalhado(target.clima, target.temperatura);
  const enderecoObra = formatarEnderecoObra(obra);

  const executarImpressao = () => {
    if (!printAreaRef.current) return;
    setImprimindo(true);

    const janela = window.open("", "_blank", "width=1100,height=900");
    if (!janela) {
      window.print();
      setImprimindo(false);
      return;
    }
    janela.opener = null;

    const copia = printAreaRef.current.cloneNode(true) as HTMLElement;
    copia.querySelectorAll(".print-exclude").forEach((el) => el.remove());

    const estilos = `
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 12mm 12mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        .rdo-document {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
        }
        .header-box {
          border: 1.5px solid #0f172a;
          border-radius: 4px;
          padding: 10px 14px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
        }
        .header-title-box {
          text-align: center;
          flex: 1;
        }
        .header-title {
          font-size: 15px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          margin: 0 0 2px 0;
        }
        .header-code {
          font-size: 12px;
          font-weight: 700;
          color: #0284c7;
        }
        .section-box {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          margin-bottom: 10px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .section-header {
          background: #0f172a;
          color: #ffffff;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .section-body {
          padding: 8px 10px;
          background: #ffffff;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .info-row {
          margin-bottom: 4px;
        }
        .info-label {
          font-weight: 700;
          color: #475569;
          font-size: 10px;
          text-transform: uppercase;
        }
        .info-value {
          font-weight: 600;
          color: #0f172a;
          font-size: 11.5px;
        }
        table.rdo-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 4px;
        }
        table.rdo-table th {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
          font-size: 10px;
          text-align: left;
          color: #334155;
          font-weight: 700;
          text-transform: uppercase;
        }
        table.rdo-table td {
          border: 1px solid #e2e8f0;
          padding: 5px 8px;
          font-size: 11px;
        }
        .text-box {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          padding: 8px 10px;
          white-space: pre-wrap;
          font-size: 11px;
          min-height: 48px;
          color: #1e293b;
        }
        .signatures-container {
          margin-top: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          page-break-inside: avoid;
        }
        .signature-box {
          border-top: 1.5px solid #0f172a;
          text-align: center;
          padding-top: 6px;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 6px;
        }
        .photo-card {
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 4px;
          background: #f8fafc;
          page-break-inside: avoid;
        }
        .photo-img {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 2px;
          display: block;
        }
        .photo-caption {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 4px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .footer-note {
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
          margin-top: 16px;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
        }
      </style>
    `;

    janela.document.open();
    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${codigoRdo} - ${obra?.nome || "ObrasFlow"}</title>
          ${estilos}
        </head>
        <body>
          <div class="rdo-document">
            ${copia.innerHTML}
          </div>
        </body>
      </html>
    `);
    janela.document.close();

    window.setTimeout(() => {
      janela.focus();
      janela.print();
      setImprimindo(false);
    }, 450);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/30">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="size-4 text-primary" />
              Relatório Diário de Obra (RDO) Executivo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Documento formatado segundo normas ABNT para fiscalização, assinatura e arquivo legal.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 pr-8">
            <Button
              size="sm"
              onClick={executarImpressao}
              disabled={imprimindo}
              className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm"
            >
              {imprimindo ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
              Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Área de Visualização e Renderização do RDO */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70">
          <div
            ref={printAreaRef}
            className="max-w-[210mm] mx-auto bg-white border shadow-md p-8 rounded-sm text-slate-900"
            style={{ minHeight: "297mm" }}
          >
            {/* Cabeçalho do RDO */}
            <div className="header-box border-2 border-slate-900 rounded p-4 mb-4 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                {logoResolvida ? (
                  <img
                    src={logoResolvida}
                    alt={empresa?.nome_fantasia || "Logo Construtora"}
                    className="h-12 w-auto max-w-[130px] object-contain"
                    onError={() => setLogoResolvida(null)}
                  />
                ) : (
                  <div className="size-12 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                    {empresa?.nome_fantasia?.slice(0, 2).toUpperCase() || empresa?.razao_social?.slice(0, 2).toUpperCase() || "OF"}
                  </div>
                )}
                <div>
                  <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                    {empresa?.razao_social || empresa?.nome_fantasia || "CONSTRUTORA & ENGENHARIA"}
                  </div>
                  {empresa?.cnpj && (
                    <div className="text-[10px] text-slate-600 font-medium">CNPJ: {formatCpfCnpj(empresa.cnpj)}</div>
                  )}
                  <div className="text-[10px] text-slate-500">ObrasFlow ERP • Gestão Técnica de Obras</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  RELATÓRIO DIÁRIO DE OBRA
                </div>
                <div className="text-sm font-bold text-primary font-mono">{codigoRdo}</div>
                <div className="text-[11px] text-slate-700 font-semibold">{dataInfo.dataFormatada}</div>
              </div>
            </div>

            {/* Seção 1: Identificação da Obra e Contratante */}
            <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
              <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase flex items-center gap-1.5">
                <Building className="size-3.5 text-primary-foreground/80" />
                1. Identificação da Obra e Responsáveis
              </div>
              <div className="section-body p-3 bg-white grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="info-row">
                    <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Obra / Projeto</span>
                    <span className="info-value font-bold text-slate-900 text-sm">
                      {obra ? `${obra.numero} — ${obra.nome}` : "Obra em andamento"}
                    </span>
                  </div>
                  <div className="info-row mt-2">
                    <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Localização / Endereço</span>
                    <span className="info-value text-slate-700 flex items-center gap-1">
                      <MapPin className="size-3 text-slate-400 shrink-0 inline" />
                      {enderecoObra}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="info-row">
                    <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Proprietário da Obra</span>
                    <span className="info-value font-semibold text-slate-900">
                      {cliente?.nome || "Proprietário da Obra"}
                    </span>
                    {cliente?.cpf_cnpj && (
                      <span className="text-[10px] text-slate-500 block">Doc: {formatCpfCnpj(cliente.cpf_cnpj)}</span>
                    )}
                  </div>
                  <div className="info-row mt-2">
                    <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Responsável Técnico</span>
                    <span className="info-value font-semibold text-slate-900 flex items-center gap-1">
                      <HardHat className="size-3 text-slate-400 shrink-0 inline" />
                      {responsavelTecnico?.nome || "Engenharia Residente"}
                      {responsavelTecnico?.crea_cau && ` • CREA/CAU: ${responsavelTecnico.crea_cau}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Condições Climáticas e Calendário */}
            <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
              <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase flex items-center gap-1.5">
                <CloudSun className="size-3.5 text-primary-foreground/80" />
                2. Condições Climáticas e Operacionais
              </div>
              <div className="section-body p-3 bg-white grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Data e Dia da Semana</span>
                  <span className="info-value font-semibold text-slate-900">{dataInfo.dataCompletaExtenso}</span>
                </div>
                <div>
                  <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Condição do Tempo</span>
                  <span className="info-value font-semibold text-slate-900">
                    {climaInfo.label} {target.temperatura != null && `(${climaInfo.temperaturaTexto})`}
                  </span>
                </div>
                <div>
                  <span className="info-label text-[10px] uppercase font-bold text-slate-500 block">Condição de Trabalho</span>
                  <span className="info-value font-semibold text-slate-900">{climaInfo.condicaoTrabalho}</span>
                </div>
              </div>
            </div>

            {/* Seção 3: Mão de Obra e Efetivo Presente */}
            <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
              <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary-foreground/80" />
                  3. Mão de Obra e Efetivo no Canteiro
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-300">
                  Total: {totalEfetivo} profissional(is)
                </span>
              </div>
              <div className="section-body p-3 bg-white">
                {(target.efetivo || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    Nenhum efetivo específico detalhado para a data.
                  </p>
                ) : (
                  <table className="rdo-table w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="border border-slate-300 p-1.5 text-left font-bold text-slate-700 w-12 text-center">#</th>
                        <th className="border border-slate-300 p-1.5 text-left font-bold text-slate-700">Função / Categoria Profissional</th>
                        <th className="border border-slate-300 p-1.5 text-right font-bold text-slate-700 w-32">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {target.efetivo.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border border-slate-200 p-1.5 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-200 p-1.5 font-medium text-slate-900">
                            {item.funcao || "Profissional não especificado"}
                          </td>
                          <td className="border border-slate-200 p-1.5 text-right font-mono font-bold text-slate-800">
                            {item.quantidade || 0}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                        <td colSpan={2} className="border border-slate-300 p-1.5 text-right uppercase text-[10px] text-slate-700">
                          Total Geral de Efetivo Presente:
                        </td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono text-sm text-slate-950">
                          {totalEfetivo}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Seção 4: Serviços e Atividades Executadas */}
            <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
              <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary-foreground/80" />
                4. Atividades e Serviços Executados
              </div>
              <div className="section-body p-3 bg-white">
                <div className="text-box bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 leading-relaxed min-h-[50px] whitespace-pre-wrap">
                  {target.atividades?.trim() || "Nenhuma descrição de atividade registrada no dia."}
                </div>
              </div>
            </div>

            {/* Seção 5: Ocorrências, Paralisações e Imprevistos */}
            <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
              <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase">
                5. Ocorrências, Paralisações ou Justificativas
              </div>
              <div className="section-body p-3 bg-white">
                <div className="text-box bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 leading-relaxed min-h-[40px] whitespace-pre-wrap">
                  {target.ocorrencias?.trim() || "Sem ocorrências anormais, acidentes ou interrupções no expediente."}
                </div>
              </div>
            </div>

            {/* Seção 6: Observações Técnicas Gerais */}
            {target.observacoes?.trim() && (
              <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden">
                <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase">
                  6. Observações e Recomendações Técnicas
                </div>
                <div className="section-body p-3 bg-white">
                  <div className="text-box bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {target.observacoes.trim()}
                  </div>
                </div>
              </div>
            )}

            {/* Seção 7: Relatório Fotográfico */}
            {fotosComUrls.length > 0 && (
              <div className="section-box border border-slate-300 rounded mb-3 overflow-hidden page-break-inside-avoid">
                <div className="section-header bg-slate-900 text-white px-3 py-1 font-bold text-xs uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="size-3.5 text-primary-foreground/80" />
                    Registro Fotográfico do Dia ({fotosComUrls.length} fotos)
                  </span>
                </div>
                <div className="section-body p-3 bg-white">
                  <div className="photo-grid grid grid-cols-2 gap-3">
                    {fotosComUrls.map((f, i) => (
                      <div key={f.id} className="photo-card border border-slate-200 rounded p-1.5 bg-slate-50">
                        {f.signedUrl ? (
                          <img
                            src={f.signedUrl}
                            alt={f.descricao || `Foto ${i + 1}`}
                            className="photo-img w-full h-36 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-full h-36 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500">
                            Carregando imagem…
                          </div>
                        )}
                        <div className="photo-caption text-[10px] text-slate-600 text-center mt-1 truncate font-medium">
                          {f.descricao || `Registro #${i + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Assinaturas Formais */}
            <div className="signatures-container grid grid-cols-2 gap-8 mt-8 pt-4">
              <div className="signature-box border-t-2 border-slate-900 pt-2 text-center">
                <div className="font-bold text-xs text-slate-900">
                  {responsavelTecnico?.nome || "Responsável Técnico pela Obra"}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">Engenheiro / Arquiteto Residente</div>
                <div className="text-[10px] text-slate-500">
                  {responsavelTecnico?.crea_cau ? `CREA/CAU: ${responsavelTecnico.crea_cau}` : "Assinatura e Carimbo"}
                </div>
              </div>

              <div className="signature-box border-t-2 border-slate-900 pt-2 text-center">
                <div className="font-bold text-xs text-slate-900">
                  {cliente?.nome || "Proprietário da Obra"}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">Proprietário da Obra</div>
                <div className="text-[10px] text-slate-500">Visto e De Acordo</div>
              </div>
            </div>

            {/* Rodapé Legal */}
            <div className="footer-note text-[9px] text-slate-400 text-center mt-6 pt-3 border-t border-slate-200">
              Emitido eletronicamente pelo ObrasFlow ERP em{" "}
              {new Date().toLocaleString("pt-BR")} • Documento com validade técnica e jurídica conforme NBR 12.721 e
              Resoluções do CONFEA/CREA.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
