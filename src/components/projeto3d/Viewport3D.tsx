import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { DadosProjetoBIM, Parede, Abertura } from "@/types/projeto3d";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scissors,
  Layers,
  Sun,
  Eye,
  EyeOff,
} from "lucide-react";

export interface Viewport3DHandle {
  capturarFoto: () => string | null;
  resetarCamera: () => void;
  alternarCorte: () => void;
}

interface Viewport3DProps {
  dados: DadosProjetoBIM;
  onCapturarFotoParaCapa?: (base64: string) => void;
  somenteLeitura?: boolean;
}

export const Viewport3D = forwardRef<Viewport3DHandle, Viewport3DProps>(
  function Viewport3D({ dados, onCapturarFotoParaCapa, somenteLeitura = false }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

    const [modoCorte, setModoCorte] = useState(false);
    const [camadas, setCamadas] = useState(dados.layers);
    const [snapshotFeedback, setSnapshotFeedback] = useState(false);

    // Grupos da cena Three.js
    const groupParedesRef = useRef<THREE.Group>(new THREE.Group());
    const groupPisoRef = useRef<THREE.Group>(new THREE.Group());
    const groupEsquadriasRef = useRef<THREE.Group>(new THREE.Group());
    const groupTelhadoRef = useRef<THREE.Group>(new THREE.Group());

    // Estado do controle de órbita manual
    const isDraggingRef = useRef(false);
    const isPanningRef = useRef(false);
    const prevMousePosRef = useRef({ x: 0, y: 0 });
    const sphericalRef = useRef({ radius: 20, theta: Math.PI / 4, phi: Math.PI / 3 });
    const targetRef = useRef(new THREE.Vector3(3, 1.4, 2));

    // Sincronizar camadas externas
    useEffect(() => {
      setCamadas(dados.layers);
    }, [dados.layers]);

    // Atualizar visibilidade das camadas na cena
    useEffect(() => {
      groupTelhadoRef.current.visible = camadas.telhado && !modoCorte;
      groupParedesRef.current.visible = camadas.paredes;
      groupEsquadriasRef.current.visible = camadas.esquadrias;
      groupPisoRef.current.visible = camadas.piso;
    }, [camadas, modoCorte]);

    // Função de captura de tela
    const capturarFoto = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
      // Forçar renderização com fundo limpo
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const dataUrl = rendererRef.current.domElement.toDataURL("image/png");

      setSnapshotFeedback(true);
      setTimeout(() => setSnapshotFeedback(false), 2000);

      if (onCapturarFotoParaCapa) {
        onCapturarFotoParaCapa(dataUrl);
      }
      return dataUrl;
    };

    const resetarCamera = () => {
      sphericalRef.current = { radius: 18, theta: Math.PI / 4, phi: Math.PI / 3.2 };
      targetRef.current.set(3, 1.4, 2);
      atualizarPosicaoCamera();
    };

    const alternarCorte = () => {
      setModoCorte((prev) => !prev);
    };

    useImperativeHandle(ref, () => ({
      capturarFoto,
      resetarCamera,
      alternarCorte,
    }));

    const atualizarPosicaoCamera = () => {
      if (!cameraRef.current) return;
      const { radius, theta, phi } = sphericalRef.current;
      const x = targetRef.current.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = targetRef.current.y + radius * Math.cos(phi);
      const z = targetRef.current.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(targetRef.current);
    };

    // Inicialização da cena Three.js
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      // Cena com cor de céu arquitetônico suave
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f1f5f9");
      sceneRef.current = scene;

      // Câmera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.replaceChildren(renderer.domElement);
      rendererRef.current = renderer;

      // Luzes
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
      sunLight.position.set(15, 25, 20);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 100;
      const d = 15;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      scene.add(sunLight);

      const fillLight = new THREE.DirectionalLight(0xb0d0ff, 0.4);
      fillLight.position.set(-15, 10, -15);
      scene.add(fillLight);

      // Chão com Grid suave
      const grid = new THREE.GridHelper(40, 40, 0x94a3b8, 0xe2e8f0);
      grid.position.y = -0.01;
      scene.add(grid);

      const groundGeo = new THREE.PlaneGeometry(100, 100);
      const groundMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      scene.add(ground);

      // Adicionar grupos à cena
      scene.add(groupPisoRef.current);
      scene.add(groupParedesRef.current);
      scene.add(groupEsquadriasRef.current);
      scene.add(groupTelhadoRef.current);

      resetarCamera();

      // Loop de animação
      let animationFrameId: number;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Resize observer
      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", handleResize);
        renderer.dispose();
      };
    }, []);

    // Reconstruir geometria quando os dados mudam ou quando entra em modo de corte
    useEffect(() => {
      const groupParedes = groupParedesRef.current;
      const groupPiso = groupPisoRef.current;
      const groupEsquadrias = groupEsquadriasRef.current;
      const groupTelhado = groupTelhadoRef.current;

      // Limpar malhas antigas
      groupParedes.clear();
      groupPiso.clear();
      groupEsquadrias.clear();
      groupTelhado.clear();

      const alturaParedes = modoCorte ? 1.20 : dados.config.peDireito;

      // Materiais de acabamento arquitetônico
      const matParedeExterna = new THREE.MeshStandardMaterial({
        color: 0xededed,
        roughness: 0.85,
      });
      const matParedeTopo = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        roughness: 0.6,
      });
      const matPiso = new THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.3,
      });
      const matPorta = new THREE.MeshStandardMaterial({
        color: 0x5c3a21,
        roughness: 0.5,
      });
      const matEsquadria = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.2,
      });
      const matVidro = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        transmission: 0.6,
      });
      const matTelha = new THREE.MeshStandardMaterial({
        color: new THREE.Color(dados.cobertura.corTelha || "#b94a32"),
        roughness: 0.7,
      });

      // 1. Construir Paredes e Vãos
      dados.paredes.forEach((parede) => {
        const dx = parede.p2.x - parede.p1.x;
        const dy = parede.p2.y - parede.p1.y;
        const comprimento = Math.sqrt(dx * dx + dy * dy);
        const angulo = Math.atan2(dy, dx);

        const espessura = parede.espessura || dados.config.espessuraParedePadrao;

        // Parede base como bloco 3D
        const wallGeo = new THREE.BoxGeometry(comprimento, alturaParedes, espessura);
        const wallMesh = new THREE.Mesh(wallGeo, matParedeExterna);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        // Posicionar na metade da parede e rotacionar
        const midX = (parede.p1.x + parede.p2.x) / 2;
        const midZ = (parede.p1.y + parede.p2.y) / 2; // Y no 2D vira Z no 3D

        wallMesh.position.set(midX, alturaParedes / 2, midZ);
        wallMesh.rotation.y = -angulo;

        groupParedes.add(wallMesh);
      });

      // 2. Construir Esquadrias (Portas e Janelas)
      if (!modoCorte) {
        dados.aberturas.forEach((abertura) => {
          const parede = dados.paredes.find((p) => p.id === abertura.paredeId);
          if (!parede) return;

          const dx = parede.p2.x - parede.p1.x;
          const dy = parede.p2.y - parede.p1.y;
          const comprimento = Math.sqrt(dx * dx + dy * dy);
          const angulo = Math.atan2(dy, dx);

          // Posição proporcional ao longo da parede
          const t = Math.min(Math.max(abertura.distanciaP1 / comprimento, 0), 1);
          const posX = parede.p1.x + dx * t;
          const posZ = parede.p1.y + dy * t;
          const esp = parede.espessura * 1.05;

          if (abertura.tipo === "porta") {
            const h = abertura.altura;
            const w = abertura.largura;
            const portaGeo = new THREE.BoxGeometry(w, h, esp);
            const portaMesh = new THREE.Mesh(portaGeo, matPorta);
            portaMesh.position.set(posX, h / 2, posZ);
            portaMesh.rotation.y = -angulo;
            groupEsquadrias.add(portaMesh);
          } else if (abertura.tipo === "janela") {
            const h = abertura.altura;
            const w = abertura.largura;
            const peitoril = abertura.peitoril;

            // Vidro da janela
            const janelaGeo = new THREE.BoxGeometry(w, h, esp * 0.5);
            const janelaMesh = new THREE.Mesh(janelaGeo, matVidro);
            janelaMesh.position.set(posX, peitoril + h / 2, posZ);
            janelaMesh.rotation.y = -angulo;
            groupEsquadrias.add(janelaMesh);

            // Moldura externa da esquadria
            const molduraGeo = new THREE.BoxGeometry(w * 1.05, h * 1.05, esp * 0.2);
            const molduraMesh = new THREE.Mesh(molduraGeo, matEsquadria);
            molduraMesh.position.set(posX, peitoril + h / 2, posZ);
            molduraMesh.rotation.y = -angulo;
            groupEsquadrias.add(molduraMesh);
          }
        });
      }

      // 3. Piso / Laje dos Ambientes
      if (dados.ambientes.length > 0) {
        dados.ambientes.forEach((amb) => {
          if (amb.pontos.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(amb.pontos[0].x, amb.pontos[0].y);
            for (let i = 1; i < amb.pontos.length; i++) {
              shape.lineTo(amb.pontos[i].x, amb.pontos[i].y);
            }
            shape.closePath();

            const floorGeo = new THREE.ShapeGeometry(shape);
            const floorMesh = new THREE.Mesh(floorGeo, matPiso);
            floorMesh.rotation.x = Math.PI / 2;
            floorMesh.position.y = 0.01;
            floorMesh.receiveShadow = true;
            groupPiso.add(floorMesh);
          }
        });
      } else {
        // Piso padrão delimitado pelos limites das paredes
        const box = calcularLimites(dados.paredes);
        const w = Math.max(box.maxX - box.minX, 1);
        const d = Math.max(box.maxZ - box.minZ, 1);
        const floorGeo = new THREE.PlaneGeometry(w, d);
        const floorMesh = new THREE.Mesh(floorGeo, matPiso);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set((box.minX + box.maxX) / 2, 0.01, (box.minZ + box.maxZ) / 2);
        floorMesh.receiveShadow = true;
        groupPiso.add(floorMesh);
      }

      // 4. Cobertura / Telhado 3D
      if (!modoCorte && dados.layers.telhado) {
        const box = calcularLimites(dados.paredes);
        const beiral = dados.cobertura.beiral || 0.6;
        const w = box.maxX - box.minX + beiral * 2;
        const d = box.maxZ - box.minZ + beiral * 2;
        const centroX = (box.minX + box.maxX) / 2;
        const centroZ = (box.minZ + box.maxZ) / 2;
        const alturaCumeeira = 1.6;

        // Telhado colonial em duas águas
        const telhadoGeo = new THREE.ConeGeometry(Math.max(w, d) / 1.3, alturaCumeeira, 4);
        const telhadoMesh = new THREE.Mesh(telhadoGeo, matTelha);
        telhadoMesh.position.set(centroX, dados.config.peDireito + alturaCumeeira / 2, centroZ);
        telhadoMesh.rotation.y = Math.PI / 4;
        telhadoMesh.castShadow = true;
        groupTelhado.add(telhadoMesh);
      }
    }, [dados, modoCorte]);

    function calcularLimites(paredes: Parede[]) {
      if (paredes.length === 0) return { minX: 0, maxX: 6, minZ: 0, maxZ: 4 };
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      paredes.forEach((p) => {
        minX = Math.min(minX, p.p1.x, p.p2.x);
        maxX = Math.max(maxX, p.p1.x, p.p2.x);
        minZ = Math.min(minZ, p.p1.y, p.p2.y);
        maxZ = Math.max(maxZ, p.p1.y, p.p2.y);
      });
      return { minX, maxX, minZ, maxZ };
    }

    // Controles de mouse / touch para órbita e zoom
    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
      } else if (e.button === 2) {
        isPanningRef.current = true;
      }
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      const dx = e.clientX - prevMousePosRef.current.x;
      const dy = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingRef.current) {
        sphericalRef.current.theta -= dx * 0.008;
        sphericalRef.current.phi = Math.max(
          0.1,
          Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - dy * 0.008)
        );
        atualizarPosicaoCamera();
      } else if (isPanningRef.current) {
        const factor = sphericalRef.current.radius * 0.001;
        targetRef.current.x -= dx * factor * Math.cos(sphericalRef.current.theta);
        targetRef.current.z += dx * factor * Math.sin(sphericalRef.current.theta);
        targetRef.current.y += dy * factor;
        atualizarPosicaoCamera();
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isPanningRef.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
      sphericalRef.current.radius = Math.max(
        3,
        Math.min(50, sphericalRef.current.radius + e.deltaY * 0.02)
      );
      atualizarPosicaoCamera();
    };

    return (
      <div className="relative w-full h-full min-h-[500px] bg-slate-900 rounded-lg overflow-hidden select-none">
        {/* Viewport Canvas 3D */}
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Notificação de Snapshot Capturado */}
        {snapshotFeedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in zoom-in-95 duration-200">
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg px-4 py-1.5 text-sm gap-2">
              <Camera className="w-4 h-4" /> Foto 3D capturada para a capa com sucesso!
            </Badge>
          </div>
        )}

        {/* Barra Flutuante de Ferramentas da Câmera & Camadas */}
        <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-2 items-center bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-xl">
          {/* Botão de Corte Horizontal */}
          <Button
            size="sm"
            variant={modoCorte ? "default" : "outline"}
            className={modoCorte ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-200 hover:text-white border-slate-700"}
            onClick={alternarCorte}
            title="Corte Horizontal (Planta 3D Humanizada)"
          >
            <Scissors className="w-4 h-4 mr-1.5" />
            {modoCorte ? "Corte Ativo (1.2m)" : "Corte 3D"}
          </Button>

          {/* Toggle Rápido do Telhado */}
          <Button
            size="sm"
            variant="outline"
            className="text-slate-200 hover:text-white border-slate-700"
            onClick={() => setCamadas((prev) => ({ ...prev, telhado: !prev.telhado }))}
            title="Ligar ou desligar telhado para ver o interior"
          >
            {camadas.telhado ? <Eye className="w-4 h-4 mr-1.5 text-emerald-400" /> : <EyeOff className="w-4 h-4 mr-1.5 text-slate-400" />}
            Telhado
          </Button>

          {/* Resetar Câmera */}
          <Button
            size="sm"
            variant="outline"
            className="text-slate-200 hover:text-white border-slate-700"
            onClick={resetarCamera}
            title="Resetar posição da câmera"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Botão de Captura para a Capa */}
          {!somenteLeitura && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white shadow-md font-medium"
              onClick={capturarFoto}
              title="Tirar foto deste ângulo para a capa do Dossiê"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              Capturar para Capa
            </Button>
          )}
        </div>

        {/* Dicas de Navegação no Rodapé */}
        <div className="absolute bottom-3 left-3 z-10 text-xs text-slate-400 bg-slate-950/70 backdrop-blur-sm px-3 py-1.5 rounded border border-slate-800 pointer-events-none">
          <span className="font-semibold text-slate-200">Navegação:</span> Botão esquerdo para orbitar • Roda do mouse para zoom • Botão direito para arrastar
        </div>
      </div>
    );
  }
);
