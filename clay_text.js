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
    folder    carpeta de las imágenes (default "glyphs/")
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

  function render(el, text, opts = {}) {
    const o = Object.assign({ size: 90, maxWidth: 0, animate: false, jitter: 1, tracking: 0.02, folder: "glyphs/" }, opts);
    const data = G();
    if (!data) { el.textContent = text; return; }
    const k = o.size / data.cap;                 // de px del alfabeto a px en pantalla
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
        t.style.cssText = `font:700 ${0.9 * o.size}px/1 system-ui,sans-serif;color:#EFE3D3;margin:0 ${0.04 * o.size}px`;
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
        `transform:translateY(${dy}px) rotate(${rot}deg);transform-origin:50% 80%`;
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

  window.ClayText = { render };
})();
