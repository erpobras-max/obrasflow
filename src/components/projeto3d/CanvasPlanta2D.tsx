import { useState, useRef, useEffect, useCallback } from "react";
import type { DadosProjetoBIM, Parede, Abertura, Ponto2D, Ambiente } from "@/types/projeto3d";
import { snapAoGrid, calcularComprimentoParede } from "@/lib/projeto3d.utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  Undo2,
  Redo2,
  Ruler,
  FlipHorizontal,
  AlignCenter,
  MoveHorizontal,
  Type,
  Check,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
} from "lucide-react";
import { extrairParedesDoDxf, exportarParaDxf } from "@/lib/dxf-parser";
import { toast } from "sonner";

export type FerramentaAtiva =
  | "selecionar"
  | "parede"
  | "porta"
  | "janela"
  | "apagar"
  | "medir"
  | "texto";

interface SnapInfo {
  x: number;
  y: number;
  tipo: "endpoint" | "midpoint";
  paredeId?: string;
}

interface CanvasPlanta2DProps {
  dados: DadosProjetoBIM;
  onChangeDados: (novosDados: DadosProjetoBIM) => void;
  somenteLeitura?: boolean;
}

export function CanvasPlanta2D({ dados, onChangeDados, somenteLeitura = false }: CanvasPlanta2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ferramenta ativa
  const [ferramenta, setFerramenta] = useState<FerramentaAtiva>("selecionar");
  const [elementoSelecionadoId, setElementoSelecionadoId] = useState<string | null>(null);

  // Hover feedback para interações
  const [elementoHover, setElementoHover] = useState<{
    id: string;
    tipo: "abertura" | "parede" | "ambiente" | "vertice";
    vertice?: "p1" | "p2";
  } | null>(null);

  // Configurações ativas para novas inserções (customizáveis pelo engenheiro)
  const [espessuraAtiva, setEspessuraAtiva] = useState(0.15); // metros (15cm padrão)
  const [peDireitoAtivo, setPeDireitoAtivo] = useState(2.80); // metros
  const [larguraPortaAtiva, setLarguraPortaAtiva] = useState(0.80); // metros (80cm padrão)
  const [larguraJanelaAtiva, setLarguraJanelaAtiva] = useState(1.20); // metros (1.20m padrão)

  // Modo Ortogonal (Ortho Lock como no AutoCAD tecla F8)
  const [modoOrtho, setModoOrtho] = useState(true);

  // Pilhas de Desfazer (Undo) e Refazer (Redo)
  const historicoDesfazer = useRef<DadosProjetoBIM[]>([]);
  const historicoRefazer = useRef<DadosProjetoBIM[]>([]);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);

  // Ponto de início de uma parede durante a criação contínua (Polyline)
  const [pontoInicial, setPontoInicial] = useState<Ponto2D | null>(null);
  const [pontoCursor, setPontoCursor] = useState<Ponto2D | null>(null);
  const cadeiaParedes = useRef<Ponto2D[]>([]);

  // Snap Inteligente (OSNAP) ativo no cursor
  const [pontoSnapAtivo, setPontoSnapAtivo] = useState<SnapInfo | null>(null);

  // Estado de Arrastar Abertura (Porta/Janela) ou Vértice de Parede
  const arrastoAberturaId = useRef<string | null>(null);
  const arrastoVertice = useRef<{ paredeId: string; vertice: "p1" | "p2" } | null>(null);

  // Ferramenta Medir (Régua CAD)
  const [pontoMedirInicio, setPontoMedirInicio] = useState<Ponto2D | null>(null);
  const [medicaoFixa, setMedicaoFixa] = useState<{ p1: Ponto2D; p2: Ponto2D; distancia: number } | null>(null);

  // Modais de Criação Rápida e Edição de Ambientes
  const [modalComodoAberto, setModalComodoAberto] = useState(false);
  const [comodoNome, setComodoNome] = useState("Quarto");
  const [comodoLargura, setComodoLargura] = useState("4.00");
  const [comodoComprimento, setComodoComprimento] = useState("3.50");

  const [modalEditarAmbienteAberto, setModalEditarAmbienteAberto] = useState(false);
  const [ambienteEmEdicao, setAmbienteEmEdicao] = useState<Ambiente | null>(null);

  // Transformação de visualização (Pan & Zoom no Canvas 2D)
  const [zoom, setZoom] = useState(50); // pixels por metro (ex: 50px = 1 metro)
  const [offset, setOffset] = useState<Ponto2D>({ x: 150, y: 150 });
  const isDraggingCanvas = useRef(false);
  const dragStartPos = useRef<Ponto2D>({ x: 0, y: 0 });

  // Salvar no histórico antes de mutação
  const registrarHistorico = useCallback(() => {
    historicoDesfazer.current.push(JSON.parse(JSON.stringify(dados)));
    if (historicoDesfazer.current.length > 25) {
      historicoDesfazer.current.shift();
    }
    historicoRefazer.current = [];
    setPodeDesfazer(true);
    setPodeRefazer(false);
  }, [dados]);

  // Desfazer (Ctrl+Z)
  const handleDesfazer = useCallback(() => {
    if (historicoDesfazer.current.length === 0) return;
    const estadoAnterior = historicoDesfazer.current.pop()!;
    historicoRefazer.current.push(JSON.parse(JSON.stringify(dados)));
    setPodeDesfazer(historicoDesfazer.current.length > 0);
    setPodeRefazer(true);
    onChangeDados(estadoAnterior);
    setElementoSelecionadoId(null);
    toast.info("Ação desfeita");
  }, [dados, onChangeDados]);

  // Refazer (Ctrl+Y)
  const handleRefazer = useCallback(() => {
    if (historicoRefazer.current.length === 0) return;
    const proximoEstado = historicoRefazer.current.pop()!;
    historicoDesfazer.current.push(JSON.parse(JSON.stringify(dados)));
    setPodeDesfazer(true);
    setPodeRefazer(historicoRefazer.current.length > 0);
    onChangeDados(proximoEstado);
    setElementoSelecionadoId(null);
    toast.info("Ação refeita");
  }, [dados, onChangeDados]);

  // Converter coordenadas de Tela (pixels) para Mundo (metros)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Ponto2D => {
      return {
        x: snapAoGrid((screenX - offset.x) / zoom, 0.05),
        y: snapAoGrid((screenY - offset.y) / zoom, 0.05),
      };
    },
    [offset, zoom]
  );

  // Converter coordenadas de Mundo (metros) para Tela (pixels)
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Ponto2D => {
      return {
        x: worldX * zoom + offset.x,
        y: worldY * zoom + offset.y,
      };
    },
    [offset, zoom]
  );

  // Detecção de Snap Inteligente (OSNAP: Endpoints e Midpoints)
  const detectarSnap = useCallback(
    (posMundo: Ponto2D, raioSnapMundo: number = 0.35): SnapInfo | null => {
      // 1. Prioridade para Endpoints de paredes
      for (const p of dados.paredes) {
        const dist1 = Math.hypot(posMundo.x - p.p1.x, posMundo.y - p.p1.y);
        if (dist1 <= raioSnapMundo) {
          return { x: p.p1.x, y: p.p1.y, tipo: "endpoint", paredeId: p.id };
        }
        const dist2 = Math.hypot(posMundo.x - p.p2.x, posMundo.y - p.p2.y);
        if (dist2 <= raioSnapMundo) {
          return { x: p.p2.x, y: p.p2.y, tipo: "endpoint", paredeId: p.id };
        }
      }

      // 2. Pontos médios de paredes
      for (const p of dados.paredes) {
        const midX = (p.p1.x + p.p2.x) / 2;
        const midY = (p.p1.y + p.p2.y) / 2;
        const distMid = Math.hypot(posMundo.x - midX, posMundo.y - midY);
        if (distMid <= raioSnapMundo * 0.8) {
          return { x: midX, y: midY, tipo: "midpoint", paredeId: p.id };
        }
      }

      return null;
    },
    [dados.paredes]
  );

  // Modo Ortogonal (Ortho Lock 90°)
  const aplicarOrtho = useCallback(
    (pos: Ponto2D, posOrigem: Ponto2D | null, desativar = false): Ponto2D => {
      if (!modoOrtho || !posOrigem || desativar) return pos;
      const dx = Math.abs(pos.x - posOrigem.x);
      const dy = Math.abs(pos.y - posOrigem.y);
      return dx >= dy ? { x: pos.x, y: posOrigem.y } : { x: posOrigem.x, y: pos.y };
    },
    [modoOrtho]
  );

  // Encontrar Abertura Mais Próxima
  const encontrarAberturaMaisProxima = useCallback(
    (pos: Ponto2D, tolerancia = 0.55): Abertura | null => {
      let maisProxima: Abertura | null = null;
      let menorDist = tolerancia;

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
        const dist = Math.hypot(pos.x - posX, pos.y - posY);
        if (dist < menorDist) {
          menorDist = dist;
          maisProxima = ab;
        }
      });

      return maisProxima;
    },
    [dados.aberturas, dados.paredes]
  );

  // Encontrar Parede Mais Próxima
  const encontrarParedeMaisProxima = useCallback(
    (pos: Ponto2D) => {
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
        const dist = Math.hypot(pos.x - projX, pos.y - projY);

        if (dist < menorDist) {
          menorDist = dist;
          maisProxima = p;
          distAoInicio = t * comp;
        }
      });

      return maisProxima
        ? { parede: maisProxima, distanciaPontoReta: menorDist, distanciaAoInicio: distAoInicio }
        : null;
    },
    [dados.paredes]
  );

  // Abertura e Parede selecionadas atualmente
  const aberturaSelecionada = dados.aberturas.find((a) => a.id === elementoSelecionadoId);
  const paredeSelecionada = dados.paredes.find((p) => p.id === elementoSelecionadoId);
  const ambienteSelecionado = dados.ambientes.find((amb) => amb.id === elementoSelecionadoId);

  // -------------------------------------------------------------
  // OPERAÇÕES EM ABERTURAS (Portas / Janelas)
  // -------------------------------------------------------------

  // Apagar EXCLUSIVAMENTE a abertura selecionada ou especificada
  const handleApagarAbertura = useCallback(
    (aberturaId: string) => {
      const ab = dados.aberturas.find((a) => a.id === aberturaId);
      if (!ab) return;
      registrarHistorico();
      onChangeDados({
        ...dados,
        aberturas: dados.aberturas.filter((a) => a.id !== aberturaId),
      });
      if (elementoSelecionadoId === aberturaId) {
        setElementoSelecionadoId(null);
      }
      toast.success(`${ab.tipo === "porta" ? "Porta" : "Janela"} removida com sucesso!`);
    },
    [dados, elementoSelecionadoId, onChangeDados, registrarHistorico]
  );

  // Deslocar abertura ao longo da parede (+/- delta metros)
  const handleDeslocarAbertura = useCallback(
    (aberturaId: string, deltaMetros: number) => {
      const ab = dados.aberturas.find((a) => a.id === aberturaId);
      if (!ab) return;
      const parede = dados.paredes.find((p) => p.id === ab.paredeId);
      if (!parede) return;

      const comp = calcularComprimentoParede(parede.p1, parede.p2);
      const margem = ab.largura / 2 + 0.05;
      const novaDist = Math.max(margem, Math.min(comp - margem, ab.distanciaP1 + deltaMetros));

      registrarHistorico();
      onChangeDados({
        ...dados,
        aberturas: dados.aberturas.map((a) =>
          a.id === aberturaId ? { ...a, distanciaP1: Number(novaDist.toFixed(2)) } : a
        ),
      });
    },
    [dados, onChangeDados, registrarHistorico]
  );

  // Centralizar abertura na parede
  const handleCentralizarAbertura = useCallback(
    (aberturaId: string) => {
      const ab = dados.aberturas.find((a) => a.id === aberturaId);
      if (!ab) return;
      const parede = dados.paredes.find((p) => p.id === ab.paredeId);
      if (!parede) return;

      const comp = calcularComprimentoParede(parede.p1, parede.p2);
      registrarHistorico();
      onChangeDados({
        ...dados,
        aberturas: dados.aberturas.map((a) =>
          a.id === aberturaId ? { ...a, distanciaP1: Number((comp / 2).toFixed(2)) } : a
        ),
      });
      toast.info(`${ab.tipo === "porta" ? "Porta" : "Janela"} centralizada no meio da parede!`);
    },
    [dados, onChangeDados, registrarHistorico]
  );

  // Inverter sentido da folha / arco de abertura da porta
  const handleInverterPorta = useCallback(
    (aberturaId: string) => {
      registrarHistorico();
      onChangeDados({
        ...dados,
        aberturas: dados.aberturas.map((a) =>
          a.id === aberturaId ? { ...a, invertida: !a.invertida } : a
        ),
      });
      toast.info("Sentido de abertura invertido!");
    },
    [dados, onChangeDados, registrarHistorico]
  );

  // Apagar parede selecionada
  const handleApagarParede = useCallback(
    (paredeId: string) => {
      registrarHistorico();
      onChangeDados({
        ...dados,
        paredes: dados.paredes.filter((p) => p.id !== paredeId),
        aberturas: dados.aberturas.filter((a) => a.paredeId !== paredeId),
      });
      if (elementoSelecionadoId === paredeId) {
        setElementoSelecionadoId(null);
      }
      toast.success("Parede e suas esquadrias removidas!");
    },
    [dados, elementoSelecionadoId, onChangeDados, registrarHistorico]
  );

  // -------------------------------------------------------------
  // ATALHOS DE TECLADO CAD (Delete, Backspace, Esc, Ctrl+Z, Ctrl+Y, F8)
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se o usuário estiver digitando em um input
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      // 1. Tecla DELETE ou BACKSPACE -> Apaga o elemento selecionado
      if (e.key === "Delete" || e.key === "Backspace") {
        if (elementoSelecionadoId) {
          e.preventDefault();
          const ab = dados.aberturas.find((a) => a.id === elementoSelecionadoId);
          if (ab) {
            handleApagarAbertura(ab.id);
            return;
          }
          const par = dados.paredes.find((p) => p.id === elementoSelecionadoId);
          if (par) {
            handleApagarParede(par.id);
            return;
          }
        }
      }

      // 2. Tecla ESC -> Cancela parede contínua ou desseleciona
      if (e.key === "Escape") {
        if (pontoInicial) {
          setPontoInicial(null);
          cadeiaParedes.current = [];
          toast.info("Desenho de parede finalizado.");
        } else if (pontoMedirInicio) {
          setPontoMedirInicio(null);
        } else if (elementoSelecionadoId) {
          setElementoSelecionadoId(null);
        }
      }

      // 3. Ctrl+Z / Cmd+Z -> Desfazer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleDesfazer();
      }

      // 4. Ctrl+Y ou Ctrl+Shift+Z -> Refazer
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRefazer();
      }

      // 5. Tecla F8 ou 'O' -> Alternar Modo Ortho
      if (e.key === "F8" || e.key.toLowerCase() === "o") {
        e.preventDefault();
        setModoOrtho((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    elementoSelecionadoId,
    dados,
    pontoInicial,
    pontoMedirInicio,
    handleApagarAbertura,
    handleApagarParede,
    handleDesfazer,
    handleRefazer,
  ]);

  // -------------------------------------------------------------
  // RENDERIZAÇÃO NO CANVAS 2D
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 600;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Limpar fundo
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Grid Arquitetônico
    const gridSize = zoom; // 1 metro principal
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
        const isHover = elementoHover?.id === amb.id && ferramenta === "texto";
        ctx.fillStyle = isHover ? "rgba(224, 231, 255, 0.7)" : "rgba(241, 245, 249, 0.6)";
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
        const centroX = amb.pontos.reduce((acc, p) => acc + p.x, 0) / amb.pontos.length;
        const centroY = amb.pontos.reduce((acc, p) => acc + p.y, 0) / amb.pontos.length;
        const screenLabel = worldToScreen(centroX, centroY);

        ctx.fillStyle = "#334155";
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
      const isHoverApagar = ferramenta === "apagar" && elementoHover?.id === parede.id;
      const p1 = worldToScreen(parede.p1.x, parede.p1.y);
      const p2 = worldToScreen(parede.p2.x, parede.p2.y);
      const espessuraPx = Math.max(parede.espessura * zoom, 4);

      // Traço da parede
      ctx.beginPath();
      ctx.lineWidth = espessuraPx;
      ctx.lineCap = "square";
      if (isHoverApagar) {
        ctx.strokeStyle = "#ef4444"; // Vermelho no modo apagar
      } else if (isSelected) {
        ctx.strokeStyle = "#f59e0b"; // Amarelo/âmbar de seleção
      } else {
        ctx.strokeStyle = "#334155"; // Ardósia escuro padrão CAD
      }
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

      // Se a parede estiver selecionada, desenhar os nós (handles) dos vértices
      if (isSelected) {
        [p1, p2].forEach((ptNode) => {
          ctx.beginPath();
          ctx.arc(ptNode.x, ptNode.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#f59e0b";
          ctx.stroke();
        });
      }
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
      const isHover = elementoHover?.id === ab.id;
      const isHoverApagar = ferramenta === "apagar" && isHover;
      const tamPx = ab.largura * zoom;

      ctx.save();
      ctx.translate(pScreen.x, pScreen.y);
      const angulo = Math.atan2(parede.p2.y - parede.p1.y, parede.p2.x - parede.p1.x);
      ctx.rotate(angulo);

      // Caixa de destaque quando selecionada ou em hover
      if (isSelected || isHover) {
        ctx.fillStyle = isHoverApagar
          ? "rgba(239, 68, 68, 0.3)"
          : isSelected
          ? "rgba(245, 158, 11, 0.25)"
          : "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(-tamPx / 2 - 4, -14, tamPx + 8, 28);
      }

      if (ab.tipo === "porta") {
        // Vão da porta em branco com moldura
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-tamPx / 2, -5, tamPx, 10);
        ctx.strokeStyle = isHoverApagar ? "#dc2626" : isSelected ? "#f59e0b" : "#854d0e";
        ctx.lineWidth = 2;
        ctx.strokeRect(-tamPx / 2, -5, tamPx, 10);

        // Folha da porta e arco de 90°
        const flip = ab.invertida ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(-tamPx / 2, 0);
        ctx.lineTo(-tamPx / 2, flip * tamPx);
        ctx.strokeStyle = isHoverApagar ? "#dc2626" : "#b45309";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-tamPx / 2, 0, tamPx, 0, (flip * Math.PI) / 2, ab.invertida);
        ctx.strokeStyle = "rgba(180, 83, 9, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ab.tipo === "janela") {
        // Janela com três linhas paralelas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-tamPx / 2, -5, tamPx, 10);
        ctx.strokeStyle = isHoverApagar ? "#dc2626" : isSelected ? "#f59e0b" : "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-tamPx / 2, -5, tamPx, 10);

        ctx.beginPath();
        ctx.moveTo(-tamPx / 2, 0);
        ctx.lineTo(tamPx / 2, 0);
        ctx.stroke();
      }

      // Rótulo de largura e cota
      ctx.fillStyle = isHoverApagar ? "#dc2626" : isSelected ? "#b45309" : "#64748b";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${ab.largura.toFixed(2)}m`, 0, -10);

      ctx.restore();
    });

    // 6. Desenhar Prévia de Parede Sendo Criada
    if (ferramenta === "parede" && pontoInicial && pontoCursor) {
      const p1 = worldToScreen(pontoInicial.x, pontoInicial.y);
      const p2 = worldToScreen(pontoCursor.x, pontoCursor.y);
      const espessuraPx = espessuraAtiva * zoom;

      ctx.beginPath();
      ctx.lineWidth = espessuraPx;
      ctx.lineCap = "square";
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const comp = calcularComprimentoParede(pontoInicial, pontoCursor);
      ctx.fillStyle = "#1d4ed8";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${comp.toFixed(2)} m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12);
    }

    // 7. Ferramenta Régua (Medir)
    if (ferramenta === "medir" && pontoMedirInicio && pontoCursor) {
      const p1 = worldToScreen(pontoMedirInicio.x, pontoMedirInicio.y);
      const p2 = worldToScreen(pontoCursor.x, pontoCursor.y);

      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 1.5;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const dist = calcularComprimentoParede(pontoMedirInicio, pontoCursor);
      ctx.fillStyle = "#7c3aed";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`📏 ${dist.toFixed(2)} m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 8);
    }

    // 8. Snap Visual (OSNAP Marker estilo AutoCAD)
    if (pontoSnapAtivo) {
      const pSnapScreen = worldToScreen(pontoSnapAtivo.x, pontoSnapAtivo.y);
      ctx.save();
      if (pontoSnapAtivo.tipo === "endpoint") {
        ctx.strokeStyle = "#10b981"; // Verde esmeralda
        ctx.lineWidth = 2;
        ctx.strokeRect(pSnapScreen.x - 6, pSnapScreen.y - 6, 12, 12);
        ctx.fillStyle = "#059669";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Extremidade", pSnapScreen.x + 10, pSnapScreen.y - 8);
      } else if (pontoSnapAtivo.tipo === "midpoint") {
        ctx.strokeStyle = "#06b6d4"; // Ciano
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pSnapScreen.x, pSnapScreen.y - 7);
        ctx.lineTo(pSnapScreen.x + 6, pSnapScreen.y + 5);
        ctx.lineTo(pSnapScreen.x - 6, pSnapScreen.y + 5);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = "#0891b2";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Ponto Médio", pSnapScreen.x + 10, pSnapScreen.y - 8);
      }
      ctx.restore();
    }
  }, [
    dados,
    offset,
    zoom,
    ferramenta,
    pontoInicial,
    pontoCursor,
    elementoSelecionadoId,
    elementoHover,
    pontoSnapAtivo,
    pontoMedirInicio,
    espessuraAtiva,
    worldToScreen,
  ]);

  // -------------------------------------------------------------
  // EVENTOS DE MOUSE NO CANVAS
  // -------------------------------------------------------------

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.shiftKey) {
      // Arrastar tela com botão do meio ou Shift
      isDraggingCanvas.current = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      return;
    }

    if (somenteLeitura) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    // Se estiver no modo selecionar, verificar se clicou em uma abertura para arrastar
    if (ferramenta === "selecionar") {
      const abAlvo = encontrarAberturaMaisProxima(worldPos);
      if (abAlvo) {
        setElementoSelecionadoId(abAlvo.id);
        arrastoAberturaId.current = abAlvo.id;
        return;
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
      return;
    }

    let worldPos = screenToWorld(screenX, screenY);

    // 1. Detectar snap automático nos vértices existentes
    const snap = detectarSnap(worldPos);
    setPontoSnapAtivo(snap);
    if (snap) {
      worldPos = { x: snap.x, y: snap.y };
    }

    // 2. Se estiver arrastando uma abertura (porta/janela) pela parede
    if (arrastoAberturaId.current) {
      const ab = dados.aberturas.find((a) => a.id === arrastoAberturaId.current);
      if (ab) {
        const parede = dados.paredes.find((p) => p.id === ab.paredeId);
        if (parede) {
          const dx = parede.p2.x - parede.p1.x;
          const dy = parede.p2.y - parede.p1.y;
          const comp = Math.sqrt(dx * dx + dy * dy);
          if (comp > 0) {
            const t = Math.max(0, Math.min(1, ((worldPos.x - parede.p1.x) * dx + (worldPos.y - parede.p1.y) * dy) / (comp * comp)));
            const margem = ab.largura / 2 + 0.05;
            const novaDist = Math.max(margem, Math.min(comp - margem, t * comp));

            onChangeDados({
              ...dados,
              aberturas: dados.aberturas.map((a) =>
                a.id === ab.id ? { ...a, distanciaP1: Number(novaDist.toFixed(2)) } : a
              ),
            });
          }
        }
      }
      return;
    }

    // 3. Atualizar elemento em Hover
    const abHover = encontrarAberturaMaisProxima(worldPos);
    if (abHover) {
      setElementoHover({ id: abHover.id, tipo: "abertura" });
    } else {
      const parHover = encontrarParedeMaisProxima(worldPos);
      if (parHover && parHover.distanciaPontoReta < 0.35) {
        setElementoHover({ id: parHover.parede.id, tipo: "parede" });
      } else {
        setElementoHover(null);
      }
    }

    // 4. Se estiver desenhando parede, aplicar modo Ortho
    if (ferramenta === "parede" && pontoInicial) {
      worldPos = aplicarOrtho(worldPos, pontoInicial, e.altKey);
    }

    setPontoCursor(worldPos);
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
    arrastoAberturaId.current = null;
    arrastoVertice.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (somenteLeitura) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    let worldPos = screenToWorld(screenX, screenY);

    // Aplicar Snap se ativo
    if (pontoSnapAtivo) {
      worldPos = { x: pontoSnapAtivo.x, y: pontoSnapAtivo.y };
    }

    // 1. FERRAMENTA PAREDE (Desenho Contínuo / Polyline)
    if (ferramenta === "parede") {
      if (!pontoInicial) {
        // Primeiro clique: inicia cadeia
        setPontoInicial(worldPos);
        cadeiaParedes.current = [worldPos];
      } else {
        // Segundo clique: fecha segmento
        worldPos = aplicarOrtho(worldPos, pontoInicial, e.altKey);
        const comp = calcularComprimentoParede(pontoInicial, worldPos);

        if (comp > 0.2) {
          registrarHistorico();
          const novaParede: Parede = {
            id: `parede_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            p1: pontoInicial,
            p2: worldPos,
            espessura: espessuraAtiva,
            altura: peDireitoAtivo,
            tipo: "alvenaria_vedacao",
          };

          // Verificar se fechou ciclo no ponto inicial da cadeia
          const primeiroPonto = cadeiaParedes.current[0];
          const distAoInicio = Math.hypot(worldPos.x - primeiroPonto.x, worldPos.y - primeiroPonto.y);

          if (cadeiaParedes.current.length >= 3 && distAoInicio <= 0.3) {
            // Ciclo fechado: gera ambiente automático
            novaParede.p2 = primeiroPonto;
            const ptsAmbiente = [...cadeiaParedes.current];
            const novoAmbiente: Ambiente = {
              id: `amb_${Date.now()}`,
              nome: `Cômodo ${dados.ambientes.length + 1}`,
              pontos: ptsAmbiente,
              area: Number(calcularAreaPoligono(ptsAmbiente).toFixed(2)),
              perimetro: Number(comp.toFixed(2)),
              pisoAcabamento: "Porcelanato Retificado 84x84",
              tetoAcabamento: "Forro de Gesso",
              paredeAcabamento: "Pintura Acrílica Fosca Lavável",
            };

            onChangeDados({
              ...dados,
              paredes: [...dados.paredes, novaParede],
              ambientes: [...dados.ambientes, novoAmbiente],
            });

            setPontoInicial(null);
            cadeiaParedes.current = [];
            toast.success("Cômodo fechado e laje gerada com sucesso!");
            return;
          }

          onChangeDados({
            ...dados,
            paredes: [...dados.paredes, novaParede],
          });

          // Continua desenhando a partir do ponto final (estilo AutoCAD)
          setPontoInicial(worldPos);
          cadeiaParedes.current.push(worldPos);
        }
      }
      return;
    }

    // 2. FERRAMENTAS PORTA E JANELA
    if (ferramenta === "porta" || ferramenta === "janela") {
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.6) {
        registrarHistorico();
        const larg = ferramenta === "porta" ? larguraPortaAtiva : larguraJanelaAtiva;
        const alt = ferramenta === "porta" ? 2.1 : 1.2;
        const peit = ferramenta === "porta" ? 0.0 : larg <= 0.8 ? 1.6 : 1.0;

        const comp = calcularComprimentoParede(paredeAlvo.parede.p1, paredeAlvo.parede.p2);
        const margem = larg / 2 + 0.05;
        const distClamped = Math.max(margem, Math.min(comp - margem, paredeAlvo.distanciaAoInicio));

        const novaAbertura: Abertura = {
          id: `ab_${Date.now()}`,
          paredeId: paredeAlvo.parede.id,
          tipo: ferramenta,
          nome: ferramenta === "porta" ? `P - Porta (${larg.toFixed(2)}m)` : `J - Janela (${larg.toFixed(2)}m)`,
          largura: larg,
          altura: alt,
          peitoril: peit,
          distanciaP1: Number(distClamped.toFixed(2)),
          invertida: false,
        };

        onChangeDados({
          ...dados,
          aberturas: [...dados.aberturas, novaAbertura],
        });

        setFerramenta("selecionar");
        setElementoSelecionadoId(novaAbertura.id);
        toast.success(
          `${ferramenta === "porta" ? "Porta" : "Janela"} inserida! Você pode arrastá-la ou usar os botões para reposicionar.`
        );
      } else {
        toast.error("Clique em cima de uma parede para inserir o vão.");
      }
      return;
    }

    // 3. FERRAMENTA SELECIONAR
    if (ferramenta === "selecionar") {
      // Prioridade 1: Selecionar Abertura (porta/janela)
      const abAlvo = encontrarAberturaMaisProxima(worldPos);
      if (abAlvo) {
        setElementoSelecionadoId(abAlvo.id);
        return;
      }

      // Prioridade 2: Selecionar Parede
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.35) {
        setElementoSelecionadoId(paredeAlvo.parede.id);
        return;
      }

      // Desselecionar
      setElementoSelecionadoId(null);
      return;
    }

    // 4. FERRAMENTA APAGAR (Prioridade estrita para não apagar a parede por engano)
    if (ferramenta === "apagar") {
      const abAlvo = encontrarAberturaMaisProxima(worldPos);
      if (abAlvo) {
        handleApagarAbertura(abAlvo.id);
        return;
      }

      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.35) {
        handleApagarParede(paredeAlvo.parede.id);
        return;
      }
      return;
    }

    // 5. FERRAMENTA MEDIR (Régua)
    if (ferramenta === "medir") {
      if (!pontoMedirInicio) {
        setPontoMedirInicio(worldPos);
        toast.info("Clique no segundo ponto para medir a distância");
      } else {
        const dist = calcularComprimentoParede(pontoMedirInicio, worldPos);
        setMedicaoFixa({ p1: pontoMedirInicio, p2: worldPos, distancia: dist });
        setPontoMedirInicio(null);
        toast.success(`Distância medida: ${dist.toFixed(2)} metros`);
      }
      return;
    }

    // 6. FERRAMENTA TEXTO / AMBIENTE
    if (ferramenta === "texto") {
      const ambAlvo = dados.ambientes.find((amb) => pontoDentroPoligono(worldPos, amb.pontos));
      if (ambAlvo) {
        setAmbienteEmEdicao(ambAlvo);
        setModalEditarAmbienteAberto(true);
      } else {
        toast.info("Clique dentro de um cômodo para editar seu nome e piso.");
      }
      return;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 15), 180));
  };

  // Coordenadas da tela da abertura selecionada para HUD flutuante
  let aberturaScreenPos: Ponto2D | null = null;
  if (aberturaSelecionada) {
    const parede = dados.paredes.find((p) => p.id === aberturaSelecionada.paredeId);
    if (parede) {
      const comp = calcularComprimentoParede(parede.p1, parede.p2);
      const t = Math.min(Math.max(aberturaSelecionada.distanciaP1 / comp, 0), 1);
      const posX = parede.p1.x + (parede.p2.x - parede.p1.x) * t;
      const posY = parede.p1.y + (parede.p2.y - parede.p1.y) * t;
      aberturaScreenPos = worldToScreen(posX, posY);
    }
  }

  // Criação instantânea de cômodo paramétrico
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
      startX = maxX + 1.0;
    }

    const espessura = espessuraAtiva;
    const altura = peDireitoAtivo;
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

    const novoAmbiente: Ambiente = {
      id: `amb_${timestamp}`,
      nome: comodoNome || "Cômodo",
      pontos: [pTL, pTR, pBR, pBL],
      area: Number((larg * comp).toFixed(2)),
      perimetro: Number(((larg + comp) * 2).toFixed(2)),
      pisoAcabamento: "Porcelanato Retificado 84x84",
      tetoAcabamento: "Forro de Gesso",
      paredeAcabamento: "Pintura Acrílica Fosca Lavável",
    };

    registrarHistorico();
    onChangeDados({
      ...dados,
      paredes: [...dados.paredes, ...novasParedes],
      ambientes: [...dados.ambientes, novoAmbiente],
    });

    toast.success(`Cômodo "${comodoNome}" (${larg}x${comp}m = ${(larg * comp).toFixed(1)}m²) gerado!`);
    setModalComodoAberto(false);
  };

  // Exportar DXF
  const handleExportarDxf = () => {
    if (dados.paredes.length === 0) {
      toast.error("Desenhe pelo menos uma parede antes de exportar.");
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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] bg-white rounded-lg border border-slate-200 overflow-hidden flex select-none"
    >
      {/* ----------------------------------------------------------- */}
      {/* BARRA LATERAL DE FERRAMENTAS CAD (ESTILO AUTOCAD / CADCRAFT) */}
      {/* ----------------------------------------------------------- */}
      {!somenteLeitura && (
        <div className="w-52 bg-slate-50 border-r border-slate-200 p-2.5 flex flex-col gap-1.5 z-10 shrink-0 overflow-y-auto">
          {/* Ações de Desfazer e Refazer */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              CADCraft 2D
            </span>
            <div className="flex gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={!podeDesfazer}
                onClick={handleDesfazer}
                title="Desfazer (Ctrl+Z)"
                className="h-6 w-6 text-slate-600 disabled:opacity-30"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={!podeRefazer}
                onClick={handleRefazer}
                title="Refazer (Ctrl+Y)"
                className="h-6 w-6 text-slate-600 disabled:opacity-30"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Ferramenta Selecionar */}
          <Button
            size="sm"
            variant={ferramenta === "selecionar" ? "default" : "ghost"}
            className="justify-start gap-2 h-8 text-xs"
            onClick={() => {
              setFerramenta("selecionar");
              setPontoInicial(null);
            }}
          >
            <MousePointer className="w-3.5 h-3.5" /> Selecionar / Mover
          </Button>

          {/* Gerador de Cômodo Rápido */}
          <Button
            size="sm"
            variant="outline"
            className="justify-start gap-2 h-8 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
            onClick={() => setModalComodoAberto(true)}
            title="Criar um cômodo retangular com 4 paredes e piso em 1 clique"
          >
            <BoxSelect className="w-3.5 h-3.5 text-emerald-600" /> + Novo Cômodo
          </Button>

          {/* Ferramenta Parede com desenho contínuo */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "parede" ? "default" : "ghost"}
              className="justify-start gap-2 h-8 w-full text-xs text-slate-800"
              onClick={() => {
                setFerramenta("parede");
                setPontoInicial(null);
              }}
            >
              <Square className="w-3.5 h-3.5 text-blue-600" /> Parede ({(espessuraAtiva * 100).toFixed(0)}cm)
            </Button>
            {ferramenta === "parede" && (
              <div className="bg-blue-50/80 p-1.5 rounded border border-blue-200 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-blue-800 block">Espessura Ativa:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.1, 0.15, 0.2].map((esp) => (
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

          {/* Ferramenta Porta */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "porta" ? "default" : "ghost"}
              className="justify-start gap-2 h-8 w-full text-xs text-slate-800"
              onClick={() => {
                setFerramenta("porta");
                setPontoInicial(null);
              }}
            >
              <DoorOpen className="w-3.5 h-3.5 text-amber-700" /> Porta ({larguraPortaAtiva.toFixed(2)}m)
            </Button>
            {ferramenta === "porta" && (
              <div className="bg-amber-50/80 p-1.5 rounded border border-amber-200 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-amber-800 block">Largura da Porta:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.6, 0.7, 0.8, 0.9, 1.0].map((larg) => (
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

          {/* Ferramenta Janela */}
          <div className="space-y-1">
            <Button
              size="sm"
              variant={ferramenta === "janela" ? "default" : "ghost"}
              className="justify-start gap-2 h-8 w-full text-xs text-slate-800"
              onClick={() => {
                setFerramenta("janela");
                setPontoInicial(null);
              }}
            >
              <AppWindow className="w-3.5 h-3.5 text-sky-600" /> Janela ({larguraJanelaAtiva.toFixed(2)}m)
            </Button>
            {ferramenta === "janela" && (
              <div className="bg-sky-50/80 p-1.5 rounded border border-sky-200 space-y-1 animate-in fade-in duration-150">
                <span className="text-[10px] font-semibold text-sky-800 block">Largura da Janela:</span>
                <div className="grid grid-cols-2 gap-1">
                  {[0.6, 1.0, 1.2, 1.5, 2.0].map((larg) => (
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

          {/* Ferramenta Medir (Régua CAD) */}
          <Button
            size="sm"
            variant={ferramenta === "medir" ? "default" : "ghost"}
            className="justify-start gap-2 h-8 text-xs text-purple-700 hover:text-purple-800"
            onClick={() => {
              setFerramenta("medir");
              setPontoMedirInicio(null);
            }}
          >
            <Ruler className="w-3.5 h-3.5 text-purple-600" /> Medir Distância
          </Button>

          {/* Ferramenta Texto / Nomear Ambiente */}
          <Button
            size="sm"
            variant={ferramenta === "texto" ? "default" : "ghost"}
            className="justify-start gap-2 h-8 text-xs text-indigo-700 hover:text-indigo-800"
            onClick={() => {
              setFerramenta("texto");
              toast.info("Clique dentro de qualquer ambiente para renomear ou trocar acabamento.");
            }}
          >
            <Type className="w-3.5 h-3.5 text-indigo-600" /> Nomear Cômodos
          </Button>

          {/* Ferramenta Apagar */}
          <Button
            size="sm"
            variant={ferramenta === "apagar" ? "destructive" : "ghost"}
            className="justify-start gap-2 h-8 text-xs text-red-600 hover:text-red-700"
            onClick={() => {
              setFerramenta("apagar");
              setPontoInicial(null);
              toast.info("Clique na porta, janela ou parede que deseja apagar.");
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Borracha / Apagar
          </Button>

          <div className="h-px bg-slate-200 my-0.5" />

          {/* Modo Ortho 90° (F8) */}
          <Button
            size="sm"
            variant={modoOrtho ? "secondary" : "outline"}
            className={`justify-start gap-2 h-7 text-xs font-mono ${
              modoOrtho ? "bg-blue-100 text-blue-800 border-blue-300 font-semibold" : "text-slate-500"
            }`}
            onClick={() => setModoOrtho((prev) => !prev)}
            title="Trava em ângulos retos de 90° (Tecla F8 ou 'O')"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Ortho 90°: {modoOrtho ? "ON" : "OFF"}
          </Button>

          {/* Importar / Exportar DXF */}
          <div className="grid grid-cols-2 gap-1 pt-0.5">
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
                      const novasParedes = extrairParedesDoDxf(text, espessuraAtiva, peDireitoAtivo);
                      if (novasParedes.length > 0) {
                        registrarHistorico();
                        onChangeDados({
                          ...dados,
                          paredes: [...dados.paredes, ...novasParedes],
                        });
                        toast.success(`${novasParedes.length} paredes importadas do DXF!`);
                      } else {
                        toast.error("Nenhuma linha/polilinha compatível encontrada.");
                      }
                    } catch (err: any) {
                      toast.error(`Erro: ${err.message}`);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-center gap-1 h-7 text-[10px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors shadow-2xs">
                <FolderUp className="w-3 h-3 text-emerald-600" />
                <span>Importar</span>
              </div>
            </label>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] text-slate-700 bg-white hover:bg-slate-100 px-1 gap-1"
              onClick={handleExportarDxf}
              title="Exportar DXF para abrir no AutoCAD"
            >
              <Download className="w-3 h-3 text-blue-600" />
              <span>Exportar</span>
            </Button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* PAINEL DE PROPRIEDADES DA ABERTURA SELECIONADA */}
          {/* ------------------------------------------------------------- */}
          {aberturaSelecionada && (
            <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-md shadow-xs text-xs space-y-2 animate-in fade-in duration-150">
              <div className="font-semibold text-slate-900 flex items-center justify-between border-b border-amber-200 pb-1.5">
                <span className="flex items-center gap-1 capitalize">
                  {aberturaSelecionada.tipo === "porta" ? (
                    <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <AppWindow className="w-3.5 h-3.5 text-sky-600" />
                  )}
                  {aberturaSelecionada.tipo} ({aberturaSelecionada.largura.toFixed(2)}m)
                </span>
                <Button
                  size="icon-xs"
                  variant="destructive"
                  className="h-5 w-5"
                  onClick={() => handleApagarAbertura(aberturaSelecionada.id)}
                  title="Apagar esta porta/janela (Delete)"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Ajuste de Posição / Deslocamento */}
              <div>
                <span className="text-slate-600 block text-[10px] font-medium mb-1">
                  Mover ao Longo da Parede:
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="outline"
                    className="h-6 w-7 bg-white"
                    onClick={() => handleDeslocarAbertura(aberturaSelecionada.id, -0.1)}
                    title="Deslocar 10cm para a esquerda"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="outline"
                    className="h-6 flex-1 text-[10px] bg-white gap-1 font-normal"
                    onClick={() => handleCentralizarAbertura(aberturaSelecionada.id)}
                    title="Centralizar no meio da parede"
                  >
                    <AlignCenter className="w-3 h-3 text-amber-600" /> Centralizar
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="outline"
                    className="h-6 w-7 bg-white"
                    onClick={() => handleDeslocarAbertura(aberturaSelecionada.id, 0.1)}
                    title="Deslocar 10cm para a direita"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Inverter Sentido de Abertura (apenas para portas) */}
              {aberturaSelecionada.tipo === "porta" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] bg-white text-slate-700 gap-1.5"
                  onClick={() => handleInverterPorta(aberturaSelecionada.id)}
                >
                  <FlipHorizontal className="w-3 h-3 text-amber-600" /> Inverter Lado da Folha
                </Button>
              )}

              {/* Botão de Exclusão Direta e Explícita */}
              <Button
                size="sm"
                variant="destructive"
                className="w-full h-7 text-xs font-semibold gap-1.5"
                onClick={() => handleApagarAbertura(aberturaSelecionada.id)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Apagar Apenas Este Vão
              </Button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PAINEL DE PROPRIEDADES DA PAREDE SELECIONADA */}
          {/* ------------------------------------------------------------- */}
          {paredeSelecionada && !aberturaSelecionada && (
            <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-md shadow-xs text-xs space-y-2 animate-in fade-in duration-150">
              <div className="font-semibold text-slate-900 flex items-center justify-between border-b border-blue-200 pb-1.5">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Parede Selecionada
                </span>
                <Button
                  size="icon-xs"
                  variant="destructive"
                  className="h-5 w-5"
                  onClick={() => handleApagarParede(paredeSelecionada.id)}
                  title="Apagar parede selecionada (Delete)"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Comprimento:</span>
                <span className="font-bold text-slate-800 text-sm font-mono">
                  {calcularComprimentoParede(paredeSelecionada.p1, paredeSelecionada.p2).toFixed(2)} m
                </span>
              </div>

              {/* Alterar Espessura */}
              <div>
                <span className="text-slate-500 block text-[10px] mb-1">Alterar Espessura:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[0.1, 0.15, 0.2].map((esp) => (
                    <Button
                      key={esp}
                      size="icon-xs"
                      variant={paredeSelecionada.espessura === esp ? "default" : "outline"}
                      className="text-[10px] h-6 w-full font-mono bg-white"
                      onClick={() => {
                        registrarHistorico();
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

              <Button
                size="sm"
                variant="destructive"
                className="w-full h-7 text-xs font-semibold gap-1.5"
                onClick={() => handleApagarParede(paredeSelecionada.id)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Parede
              </Button>
            </div>
          )}

          <div className="mt-auto text-[10px] text-slate-400 bg-slate-100 p-2 rounded">
            Atalhos: <kbd className="bg-white px-1 border rounded">Del</kbd> apagar •{" "}
            <kbd className="bg-white px-1 border rounded">Esc</kbd> cancelar •{" "}
            <kbd className="bg-white px-1 border rounded">F8</kbd> ortho •{" "}
            <kbd className="bg-white px-1 border rounded">Ctrl+Z</kbd> desfazer.
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* ÁREA DO CANVAS 2D DE ALTA PRECISÃO */}
      {/* ----------------------------------------------------------- */}
      <div className="relative flex-1 h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${
            ferramenta === "apagar"
              ? "cursor-not-allowed"
              : ferramenta === "medir"
              ? "cursor-help"
              : "cursor-crosshair"
          }`}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* ----------------------------------------------------------- */}
        {/* WIDGET FLUTUANTE (HUD) DIRETO SOBRE A ABERTURA SELECIONADA */}
        {/* ----------------------------------------------------------- */}
        {aberturaSelecionada && aberturaScreenPos && (
          <div
            className="absolute z-30 pointer-events-auto flex items-center gap-1 bg-slate-900/95 backdrop-blur-md text-white px-2 py-1.5 rounded-lg shadow-xl border border-slate-700 -translate-x-1/2 -translate-y-[120%] animate-in zoom-in-95 duration-100"
            style={{ left: `${aberturaScreenPos.x}px`, top: `${aberturaScreenPos.y}px` }}
          >
            <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700 text-xs font-semibold text-amber-400">
              {aberturaSelecionada.tipo === "porta" ? (
                <DoorOpen className="w-3.5 h-3.5" />
              ) : (
                <AppWindow className="w-3.5 h-3.5" />
              )}
              <span>{aberturaSelecionada.largura.toFixed(2)}m</span>
            </div>

            {/* Mover para esquerda */}
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 w-6 text-slate-200 hover:text-white hover:bg-slate-800"
              onClick={() => handleDeslocarAbertura(aberturaSelecionada.id, -0.1)}
              title="Deslocar 10cm para a esquerda"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            {/* Centralizar */}
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 px-1.5 text-[11px] text-slate-200 hover:text-white hover:bg-slate-800 gap-1 font-normal"
              onClick={() => handleCentralizarAbertura(aberturaSelecionada.id)}
              title="Centralizar no vão"
            >
              <AlignCenter className="w-3 h-3 text-amber-400" />
            </Button>

            {/* Mover para direita */}
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 w-6 text-slate-200 hover:text-white hover:bg-slate-800"
              onClick={() => handleDeslocarAbertura(aberturaSelecionada.id, 0.1)}
              title="Deslocar 10cm para a direita"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>

            {/* Inverter folha da porta */}
            {aberturaSelecionada.tipo === "porta" && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-6 w-6 text-slate-200 hover:text-white hover:bg-slate-800"
                onClick={() => handleInverterPorta(aberturaSelecionada.id)}
                title="Inverter lado de abertura da porta"
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-amber-400" />
              </Button>
            )}

            {/* BOTÃO EXCLUSIVO DE APAGAR O VÃO (DESTAQUE VERMELHO) */}
            <Button
              size="icon-xs"
              variant="destructive"
              className="h-6 px-2 text-xs font-bold gap-1 bg-red-600 hover:bg-red-700 text-white ml-1 shadow-sm"
              onClick={() => handleApagarAbertura(aberturaSelecionada.id)}
              title="Apagar exclusivamente esta porta/janela"
            >
              <Trash2 className="w-3.5 h-3.5" /> Apagar Vão
            </Button>
          </div>
        )}

        {/* Instruções de Desenho Contínuo de Parede */}
        {ferramenta === "parede" && pontoInicial && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <span>Clique para continuar a parede (ESC para encerrar cadeia)</span>
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-white hover:bg-blue-700 bg-blue-800"
              onClick={() => {
                setPontoInicial(null);
                cadeiaParedes.current = [];
              }}
            >
              Concluir
            </Button>
          </div>
        )}

        {/* Orientação quando a planta está em branco */}
        {dados.paredes.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md px-4 py-2 rounded-lg text-xs text-slate-600 flex items-center gap-2 pointer-events-none">
            <Square className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>Planta em branco:</strong> Clique em <strong>+ Novo Cômodo</strong> para gerar uma sala rápida ou selecione <strong>Parede</strong> para desenhar.
            </span>
          </div>
        )}

        {/* Controles de Zoom Flutuantes */}
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

        {/* Status de Coordenadas e Ortho */}
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

      {/* ----------------------------------------------------------- */}
      {/* MODAL PARA CRIAÇÃO RÁPIDA DE CÔMODOS */}
      {/* ----------------------------------------------------------- */}
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
                placeholder="Ex: Quarto, Suíte, Sala de Estar"
                className="h-9 text-sm"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {["Quarto", "Suíte", "Sala de Estar", "Cozinha", "Banheiro", "Varanda", "Garagem"].map(
                  (sugestao) => (
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
                  )
                )}
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

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Área Estimada do Piso:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {((parseFloat(comodoLargura) || 0) * (parseFloat(comodoComprimento) || 0)).toFixed(2)} m²
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

      {/* ----------------------------------------------------------- */}
      {/* MODAL DE EDIÇÃO DE AMBIENTE / CÔMODO */}
      {/* ----------------------------------------------------------- */}
      <Dialog open={modalEditarAmbienteAberto} onOpenChange={setModalEditarAmbienteAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Type className="w-5 h-5 text-indigo-600" /> Editar Ambiente
            </DialogTitle>
          </DialogHeader>

          {ambienteEmEdicao && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Nome do Ambiente
                </Label>
                <Input
                  value={ambienteEmEdicao.nome}
                  onChange={(e) =>
                    setAmbienteEmEdicao({ ...ambienteEmEdicao, nome: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Acabamento do Piso
                </Label>
                <Input
                  value={ambienteEmEdicao.pisoAcabamento || ""}
                  onChange={(e) =>
                    setAmbienteEmEdicao({ ...ambienteEmEdicao, pisoAcabamento: e.target.value })
                  }
                  placeholder="Ex: Porcelanato Retificado 84x84"
                  className="h-9 text-sm"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-500">Área Calculada:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {ambienteEmEdicao.area.toFixed(2)} m²
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalEditarAmbienteAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={() => {
                if (ambienteEmEdicao) {
                  registrarHistorico();
                  onChangeDados({
                    ...dados,
                    ambientes: dados.ambientes.map((amb) =>
                      amb.id === ambienteEmEdicao.id ? ambienteEmEdicao : amb
                    ),
                  });
                  toast.success("Ambiente atualizado!");
                }
                setModalEditarAmbienteAberto(false);
              }}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------
// FUNÇÕES UTILITÁRIAS GEOMÉTRICAS
// -------------------------------------------------------------

function calcularAreaPoligono(pontos: Ponto2D[]): number {
  let area = 0;
  for (let i = 0; i < pontos.length; i++) {
    const j = (i + 1) % pontos.length;
    area += pontos[i].x * pontos[j].y;
    area -= pontos[j].x * pontos[i].y;
  }
  return Math.abs(area / 2);
}

function pontoDentroPoligono(ponto: Ponto2D, poligono: Ponto2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].x,
      yi = poligono[i].y;
    const xj = poligono[j].x,
      yj = poligono[j].y;

    const intersect =
      yi > ponto.y !== yj > ponto.y && ponto.x < ((xj - xi) * (ponto.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
