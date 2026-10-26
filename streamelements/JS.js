// Alertas con letras de plastilina para StreamElements (Custom Widget) — v6
// Este archivo trae TODO: el HTML y el CSS se crean desde aquí.
// Las pestañas HTML y CSS del editor pueden quedar vacías.
// Todo se configura en el panel de la izquierda (campos); aquí no hay que tocar nada.
const VERSION = "clay-alerts v6";
// valores por defecto, por si algún campo no existe todavía en tu panel
const DEF = {"alertWidth": 700, "duration": 6, "volume": 50, "nameColor": "cocoa", "nameSize": 60, "amountColor": "red", "amountSize": 44, "amountGap": 6, "jitter": 1, "showMessage": "yes", "messageSize": 24, "messageColor": "#EFE3D3", "messageStrokeColor": "#5B4743", "messageStroke": 6, "messageAlign": "center", "dialogWidth": 80, "dialogLeft": 18, "dialogGap": 4, "typeSpeed": 35, "maxChars": 300, "followOn": "yes", "followAmount": "no", "followNameX": 58, "followNameY": 50, "followNameW": 62, "subOn": "yes", "subAmount": "yes", "subDialog": "yes", "subNameX": 58, "subNameY": 50, "subNameW": 62, "subPrefix": "", "subSuffix": " meses", "subSuffixOne": " mes", "tipOn": "yes", "tipAmount": "yes", "tipDialog": "yes", "tipNameX": 58, "tipNameY": 50, "tipNameW": 62, "tipPrefix": "$", "tipSuffix": "", "tipMin": 1, "cheerOn": "yes", "cheerAmount": "yes", "cheerDialog": "yes", "cheerNameX": 58, "cheerNameY": 50, "cheerNameW": 62, "cheerPrefix": "", "cheerSuffix": " bits", "cheerSuffixOne": " bit", "cheerMin": 1, "raidOn": "yes", "raidAmount": "yes", "raidNameX": 58, "raidNameY": 50, "raidNameW": 62, "raidPrefix": "", "raidSuffix": " raiders", "raidSuffixOne": " raider", "raidMin": 1};
let F = {};
const queue = [];
let busy = false;

const EVENTS = {
  "follower-latest":   "follow",
  "subscriber-latest": "sub",
  "tip-latest":        "tip",
  "cheer-latest":      "cheer",
  "raid-latest":       "raid",
};

function buildPage() {
  const style = document.createElement("style");
  style.textContent = `@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap");
html, body { margin: 0; background: transparent; overflow: hidden; }
#stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
#alert {
  position: relative; width: ${F.alertWidth}px; opacity: 0; transform: translateY(40px);
  transition: opacity .25s steps(3), transform .35s steps(4);
}
#alert.show { opacity: 1; transform: none; }
/* sin imagen la alerta igual tiene alto, para que el texto no se amontone arriba */
#alert:not(.has-media) { aspect-ratio: 3 / 1; }
#media-img, #media-vid { display: none; width: 100%; height: auto; }
#label-box {
  position: absolute; left: var(--nx); top: var(--ny); width: var(--nw);
  transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: ${F.amountGap}px;
}
#label-box > div { display: flex !important; justify-content: center; position: static !important; }
#clay-amount:empty { display: none !important; }

/* ---- mensaje: texto suelto debajo de la placa, sin caja ---- */
#dialog {
  position: absolute; top: calc(100% + ${F.dialogGap}px); left: ${F.dialogLeft}%; width: ${F.dialogWidth}%;
  opacity: 0; transition: opacity .15s steps(2);
}
#dialog.open { opacity: 1; }
#dialog-inner { overflow: hidden; height: 0; transition: height .12s steps(2); }
#dialog-text {
  font: 600 ${F.messageSize}px/1.35 "Fredoka", sans-serif; color: ${F.messageColor};
  text-align: ${F.messageAlign}; overflow-wrap: anywhere;
  /* contorno del mismo café que los marcos + sombra, para leerse sobre cualquier fondo */
  -webkit-text-stroke: ${F.messageStroke}px ${F.messageStrokeColor}; paint-order: stroke fill;
  text-shadow: 0 3px 0 ${F.messageStrokeColor}, 0 6px 10px rgba(0,0,0,.35);
  padding-bottom: 8px;
}
#dialog-text img { height: 1.3em; vertical-align: -0.3em; }
`;
  document.head.appendChild(style);
  document.body.innerHTML = `<div id="stage">
  <div id="alert">
    <img id="media-img" alt="">
    <video id="media-vid" muted playsinline></video>
    <div id="label-box">
      <div id="clay-name"></div>
      <div id="clay-amount"></div>
    </div>
    <div id="dialog"><div id="dialog-inner"><div id="dialog-text"></div></div></div>
  </div>
</div>
<audio id="sound"></audio>`;
  console.log(VERSION);
}

window.addEventListener("onWidgetLoad", (obj) => {
  F = Object.assign({}, DEF, obj.detail.fieldData);
  for (const k in DEF) if (F[k] === "" || F[k] === undefined || F[k] === null) F[k] = DEF[k];
  buildPage();
  const base = (F.baseUrl || "").replace(/\/?$/, "/");
  const s = document.createElement("script");
  s.src = base + "clay_text.js";
  s.onload = () => ClayText.load(base + "glyphs/");
  document.head.appendChild(s);
});

window.addEventListener("onEventReceived", (obj) => {
  const type = EVENTS[obj.detail.listener];
  if (!type) return;
  const ev = obj.detail.event || {};
  if (F[type + "On"] === "no") return;
  if (ev.isCommunityGift) return;                       // los regalos en grupo llegan una sola vez
  if ((type === "tip" || type === "cheer" || type === "raid") && (+ev.amount || 0) < (+F[type + "Min"] || 0)) return;
  queue.push({ type, ev });
  next();
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function next() {
  if (busy || !queue.length) return;
  busy = true;
  const { type, ev } = queue.shift();
  try { await play(type, ev); } catch (e) { console.error(e); }
  busy = false;
  next();
}

async function play(type, ev) {
  const base = (F.baseUrl || "").replace(/\/?$/, "/");
  for (let i = 0; i < 50 && !(window.ClayText && window.CLAY_GLYPHS); i++) await wait(100);

  const alert = document.getElementById("alert");
  const img = document.getElementById("media-img");
  const vid = document.getElementById("media-vid");
  const snd = document.getElementById("sound");
  const media = F[type + "Media"] || "";
  const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(media);

  // 1. limpiar la alerta anterior y esconder todo mientras carga la nueva
  alert.classList.remove("show");
  img.style.display = vid.style.display = "none";
  alert.classList.toggle("has-media", !!media);
  const nameEl = document.getElementById("clay-name");
  const amountEl = document.getElementById("clay-amount");
  nameEl.innerHTML = amountEl.innerHTML = "";
  closeDialog();

  // 2. esperar a que la imagen o el video carguen: sin eso la alerta mide 0 de alto
  //    y el nombre cae en cualquier lado
  if (media && isVideo) {
    vid.src = media;
    await new Promise(r => { vid.onloadeddata = r; vid.onerror = r; setTimeout(r, 3000); });
    vid.style.display = "block"; vid.currentTime = 0; vid.play().catch(() => {});
  } else if (media) {
    img.src = media;
    await img.decode().catch(() => {});
    img.style.display = "block";
  }

  // 3. posiciones propias de este tipo de alerta (en % de la imagen)
  alert.style.setProperty("--nx", (+F[type + "NameX"]) + "%");
  alert.style.setProperty("--ny", (+F[type + "NameY"]) + "%");
  alert.style.setProperty("--nw", (+F[type + "NameW"]) + "%");
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // que se apliquen

  // 4. nombre y monto con letras de plastilina
  const box = document.getElementById("label-box");
  alert.classList.add("show");
  const common = { folder: base + "glyphs/", animate: true, jitter: +F.jitter };
  ClayText.render(nameEl, String(ev.name || ev.displayName || "").trim(),
    Object.assign({}, common, { size: +F.nameSize, maxWidth: box.clientWidth, color: F.nameColor }));

  const showAmount = F[type + "Amount"] === "yes" && ev.amount;
  if (showAmount) {
    let n = ev.amount;
    if (type === "tip") n = (+n).toFixed(2).replace(/\.00$/, "");
    const suffix = +n === 1 && F[type + "SuffixOne"] !== undefined ? F[type + "SuffixOne"] : F[type + "Suffix"];
    const text = (F[type + "Prefix"] || "") + n + (suffix || "");
    ClayText.render(amountEl, text, Object.assign({}, common, { size: +F.amountSize, color: F.amountColor }));
  }

  const sound = F[type + "Sound"];
  if (sound) { snd.src = sound; snd.volume = (+F.volume || 50) / 100; snd.currentTime = 0; snd.play().catch(() => {}); }

  // 5. mensaje en la caja de diálogo, letra por letra (después de que cae el nombre)
  const msg = F.showMessage === "yes" && F[type + "Dialog"] !== "no" ? (ev.message || "") : "";
  let typed = 0;
  if (msg.trim()) {
    const nameLen = [...String(ev.name || "")].length;
    await wait(400 + nameLen * 70);
    typed = await typeMessage(msg);
  }

  // la alerta dura lo normal + lo que tome escribir y leer el mensaje
  const extra = typed ? typed * 1000 / (+F.typeSpeed || 35) + Math.min(8000, typed * 45) : 0;
  await wait((+F.duration || 6) * 1000 + extra);
  closeDialog();
  alert.classList.remove("show");
  await wait(500);
  vid.pause();
}

// ---- caja de diálogo con texto que se va escribiendo ----
function closeDialog() {
  document.getElementById("dialog").classList.remove("open");
  const inner = document.getElementById("dialog-inner");
  inner.style.height = "0px";
  document.getElementById("dialog-text").innerHTML = "";
}

async function typeMessage(html) {
  const dialog = document.getElementById("dialog");
  const inner = document.getElementById("dialog-inner");
  const out = document.getElementById("dialog-text");

  // el mensaje trae texto y emotes (<img>); se separa en piezas para escribirlas una a una
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const pieces = [];
  (function walk(node) {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) for (const ch of n.textContent) pieces.push(ch);
      else if (n.tagName === "IMG") pieces.push(n.cloneNode());
      else walk(n);
    }
  })(tmp);
  const max = +F.maxChars || 300;
  if (pieces.length > max) { pieces.length = max; pieces.push("…"); }

  out.innerHTML = "";
  const pad = () => {   // alto = texto + relleno + borde
    const cs = getComputedStyle(inner);
    return out.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
         + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  };
  out.textContent = "\u00a0";                     // una línea vacía para abrir la caja
  inner.style.height = pad() + "px";
  dialog.classList.add("open");
  await wait(220);
  out.textContent = "";

  const delay = 1000 / (+F.typeSpeed || 35);
  let lastH = 0;
  for (const p of pieces) {
    if (typeof p === "string") out.append(p); else out.append(p);
    const h = pad();
    if (h !== lastH) { inner.style.height = h + "px"; lastH = h; }   // saltó de línea: la caja crece
    const pause = typeof p === "string" && /[.!?,]/.test(p) ? delay * 4 : delay;
    await wait(pause);
  }
  return pieces.length;
}
