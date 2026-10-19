import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { DadosProjetoBIM, Parede, Abertura, Movel } from "@/types/projeto3d";
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
  Armchair,
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
    const groupMoveisRef = useRef<THREE.Group>(new THREE.Group());

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
      groupMoveisRef.current.visible = (camadas.moveis !== false);
    }, [camadas, modoCorte]);

    // Função de captura de tela
    const capturarFoto = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
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
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xfffaed, 1.3);
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

      const fillLight = new THREE.DirectionalLight(0xb0d0ff, 0.45);
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
      scene.add(groupMoveisRef.current);

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
      const groupMoveis = groupMoveisRef.current;

      // Limpar malhas antigas
      groupParedes.clear();
      groupPiso.clear();
      groupEsquadrias.clear();
      groupTelhado.clear();
      groupMoveis.clear();

      const alturaParedes = modoCorte ? 1.2 : dados.config.peDireito;

      // Materiais base
      const matParedeExterna = new THREE.MeshStandardMaterial({
        color: 0xededed,
        roughness: 0.85,
      });
      const matPorta = new THREE.MeshStandardMaterial({
        color: 0x5c3a21,
        roughness: 0.5,
      });
      const matVidro = new THREE.MeshPhysicalMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        transmission: 0.7,
        reflectivity: 0.8,
      });
      const matTelha = new THREE.MeshStandardMaterial({
        color: new THREE.Color(dados.cobertura.corTelha || "#b94a32"),
        roughness: 0.7,
      });

      // Se não há paredes, limpa a cena e não constrói nada
      if (dados.paredes.length === 0) {
        return;
      }

      // -------------------------------------------------------------
      // 1. CONSTRUIR PAREDES COM RECORTES DE VÃOS REAIS
      // (Isso garante que a janela não fique afogada dentro do tijolo!)
      // -------------------------------------------------------------
      dados.paredes.forEach((parede) => {
        const dx = parede.p2.x - parede.p1.x;
        const dy = parede.p2.y - parede.p1.y;
        const comprimento = Math.sqrt(dx * dx + dy * dy);
        if (comprimento < 0.1) return;
        const angulo = Math.atan2(dy, dx);
        const espessura = parede.espessura || dados.config.espessuraParedePadrao;

        const dirX = dx / comprimento;
        const dirZ = dy / comprimento;

        // Cor customizada da pintura da parede se definida pelo engenheiro
        const matParede = parede.cor
          ? new THREE.MeshStandardMaterial({ color: new THREE.Color(parede.cor), roughness: 0.85 })
          : matParedeExterna;

        const aberturasNaParede = (dados.aberturas || [])
          .filter((a) => a.paredeId === parede.id)
          .sort((a, b) => a.distanciaP1 - b.distanciaP1);

        const addBlocoParede = (
          distInicio: number,
          distFim: number,
          yInicio: number,
          yFim: number
        ) => {
          const subLen = distFim - distInicio;
          const subH = yFim - yInicio;
          if (subLen <= 0.02 || subH <= 0.02) return;

          const centerDist = (distInicio + distFim) / 2;
          const centerPosY = yInicio + subH / 2;
          const centerPosX = parede.p1.x + dirX * centerDist;
          const centerPosZ = parede.p1.y + dirZ * centerDist;

          const blocoGeo = new THREE.BoxGeometry(subLen, subH, espessura);
          const blocoMesh = new THREE.Mesh(blocoGeo, matParede);
          blocoMesh.position.set(centerPosX, centerPosY, centerPosZ);
          blocoMesh.rotation.y = -angulo;
          blocoMesh.castShadow = true;
          blocoMesh.receiveShadow = true;
          groupParedes.add(blocoMesh);
        };

        if (aberturasNaParede.length === 0) {
          // Parede inteira sólida
          addBlocoParede(0, comprimento, 0, alturaParedes);
        } else {
          // Parede segmentada com vãos recortados
          let cursor = 0;
          aberturasNaParede.forEach((ab) => {
            const abInicio = Math.max(0, ab.distanciaP1 - ab.largura / 2);
            const abFim = Math.min(comprimento, ab.distanciaP1 + ab.largura / 2);

            // 1. Bloco de parede sólida antes do vão
            if (abInicio > cursor) {
              addBlocoParede(cursor, abInicio, 0, alturaParedes);
            }

            // 2. No vão:
            if (ab.tipo === "porta") {
              // Viga/verga acima da porta até o teto
              if (alturaParedes > ab.altura) {
                addBlocoParede(abInicio, abFim, ab.altura, alturaParedes);
              }
            } else if (ab.tipo === "janela") {
              // Peitoril / mureta abaixo da janela (de 0 até peitoril)
              if (ab.peitoril > 0.02) {
                addBlocoParede(abInicio, abFim, 0, Math.min(ab.peitoril, alturaParedes));
              }
              // Verga acima da janela até o teto
              const topoJanela = ab.peitoril + ab.altura;
              if (alturaParedes > topoJanela) {
                addBlocoParede(abInicio, abFim, topoJanela, alturaParedes);
              }
            }

            cursor = Math.max(cursor, abFim);
          });

          // 3. Bloco de parede sólida final após o último vão
          if (cursor < comprimento) {
            addBlocoParede(cursor, comprimento, 0, alturaParedes);
          }
        }
      });

      // -------------------------------------------------------------
      // 2. CONSTRUIR ESQUADRIAS 3D (JANELAS COM VIDRO/MOLDURA E PORTAS)
      // -------------------------------------------------------------
      if (!modoCorte && dados.aberturas) {
        dados.aberturas.forEach((abertura) => {
          const parede = dados.paredes.find((p) => p.id === abertura.paredeId);
          if (!parede) return;

          const dx = parede.p2.x - parede.p1.x;
          const dy = parede.p2.y - parede.p1.y;
          const comprimento = Math.sqrt(dx * dx + dy * dy);
          if (comprimento === 0) return;
          const angulo = Math.atan2(dy, dx);
          const espessura = parede.espessura || dados.config.espessuraParedePadrao;

          const t = Math.min(Math.max(abertura.distanciaP1 / comprimento, 0), 1);
          const posX = parede.p1.x + dx * t;
          const posZ = parede.p1.y + dy * t;

          if (abertura.tipo === "porta") {
            const h = abertura.altura;
            const w = abertura.largura;
            const espPorta = 0.04;

            // Batente/marco da porta
            const matMarco = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 });
            const marcoTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, espessura * 1.05), matMarco);
            marcoTop.position.set(posX, h - 0.02, posZ);
            marcoTop.rotation.y = -angulo;
            groupEsquadrias.add(marcoTop);

            // Folha de madeira da porta
            const portaGeo = new THREE.BoxGeometry(w - 0.04, h - 0.04, espPorta);
            const portaMesh = new THREE.Mesh(portaGeo, matPorta);
            portaMesh.position.set(posX, h / 2, posZ);
            portaMesh.rotation.y = -angulo;
            portaMesh.castShadow = true;
            groupEsquadrias.add(portaMesh);

            // Maçaneta cromada
            const matInox = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
            const macanetaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12), matInox);
            const offXMacaneta = Math.cos(angulo) * (w / 2 - 0.1);
            const offZMacaneta = Math.sin(angulo) * (w / 2 - 0.1);
            macanetaMesh.position.set(posX + offXMacaneta, 1.0, posZ + offZMacaneta);
            macanetaMesh.rotation.z = Math.PI / 2;
            groupEsquadrias.add(macanetaMesh);
          } else if (abertura.tipo === "janela") {
            const h = abertura.altura;
            const w = abertura.largura;
            const peitoril = abertura.peitoril;
            const espEsquadria = espessura * 0.95;

            // 1. Peitoril de granito saliente abaixo da janela
            const peitorilGeo = new THREE.BoxGeometry(w * 1.06, 0.04, espessura * 1.3);
            const matGranito = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 });
            const peitorilMesh = new THREE.Mesh(peitorilGeo, matGranito);
            peitorilMesh.position.set(posX, peitoril - 0.02, posZ);
            peitorilMesh.rotation.y = -angulo;
            groupEsquadrias.add(peitorilMesh);

            // 2. Moldura de Alumínio Preto da Esquadria
            const perfilEsp = 0.04;
            const matFrame = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });

            // Marco Superior
            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, perfilEsp, espEsquadria), matFrame);
            frameTop.position.set(posX, peitoril + h - perfilEsp / 2, posZ);
            frameTop.rotation.y = -angulo;
            groupEsquadrias.add(frameTop);

            // Marco Inferior
            const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(w, perfilEsp, espEsquadria), matFrame);
            frameBottom.position.set(posX, peitoril + perfilEsp / 2, posZ);
            frameBottom.rotation.y = -angulo;
            groupEsquadrias.add(frameBottom);

            // Marco Esquerdo
            const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(perfilEsp, h, espEsquadria), matFrame);
            const offXLeft = -Math.cos(angulo) * (w / 2 - perfilEsp / 2);
            const offZLeft = -Math.sin(angulo) * (w / 2 - perfilEsp / 2);
            frameLeft.position.set(posX + offXLeft, peitoril + h / 2, posZ + offZLeft);
            frameLeft.rotation.y = -angulo;
            groupEsquadrias.add(frameLeft);

            // Marco Direito
            const frameRight = new THREE.Mesh(new THREE.BoxGeometry(perfilEsp, h, espEsquadria), matFrame);
            const offXRight = Math.cos(angulo) * (w / 2 - perfilEsp / 2);
            const offZRight = Math.sin(angulo) * (w / 2 - perfilEsp / 2);
            frameRight.position.set(posX + offXRight, peitoril + h / 2, posZ + offZRight);
            frameRight.rotation.y = -angulo;
            groupEsquadrias.add(frameRight);

            // Montante central vertical (divisão de duas folhas de correr)
            const montanteCenter = new THREE.Mesh(
              new THREE.BoxGeometry(perfilEsp * 0.8, h - perfilEsp * 2, espEsquadria * 0.8),
              matFrame
            );
            montanteCenter.position.set(posX, peitoril + h / 2, posZ);
            montanteCenter.rotation.y = -angulo;
            groupEsquadrias.add(montanteCenter);

            // 3. Vidro translúcido físico
            const janelaVidroGeo = new THREE.BoxGeometry(w - perfilEsp * 2, h - perfilEsp * 2, 0.015);
            const janelaVidroMesh = new THREE.Mesh(janelaVidroGeo, matVidro);
            janelaVidroMesh.position.set(posX, peitoril + h / 2, posZ);
            janelaVidroMesh.rotation.y = -angulo;
            groupEsquadrias.add(janelaVidroMesh);
          }
        });
      }

      // -------------------------------------------------------------
      // 3. PISOS DOS AMBIENTES COM ACABAMENTOS REALISTAS
      // -------------------------------------------------------------
      if (dados.ambientes && dados.ambientes.length > 0) {
        dados.ambientes.forEach((amb) => {
          if (amb.pontos.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(amb.pontos[0].x, amb.pontos[0].y);
            for (let i = 1; i < amb.pontos.length; i++) {
              shape.lineTo(amb.pontos[i].x, amb.pontos[i].y);
            }
            shape.closePath();

            const floorGeo = new THREE.ShapeGeometry(shape);

            // Identificar acabamento do piso
            let matPisoAmb = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.25,
              metalness: 0.08,
            });
            const acabamento = (amb.pisoAcabamento || "").toLowerCase();
            if (acabamento.includes("madeira") || acabamento.includes("laminado")) {
              matPisoAmb = new THREE.MeshStandardMaterial({
                color: 0x92400e,
                roughness: 0.45,
                metalness: 0.05,
              });
            } else if (acabamento.includes("cimento")) {
              matPisoAmb = new THREE.MeshStandardMaterial({
                color: 0x475569,
                roughness: 0.85,
                metalness: 0.0,
              });
            } else if (acabamento.includes("cerâmica") || acabamento.includes("ceramica")) {
              matPisoAmb = new THREE.MeshStandardMaterial({
                color: 0xc2410c,
                roughness: 0.6,
                metalness: 0.0,
              });
            } else if (acabamento.includes("grama") || acabamento.includes("externo")) {
              matPisoAmb = new THREE.MeshStandardMaterial({
                color: 0x16a34a,
                roughness: 0.9,
                metalness: 0.0,
              });
            }

            const floorMesh = new THREE.Mesh(floorGeo, matPisoAmb);
            floorMesh.rotation.x = Math.PI / 2;
            floorMesh.position.y = 0.01;
            floorMesh.receiveShadow = true;
            groupPiso.add(floorMesh);
          }
        });
      } else if (dados.paredes.length >= 3) {
        const box = calcularLimites(dados.paredes);
        const w = Math.max(box.maxX - box.minX, 1);
        const d = Math.max(box.maxZ - box.minZ, 1);
        const floorGeo = new THREE.PlaneGeometry(w, d);
        const matPisoPadrao = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
        const floorMesh = new THREE.Mesh(floorGeo, matPisoPadrao);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set((box.minX + box.maxX) / 2, 0.01, (box.minZ + box.maxZ) / 2);
        floorMesh.receiveShadow = true;
        groupPiso.add(floorMesh);
      }

      // -------------------------------------------------------------
      // 4. MÓVEIS PARAMÉTRICOS 3D (HUMANIZAÇÃO DA MAQUETE)
      // -------------------------------------------------------------
      if (dados.moveis && dados.moveis.length > 0 && !modoCorte) {
        dados.moveis.forEach((movel) => {
          const posX = movel.x;
          const posZ = movel.y;
          const rotRad = ((movel.rotacao || 0) * Math.PI) / 180;
          const mGroup = new THREE.Group();
          mGroup.position.set(posX, 0, posZ);
          mGroup.rotation.y = -rotRad;

          const matMadeira = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.6 });
          const matEstofado = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
          const matBranco = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
          const matInox = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.2 });
          const matGranitoPreto = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.15, metalness: 0.1 });

          if (movel.tipo === "cama_casal") {
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 2.0), matMadeira);
            base.position.y = 0.175;
            const colchao = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.25, 1.95), matBranco);
            colchao.position.y = 0.475;
            const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), matEstofado);
            cab.position.set(0, 0.4, -0.95);
            const trav1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.4), matBranco);
            trav1.position.set(-0.4, 0.65, -0.65);
            const trav2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.4), matBranco);
            trav2.position.set(0.4, 0.65, -0.65);
            mGroup.add(base, colchao, cab, trav1, trav2);
          } else if (movel.tipo === "cama_solteiro") {
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.9), matMadeira);
            base.position.y = 0.175;
            const colchao = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.25, 1.85), matBranco);
            colchao.position.y = 0.475;
            const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.1), matEstofado);
            cab.position.set(0, 0.375, -0.9);
            const trav = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.4), matBranco);
            trav.position.set(0, 0.65, -0.6);
            mGroup.add(base, colchao, cab, trav);
          } else if (movel.tipo === "sofa") {
            const assento = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.9), matEstofado);
            assento.position.y = 0.225;
            const encosto = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.25), matEstofado);
            encosto.position.set(0, 0.675, -0.325);
            const bracoEsq = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.9), matEstofado);
            bracoEsq.position.set(-1.0, 0.325, 0);
            const bracoDir = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.9), matEstofado);
            bracoDir.position.set(1.0, 0.325, 0);
            mGroup.add(assento, encosto, bracoEsq, bracoDir);
          } else if (movel.tipo === "mesa_jantar") {
            const tampo = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.9), matMadeira);
            tampo.position.y = 0.75;
            const peMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7 });
            const peGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
            [
              [-0.7, -0.38],
              [0.7, -0.38],
              [-0.7, 0.38],
              [0.7, 0.38],
            ].forEach(([px, pz]) => {
              const pe = new THREE.Mesh(peGeo, peMat);
              pe.position.set(px, 0.375, pz);
              mGroup.add(pe);
            });
            mGroup.add(tampo);
          } else if (movel.tipo === "bancada_pia") {
            const gab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.6), matMadeira);
            gab.position.y = 0.425;
            const tampo = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.62), matGranitoPreto);
            tampo.position.y = 0.875;
            const cuba = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.4), matInox);
            cuba.position.set(0, 0.89, 0);
            mGroup.add(gab, tampo, cuba);
          } else if (movel.tipo === "geladeira") {
            const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.8, 0.7), matInox);
            corpo.position.y = 0.9;
            mGroup.add(corpo);
          } else if (movel.tipo === "fogao") {
            const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), matInox);
            corpo.position.y = 0.425;
            const tampo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.6), matGranitoPreto);
            tampo.position.y = 0.865;
            mGroup.add(corpo, tampo);
          } else if (movel.tipo === "vaso_sanitario") {
            const bacia = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.5), matBranco);
            bacia.position.set(0, 0.21, 0.1);
            const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.18), matBranco);
            caixa.position.set(0, 0.42, -0.22);
            mGroup.add(bacia, caixa);
          } else if (movel.tipo === "bancada_banheiro") {
            const gab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.45), matMadeira);
            gab.position.y = 0.45;
            const tampo = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.47), matBranco);
            tampo.position.y = 0.72;
            const cuba = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.12, 16), matBranco);
            cuba.position.set(0, 0.8, 0);
            mGroup.add(gab, tampo, cuba);
          }

          groupMoveis.add(mGroup);
        });
      }

      // -------------------------------------------------------------
      // 5. COBERTURA / TELHADO 3D (se houver pelo menos 3 paredes)
      // -------------------------------------------------------------
      if (!modoCorte && dados.layers.telhado && dados.paredes.length >= 3) {
        const box = calcularLimites(dados.paredes);
        const beiral = dados.cobertura.beiral || 0.6;
        const w = box.maxX - box.minX + beiral * 2;
        const d = box.maxZ - box.minZ + beiral * 2;
        const centroX = (box.minX + box.maxX) / 2;
        const centroZ = (box.minZ + box.maxZ) / 2;
        const alturaCumeeira = 1.6;

        const telhadoGeo = new THREE.ConeGeometry(Math.max(w, d) / 1.3, alturaCumeeira, 4);
        const telhadoMesh = new THREE.Mesh(telhadoGeo, matTelha);
        telhadoMesh.position.set(centroX, dados.config.peDireito + alturaCumeeira / 2, centroZ);
        telhadoMesh.rotation.y = Math.PI / 4;
        telhadoMesh.castShadow = true;
        groupTelhado.add(telhadoMesh);
      }
    }, [dados, modoCorte]);

    function calcularLimites(paredes: Parede[]) {
      if (paredes.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
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

        {/* Estado Vazio Elegante quando a Obra não tem paredes modeladas */}
        {dados.paredes.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-6 rounded-xl shadow-2xl max-w-sm pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-700">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Nenhum elemento 3D nesta obra</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {somenteLeitura
                  ? "A maquete tridimensional desta obra ainda não foi publicada pela equipe de engenharia."
                  : "Esta obra ainda não possui paredes modeladas. Alterne para a aba Planta 2D para desenhar ou importar um arquivo DXF."}
              </p>
            </div>
          </div>
        )}

        {/* Barra Flutuante de Ferramentas da Câmera & Camadas */}
        <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-2 items-center bg-slate-950/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-2xl">
          {/* Botão de Corte Horizontal */}
          <Button
            size="sm"
            variant="ghost"
            className={
              modoCorte
                ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold border border-amber-500 shadow-xs"
                : "bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-600 shadow-xs"
            }
            onClick={alternarCorte}
            title="Corte Horizontal (Planta 3D Humanizada)"
          >
            <Scissors className="w-4 h-4 mr-1.5 text-amber-300" />
            {modoCorte ? "Corte Ativo (1.2m)" : "Corte 3D"}
          </Button>

          {/* Toggle Rápido do Telhado */}
          <Button
            size="sm"
            variant="ghost"
            className={
              camadas.telhado
                ? "bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-600 shadow-xs"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium border border-slate-700"
            }
            onClick={() => setCamadas((prev) => ({ ...prev, telhado: !prev.telhado }))}
            title="Ligar ou desligar telhado para ver o interior"
          >
            {camadas.telhado ? (
              <Eye className="w-4 h-4 mr-1.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-4 h-4 mr-1.5 text-slate-400" />
            )}
            Telhado
          </Button>

          {/* Toggle de Móveis */}
          <Button
            size="sm"
            variant="ghost"
            className={
              camadas.moveis !== false
                ? "bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-600 shadow-xs"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium border border-slate-700"
            }
            onClick={() => setCamadas((prev) => ({ ...prev, moveis: !prev.moveis }))}
            title="Ligar ou desligar visualização de mobília"
          >
            <Armchair
              className={`w-4 h-4 mr-1.5 ${
                camadas.moveis !== false ? "text-amber-400" : "text-slate-400"
              }`}
            />
            Móveis
          </Button>

          {/* Resetar Câmera */}
          <Button
            size="sm"
            variant="ghost"
            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 shadow-xs px-2.5"
            onClick={resetarCamera}
            title="Resetar posição da câmera"
          >
            <RotateCcw className="w-4 h-4 text-slate-200" />
          </Button>

          {/* Botão de Captura para a Capa */}
          {!somenteLeitura && (
            <Button
              size="sm"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md font-semibold border border-blue-500"
              onClick={capturarFoto}
              title="Tirar foto deste ângulo para a capa do Dossiê"
            >
              <Camera className="w-4 h-4 mr-1.5 text-white" />
              Capturar para Capa
            </Button>
          )}
        </div>

        {/* Dicas de Navegação no Rodapé */}
        <div className="absolute bottom-3 left-3 z-10 text-xs text-slate-400 bg-slate-950/70 backdrop-blur-sm px-3 py-1.5 rounded border border-slate-800 pointer-events-none">
          <span className="font-semibold text-slate-200">Navegação:</span> Botão esquerdo para
          orbitar • Roda do mouse para zoom • Botão direito para arrastar
        </div>
      </div>
    );
  }
);
