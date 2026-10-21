from __future__ import annotations

from math import sqrt
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "maquete-papel-cidade-proibida-a4.pdf"
MM = 72 / 25.4
PAGE_W, PAGE_H = A4

CUT = colors.HexColor("#202020")
FOLD = colors.HexColor("#2474A6")
GLUE = colors.HexColor("#8A8A8A")
MARBLE = colors.HexColor("#ECE8DE")
MARBLE_2 = colors.HexColor("#DDD7CB")
RED = colors.HexColor("#A82724")
DARK_RED = colors.HexColor("#741A18")
GOLD = colors.HexColor("#D7A11E")
DARK_GOLD = colors.HexColor("#9B6911")
BLUE = colors.HexColor("#2E6F86")
INK = colors.HexColor("#28231E")
PAPER = colors.HexColor("#FAF7F0")


def mm(value: float) -> float:
    return value * MM


def line(c: canvas.Canvas, x1, y1, x2, y2, kind: str = "cut", width: float = 0.45) -> None:
    if kind == "fold":
        c.setStrokeColor(FOLD)
        c.setDash(mm(3), mm(2))
        width = 0.35
    elif kind == "glue":
        c.setStrokeColor(GLUE)
        c.setDash(mm(1), mm(1.4))
        width = 0.3
    else:
        c.setStrokeColor(CUT)
        c.setDash()
    c.setLineWidth(mm(width))
    c.line(mm(x1), mm(y1), mm(x2), mm(y2))
    c.setDash()


def poly(c: canvas.Canvas, points: list[tuple[float, float]], fill, kind: str = "cut") -> None:
    path = c.beginPath()
    path.moveTo(mm(points[0][0]), mm(points[0][1]))
    for x, y in points[1:]:
        path.lineTo(mm(x), mm(y))
    path.close()
    c.setFillColor(fill)
    c.setStrokeColor(CUT)
    c.setLineWidth(mm(0.45))
    c.drawPath(path, fill=1, stroke=1)
    if kind == "fold":
        for index in range(len(points)):
            a = points[index]
            b = points[(index + 1) % len(points)]
            line(c, a[0], a[1], b[0], b[1], "fold")


def text(c: canvas.Canvas, value: str, x: float, y: float, size: float = 8, bold: bool = False,
         color=INK, align: str = "left") -> None:
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    method = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
    method(mm(x), mm(y), value)


def page_title(c: canvas.Canvas, number: int, title: str, subtitle: str = "") -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    text(c, f"{number:02d}", 10, 287, 9, True, DARK_GOLD)
    text(c, title, 22, 286.5, 14, True)
    if subtitle:
        text(c, subtitle, 22, 280, 7.5, False, colors.HexColor("#6D6257"))
    line(c, 10, 276, 200, 276, "cut", 0.25)
    text(c, "CORTE", 10, 7, 6.5, True, CUT)
    line(c, 26, 8, 38, 8, "cut")
    text(c, "DOBRA", 46, 7, 6.5, True, FOLD)
    line(c, 64, 8, 76, 8, "fold")
    text(c, "COLA", 84, 7, 6.5, True, GLUE)
    line(c, 98, 8, 110, 8, "glue")
    text(c, "Imprimir em A4 a 100% - não usar Ajustar à página", 200, 7, 6.5, True, DARK_RED, "right")


def glue_tab(c: canvas.Canvas, x: float, y: float, w: float, h: float, orientation: str) -> None:
    if orientation == "top":
        points = [(x, y), (x + w, y), (x + w - 2, y + h), (x + 2, y + h)]
        fold = (x, y, x + w, y)
    elif orientation == "bottom":
        points = [(x, y), (x + w, y), (x + w - 2, y - h), (x + 2, y - h)]
        fold = (x, y, x + w, y)
    elif orientation == "left":
        points = [(x, y), (x, y + h), (x - w, y + h - 2), (x - w, y + 2)]
        fold = (x, y, x, y + h)
    else:
        points = [(x, y), (x, y + h), (x + w, y + h - 2), (x + w, y + 2)]
        fold = (x, y, x, y + h)
    poly(c, points, colors.HexColor("#E6E1D8"))
    line(c, *fold, "fold")


def marble_pattern(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    c.saveState()
    c.setStrokeColor(colors.HexColor("#CFC8BB"))
    c.setLineWidth(mm(0.18))
    for offset in range(-int(h), int(w), 14):
        c.line(mm(x + max(offset, 0)), mm(y), mm(x + min(offset + h, w)), mm(y + min(h, w - offset)))
    c.restoreState()


def platform_page(c: canvas.Canvas, number: int, title: str, w: float, d: float, h: float,
                  fill) -> None:
    page_title(c, number, title, f"Tampo {w:.0f} × {d:.0f} mm · paredes com {h:.0f} mm de altura")
    x = 105 - w / 2
    y = 142 - d / 2
    c.setFillColor(fill)
    c.setStrokeColor(CUT)
    c.setLineWidth(mm(0.45))
    c.rect(mm(x), mm(y), mm(w), mm(d), fill=1, stroke=1)
    marble_pattern(c, x, y, w, d)
    # Paredes frontal e traseira, com aba voltada para fora.
    for wall_y, orientation in [
        (y - h, "bottom"),
        (y + d, "top"),
    ]:
        c.setFillColor(fill)
        c.rect(mm(x), mm(wall_y), mm(w), mm(h), fill=1, stroke=1)
        marble_pattern(c, x, wall_y, w, h)
        fold_y = wall_y + h if orientation == "bottom" else wall_y
        line(c, x, fold_y, x + w, fold_y, "fold")
        tab_y = wall_y if orientation == "bottom" else wall_y + h
        glue_tab(c, x, tab_y, w, 4, orientation)

    # Paredes laterais rotacionadas; as abas ficam para fora do tampo.
    left_x = x - h
    right_x = x + w
    for wall_x, orientation in [
        (left_x, "left"),
        (right_x, "right"),
    ]:
        c.setFillColor(fill)
        c.rect(mm(wall_x), mm(y), mm(h), mm(d), fill=1, stroke=1)
        marble_pattern(c, wall_x, y, h, d)
        fold_x = wall_x + h if orientation == "left" else wall_x
        line(c, fold_x, y, fold_x, y + d, "fold")
        tab_x = wall_x if orientation == "left" else wall_x + h
        glue_tab(c, tab_x, y, 4, d, orientation)
    c.showPage()


def draw_stair_net(c: canvas.Canvas, x: float, y: float, width: float, run: float, height: float, name: str) -> None:
    # Rampa central com degraus impressos; laterais triangulares dobram para baixo.
    c.setFillColor(MARBLE)
    c.setStrokeColor(CUT)
    c.rect(mm(x), mm(y), mm(width), mm(run), fill=1, stroke=1)
    steps = 6
    for step in range(1, steps):
        line(c, x, y + run * step / steps, x + width, y + run * step / steps, "fold", 0.25)
    left = [(x, y), (x, y + run), (x - height, y + run)]
    right = [(x + width, y), (x + width, y + run), (x + width + height, y + run)]
    poly(c, left, MARBLE_2)
    poly(c, right, MARBLE_2)
    line(c, x, y, x, y + run, "fold")
    line(c, x + width, y, x + width, y + run, "fold")
    glue_tab(c, x, y, width, 4, "bottom")
    text(c, name, x + width / 2, y - 8, 5.5, True, DARK_RED, "center")


def draw_wall(c: canvas.Canvas, x: float, y: float, w: float, h: float, name: str,
              facade: bool = False) -> None:
    c.setFillColor(RED)
    c.setStrokeColor(CUT)
    c.rect(mm(x), mm(y), mm(w), mm(h), fill=1, stroke=1)
    # Faixa decorativa e pilares estruturais impressos.
    c.setFillColor(BLUE)
    c.rect(mm(x), mm(y + h - 7), mm(w), mm(5), fill=1, stroke=0)
    bays = 11 if facade else 5
    for bay in range(bays + 1):
        px = x + w * bay / bays
        c.setFillColor(DARK_RED)
        c.rect(mm(px - 1), mm(y + 2), mm(2), mm(h - 4), fill=1, stroke=0)
    for bay in range(bays):
        cx = x + w * (bay + 0.5) / bays
        c.setFillColor(colors.HexColor("#321F1C"))
        c.rect(mm(cx - w / bays * 0.30), mm(y + 3), mm(w / bays * 0.60), mm(h - 13), fill=1, stroke=0)
        c.setStrokeColor(GOLD)
        c.setLineWidth(mm(0.35))
        c.rect(mm(cx - w / bays * 0.30), mm(y + 3), mm(w / bays * 0.60), mm(h - 13), fill=0, stroke=1)
    glue_tab(c, x, y, w, 4, "bottom")
    glue_tab(c, x, y + h, w, 4, "top")
    glue_tab(c, x + w, y, 4, h, "right")
    text(c, name, x - 2, y + h / 2 - 1, 5.2, True, DARK_RED, "right")


def roof_page(c: canvas.Canvas, number: int, title: str, width: float, depth: float,
              ridge: float, slope: float, prefix: str) -> None:
    page_title(c, number, title, "Quatro águas simplificado · conectores dobrados ficam pelo lado de dentro")
    center = 105
    long_x = center - width / 2
    for index, y in enumerate([206, 154], 1):
        inset = (width - ridge) / 2
        points = [(long_x, y), (long_x + width, y), (long_x + width - inset, y + slope),
                  (long_x + inset, y + slope)]
        poly(c, points, GOLD if index == 1 else colors.HexColor("#E3B532"))
        for stripe in range(1, 8):
            sx = long_x + width * stripe / 8
            line(c, sx, y + 1, center + (sx - center) * ridge / width, y + slope - 1, "glue", 0.2)
        text(c, f"{prefix}{index}", long_x - 3, y + slope / 2 - 1, 6, True, DARK_RED, "right")

    half_depth = depth / 2
    half_taper = (width - ridge) / 2
    if slope <= half_depth:
        raise ValueError(f"Inclinação de {title} precisa ser maior que {half_depth:.1f} mm")
    roof_rise = sqrt(slope ** 2 - half_depth ** 2)
    tri_h = sqrt(half_taper ** 2 + roof_rise ** 2)
    seam_long = sqrt(half_taper ** 2 + slope ** 2)
    seam_side = sqrt(half_depth ** 2 + tri_h ** 2)
    assert abs(seam_long - seam_side) < 0.001
    for index, cx in enumerate([55, 155], 3):
        y = 96
        points = [(cx - depth / 2, y), (cx + depth / 2, y), (cx, y + tri_h)]
        poly(c, points, GOLD)
        text(c, f"{prefix}{index}", cx, y - 6, 6, True, DARK_RED, "center")

    # Conectores internos para as quatro emendas e uma faixa de cumeeira.
    connector_y = 43
    for index in range(4):
        x = 17 + index * 45
        c.setFillColor(colors.HexColor("#D5A01B"))
        c.rect(mm(x), mm(connector_y), mm(38), mm(10), fill=1, stroke=1)
        line(c, x, connector_y + 5, x + 38, connector_y + 5, "fold")
    c.setFillColor(DARK_GOLD)
    c.rect(mm(62), mm(22), mm(86), mm(9), fill=1, stroke=1)
    line(c, 62, 26.5, 148, 26.5, "fold")
    text(c, f"CUMEEIRA {prefix}", 105, 16, 5.5, True, DARK_RED, "center")
    c.showPage()


def cover(c: canvas.Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(DARK_RED)
    c.rect(0, mm(226), PAGE_W, mm(71), fill=1, stroke=0)
    text(c, "MAQUETE DE PAPEL", 16, 278, 12, True, GOLD)
    text(c, "SALÃO DA SUPREMA", 16, 261, 25, True, colors.white)
    text(c, "HARMONIA", 16, 247, 25, True, colors.white)
    text(c, "Cidade Proibida · Pequim", 16, 235, 11, False, colors.HexColor("#F4D98A"))

    text(c, "ANTES DE CORTAR", 16, 211, 13, True, DARK_RED)
    bullets = [
        "Imprima todas as páginas em A4, orientação retrato, escala 100%.",
        "Desative 'Ajustar', 'Encolher' ou 'Fit to page' na impressão.",
        "Use papel de 160 a 220 g/m². Para a base, cole sobre papelão de 1 mm.",
        "Linha preta contínua: cortar. Linha azul tracejada: vincar e dobrar.",
        "Faça um teste de encaixe sem cola antes da montagem definitiva.",
    ]
    for index, item in enumerate(bullets, 1):
        c.setFillColor(GOLD)
        c.circle(mm(19), mm(195 - (index - 1) * 13), mm(3.2), fill=1, stroke=0)
        text(c, str(index), 19, 193.5 - (index - 1) * 13, 7, True, colors.white, "center")
        text(c, item, 27, 193.5 - (index - 1) * 13, 8.5)

    text(c, "ORDEM DE MONTAGEM", 16, 125, 13, True, DARK_RED)
    assembly = [
        ("1", "Base"), ("2", "Terraço inferior"), ("3", "Terraço intermediário"),
        ("4", "Terraço superior"), ("5", "Salão"), ("6", "Beiral inferior"),
        ("7", "Faixa superior"), ("8", "Cobertura imperial"),
    ]
    for index, (step, name) in enumerate(assembly):
        col = index % 2
        row = index // 2
        x = 20 + col * 92
        y = 108 - row * 17
        c.setFillColor(MARBLE if index < 4 else RED if index in [4, 6] else GOLD)
        c.roundRect(mm(x), mm(y), mm(10), mm(10), mm(2), fill=1, stroke=0)
        text(c, step, x + 5, y + 2.8, 7, True, INK, "center")
        text(c, name, x + 14, y + 2.8, 8.2, index in [4, 7])

    # Quadrado de calibração obrigatório.
    c.setFillColor(colors.white)
    c.setStrokeColor(CUT)
    c.setLineWidth(mm(0.5))
    c.rect(mm(16), mm(20), mm(50), mm(50), fill=1, stroke=1)
    text(c, "TESTE DE ESCALA", 41, 47, 8, True, DARK_RED, "center")
    text(c, "Este quadrado deve", 41, 40, 7, False, INK, "center")
    text(c, "medir 50 × 50 mm", 41, 35, 7, True, INK, "center")
    text(c, "Modelo autoral simplificado para uso educacional.", 194, 26, 7, False, colors.HexColor("#6D6257"), "right")
    text(c, "Referências: Palace Museum e Visit Beijing.", 194, 20, 7, False, colors.HexColor("#6D6257"), "right")
    c.showPage()


def base_page(c: canvas.Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    x, y, w, h = 10, 13.5, 190, 270
    c.setFillColor(colors.HexColor("#D5D0C6"))
    c.setStrokeColor(CUT)
    c.setLineWidth(mm(0.45))
    c.rect(mm(x), mm(y), mm(w), mm(h), fill=1, stroke=1)
    marble_pattern(c, x, y, w, h)
    # Guias de centralização das três plataformas.
    for pw, pd, name in [(166, 220, "02"), (150, 180, "03"), (136, 140, "04")]:
        px = 105 - pw / 2
        py = 148.5 - pd / 2
        line(c, px, py, px + pw, py, "glue")
        line(c, px + pw, py, px + pw, py + pd, "glue")
        line(c, px + pw, py + pd, px, py + pd, "glue")
        line(c, px, py + pd, px, py, "glue")
    text(c, "01 · BASE 190 × 270 mm", 105, 288, 6.5, True, DARK_RED, "center")
    c.showPage()


def stairs_page(c: canvas.Canvas) -> None:
    page_title(c, 6, "Escadarias", "Nove rampas: três para cada nível do terraço")
    configs = [(8, "A"), (8, "B"), (10, "C")]
    for row, (height, prefix) in enumerate(configs):
        for col in range(3):
            x = 22 + col * 62
            y = 210 - row * 70
            draw_stair_net(c, x, y, 28, 24, height, f"{prefix}{col + 1}")
    text(c, "Cole A1-A3 no terraço inferior, B1-B3 no intermediário e C1-C3 no superior.",
         105, 24, 8, True, DARK_RED, "center")
    c.showPage()


def hall_page(c: canvas.Canvas) -> None:
    page_title(c, 7, "Salão principal", "Paredes com pilares impressos · 11 vãos na fachada e 5 nas laterais")
    # Piso/teto estrutural.
    c.setFillColor(colors.HexColor("#7F1F1C"))
    c.rect(mm(43), mm(188), mm(124), mm(68), fill=1, stroke=1)
    text(c, "H0 · PISO DO SALÃO", 105, 263, 6.5, True, DARK_RED, "center")
    # Paredes frontal e traseira.
    draw_wall(c, 43, 134, 116, 32, "H1 · FRENTE", True)
    draw_wall(c, 43, 84, 116, 32, "H2 · FUNDO", True)
    # Laterais.
    draw_wall(c, 20, 32, 60, 32, "H3 · OESTE")
    draw_wall(c, 118, 32, 60, 32, "H4 · LESTE")
    text(c, "Cole as paredes ao redor de H0, mantendo a fachada H1 voltada para as escadas.",
         105, 18, 7.5, True, DARK_RED, "center")
    c.showPage()


def upper_band_page(c: canvas.Canvas) -> None:
    page_title(c, 9, "Faixa superior e ornamentos", "Corpo curto entre os dois beirais · balaustradas opcionais")
    draw_wall(c, 48, 218, 106, 18, "U1 · FRENTE", True)
    draw_wall(c, 48, 176, 106, 18, "U2 · FUNDO", True)
    draw_wall(c, 22, 134, 48, 18, "U3 · OESTE")
    draw_wall(c, 138, 134, 48, 18, "U4 · LESTE")

    # Balaustradas simplificadas: cortar como tiras e colar nas bordas dos terraços.
    lengths = [132, 116, 100, 84]
    for index, length in enumerate(lengths):
        x = 105 - length / 2
        y = 103 - index * 18
        c.setFillColor(MARBLE)
        c.rect(mm(x), mm(y), mm(length), mm(10), fill=1, stroke=1)
        for post in range(0, int(length), 8):
            line(c, x + post, y + 2, x + post, y + 9, "glue", 0.2)
        text(c, f"R{index + 1}", x - 3, y + 3.1, 5.2, True, DARK_RED, "right")
    c.showPage()


def final_page(c: canvas.Canvas) -> None:
    page_title(c, 11, "Montagem final", "Leia uma vez antes de usar cola")
    stages = [
        ("1", "Reforce e recorte a base 01."),
        ("2", "Dobre e feche os terraços 02, 03 e 04. Centralize pelas linhas-guia."),
        ("3", "Monte as nove rampas e alinhe três em cada frente."),
        ("4", "Feche o salão H1-H4 sobre o piso H0."),
        ("5", "Una as quatro faces do telhado L usando as abas internas."),
        ("6", "Monte U1-U4 sobre o telhado L e centralize."),
        ("7", "Una as faces do telhado T e finalize com a cumeeira."),
        ("8", "Faça o encaixe a seco; só depois cole todos os módulos."),
    ]
    for index, (step, instruction) in enumerate(stages):
        y = 247 - index * 26
        c.setFillColor(GOLD if index >= 4 else MARBLE_2)
        c.circle(mm(24), mm(y + 1), mm(7), fill=1, stroke=0)
        text(c, step, 24, y - 1.3, 10, True, INK, "center")
        text(c, instruction, 38, y - 1.5, 9, index in [0, 3, 7])
        if index < len(stages) - 1:
            line(c, 24, y - 7, 24, y - 18, "glue")

    c.setFillColor(colors.HexColor("#F2E6C5"))
    c.roundRect(mm(15), mm(18), mm(180), mm(28), mm(3), fill=1, stroke=0)
    text(c, "DICA", 24, 35, 8, True, DARK_RED)
    text(c, "Vinque as dobras com régua e ponta sem corte antes de dobrar.", 42, 35, 8.2, True)
    text(c, "Use pouca cola e prendedores até secar para evitar ondulações.", 42, 27, 8.2)
    c.showPage()


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Maquete de papel A4 - Salão da Suprema Harmonia")
    c.setAuthor("ObrasFlow")
    c.setSubject("Papercraft original para imprimir, recortar, dobrar e colar")

    cover(c)
    base_page(c)
    platform_page(c, 3, "Terraço inferior", 166, 220, 8, MARBLE_2)
    platform_page(c, 4, "Terraço intermediário", 150, 180, 8, MARBLE)
    platform_page(c, 5, "Terraço superior", 136, 140, 10, MARBLE_2)
    stairs_page(c)
    hall_page(c)
    roof_page(c, 8, "Beiral inferior", 148, 88, 68, 48, "L")
    upper_band_page(c)
    roof_page(c, 10, "Cobertura imperial", 132, 78, 58, 43, "T")
    final_page(c)
    c.save()
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    build()
