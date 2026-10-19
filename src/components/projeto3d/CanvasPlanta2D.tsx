import { useState, useRef, useEffect } from "react";
import type { DadosProjetoBIM, Parede, Abertura, Ponto2D } from "@/types/projeto3d";
import { snapAoGrid, calcularComprimentoParede } from "@/lib/projeto3d.utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { extrairParedesDoDxf } from "@/lib/dxf-parser";
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

  // Eventos de clique no canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (somenteLeitura) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    if (ferramenta === "parede") {
      if (!pontoInicial) {
        // Primeiro clique: ponto inicial da parede
        setPontoInicial(worldPos);
      } else {
        // Segundo clique: finalizar a parede
        const comp = calcularComprimentoParede(pontoInicial, worldPos);
        if (comp > 0.2) {
          const novaParede: Parede = {
            id: `parede_${Date.now()}`,
            p1: pontoInicial,
            p2: worldPos,
            espessura: dados.config.espessuraParedePadrao,
            altura: dados.config.peDireito,
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
      // Inserir porta ou janela na parede mais próxima do clique
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo) {
        const novaAbertura: Abertura = {
          id: `ab_${Date.now()}`,
          paredeId: paredeAlvo.parede.id,
          tipo: ferramenta,
          nome: ferramenta === "porta" ? "P - Nova Porta" : "J - Nova Janela",
          largura: ferramenta === "porta" ? 0.8 : 1.2,
          altura: ferramenta === "porta" ? 2.1 : 1.2,
          peitoril: ferramenta === "porta" ? 0.0 : 1.0,
          distanciaP1: Math.max(paredeAlvo.distanciaAoInicio, 0.4),
        };
        onChangeDados({
          ...dados,
          aberturas: [...dados.aberturas, novaAbertura],
        });
        setFerramenta("selecionar");
      }
    } else if (ferramenta === "selecionar") {
      // Selecionar elemento sob o clique
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.3) {
        setElementoSelecionadoId(paredeAlvo.parede.id);
      } else {
        setElementoSelecionadoId(null);
      }
    } else if (ferramenta === "apagar") {
      const paredeAlvo = encontrarParedeMaisProxima(worldPos);
      if (paredeAlvo && paredeAlvo.distanciaPontoReta < 0.3) {
        onChangeDados({
          ...dados,
          paredes: dados.paredes.filter((p) => p.id !== paredeAlvo.parede.id),
          aberturas: dados.aberturas.filter((a) => a.paredeId !== paredeAlvo.parede.id),
        });
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
      const worldPos = screenToWorld(screenX, screenY);
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

  const elementoSelecionado = dados.paredes.find((p) => p.id === elementoSelecionadoId);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-white rounded-lg border border-slate-200 overflow-hidden flex">
      {/* Menu Lateral de Ferramentas CAD (Estilo Structa) */}
      {!somenteLeitura && (
        <div className="w-48 bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-1.5 z-10 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
            Ferramentas 2D
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

          <Button
            size="sm"
            variant={ferramenta === "parede" ? "default" : "ghost"}
            className="justify-start gap-2 h-9 text-slate-800"
            onClick={() => {
              setFerramenta("parede");
              setPontoInicial(null);
            }}
          >
            <Square className="w-4 h-4 text-blue-600" /> Parede (0.15m)
          </Button>

          <Button
            size="sm"
            variant={ferramenta === "porta" ? "default" : "ghost"}
            className="justify-start gap-2 h-9 text-slate-800"
            onClick={() => {
              setFerramenta("porta");
              setPontoInicial(null);
            }}
          >
            <DoorOpen className="w-4 h-4 text-amber-700" /> Porta (0.80m)
          </Button>

          <Button
            size="sm"
            variant={ferramenta === "janela" ? "default" : "ghost"}
            className="justify-start gap-2 h-9 text-slate-800"
            onClick={() => {
              setFerramenta("janela");
              setPontoInicial(null);
            }}
          >
            <AppWindow className="w-4 h-4 text-sky-600" /> Janela (1.20m)
          </Button>

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

          {/* Botão Importar DXF (AutoCAD) */}
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
            <div className="flex items-center gap-2 h-9 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-2xs">
              <FolderUp className="w-4 h-4 text-emerald-600" />
              <span>Importar DXF</span>
            </div>
          </label>

          {/* Painel do Elemento Selecionado */}
          {elementoSelecionado && (
            <div className="mt-4 p-2.5 bg-white border border-slate-200 rounded-md shadow-xs text-xs space-y-1.5">
              <div className="font-semibold text-slate-700 flex items-center justify-between">
                <span>Parede Selecionada</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 h-5 w-5"
                  onClick={() => {
                    onChangeDados({
                      ...dados,
                      paredes: dados.paredes.filter((p) => p.id !== elementoSelecionado.id),
                      aberturas: dados.aberturas.filter((a) => a.paredeId !== elementoSelecionado.id),
                    });
                    setElementoSelecionadoId(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-slate-500">
                Comprimento:{" "}
                <span className="font-medium text-slate-800">
                  {calcularComprimentoParede(elementoSelecionado.p1, elementoSelecionado.p2).toFixed(2)} m
                </span>
              </div>
              <div className="text-slate-500">
                Espessura:{" "}
                <span className="font-medium text-slate-800">{elementoSelecionado.espessura.toFixed(2)} m</span>
              </div>
              <div className="text-slate-500">
                Pé-Direito:{" "}
                <span className="font-medium text-slate-800">{elementoSelecionado.altura.toFixed(2)} m</span>
              </div>
            </div>
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

        {/* Status de Coordenadas */}
        {pontoCursor && (
          <div className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-500 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-200 pointer-events-none">
            X: {pontoCursor.x.toFixed(2)} m • Y: {pontoCursor.y.toFixed(2)} m
          </div>
        )}
      </div>
    </div>
  );
}
