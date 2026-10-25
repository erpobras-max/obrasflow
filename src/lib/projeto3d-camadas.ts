import type { CamadaCad, DadosProjetoBIM, Parede } from "@/types/projeto3d";
import type { SelecaoElementoCad } from "@/lib/projeto3d-transformacoes";

export const CAMADA_CAD_PADRAO_ID = "padrao";

const CAMADA_PADRAO: CamadaCad = {
  id: CAMADA_CAD_PADRAO_ID,
  nome: "Geral",
  visivel: true,
  bloqueada: false,
};

type ElementoComCamada = { camadaId?: string; layer?: string };

function idCamadaDxf(nome: string) {
  return `dxf:${nome}`;
}

export function obterCamadaId(elemento: ElementoComCamada): string {
  return elemento.camadaId || (elemento.layer ? idCamadaDxf(elemento.layer) : CAMADA_CAD_PADRAO_ID);
}

export function listarCamadasCad(dados: DadosProjetoBIM): CamadaCad[] {
  const camadas = new Map<string, CamadaCad>();
  camadas.set(CAMADA_CAD_PADRAO_ID, CAMADA_PADRAO);
  for (const camada of dados.camadasCad ?? []) camadas.set(camada.id, camada);
  for (const parede of dados.paredes) {
    if (!parede.camadaId && parede.layer) {
      const id = idCamadaDxf(parede.layer);
      if (!camadas.has(id)) {
        camadas.set(id, { id, nome: parede.layer, visivel: true, bloqueada: false });
      }
    }
  }
  return [...camadas.values()];
}

export function obterCamadaCad(dados: DadosProjetoBIM, elemento: ElementoComCamada): CamadaCad {
  const id = obterCamadaId(elemento);
  return listarCamadasCad(dados).find((camada) => camada.id === id) ?? CAMADA_PADRAO;
}

export function elementoCadVisivel(dados: DadosProjetoBIM, elemento: ElementoComCamada): boolean {
  return obterCamadaCad(dados, elemento).visivel;
}

export function elementoCadEditavel(dados: DadosProjetoBIM, elemento: ElementoComCamada): boolean {
  const camada = obterCamadaCad(dados, elemento);
  return camada.visivel && !camada.bloqueada;
}

export function filtrarSelecaoEditavel(
  dados: DadosProjetoBIM,
  selecao: SelecaoElementoCad[]
): SelecaoElementoCad[] {
  return selecao.filter((item) => {
    const elemento =
      item.tipo === "parede"
        ? dados.paredes.find((parede) => parede.id === item.id)
        : item.tipo === "ambiente"
          ? dados.ambientes.find((ambiente) => ambiente.id === item.id)
          : (dados.moveis ?? []).find((movel) => movel.id === item.id);
    return elemento ? elementoCadEditavel(dados, elemento) : false;
  });
}

export function criarCamadaCad(dados: DadosProjetoBIM, id: string, nome: string): DadosProjetoBIM {
  const nomeLimpo = nome.trim();
  const camadas = listarCamadasCad(dados);
  if (!nomeLimpo || camadas.some((camada) => camada.nome.toLocaleLowerCase() === nomeLimpo.toLocaleLowerCase())) {
    return dados;
  }
  return {
    ...dados,
    camadasCad: [...camadas, { id, nome: nomeLimpo, visivel: true, bloqueada: false }],
  };
}

export function atualizarCamadaCad(
  dados: DadosProjetoBIM,
  camadaId: string,
  alteracoes: Partial<Pick<CamadaCad, "visivel" | "bloqueada">>
): DadosProjetoBIM {
  return {
    ...dados,
    camadasCad: listarCamadasCad(dados).map((camada) =>
      camada.id === camadaId ? { ...camada, ...alteracoes } : camada
    ),
  };
}

export function aplicarCamadaNaSelecao(
  dados: DadosProjetoBIM,
  selecao: SelecaoElementoCad[],
  camadaId: string
): DadosProjetoBIM {
  const camada = listarCamadasCad(dados).find((item) => item.id === camadaId);
  if (!camada) return dados;
  const idsParede = new Set(selecao.filter((item) => item.tipo === "parede").map((item) => item.id));
  const idsAmbiente = new Set(selecao.filter((item) => item.tipo === "ambiente").map((item) => item.id));
  const idsMovel = new Set(selecao.filter((item) => item.tipo === "movel").map((item) => item.id));
  return {
    ...dados,
    camadasCad: listarCamadasCad(dados),
    paredes: dados.paredes.map((parede) =>
      idsParede.has(parede.id) ? { ...parede, camadaId, layer: camada.nome } : parede
    ),
    ambientes: dados.ambientes.map((ambiente) =>
      idsAmbiente.has(ambiente.id) ? { ...ambiente, camadaId } : ambiente
    ),
    moveis: (dados.moveis ?? []).map((movel) =>
      idsMovel.has(movel.id) ? { ...movel, camadaId } : movel
    ),
  };
}

export function renomearCamadaCad(
  dados: DadosProjetoBIM,
  camadaId: string,
  nome: string
): DadosProjetoBIM {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) return dados;
  const camadas = listarCamadasCad(dados);
  if (
    camadas.some(
      (camada) => camada.id !== camadaId && camada.nome.toLocaleLowerCase() === nomeLimpo.toLocaleLowerCase()
    )
  ) {
    return dados;
  }
  return {
    ...dados,
    camadasCad: camadas.map((camada) =>
      camada.id === camadaId ? { ...camada, nome: nomeLimpo } : camada
    ),
    paredes: dados.paredes.map((parede) =>
      obterCamadaId(parede) === camadaId
        ? { ...parede, camadaId, layer: nomeLimpo }
        : parede
    ),
  };
}

export function removerCamadaCad(dados: DadosProjetoBIM, camadaId: string): DadosProjetoBIM {
  if (camadaId === CAMADA_CAD_PADRAO_ID) return dados;
  const moverParaPadrao = <T extends ElementoComCamada>(elemento: T): T =>
    obterCamadaId(elemento) === camadaId
      ? { ...elemento, camadaId: CAMADA_CAD_PADRAO_ID, layer: undefined }
      : elemento;
  return {
    ...dados,
    camadasCad: listarCamadasCad(dados).filter((camada) => camada.id !== camadaId),
    paredes: dados.paredes.map(moverParaPadrao) as Parede[],
    ambientes: dados.ambientes.map(moverParaPadrao),
    moveis: (dados.moveis ?? []).map(moverParaPadrao),
  };
}
