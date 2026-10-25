#!/usr/bin/env python3
"""
cut_alphabet.py - Corta las hojas del alfabeto de plastilina en letras sueltas.

Uso:
  python cut_alphabet.py hojas glyphs

  hojas/   upper_1, upper_2, upper_3, lower_1, lower_2, lower_3, digits, symbols
           (.png o .jpg). Variantes opcionales: upper_1_v2.png, upper_1_v3.png...
  glyphs/  salida: un PNG transparente por carácter + glyphs.json con las medidas

Qué hace:
  - Quita el fondo gris (y la sombra horneada) sin IA: separa por calidez del color
    (la plastilina es cálida incluso en su borde oscuro; fondo y sombra son grises).
  - Asigna cada pieza a su celda de la cuadrícula 3x3 (los puntos de i, j, ! y ? van con su letra).
  - Iguala la escala entre hojas: mayúsculas y números a la misma altura,
    minúsculas con la misma altura de x, y guarda cuánto baja cada letra
    bajo la línea base (g, j, p, q, y, el guion bajo...).

Requisitos: pip install numpy pillow scipy
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CAP = 220          # alto final de una mayúscula, en px

SHEETS = {
    "upper_1": "ABCDEFGHI",
    "upper_2": "JKLMNOPQR",
    "upper_3": "STUVWXYZ",
    "lower_1": "abcdefghi",
    "lower_2": "jklmnopqr",
    "lower_3": "stuvwxyz",
    "digits":  "012345678",
    "symbols": "9_.!?-@&#",
}
DESCENDERS = set("gjpqy_")          # no cuentan para calcular la línea base
NOT_BASE = DESCENDERS | set(".-@")  # tampoco estos (punto y guion no marcan la base)
XHEIGHT = set("acemnorsuvwxz")      # minúsculas sin ascendente ni descendente
FILENAMES = {"_": "underscore", ".": "period", "!": "exclam", "?": "question",
             "-": "hyphen", "@": "at", "&": "amp", "#": "hash"}


def glyph_name(ch):
    if ch in FILENAMES:
        return FILENAMES[ch]
    if ch.isupper():
        return f"U_{ch}"          # Windows no distingue A.png de a.png
    if ch.islower():
        return f"L_{ch}"
    return ch


def cut_sheet(path, chars):
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    H, W, _ = img.shape
    L = img.mean(2)
    ch_, cw = H / 3, W / 3

    # fondo por celda: mediana del borde de cada celda (aguanta celdas de gris distinto)
    bg = np.zeros((H, W), np.float32)
    bg_rgb = np.zeros((H, W, 3), np.float32)
    for r in range(3):
        for c in range(3):
            y0, y1, x0, x1 = int(r * ch_), int((r + 1) * ch_), int(c * cw), int((c + 1) * cw)
            m = max(4, int(min(ch_, cw) * 0.04))
            border = np.concatenate([img[y0:y0 + m, x0:x1].reshape(-1, 3), img[y1 - m:y1, x0:x1].reshape(-1, 3),
                                     img[y0:y1, x0:x0 + m].reshape(-1, 3), img[y0:y1, x1 - m:x1].reshape(-1, 3)])
            med = np.median(border, 0)
            bg_rgb[y0:y1, x0:x1] = med
            bg[y0:y1, x0:x1] = med.mean()

    # 1. máscara de la plastilina.
    #    El fondo y la sombra proyectada son grises neutros; la plastilina es cálida (R > B),
    #    incluso en su borde oscuro. Se separa por calidez + brillo, creciendo desde lo seguro.
    scale_px = max(1, round(min(H, W) / 1024))
    warm = (img[..., 0] - img[..., 2]) - (bg_rgb[..., 0] - bg_rgb[..., 2])
    diff = L - bg
    seed = (diff > 40) | (warm > 14)                      # seguro: plastilina
    seed = ndi.binary_opening(seed, iterations=scale_px)
    # el borde oscuro de la letra es fino: los píxeles oscuros solo cuentan pegados a la letra
    near_wide = ndi.binary_dilation(seed, iterations=4 * scale_px)
    near_thin = ndi.binary_dilation(seed, iterations=2 * scale_px)
    cand = ((diff > 15) & near_wide) | ((warm >= 7) & near_thin)
    solid = ndi.binary_propagation(seed, mask=cand | seed)
    solid = ndi.binary_closing(solid, iterations=scale_px)
    # rellenar huecos pequeños (pliegues dentro de la letra), no los grandes (el hueco de la o)
    holes = ndi.binary_fill_holes(solid) & ~solid
    lab, n = ndi.label(holes)
    if n:
        idx = np.arange(1, n + 1)
        sizes = ndi.sum(holes, lab, idx)
        hole_warm = ndi.mean(warm, lab, idx)            # pliegue de plastilina = cálido; hueco de fondo = gris
        hole_diff = ndi.mean(diff, lab, idx)             # más oscuro que el fondo = sombra, no plastilina
        crease = (sizes < H * W * 0.00005) | ((sizes < H * W * 0.0015) & (hole_warm > 5) & (hole_diff > 0))
        solid |= np.isin(lab, idx[crease])

    # 2. borde suave (antialias) sin comerse la letra: se difumina la máscara, no el color
    alpha = ndi.gaussian_filter(solid.astype(np.float32), sigma=0.7 * scale_px)
    alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)
    a = alpha[..., None]
    rgb = np.where(a > 0.02, (img - (1 - a) * bg_rgb) / np.maximum(a, 0.02), 0)
    rgb = np.where(a > 0.85, img, rgb)                    # dentro de la letra: color original
    rgb = np.clip(rgb, 0, 255)

    # 3. piezas -> celdas por su centro
    lab, n = ndi.label(alpha > 0.3)
    cells = {i: [] for i in range(9)}
    min_area = H * W * 0.00015
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        piece = lab[sl] == i
        if piece.sum() < min_area:
            continue
        cy, cx = ndi.center_of_mass(piece)
        cy += sl[0].start
        cx += sl[1].start
        idx = min(2, int(cy // ch_)) * 3 + min(2, int(cx // cw))
        cells[idx].append(i)

    out = []
    for idx, ch in enumerate(chars):
        ids = cells[idx]
        if not ids:
            print(f"  [aviso] {path.name}: no encontré '{ch}' en la celda {idx + 1}")
            continue
        mask = np.isin(lab, ids)
        mask = ndi.binary_dilation(mask, iterations=3)
        ys, xs = np.where(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        g_a = (alpha * mask)[y0:y1, x0:x1]
        g_rgb = rgb[y0:y1, x0:x1]
        out.append({"ch": ch, "row": idx // 3, "rgba": np.dstack([g_rgb, g_a * 255]),
                    "top": y0, "bottom": y1, "h": y1 - y0})
    return out


def main(src, dst):
    src, dst = Path(src), Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for old in dst.glob("*.png"):
        old.unlink()

    files = sorted(p for p in src.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    groups = {}
    for p in files:
        m = re.fullmatch(r"(upper_[123]|lower_[123]|digits|symbols)(?:_v(\d+))?", p.stem)
        if not m:
            print(f"[salto] {p.name}: nombre no reconocido")
            continue
        groups.setdefault(m.group(1), []).append((int(m.group(2) or 1), p))

    sheets = []
    for key, items in groups.items():
        for var, p in sorted(items):
            print(f"[hoja] {p.name}")
            sheets.append((key, var, cut_sheet(p, SHEETS[key])))

    # escala: mayúsculas/números por su alto; minúsculas por su altura de x
    def median_h(glyphs, pred):
        hs = [g["h"] for g in glyphs if pred(g["ch"])]
        return float(np.median(hs)) if hs else None

    xh_ratio = []
    for key, var, gl in sheets:
        if key == "lower_1":
            asc = median_h(gl, lambda c: c in "bdh")
            xh = median_h(gl, lambda c: c in XHEIGHT)
            if asc and xh:
                xh_ratio.append(xh / asc)
    XH = CAP * (float(np.mean(xh_ratio)) if xh_ratio else 0.66)

    manifest = {"cap": CAP, "xheight": round(XH), "glyphs": {}}
    for key, var, gl in sheets:
        if key.startswith("upper") or key == "digits":
            ref, target = median_h(gl, lambda c: True), CAP
        elif key.startswith("lower"):
            ref, target = median_h(gl, lambda c: c in XHEIGHT), XH
        else:  # symbols: el 9 manda
            ref, target = median_h(gl, lambda c: c == "9"), CAP
        scale = target / ref

        # línea base por fila: mediana del borde inferior de las letras que no bajan
        base = {}
        for r in range(3):
            bots = [g["bottom"] for g in gl if g["row"] == r and g["ch"] not in NOT_BASE]
            base[r] = float(np.median(bots)) if bots else None
        if base.get(0) is None and key == "symbols":
            base[0] = None

        for g in gl:
            b = base.get(g["row"])
            if b is None:  # fila sin referencia (raro): usar el borde inferior propio
                b = g["bottom"]
            drop = (g["bottom"] - b) * scale
            im = Image.fromarray(g["rgba"].round().astype(np.uint8), "RGBA")
            w = max(1, round(im.width * scale))
            h = max(1, round(im.height * scale))
            im = im.resize((w, h), Image.LANCZOS)
            name = f"{glyph_name(g['ch'])}" + (f"_v{var}" if var > 1 else "")
            im.save(dst / f"{name}.png", optimize=True)
            manifest["glyphs"].setdefault(g["ch"], []).append(
                {"file": f"{name}.png", "w": w, "h": h, "drop": round(drop, 1)})

    with open(dst / "glyphs.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    # también como .js, para abrir la página con doble clic (file://) sin servidor
    with open(dst / "glyphs.js", "w", encoding="utf-8") as f:
        f.write("window.CLAY_GLYPHS = " + json.dumps(manifest, ensure_ascii=False) + ";\n")

    found = "".join(sorted(manifest["glyphs"]))
    missing = [c for c in "".join(SHEETS.values()) if c not in manifest["glyphs"]]
    print(f"\nListo: {len(manifest['glyphs'])} caracteres en {dst}")
    print("Faltan: " + ("".join(missing) if missing else "ninguno"))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
