/*
  clay_text.js - Escribe cualquier texto con el alfabeto de plastilina.

  Necesita glyphs/glyphs.js (lo genera cut_alphabet.py) cargado antes:
    <script src="glyphs/glyphs.js"></script>
    <script src="clay_text.js"></script>

  Uso:
    ClayText.render(elemento, "emil_mr09", { size: 90, maxWidth: 900, animate: true });

  Opciones:
    size      alto de las mayúsculas en px (default 90)
    maxWidth  ancho máximo; si el texto no cabe, se achica solo
    animate   las letras caen una por una a saltos (stop-motion)
    jitter    cuánto "a mano" se ve: 0 = recto, 1 = normal, 2 = muy torcido
    tracking  espacio extra entre letras, en fracción del tamaño (default 0.02)
    folder    carpeta de las imágenes (default "glyphs/"); puede ser una URL de internet
    color     color de la plastilina: bone, cocoa, red, blue, yellow, pink, sage
              o un hex como "#5B4743" (default bone)

  Las letras vienen en gris (solo el relieve) y aquí se pintan todas con la misma luz.

  Sin glyphs.js cargado antes (por ejemplo en Streamlabs):
    ClayText.load("https://.../glyphs/").then(() => ClayText.render(el, "hola", {...}))
*/
(function () {
  const G = () => window.CLAY_GLYPHS;

  // número pseudoaleatorio estable: el mismo texto siempre se ve igual
  function rand(seed) {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hash(str) {
    let h = 2166136261;
    for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return h >>> 0;
  }

  // á -> a, ñ -> n, Ü -> U ... ; si no existe en minúscula prueba mayúscula y al revés
  function lookup(ch) {
    const g = G().glyphs;
    if (g[ch]) return g[ch];
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (g[base]) return g[base];
    if (g[base.toUpperCase()]) return g[base.toUpperCase()];
    if (g[base.toLowerCase()]) return g[base.toLowerCase()];
    return null;
  }

  // ---- color: mapa de degradado (sombra -> color -> brillo) aplicado al gris ----
  const COLORS = { bone: "#EFE3D3", cocoa: "#6B5550", red: "#E8322B", blue: "#2E8BF0",
                   yellow: "#F5D326", pink: "#D9A0A8", sage: "#7FB77E" };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function tintFilter(color) {
    const c = (COLORS[color] || color || COLORS.bone).replace(/^([0-9a-f]{6})$/i, "#$1");
    const id = "clay-tint-" + c.slice(1).toLowerCase();
    if (document.getElementById(id)) return id;
    const base = hex(c);
    const shadow = base.map(v => v * 0.38);
    const deep = base.map(v => v * 0.12);
    const high = mix(base, [1, 1, 1], 0.5);
    const N = 32, tables = [[], [], []];
    for (let k = 0; k <= N; k++) {
      const g = k / N;
      const col = g < 0.32 ? mix(deep, shadow, g / 0.32)
                : g < 0.78 ? mix(shadow, base, (g - 0.32) / 0.46)
                : mix(base, high, (g - 0.78) / 0.22);
      col.forEach((v, i) => tables[i].push(Math.min(1, Math.max(0, v)).toFixed(3)));
    }
    let svg = document.getElementById("clay-tints");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "clay-tints";
      svg.setAttribute("style", "position:absolute;width:0;height:0");
      document.body.appendChild(svg);
    }
    svg.insertAdjacentHTML("beforeend",
      `<filter id="${id}" color-interpolation-filters="sRGB"><feComponentTransfer>` +
      ["R", "G", "B"].map((ch, i) => `<feFunc${ch} type="table" tableValues="${tables[i].join(" ")}"/>`).join("") +
      `</feComponentTransfer></filter>`);
    return id;
  }

  // carga glyphs.js desde una carpeta o URL (para cuando no se puede poner <script> antes)
  function load(folder) {
    if (window.CLAY_GLYPHS) return Promise.resolve();
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = folder.replace(/\/?$/, "/") + "glyphs.js";
      s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }

  function render(el, text, opts = {}) {
    const o = Object.assign({ size: 90, maxWidth: 0, animate: false, jitter: 1, tracking: 0.02, folder: "glyphs/", color: "bone" }, opts);
    o.folder = o.folder.replace(/\/?$/, "/");
    const data = G();
    if (!data) { el.textContent = text; return; }
    const k = o.size / data.cap;
    const tint = tintFilter(o.color);                 // de px del alfabeto a px en pantalla
    const seed = hash(text);
    el.innerHTML = "";
    el.style.display = "inline-flex";
    el.style.alignItems = "flex-end";
    el.style.whiteSpace = "nowrap";
    el.style.paddingBottom = Math.round(0.25 * o.size) + "px";   // espacio para g, p, y...
    el.style.filter = `drop-shadow(${0.03 * o.size}px ${0.05 * o.size}px ${0.05 * o.size}px rgba(0,0,0,.35))`;

    const seen = {};
    let i = 0;
    for (const ch of text) {
      i++;
      if (ch === " ") {
        const sp = document.createElement("span");
        sp.style.display = "inline-block";
        sp.style.width = 0.35 * o.size + "px";
        el.appendChild(sp);
        continue;
      }
      const vars = lookup(ch);
      if (!vars) {                               // carácter que no está en el alfabeto
        const t = document.createElement("span");
        t.textContent = ch;
        t.style.cssText = `font:700 ${0.8 * o.size}px/1 system-ui,sans-serif;color:${COLORS[o.color] || o.color};margin:0 ${0.04 * o.size}px`;
        el.appendChild(t);
        continue;
      }
      // las letras repetidas alternan variante (si hay _v2, _v3...)
      seen[ch] = (seen[ch] || 0) + 1;
      const g = vars[(seen[ch] - 1 + (seed % vars.length)) % vars.length];

      const img = document.createElement("img");
      img.src = o.folder + g.file;
      img.alt = ch;
      img.draggable = false;
      const r1 = rand(seed + i * 7), r2 = rand(seed + i * 13);
      const rot = (r1 - 0.5) * 6 * o.jitter;     // ±3°
      const dy = (r2 - 0.5) * 0.05 * o.size * o.jitter;
      img.style.cssText = `height:${g.h * k}px;width:${g.w * k}px;display:block;flex:none;` +
        `margin:0 ${o.tracking * o.size}px ${-g.drop * k}px;` +
        `transform:translateY(${dy}px) rotate(${rot}deg);transform-origin:50% 80%;filter:url(#${tint})`;
      if (o.animate) {
        img.style.opacity = "0";
        img.animate(
          [{ opacity: 0, transform: `translateY(${-0.6 * o.size}px) rotate(${rot}deg)` },
           { opacity: 1, transform: `translateY(${dy + 0.06 * o.size}px) rotate(${rot}deg) scale(1.06,.92)` },
           { opacity: 1, transform: `translateY(${dy}px) rotate(${rot}deg)` }],
          { duration: 360, delay: i * 70, easing: "steps(4, end)", fill: "forwards" });
      }
      el.appendChild(img);
    }

    // achicar si no cabe
    if (o.maxWidth) {
      requestAnimationFrame(() => {
        const w = el.scrollWidth;
        if (w > o.maxWidth) render(el, text, Object.assign({}, o, { size: o.size * o.maxWidth / w * 0.98, maxWidth: 0 }));
      });
    }
  }

  window.ClayText = { render, load, COLORS };
})();
