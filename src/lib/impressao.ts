/** Abre uma folha limpa para impressão, sem o modal ou a navegação do sistema. */
export function imprimirElemento(elemento: HTMLElement | null, titulo: string, orientacao: "portrait" | "landscape" = "portrait") {
  if (!elemento) return;
  const janela = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
  if (!janela) {
    window.print();
    return;
  }

  const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((item) => item.outerHTML)
    .join("\n");
  const copia = elemento.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(".print-hidden, [data-print-hidden]").forEach((item) => item.remove());

  janela.document.open();
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>${estilos}<style>
    @page { size: A4 ${orientacao}; margin: 12mm; }
    html, body { margin: 0; background: #fff !important; color: #0f172a; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .print-sheet { width: 100% !important; max-width: none !important; min-height: auto !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: 0 !important; }
  </style></head><body>${copia.outerHTML}</body></html>`);
  janela.document.close();
  window.setTimeout(() => {
    janela.focus();
    janela.print();
  }, 500);
}
