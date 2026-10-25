// pestaña JS. Cambia TU_USUARIO por tu usuario de GitHub.
const BASE = "https://cdn.jsdelivr.net/gh/TU_USUARIO/clay-alphabet@v1/";
const NOMBRE = { size: 80, maxWidth: 700, animate: true, jitter: 1, color: "cocoa" };
const MONTO  = { size: 56, maxWidth: 500, animate: true, jitter: 1, color: "red" };
const PREFIJO_MONTO = "$";   // "" para bits/meses; "$" para donaciones

(function () {
  const nameEl = document.getElementById("clay-name");
  const amountEl = document.getElementById("clay-amount");
  const name = (nameEl.dataset.name || "").trim();
  const amount = (amountEl.dataset.amount || "").trim();

  function go() {
    ClayText.load(BASE + "glyphs/").then(() => {
      const folder = { folder: BASE + "glyphs/" };
      if (name) ClayText.render(nameEl, name, Object.assign(folder, NOMBRE));
      if (amount && amount !== "0" && !amount.includes("{"))
        ClayText.render(amountEl, PREFIJO_MONTO + amount, Object.assign({}, folder, MONTO));
    });
  }
  if (window.ClayText) return go();
  const s = document.createElement("script");
  s.src = BASE + "clay_text.js";
  s.onload = go;
  document.head.appendChild(s);
})();
