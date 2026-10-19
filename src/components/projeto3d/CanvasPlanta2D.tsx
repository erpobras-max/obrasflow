import { useState, useRef, useEffect } from "react";
import type { DadosProjetoBIM, Parede, Abertura, Ponto2D } from "@/types/projeto3d";
import { snapAoGrid, calcularComprimentoParede } from "@/lib/projeto3d.utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MousePointer,
  Square,
  DoorOpen,
  AppWindow,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
  HelpCircle,
  FolderUp,
  Download,
  BoxSelect,
  Grid,
  Crosshair,
  SlidersHorizontal,
} from "lucide-react";
import { extrairParedesDoDxf, exportarParaDxf } from "@/lib/dxf-parser";
import { toast } from "sonner";

type FerramentaAtiva = "selecionar" | "parede" | "porta" | "janela" | "apagar";

interface CanvasPlanta2DProps {
  dados: DadosProjetoBIM;
  onChangeDados: (novosDados: DadosProjetoBIM) => void;
  somenteLeitura?: boolean;
}

export function CanvasPlanta2D({ dados, onChangeDados, somenteLeitura = false }: CanvasPlanta2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ferramenta, setFerramenta] = useState<FerramentaAtiva>("selecionar");
  const [elementoSelecionadoId, setElementoSelecionadoId] = useState<string | null>(null);

  // Configurações ativas para novas inserções (customizáveis pelo engenheiro)
  const [espessuraAtiva, setEspessuraAtiva] = useState(0.15); // metros (15cm padrão)
  const [peDireitoAtivo, setPeDireitoAtivo] = useState(2.80); // metros
  const [larguraPortaAtiva, setLarguraPortaAtiva] = useState(0.80); // metros (80cm padrão)
  const [larguraJanelaAtiva, setLarguraJanelaAtiva] = useState(1.20); // metros (1.20m padrão)

  // Modo Ortogonal (Ortho Lock como no AutoCAD)
  const [modoOrtho, setModoOrtho] = useState(true);

  // Modal para criação rápida de cômodo paramétrico
  const [modalComodoAberto, setModalComodoAberto] = useState(false);
  const [comodoNome, setComodoNome] = useState("Quarto");
  const [comodoLargura, setComodoLargura] = useState("4.00");
  const [comodoComprimento, setComodoComprimento] = useState("3.50");

  // Ponto de início de uma parede durante a criação
  const [pontoInicial, setPontoInicial] = useState<Ponto2D | null>(null);
  const [pontoCursor, setPontoCursor] = useState<Ponto2D | null>(null);

  // Transformação de visualização (Pan & Zoom no Canvas 2D)
  const [zoom, setZoom] = useState(50); // pixels por metro (ex: 50px = 1 metro)
  const [offset, setOffset] = useState<Ponto2D>({ x: 150, y: 150 });
  const isDraggingCanvas = useRef(false);
  const dragStartPos = useRef<Ponto2D>({ x: 0, y: 0 });

  // Converter coordenadas de Tela (pixels) para Mundo (metros)
  const screenToWorld = (screenX: number, screenY: number): Ponto2D => {
    return {
      x: snapAoGrid((screenX - offset.x) / zoom, 0.1),
      y: snapAoGrid((screenY - offset.y) / zoom, 0.1),
    };
  };

  // Converter coordenadas de Mundo (metros) para Tela (pixels)
  const worldToScreen = (worldX: number, worldY: number): Ponto2D => {
    return {
      x: worldX * zoom + offset.x,
      y: worldY * zoom + offset.y,
    };
  };

  // Redesenhar o Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajustar tamanho do buffer com DPR
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 600;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Limpar fundo
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Desenhar Grid Arquitetônico
    const gridSize = zoom; // 1 metro
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "#e2e8f0";

    const startX = offset.x % gridSize;
    const startY = offset.y % gridSize;

    for (let x = startX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Desenhar Ambientes (Pisos)
    dados.ambientes.forEach((amb) => {
      if (amb.pontos.length >= 3) {
        ctx.fillStyle = "rgba(241, 245, 249, 0.6)";
        ctx.beginPath();
        const first = worldToScreen(amb.pontos[0].x, amb.pontos[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < amb.pontos.length; i++) {
          const pt = worldToScreen(amb.pontos[i].x, amb.pontos[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();

        // Rótulo do ambiente
        const centroX =
          amb.pontos.reduce((acc, p) => acc + p.x, 0) / amb.pontos.length;
        const centroY =
          amb.pontos.reduce((acc, p) => acc + p.y, 0) / amb.pontos.length;
        const screenLabel = worldToScreen(centroX, centroY);

        ctx.fillStyle = "#475569";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(amb.nome, screenLabel.x, screenLabel.y - 6);
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.fillText(`${amb.area.toFixed(2)} m²`, screenLabel.x, screenLabel.y + 10);
      }
    });

    // 4. Desenhar Paredes
    dados.paredes.forEach((parede) => {
      const isSelected = parede.id === elementoSelecionadoId;
      const p1 = worldToScreen(parede.p1.x, parede.p1.y);
      const p2 = worldToScreen(parede.p2.x, parede.p2.y);
      const espessuraPx = Math.max(parede.espessura * zoom, 4);

      // Traço da parede
      ctx.beginPath();
      ctx.lineWidth = espessuraPx;
      ctx.lineCap = "square";
      ctx.strokeStyle = isSelected ? "#f59e0b" : "#334155";
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Cota de comprimento da parede
      const comp = calcularComprimentoParede(parede.p1, parede.p2);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.fillStyle = isSelected ? "#b45309" : "#0284c7";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${comp.toFixed(2)} m`, midX, midY - espessuraPx / 2 - 4);
    });

    // 5. Desenhar Aberturas (Portas e Janelas)
    dados.aberturas.forEach((ab) => {
      const parede = dados.paredes.find((p) => p.id === ab.paredeId);
      if (!parede) return;

      const comp = calcularComprimentoParede(parede.p1, parede.p2);
      const t = Math.min(Math.max(ab.distanciaP1 / comp, 0), 1);
      const posX = parede.p1.x + (parede.p2.x - parede.p1.x) * t;
      const posY = parede.p1.y + (parede.p2.y - parede.p1.y) * t;
      const pScreen = worldToScreen(posX, posY);

      const isSelected = ab.id === elementoSelecionadoId;
      const tamPx = ab.largura * zoom;

      ctx.save();
      ctx.translate(pScreen.x, pScreen.y);
      const angulo = Math.atan2(parede.p2.y - parede.p1.y, parede.p2.x - parede.p1.x);
      ctx.rotate(angulo);

      if (ab.tipo === "porta") {
        // Vão da porta em branco com folha aberta
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-tamPx / 2, -4, tamPx, 8);
        ctx.strokeStyle = isSelected ? "#f59e0b" : "#854d0e";
        ctx.lineWidth = 2;
        ctx.strokeRect(-tamPx / 2, -4, tamPx, 8);

        // Arco de abertura da porta
        ctx.beginPath();
        ctx.arc(-tamPx / 2, 0, tamPx, 0, Math.PI / 2);
        ctx.strokeStyle = "rgba(133, 77, 14, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ab.tipo === "janela") {
        // Janela com três linhas paralelas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-tamPx / 2, -4, tamPx, 8);
        ctx.strokeStyle = isSelected ? "#f59e0b" : "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-tamPx / 2, -4, tamPx, 8);
        ctx.beginPath();
        ctx.moveTo(-tamPx / 2, 0);
        ctx.lineTo(tamPx / 2, 0);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 6. Desenhar Prévia da Parede Sendo Criada
    if (ferramenta === "parede" && pontoInicial && pontoCursor) {
      const p1 = worldToScreen(pontoInicial.x, pontoInicial.y);
      const p2 = worldToScreen(pontoCursor.x, pontoCursor.y);
      const espessuraPx = dados.config.espessuraParedePadrao * zoom;

      ctx.beginPath();
      ctx.lineWidth = espessuraPx;
      ctx.lineCap = "square";
      ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const comp = calcularComprimentoParede(pontoInicial, pontoCursor);
      ctx.fillStyle = "#1d4ed8";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${comp.toFixed(2)} m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12);
    }
  }, [dados, offset, zoom, ferramenta, pontoInicial, pontoCursor, elementoSelecionadoId]);

  // Aplicar modo ortogonal (Ortho Lock - força 0°, 90°, 180°, 270°)
  const aplicarOrthoSeNecessario = (pos: Ponto2D, posOrigem: Ponto2D | null, desativar = false): Ponto2D => {
    if (!modoOrtho || !posOrigem || desativar) return pos;
    const dx = Math.abs(pos.x - posOrigem.x);
    const dy = Math.abs(pos.y - posOrigem.y);
    if (dx >= dy) {
      return { x: pos.x, y: posOrigem.y };
    } else {
      return { x: posOrigem.x, y: pos.y };
    }
  };

  // Criação instantânea de cômodo paramétrico em 1 clique
  const handleCriarComodoRapido = () => {
    const larg = parseFloat(comodoLargura) || 4.0;
    const comp = parseFloat(comodoComprimento) || 3.0;

    let startX = 0;
    let startY = 0;
    if (dados.paredes.length > 0) {
      let maxX = -Infinity;
      dados.paredes.forEach((p) => {
        maxX = Math.max(maxX, p.p1.x, p.p2.x);
      });
      startX = maxX + 1.0; // Adiciona 1m de espaçamento da última parede
    }

    const espessura = dados.config.espessuraParedePadrao;
    const altura = dados.config.peDireito;
    const timestamp = Date.now();

    const pTL: Ponto2D = { x: startX, y: startY };
    const pTR: Ponto2D = { x: startX + larg, y: startY };
    const pBR: Ponto2D = { x: startX + larg, y: startY + comp };
    const pBL: Ponto2D = { x: startX, y: startY + comp };

    const novasParedes: Parede[] = [
      { id: `parede_${timestamp}_1`, p1: pTL, p2: pTR, espessura, altura, tipo: "alvenaria_vedacao" },
      { id: `parede_${timestamp}_2`, p1: pTR, p2: pBR, espessura, altura, tipo: "alvenaria_vedacao" },
      { id: `parede_${timestamp}_3`, p1: pBR, p2: pBL, espessura, altura, tipo: "alvenaria_vedacao" },
      { id: `parede_${timestamp}_4`, p1: pBL, p2: pTL, espessura, altura, tipo: "alvenaria_vedacao" },
    ];

    const novoAmbiente = {
      id: `amb_${timestamp}`,
      nome: comodoNome || "Cômodo",
      pontos: [pTL, pTR, pBR, pBL],
      area: Number((larg * comp).toFixed(2)),
      perimetro: Number(((larg + comp) * 2).toFixed(2)),
      pisoAcabamento: "Porcelanato Retificado 84x84",
      tetoAcabamento: "Forro de Gesso com Pintura Branca",
      paredeAcabamento: "Pintura Acrílica Fosca Lavável",
    };

    onChangeDados({
      ...dados,
      paredes: [...dados.paredes, ...novasParedes],
      ambientes: [...dados.ambientes, novoAmbiente],
    });

    toast.success(`Cômodo "${comodoNome}" (${larg}x${comp}m = ${(larg * comp).toFixed(1)}m²) gerado no 2D e 3D!`);
    setModalComodoAberto(false);
  };

  // Exportar a planta modelada diretamente para AutoCAD (.DXF)
  const handleExportarDxf = () => {
    if (dados.paredes.length === 0) {
      toast.error("Desenhe pelo menos uma parede antes de exportar para DXF.");
      return;
    }
    const dxfString = exportarParaDxf({ paredes: dados.paredes });
    const blob = new Blob([dxfString], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planta_baixa_${Date.now()}.dxf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Planta exportada para DXF (AutoCAD) com sucesso!");
  };

  const handleLimparPlanta = () => {
    if (dados.paredes.length === 0) return;
    if (window.confirm("Deseja realmente limpar toda a planta baixa desta obra?")) {
      onChangeDados({
        ...dados,
        paredes: [],
        aberturas: [],
        ambientes: [],
      });
      setElementoSelecionadoId(null);
      toast.info("Planta limpa com sucesso.");
    }
  };

  // Eventos de clique no canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (somenteLeitura) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    let worldPos = screenToWorld(screenX, screenY);

    if (ferramenta === "parede") {
      if (!pontoInicial) {
        // Primeiro clique: ponto inicial da parede
        setPontoInicial(worldPos);
      } else {
        // Segundo clique: aplicar Ortho se ativo e finalizar a parede
        worldPos = aplicarOrthoSeNecessario(worldPos, pontoInicial, e.altKey);
        const comp = calcularComprimentoParede(pontoInicial, worldPos);
        if (comp > 0.2) {
          const novaParede: Parede = {
            id: `parede_${Date.now()}`,
            p1: pontoInicial,
            p2: worldPos,
            espessura: espessuraAtiva,
            altura: peDireitoAtivo,
            tipo: "alvenaria_vedacao",
          };
          onChangeDados({
            ...dados,
            paredes: [...dados.paredes, novaParede],
          });
        }
        setPontoInicial(null);
      }
    } else if (ferramenta === "porta" || ferramenta === "janela") {
      // Inserir porta ou janela na parede mais próxima do clique com as dimensões ativas
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo) {
        const larg = ferramenta === "porta" ? larguraPortaAtiva : larguraJanelaAtiva;
        const alt = ferramenta === "porta" ? 2.10 : 1.20;
        const peit = ferramenta === "porta" ? 0.0 : (larg <= 0.8 ? 1.6 : 1.0);
        const novaAbertura: Abertura = {
          id: `ab_${Date.now()}`,
          paredeId: paredeAlvo.parede.id,
          tipo: ferramenta,
          nome: ferramenta === "porta" ? `P - Porta (${larg.toFixed(2)}m)` : `J - Janela (${larg.toFixed(2)}m)`,
          largura: larg,
          altura: alt,
          peitoril: peit,
          distanciaP1: Math.max(paredeAlvo.distanciaAoInicio, 0.2),
        };
        onChangeDados({
          ...dados,
          aberturas: [...dados.aberturas, novaAbertura],
        });
        setFerramenta("selecionar");
        setElementoSelecionadoId(novaAbertura.id);
      }
    } else if (ferramenta === "selecionar") {
      // 1. Tentar selecionar uma abertura (porta/janela)
      const abAlvo = encontrarAberturaMaisProxima(worldPos);
      if (abAlvo) {
        setElementoSelecionadoId(abAlvo.id);
      } else {
        // 2. Tentar selecionar uma parede
        const paredeAlvo = encontrarParedeMaisProxima(worldPos);
        if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.3) {
          setElementoSelecionadoId(paredeAlvo.parede.id);
        } else {
          setElementoSelecionadoId(null);
        }
      }
    } else if (ferramenta === "apagar") {
      const abAlvo = encontrarAberturaMaisProxima(worldPos);
      if (abAlvo) {
        onChangeDados({
          ...dados,
          aberturas: dados.aberturas.filter((a) => a.id !== abAlvo.id),
        });
        setElementoSelecionadoId(null);
      } else {
        const paredeAlvo = encontrarParedeMaisProxima(worldPos);
        if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.3) {
          onChangeDados({
            ...dados,
            paredes: dados.paredes.filter((p) => p.id !== paredeAlvo.parede.id),
            aberturas: dados.aberturas.filter((a) => a.paredeId !== paredeAlvo.parede.id),
          });
          setElementoSelecionadoId(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (isDraggingCanvas.current) {
      setOffset((prev) => ({
        x: prev.x + (screenX - dragStartPos.current.x),
        y: prev.y + (screenY - dragStartPos.current.y),
      }));
      dragStartPos.current = { x: screenX, y: screenY };
    } else {
      let worldPos = screenToWorld(screenX, screenY);
      if (ferramenta === "parede" && pontoInicial) {
        worldPos = aplicarOrthoSeNecessario(worldPos, pontoInicial, e.altKey);
      }
      setPontoCursor(worldPos);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.shiftKey) {
      // Arrastar tela com botão do meio ou Shift
      isDraggingCanvas.current = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 15), 180));
  };

  function encontrarAberturaMaisProxima(pos: Ponto2D) {
    let maisProxima: Abertura | null = null;
    let menorDist = 0.45; // 45cm de tolerância de clique

    dados.aberturas.forEach((ab) => {
      const parede = dados.paredes.find((p) => p.id === ab.paredeId);
      if (!parede) return;
      const dx = parede.p2.x - parede.p1.x;
      const dy = parede.p2.y - parede.p1.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      if (comp === 0) return;
      const t = Math.min(Math.max(ab.distanciaP1 / comp, 0), 1);
      const posX = parede.p1.x + dx * t;
      const posY = parede.p1.y + dy * t;
      const dist = Math.sqrt((pos.x - posX) ** 2 + (pos.y - posY) ** 2);
      if (dist < menorDist) {
        menorDist = dist;
        maisProxima = ab;
      }
    });

    return maisProxima;
  }

  function encontrarParedeMaisProxima(pos: Ponto2D) {
    let maisProxima: Parede | null = null;
    let menorDist = Infinity;
    let distAoInicio = 0;

    dados.paredes.forEach((p) => {
      const dx = p.p2.x - p.p1.x;
      const dy = p.p2.y - p.p1.y;
      const comp = Math.sqrt(dx * dx + dy * dy);
      if (comp === 0) return;

      const t = Math.max(0, Math.min(1, ((pos.x - p.p1.x) * dx + (pos.y - p.p1.y) * dy) / (comp * comp)));
      const projX = p.p1.x + t * dx;
      const projY = p.p1.y + t * dy;
      const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);

      if (dist < menorDist) {
        menorDist = dist;
        maisProxima = p;
        distAoInicio = t * comp;
      }
    });

    return maisProxima ? { parede: maisProxima, distanciaPontoReta: menorDist, distanciaAoInicio: distAoInicio } : null;
  }

  const paredeSelecionada = dados.paredes.find((p) => p.id === elementoSelecionadoId);
  const aberturaSelecionada = dados.aberturas.find((a) => a.id === elementoSelecionadoId);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-white rounded-lg border border-slate-200 overflow-hidden flex">
      {/* Menu Lateral de Ferramentas CAD (Estilo Structa) */}
      {!somenteLeitura && (
        <div className="w-48 bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-1.5 z-10 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
            Ferramentas CAD
          </div>

          <Button
            size="sm"
            variant={ferramenta === "selecionar" ? "default" : "ghost"}
            className="justify-start gap-2 h-9"
            onClick={() => {
              setFerramenta("selecionar");
              setPontoInicial(null);
            }}
          >
            <MousePointer className="w-4 h-4" /> Selecionar
          </Button>

          {/* Botão de Criação de Cômodo Paramétrico Rápido */}
          <Button
            size="sm"
            variant="outline"
            className="justify-start gap-2 h-9 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
            onClick={() => setModalComodoAberto(true)}
            title="Criar um cômodo retangular com 4 paredes e piso automaticamente"
          >
            <BoxSelect className="w-4 h-4 text-emerald-600" /> + Novo Cômodo
          </Button>

          {/* Botão Parede com seletor de espessura ativa */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "parede" ? "default" : "ghost"}
              className="justify-start gap-2 h-9 w-full text-slate-800"
              onClick={() => {
                setFerramenta("parede");
                setPontoInicial(null);
              }}
            >
              <Square className="w-4 h-4 text-blue-600" /> Parede ({(espessuraAtiva * 100).toFixed(0)}cm)
            </Button>
            {ferramenta === "parede" && (
              <div className="bg-blue-50/70 p-1.5 rounded border border-blue-200/60 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-blue-800 block">Espessura da Parede:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.10, 0.15, 0.20].map((esp) => (
                    <Button
                      key={esp}
                      type="button"
                      size="icon-xs"
                      variant={espessuraAtiva === esp ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => setEspessuraAtiva(esp)}
                    >
                      {Math.round(esp * 100)}cm
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botão Porta com seletor de largura ativa */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "porta" ? "default" : "ghost"}
              className="justify-start gap-2 h-9 w-full text-slate-800"
              onClick={() => {
                setFerramenta("porta");
                setPontoInicial(null);
              }}
            >
              <DoorOpen className="w-4 h-4 text-amber-700" /> Porta ({larguraPortaAtiva.toFixed(2)}m)
            </Button>
            {ferramenta === "porta" && (
              <div className="bg-amber-50/70 p-1.5 rounded border border-amber-200/60 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-amber-800 block">Largura do Vão:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.60, 0.70, 0.80, 0.90, 1.00].map((larg) => (
                    <Button
                      key={larg}
                      type="button"
                      size="icon-xs"
                      variant={larguraPortaAtiva === larg ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => setLarguraPortaAtiva(larg)}
                    >
                      {larg.toFixed(2)}m
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botão Janela com seletor de largura ativa */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "janela" ? "default" : "ghost"}
              className="justify-start gap-2 h-9 w-full text-slate-800"
              onClick={() => {
                setFerramenta("janela");
                setPontoInicial(null);
              }}
            >
              <AppWindow className="w-4 h-4 text-sky-600" /> Janela ({larguraJanelaAtiva.toFixed(2)}m)
            </Button>
            {ferramenta === "janela" && (
              <div className="bg-sky-50/70 p-1.5 rounded border border-sky-200/60 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-sky-800 block">Largura da Janela:</span>
                <div className="grid grid-cols-2 gap-1">
                  {[0.60, 1.00, 1.20, 1.50, 2.00].map((larg) => (
                    <Button
                      key={larg}
                      type="button"
                      size="icon-xs"
                      variant={larguraJanelaAtiva === larg ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => setLarguraJanelaAtiva(larg)}
                    >
                      {larg.toFixed(2)}m
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant={ferramenta === "apagar" ? "destructive" : "ghost"}
            className="justify-start gap-2 h-9 text-red-600 hover:text-red-700"
            onClick={() => {
              setFerramenta("apagar");
              setPontoInicial(null);
            }}
          >
            <Trash2 className="w-4 h-4" /> Apagar
          </Button>

          <div className="h-px bg-slate-200 my-1" />

          {/* Toggle de Modo Ortogonal (Ortho Lock como no AutoCAD) */}
          <Button
            size="sm"
            variant={modoOrtho ? "secondary" : "outline"}
            className={`justify-start gap-2 h-8 text-xs font-mono ${
              modoOrtho
                ? "bg-blue-100 text-blue-800 border-blue-300 font-semibold"
                : "text-slate-500"
            }`}
            onClick={() => setModoOrtho((prev) => !prev)}
            title="Trava o desenho em ângulos retos de 90° (como a tecla F8 no AutoCAD)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Ortho 90°: {modoOrtho ? "ON" : "OFF"}
          </Button>

          <div className="h-px bg-slate-200 my-1" />

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            AutoCAD (DXF)
          </div>

          {/* Botão Importar DXF */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".dxf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const text = event.target?.result as string;
                    const novasParedes = extrairParedesDoDxf(
                      text,
                      dados.config.espessuraParedePadrao,
                      dados.config.peDireito
                    );
                    if (novasParedes.length > 0) {
                      onChangeDados({
                        ...dados,
                        paredes: [...dados.paredes, ...novasParedes],
                      });
                      toast.success(`${novasParedes.length} paredes importadas do DXF com sucesso!`);
                    } else {
                      toast.error("Nenhuma linha ou polilinha compatível encontrada no arquivo DXF.");
                    }
                  } catch (err: any) {
                    toast.error(`Erro ao ler DXF: ${err.message}`);
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-2 h-8 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-2xs">
              <FolderUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importar DXF</span>
            </div>
          </label>

          {/* Botão Exportar DXF */}
          <Button
            size="sm"
            variant="outline"
            className="justify-start gap-2 h-8 text-xs text-slate-700 bg-white hover:bg-slate-100"
            onClick={handleExportarDxf}
            title="Exporta a planta atual em formato DXF ASCII para abrir no AutoCAD"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar DXF</span>
          </Button>

          {/* Painel de Parede Selecionada */}
          {paredeSelecionada && (
            <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded-md shadow-xs text-xs space-y-2">
              <div className="font-semibold text-slate-800 flex items-center justify-between border-b pb-1.5">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" /> Parede
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 h-5 w-5"
                  onClick={() => {
                    onChangeDados({
                      ...dados,
                      paredes: dados.paredes.filter((p) => p.id !== paredeSelecionada.id),
                      aberturas: dados.aberturas.filter((a) => a.paredeId !== paredeSelecionada.id),
                    });
                    setElementoSelecionadoId(null);
                  }}
                  title="Apagar parede selecionada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Comprimento:</span>
                <span className="font-bold text-slate-800 text-sm font-mono">
                  {calcularComprimentoParede(paredeSelecionada.p1, paredeSelecionada.p2).toFixed(2)} m
                </span>
              </div>

              {/* Ajuste Rápido de Espessura da Parede */}
              <div>
                <span className="text-slate-400 block text-[10px] mb-1">Alterar Espessura:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.10, 0.15, 0.20].map((esp) => (
                    <Button
                      key={esp}
                      size="icon-xs"
                      variant={paredeSelecionada.espessura === esp ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => {
                        onChangeDados({
                          ...dados,
                          paredes: dados.paredes.map((p) =>
                            p.id === paredeSelecionada.id ? { ...p, espessura: esp } : p
                          ),
                        });
                      }}
                    >
                      {Math.round(esp * 100)}cm
                    </Button>
                  ))}
                </div>
              </div>

              {/* Ajuste de Pé-Direito */}
              <div>
                <span className="text-slate-400 block text-[10px] mb-1">Pé-Direito:</span>
                <div className="grid grid-cols-2 gap-1">
                  {[2.80, 3.00].map((alt) => (
                    <Button
                      key={alt}
                      size="icon-xs"
                      variant={paredeSelecionada.altura === alt ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => {
                        onChangeDados({
                          ...dados,
                          paredes: dados.paredes.map((p) =>
                            p.id === paredeSelecionada.id ? { ...p, altura: alt } : p
                          ),
                        });
                      }}
                    >
                      {alt.toFixed(2)}m
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Painel de Abertura (Porta / Janela) Selecionada */}
          {aberturaSelecionada && (
            <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded-md shadow-xs text-xs space-y-2">
              <div className="font-semibold text-slate-800 flex items-center justify-between border-b pb-1.5">
                <span className="flex items-center gap-1 capitalize">
                  {aberturaSelecionada.tipo === "porta" ? (
                    <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <AppWindow className="w-3.5 h-3.5 text-sky-600" />
                  )}
                  {aberturaSelecionada.tipo} Selecionada
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 h-5 w-5"
                  onClick={() => {
                    onChangeDados({
                      ...dados,
                      aberturas: dados.aberturas.filter((a) => a.id !== aberturaSelecionada.id),
                    });
                    setElementoSelecionadoId(null);
                  }}
                  title="Apagar este vão"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] mb-1">Alterar Largura:</span>
                <div className="grid grid-cols-3 gap-1">
                  {(aberturaSelecionada.tipo === "porta"
                    ? [0.60, 0.70, 0.80, 0.90, 1.00]
                    : [0.60, 1.00, 1.20, 1.50, 2.00]
                  ).map((larg) => (
                    <Button
                      key={larg}
                      size="icon-xs"
                      variant={aberturaSelecionada.largura === larg ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono"
                      onClick={() => {
                        onChangeDados({
                          ...dados,
                          aberturas: dados.aberturas.map((a) =>
                            a.id === aberturaSelecionada.id ? { ...a, largura: larg } : a
                          ),
                        });
                      }}
                    >
                      {larg.toFixed(2)}m
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t">
                <span>
                  Altura: <strong>{aberturaSelecionada.altura.toFixed(2)}m</strong>
                </span>
                <span>
                  Peitoril: <strong>{aberturaSelecionada.peitoril.toFixed(2)}m</strong>
                </span>
              </div>
            </div>
          )}

          {dados.paredes.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 text-slate-400 hover:text-red-600 text-xs justify-start gap-1.5 h-7"
              onClick={handleLimparPlanta}
            >
              <Trash2 className="w-3 h-3" /> Limpar Planta
            </Button>
          )}

          <div className="mt-auto text-[11px] text-slate-400 bg-slate-100 p-2 rounded">
            Dica: Segure <kbd className="bg-white px-1 border rounded">Shift</kbd> ou botão do meio para arrastar a tela.
          </div>
        </div>
      )}

      {/* Área do Canvas de Desenho */}
      <div className="relative flex-1 h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Orientação quando a planta está em branco */}
        {dados.paredes.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md px-4 py-2 rounded-lg text-xs text-slate-600 flex items-center gap-2 pointer-events-none">
            <Square className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>Planta em branco:</strong> Selecione a ferramenta <strong>Parede</strong> para desenhar ou clique em <strong>Importar DXF</strong> na barra lateral.
            </span>
          </div>
        )}

        {/* Controles de Zoom Flutuantes no Canto Inferior Direito */}
        <div className="absolute bottom-3 right-3 z-10 flex gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-md border border-slate-200 shadow-sm">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setZoom((prev) => Math.min(prev * 1.2, 180))}
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setZoom((prev) => Math.max(prev * 0.8, 15))}
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => {
              setZoom(50);
              setOffset({ x: 150, y: 150 });
            }}
            title="Centralizar Visualização"
          >
            <Maximize className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Status de Coordenadas e Modo Ortho */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
          {pontoCursor && (
            <div className="text-[11px] text-slate-500 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-200">
              X: {pontoCursor.x.toFixed(2)} m • Y: {pontoCursor.y.toFixed(2)} m
            </div>
          )}
          <div
            className={`text-[10px] font-mono px-2 py-1 rounded border font-semibold ${
              modoOrtho
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            ORTHO: {modoOrtho ? "LIGADO (90°)" : "DESLIGADO"}
          </div>
        </div>
      </div>

      {/* Modal Paramétrico para Criação Rápida de Cômodos */}
      <Dialog open={modalComodoAberto} onOpenChange={setModalComodoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <BoxSelect className="w-5 h-5 text-emerald-600" /> Adicionar Cômodo Paramétrico
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Nome do Ambiente
              </Label>
              <Input
                value={comodoNome}
                onChange={(e) => setComodoNome(e.target.value)}
                placeholder="Ex: Quarto 1, Suíte, Sala de Estar"
                className="h-9 text-sm"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {["Quarto", "Suíte", "Sala", "Cozinha", "Banheiro", "Varanda", "Garagem"].map((sugestao) => (
                  <Button
                    key={sugestao}
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    className="text-[11px] h-6 px-2 w-auto font-normal"
                    onClick={() => setComodoNome(sugestao)}
                  >
                    {sugestao}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Largura (metros)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="50"
                  value={comodoLargura}
                  onChange={(e) => setComodoLargura(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Comprimento (metros)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="50"
                  value={comodoComprimento}
                  onChange={(e) => setComodoComprimento(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>

            {/* Prévia das medidas e área */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Área Estimada do Piso:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {(
                  (parseFloat(comodoLargura) || 0) * (parseFloat(comodoComprimento) || 0)
                ).toFixed(2)}{" "}
                m²
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalComodoAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
              onClick={handleCriarComodoRapido}
            >
              <Plus className="w-4 h-4" /> Gerar Cômodo 2D & 3D
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
